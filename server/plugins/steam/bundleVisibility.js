import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { buildPublicBundle, collectionBundleConfig, ensureBundleStorage } from './bundles.js';

/** Default visibility applies only to new items. Existing public snapshots follow saved changes. */
export async function syncPublicBundlesAfterSave({ appContext, auth, previousState, state }) {
  const { pool, hasPermission, logger } = appContext;
  const organizationId = auth.activeOrganization?.id;
  const config = collectionBundleConfig(state);
  if (
    !organizationId ||
    !config.gamesCollectionId ||
    !config.bundlesCollectionId ||
    !config.bundleRelationPropertyId
  )
    return;
  const current = state.collections.find((c) => c.id === config.bundlesCollectionId);
  const previous = previousState?.collections?.find((c) => c.id === current.id);
  const games = state.collections.find((c) => c.id === config.gamesCollectionId);
  const previousGames = previousState?.collections?.find((c) => c.id === games.id);
  if (JSON.stringify([current, games]) === JSON.stringify([previous, previousGames])) return;
  const settings = await pool.query(
    "SELECT config FROM plugin_configs WHERE organization_id = $1 AND plugin_id = 'steam' AND enabled = true",
    [organizationId],
  );
  if (!settings.rows[0]) return;
  const defaultPublic = settings.rows[0].config?.bundlesPublicByDefault === true;
  await ensureBundleStorage(pool);
  const published = await pool.query(
    'SELECT bundle_id, snapshot FROM steam_public_bundles WHERE organization_id = $1',
    [organizationId],
  );
  const existing = new Map(published.rows.map((row) => [row.bundle_id, row.snapshot]));
  const previousIds = new Set((previous?.items || []).map((item) => item.id));
  for (const item of current.items || []) {
    const alreadyPublished = existing.has(item.id);
    if (!alreadyPublished && (!defaultPublic || previousIds.has(item.id))) continue;
    if (!hasPermission(auth, { collection_id: current.id, item_id: item.id }, 'can_write'))
      continue;
    try {
      const snapshot = buildPublicBundle(
        state,
        config,
        item.id,
        (collection_id, item_id, field_id) =>
          hasPermission(auth, { collection_id, item_id, field_id }, 'can_read') &&
          (!field_id ||
            hasPermission(auth, { collection_id, item_id: null, field_id }, 'can_read')),
      );
      if (alreadyPublished && isDeepStrictEqual(snapshot, existing.get(item.id))) continue;
      if (alreadyPublished) {
        // Never recreate a publication that was concurrently made private.
        await pool.query(
          'UPDATE steam_public_bundles SET snapshot = $1, updated_at = NOW() WHERE organization_id = $2 AND bundle_id = $3',
          [JSON.stringify(snapshot), organizationId, item.id],
        );
      } else {
        await pool.query(
          'INSERT INTO steam_public_bundles (id, organization_id, bundle_id, snapshot) VALUES ($1,$2,$3,$4) ON CONFLICT (organization_id, bundle_id) DO NOTHING',
          [randomUUID(), organizationId, item.id, JSON.stringify(snapshot)],
        );
      }
    } catch (error) {
      logger.error('[Steam bundles] Automatic publication failed', { bundleId: item.id, error });
    }
  }
}
