import { randomUUID } from 'node:crypto';

const storageReady = new WeakMap();
export function ensureBundleStorage(pool) {
  if (!storageReady.has(pool)) {
    storageReady.set(
      pool,
      pool
        .query(
          `CREATE TABLE IF NOT EXISTS steam_public_bundles (
    id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, bundle_id TEXT NOT NULL,
    snapshot JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, bundle_id)
  )`,
        )
        .catch((error) => {
          storageReady.delete(pool);
          throw error;
        }),
    );
  }
  return storageReady.get(pool);
}

export function publicSteamGame(raw) {
  let value = raw;
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const appid = Number(value && typeof value === 'object' ? (value.appid ?? value.appId) : value);
  if (!Number.isSafeInteger(appid) || appid <= 0) return null;
  return { appid, name: typeof value?.name === 'string' ? value.name : '' };
}

const safeTypes = new Set([
  'text',
  'number',
  'date',
  'select',
  'multiselect',
  'multi_select',
  'checkbox',
  'steam',
]);
const ids = (value) =>
  (Array.isArray(value) ? value : value ? [value] : []).map((v) =>
    typeof v === 'object' ? v.id : v,
  );
const httpError = (status, message) => Object.assign(new Error(message), { status });

export function collectionBundleConfig(state) {
  const games = state.collections?.find((c) => c.plugins?.steam?.role === 'games');
  const bundles = state.collections?.find((c) => c.plugins?.steam?.role === 'bundles');
  const relations =
    games?.properties?.filter(
      (p) => p.type === 'relation' && p.relation?.targetCollectionId === bundles?.id,
    ) || [];
  return {
    gamesCollectionId: games?.id,
    bundlesCollectionId: bundles?.id,
    bundleRelationPropertyId:
      relations.find((p) => p.id === games?.plugins?.steam?.bundleRelationPropertyId)?.id ||
      (relations.length === 1 ? relations[0].id : undefined),
  };
}

export function buildPublicBundle(state, config, bundleId, canRead) {
  const games = state.collections?.find((c) => c.id === config.gamesCollectionId);
  const bundles = state.collections?.find((c) => c.id === config.bundlesCollectionId);
  const relation = games?.properties?.find(
    (p) =>
      p.id === config.bundleRelationPropertyId &&
      p.type === 'relation' &&
      p.relation?.targetCollectionId === bundles?.id,
  );
  const bundle = bundles?.items?.find((i) => i.id === bundleId);
  if (!games || !bundles || games.id === bundles.id || !relation || !bundle)
    throw httpError(400, 'Collections ou relation de bundles invalides.');
  if (!canRead(bundles.id, bundle.id)) throw httpError(403, 'Bundle non accessible.');
  const linked = games.items.filter((i) => ids(i[relation.id]).includes(bundle.id));
  if (linked.length > 2000) throw httpError(400, 'Maximum : 2 000 jeux par bundle.');
  if (linked.some((i) => !canRead(games.id, i.id) || !canRead(games.id, i.id, relation.id)))
    throw httpError(403, 'Certains jeux ne sont pas accessibles.');
  const fields = (collection, items) =>
    collection.properties
      .filter(
        (p) =>
          safeTypes.has(p.type) &&
          !p.isRelationLinkedColumn &&
          items.every((i) => canRead(collection.id, i.id, p.id)),
      )
      .map((p) => ({ id: p.id, name: p.name, type: p.type }));
  const bundleProperties = fields(bundles, [bundle]);
  const readableGameProperties = fields(games, linked);
  const steam = readableGameProperties.find((p) => p.type === 'steam');
  if (!steam) throw httpError(400, 'Un champ Steam accessible est requis.');
  const gameProperties = readableGameProperties.filter(
    (p) => p.type !== 'steam' || p.id === steam.id,
  );
  const pick = (item, props) =>
    Object.fromEntries(
      props
        .filter((p) => item[p.id] !== undefined)
        .map((p) => {
          let value = item[p.id];
          if (p.type === 'steam') {
            value = publicSteamGame(value);
          } else if (!(
            value === null ||
            ['string', 'number', 'boolean'].includes(typeof value) ||
            (Array.isArray(value) && value.every((v) => typeof v === 'string'))
          )) {
            value = null;
          }
          return [p.id, value];
        }),
    );
  const publicBundle = pick(bundle, bundleProperties);
  const titleProp =
    bundleProperties.find(
      (p) =>
        bundles.properties.find((b) => b.id === p.id)?.isTitle ||
        bundles.properties.find((b) => b.id === p.id)?.isNameField ||
        p.id === 'name' ||
        p.name === 'Nom',
    ) || bundleProperties.find((p) => p.type === 'text');
  return {
    format: 'steam-bundle-v1',
    title: String(publicBundle[titleProp?.id] || 'Bundle Steam'),
    bundleProperties,
    gameProperties,
    bundle: publicBundle,
    games: linked.filter((i) => publicSteamGame(i[steam.id])).map((i) => pick(i, gameProperties)),
    excludedGameCount: linked.filter((i) => !publicSteamGame(i[steam.id])).length,
  };
}

