import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const STEAM_CATALOGUE_PATH = path.join(root, 'public/steamList.json');
const bundledPath = path.join(root, 'src/lib/plugins/steam/steamList.json');
export function normalizeSteamCatalogue(raw) {
  const apps = Array.isArray(raw) ? raw : raw?.applist?.apps || [];
  return [
    ...new Map(
      apps
        .filter(
          (app) =>
            Number.isSafeInteger(app?.appid) &&
            app.appid > 0 &&
            typeof app.name === 'string' &&
            app.name.trim(),
        )
        .map((app) => [app.appid, { appid: app.appid, name: app.name.trim() }]),
    ).values(),
  ].sort((a, b) => a.appid - b.appid);
}
export async function readSteamCatalogue() {
  for (const file of [STEAM_CATALOGUE_PATH, bundledPath]) {
    try {
      const games = normalizeSteamCatalogue(JSON.parse(await fs.readFile(file, 'utf8')));
      if (games.length) return games;
    } catch {
      /* use the next local copy */
    }
  }
  return [];
}
export async function fetchSteamCatalogue(key, fetchImpl = fetch) {
  if (!key) throw new Error('STEAM_API_KEY manquante sur le serveur.');
  const apps = [];
  let lastAppid = 0;
  for (let page = 0; page < 100; page += 1) {
    const input = {
      include_games: true,
      include_dlc: false,
      include_software: false,
      include_videos: false,
      include_hardware: false,
      max_results: 50000,
      ...(lastAppid ? { last_appid: lastAppid } : {}),
    };
    const url = new URL('https://api.steampowered.com/IStoreService/GetAppList/v1/');
    url.searchParams.set('key', key);
    url.searchParams.set('input_json', JSON.stringify(input));
    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(30000) });
    } catch {
      throw new Error('Steam est injoignable. La liste précédente est conservée.');
    }
    if (!response.ok)
      throw new Error(`Steam a répondu ${response.status}. La liste précédente est conservée.`);
    let body;
    try {
      body = (await response.json())?.response;
    } catch {
      throw new Error('Réponse Steam invalide. La liste précédente est conservée.');
    }
    if (!Array.isArray(body?.apps))
      throw new Error('Réponse Steam invalide. La liste précédente est conservée.');
    apps.push(...body.apps);
    if (!body.have_more_results) {
      const games = normalizeSteamCatalogue(apps);
      if (!games.length) throw new Error('Aucun jeu reçu. La liste précédente est conservée.');
      return games;
    }
    if (!body.apps.length || !Number.isSafeInteger(body.last_appid) || body.last_appid <= lastAppid)
      throw new Error('Pagination Steam invalide. La liste précédente est conservée.');
    lastAppid = body.last_appid;
  }
  throw new Error('La liste Steam est incomplète. La liste précédente est conservée.');
}
export async function writeSteamCatalogue(games, output = STEAM_CATALOGUE_PATH) {
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, JSON.stringify({ applist: { apps: games } }));
    await fs.rename(temporary, output);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
}
export function registerCatalogueRoutes({ app, appContext: { requireAuth, logger } }) {
  let refreshing = false;
  const admin = (req, res, next) =>
    req.auth.roles?.some((role) => role.name === 'admin')
      ? next()
      : res
          .status(403)
          .json({ error: 'Seul un administrateur peut actualiser le catalogue Steam.' });
  app.get('/api/plugins/steam/games', requireAuth, async (_req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      res.json(await readSteamCatalogue());
    } catch {
      res.status(500).json({ error: 'Liste Steam indisponible.' });
    }
  });
  app.post('/api/plugins/steam/games/refresh', requireAuth, admin, async (_req, res) => {
    if (refreshing)
      return res.status(409).json({ error: 'Une mise à jour Steam est déjà en cours.' });
    if (!process.env.STEAM_API_KEY)
      return res.status(503).json({ error: 'STEAM_API_KEY manquante sur le serveur.' });
    refreshing = true;
    try {
      const games = await fetchSteamCatalogue(process.env.STEAM_API_KEY);
      await writeSteamCatalogue(games);
      res.json({ count: games.length, updatedAt: new Date().toISOString() });
    } catch (error) {
      logger.error('[Steam catalogue] Refresh failed');
      res.status(502).json({
        error: error.message?.includes('Steam')
          ? error.message
          : 'Mise à jour impossible. La liste précédente est conservée.',
      });
    } finally {
      refreshing = false;
    }
  });
}
