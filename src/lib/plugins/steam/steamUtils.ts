import { imageUrlRevision } from './steamImages';
/**
 * Liste des jeux Steam pour autocomplete
 * Cette liste est intégrée dans le build
 */

import steamListRaw from './steamList.json';

export interface SteamGame {
  appid: number;
  name: string;
}

// Export vide - sera chargée dynamiquement à runtime
export const steamGames: SteamGame[] = [];

export function getSteamAppId(raw: any): number | null {
  let value = raw;
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const id = Number(
    value && typeof value === 'object' ? (value.appid ?? value.appId ?? value.id) : value,
  );
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function getSteamImageUrl(
  appid: number | string | undefined | null,
  type: 'header' | 'capsule' | 'portrait' | 'hero' | 'logo' = 'header',
): string | null {
  if (appid === undefined || appid === null || appid === '') return null;
  const numericId = Number(appid);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) return null;
  const id = String(numericId);
  switch (type) {
    case 'portrait':
      return imageUrlRevision(
        `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`,
      );
    case 'hero':
      return imageUrlRevision(
        `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_hero.jpg`,
      );
    case 'capsule':
      return imageUrlRevision(
        `https://cdn.akamai.steamstatic.com/steam/apps/${id}/capsule_616x353.jpg`,
      );
    case 'logo':
      return imageUrlRevision(`https://cdn.akamai.steamstatic.com/steam/apps/${id}/logo.png`);
    case 'header':
    default:
      return imageUrlRevision(`https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`);
  }
}

let cachedSteamGames: SteamGame[] | null = null;

function normalizeSteamGames(raw: any): SteamGame[] {
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.applist?.apps)
      ? raw.applist.apps
      : [];

  return source
    .filter(
      (g: any) => g && typeof g.appid === 'number' && typeof g.name === 'string' && g.name.trim(),
    )
    .map((g: any) => ({ appid: g.appid, name: g.name.trim() }));
}

/**
 * Charge la liste Steam depuis le fichier JSON
 */
let loadingSteamGames: Promise<SteamGame[]> | null = null;
let catalogueGeneration = 0;
export const STEAM_CATALOGUE_CHANGED = 'steam-catalogue-changed';
export function invalidateSteamGamesList() {
  catalogueGeneration += 1;
  cachedSteamGames = null;
  loadingSteamGames = null;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STEAM_CATALOGUE_CHANGED));
}
export async function loadSteamGamesList(): Promise<SteamGame[]> {
  if (cachedSteamGames) return cachedSteamGames;
  if (loadingSteamGames) return loadingSteamGames;
  const generation = catalogueGeneration;
  loadingSteamGames = (async () => {
    for (const url of [
      `${import.meta.env.VITE_API_URL || '/api'}/plugins/steam/games`,
      '/steamList.json',
    ]) {
      try {
        const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
        if (!response.ok) continue;
        const list = normalizeSteamGames(await response.json());
        if (list.length) {
          if (generation === catalogueGeneration) cachedSteamGames = list;
          return list;
        }
      } catch {
        /* The bundled catalogue remains available offline. */
      }
    }
    const list = normalizeSteamGames(steamListRaw);
    if (generation === catalogueGeneration && list.length) cachedSteamGames = list;
    return list;
  })().finally(() => {
    if (generation === catalogueGeneration) loadingSteamGames = null;
  });
  return loadingSteamGames;
}

/**
 * Recherche les jeux Steam correspondant à une query
 */
export function searchSteamGames(
  query: string,
  games: SteamGame[],
  limit: number = 10,
): SteamGame[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  return games.filter((game) => game.name.toLowerCase().includes(lowerQuery)).slice(0, limit);
}