export function registerBundleRoutes({
  app,
  appContext: { pool, requireAuth, hasPermission, logger },
}) {
  const route = (fn) => async (req, res) => {
    try {
      await ensureBundleStorage(pool);
      await fn(req, res);
    } catch (e) {
      logger.error('[Steam bundles]', e);
      res
        .status(e.status || 500)
        .json({ error: e.status ? e.message : 'Impossible de traiter le bundle.' });
    }
  };
  const active = async (req) => {
    const org = req.auth.activeOrganization?.id;
    if (!org) throw httpError(400, 'Aucune organisation active.');
    const result = await pool.query(
      "SELECT config FROM plugin_configs WHERE organization_id = $1 AND plugin_id = 'steam' AND enabled = true",
      [org],
    );
    if (!result.rows[0]) throw httpError(403, 'Plugin Steam désactivé.');
    const saved = await pool.query(
      'SELECT data FROM app_state WHERE organization_id = $1 LIMIT 1',
      [org],
    );
    if (!saved.rows[0]) throw httpError(404, 'État sauvegardé introuvable.');
    const raw = saved.rows[0].data;
    const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const config = collectionBundleConfig(state);
    return { org, config, state };
  };
  app.get(
    '/api/plugins/steam/public-bundles',
    route(async (_req, res) => {
      const result = await pool.query(
        "SELECT id, snapshot->>'title' AS title, jsonb_array_length(snapshot->'games') AS \"gameCount\" , snapshot->'bundle' AS bundle, snapshot->'bundleProperties' AS \"bundleProperties\" FROM steam_public_bundles ORDER BY updated_at DESC LIMIT 200",
      );
      res.json(result.rows);
    }),
  );
  app.get(
    '/api/plugins/steam/public-bundles/:id',
    route(async (req, res) => {
      if (!/^[\da-f-]{36}$/i.test(req.params.id)) throw httpError(404, 'Bundle introuvable.');
      const result = await pool.query('SELECT snapshot FROM steam_public_bundles WHERE id = $1', [
        req.params.id,
      ]);
      if (!result.rows[0]) throw httpError(404, 'Bundle introuvable.');
      const snapshot = result.rows[0].snapshot;
      res.set('Cache-Control', 'no-store');
      if (req.query.format === 'json') return res.json(snapshot);
      const escape = (value) =>
        String(value).replace(
          /[&<>"']/g,
          (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
        );
      const steam = snapshot.gameProperties.find((p) => p.type === 'steam');
      res
        .type('html')
        .send(
          `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(snapshot.title)}</title><body style="font-family:system-ui;max-width:800px;margin:40px auto;padding:24px"><h1>${escape(snapshot.title)}</h1><p>${snapshot.games.length} jeux Steam partagés</p>${snapshot.games.length ? '' : '<p>Aucun jeu Steam partageable pour le moment.</p>'}<a href="?format=json" download="bundle.json">Télécharger le bundle pour l’importer</a><ul>${snapshot.games.map((g) => `<li><a href="https://store.steampowered.com/app/${Number(g[steam.id].appid)}/">${escape(g[steam.id].name || g[steam.id].appid)}</a></li>`).join('')}</ul></body></html>`,
        );
    }),
  );
  app.get(
    '/api/plugins/steam/bundles/publications',
    requireAuth,
    route(async (req, res) => {
      const { org, config } = await active(req);
      if (!hasPermission(req.auth, { collection_id: config.bundlesCollectionId }, 'can_write'))
        throw httpError(403, 'Accès refusé.');
      const result = await pool.query(
        `SELECT id, bundle_id, jsonb_array_length(snapshot->'games') AS "gameCount", COALESCE((snapshot->>'excludedGameCount')::integer, 0) AS "excludedGameCount" FROM steam_public_bundles WHERE organization_id = $1`,
        [org],
      );
      res.json(result.rows);
    }),
  );
  app.post(
    '/api/plugins/steam/bundles/:bundleId/publish',
    requireAuth,
    route(async (req, res) => {
      const { org, config, state } = await active(req);
      if (!config.bundlesCollectionId || !config.gamesCollectionId)
        throw httpError(
          400,
          'Définissez les rôles Jeux et Bundles dans les paramètres des collections.',
        );
      if (
        !hasPermission(
          req.auth,
          { collection_id: config.bundlesCollectionId, item_id: req.params.bundleId },
          'can_write',
        )
      )
        throw httpError(403, 'Accès refusé.');
      const snapshot = buildPublicBundle(
        state,
        config,
        req.params.bundleId,
        (collection_id, item_id, field_id) =>
          hasPermission(req.auth, { collection_id, item_id, field_id }, 'can_read') &&
          (!field_id ||
            hasPermission(req.auth, { collection_id, item_id: null, field_id }, 'can_read')),
      );
      const saved = await pool.query(
        `INSERT INTO steam_public_bundles (id, organization_id, bundle_id, snapshot) VALUES ($1,$2,$3,$4)
      ON CONFLICT (organization_id, bundle_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = NOW() RETURNING id`,
        [randomUUID(), org, req.params.bundleId, JSON.stringify(snapshot)],
      );
      res.json(saved.rows[0]);
    }),
  );
  app.delete(
    '/api/plugins/steam/bundles/publications/:id',
    requireAuth,
    route(async (req, res) => {
      const { org, config } = await active(req);
      const found = await pool.query(
        'SELECT bundle_id FROM steam_public_bundles WHERE id::text = $1 AND organization_id = $2',
        [req.params.id, org],
      );
      if (!found.rows[0]) throw httpError(404, 'Publication introuvable.');
      if (
        !hasPermission(
          req.auth,
          { collection_id: config.bundlesCollectionId, item_id: found.rows[0].bundle_id },
          'can_write',
        )
      )
        throw httpError(403, 'Accès refusé.');
      await pool.query(
        'DELETE FROM steam_public_bundles WHERE id::text = $1 AND organization_id = $2',
        [req.params.id, org],
      );
      res.json({ success: true });
    }),
  );
}
