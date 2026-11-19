import { mergePersistentHistory } from '../services/persistentHistory.js';
/** Persistent personal UI state and organization-owned item history. */
export const isSharedStorageKey = (key) => key.startsWith('erp-item-versions:') || key === 'erp:steam-images-revision';
export function validStorageEntries(entries) {
  return entries && typeof entries === 'object' && !Array.isArray(entries) &&
    Object.entries(entries).every(([key, value]) => /^(erp[-_:]|calendarViewMode)/.test(key) && key.length <= 2048 &&
      (value === null || (typeof value === 'string' && Buffer.byteLength(value) <= 8 * 1024 * 1024)));
}

export function registerBrowserStateRoutes({ app, appContext: { pool, requireAuth, hasPermission, logger } }) {
  const allowed = (req, key, value, write = false) => {
    if (!key.startsWith('erp-item-versions:')) return true;
    const parts = key.slice('erp-item-versions:'.length).split(':');
    if (parts.length === 3 && parts.shift() !== req.auth.activeOrganization.id) return false;
    if (parts.length !== 2) return false;
    const [collection_id, item_id] = parts;
    const action = write ? 'can_write' : 'can_read';
    if (!hasPermission(req.auth, { collection_id, item_id }, action)) return false;
    if (!value) return true;
    try {
      const history = JSON.parse(value);
      if (!history.base || !Array.isArray(history.versions)) return false;
      const fields = new Set(Object.keys(history.base));
      for (const version of history.versions) {
        for (const key of Object.keys(version.patch?.set || {})) fields.add(key);
        for (const key of Object.keys(version.patch?.deltas || {})) fields.add(key);
        for (const key of version.patch?.unset || []) fields.add(key);
      }
      return [...fields].filter(key => !['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'].includes(key))
        .every(field_id => hasPermission(req.auth, { collection_id, item_id, field_id }, action));
    } catch { return false; }
  };
  const read = async (req) => {
    const result = await pool.query(
      'SELECT key, value FROM browser_state WHERE organization_id = $1 AND owner_key IN ($2, $3)',
      [req.auth.activeOrganization.id, req.auth.user.id, 'organization']);
    return Object.fromEntries(result.rows.filter(row => allowed(req, row.key, row.value)).map(row => [row.key, row.value]));
  };
  const guard = (req, res) => {
    if (!req.auth.activeOrganization?.id) { res.status(400).json({ error: 'No active organization' }); return false; }
    if (req.body?.organizationId && req.body.organizationId !== req.auth.activeOrganization.id) {
      res.status(409).json({ error: 'Organization changed; reload before saving' }); return false;
    }
    return true;
  };
  app.get('/api/browser-state', requireAuth, async (req, res) => {
    if (!guard(req, res)) return;
    try { res.json({ entries: await read(req) }); }
    catch (error) { logger.error('Load browser state failed', error); res.status(500).json({ error: 'Load failed' }); }
  });
  const save = (importOnly) => async (req, res) => {
    if (!guard(req, res)) return;
    let entries = req.body?.entries;
    if (!validStorageEntries(entries)) return res.status(400).json({ error: 'Invalid entries' });
    if (importOnly) entries = Object.fromEntries(Object.entries(entries).filter(([key, value]) => allowed(req, key, value, true)));
    if (!Object.entries(entries).every(([key, value]) => allowed(req, key, value, true))) {
      return res.status(403).json({ error: 'Forbidden history access' });
    }
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      // Serialize organization history merges, including the first insertion.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [req.auth.activeOrganization.id]);
      for (const [originalKey, incomingValue] of Object.entries(entries)) {
        // Old histories lacked the organization in their key. Normalize before
        // merging so imports from different browsers converge on one history.
        const key = originalKey.startsWith('erp-item-versions:') && originalKey.slice('erp-item-versions:'.length).split(':').length === 2
          ? `erp-item-versions:${req.auth.activeOrganization.id}:${originalKey.slice('erp-item-versions:'.length)}` : originalKey;
        let value = incomingValue;
        const owner = isSharedStorageKey(key) ? 'organization' : req.auth.user.id;
        if (key.startsWith('erp-item-versions:')) {
          const existing = await client.query('SELECT value FROM browser_state WHERE organization_id=$1 AND owner_key=$2 AND key=$3',
            [req.auth.activeOrganization.id, owner, key]);
          if (existing.rows[0] && !allowed(req, key, existing.rows[0].value, true)) throw new Error('Restricted existing history');
          if (value !== null) value = mergePersistentHistory(existing.rows[0]?.value, value);
        }
        if (value === null) {
          if (!importOnly) await client.query('DELETE FROM browser_state WHERE organization_id=$1 AND owner_key=$2 AND key=$3', [req.auth.activeOrganization.id, owner, key]);
        } else {
          await client.query(`INSERT INTO browser_state (organization_id, owner_key, key, value) VALUES ($1,$2,$3,$4)
            ON CONFLICT (organization_id, owner_key, key) DO ${importOnly && !key.startsWith('erp-item-versions:') ? 'NOTHING' : 'UPDATE SET value=EXCLUDED.value'}`,
          [req.auth.activeOrganization.id, owner, key, value]);
        }
      }
      await client.query('COMMIT');
      res.json(importOnly ? { entries: await read(req), importedKeys: Object.keys(entries) } : { ok: true });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      logger.error('Save browser state failed', error);
      res.status(500).json({ error: 'Save failed' });
    } finally { client?.release(); }
  };
  app.patch('/api/browser-state', requireAuth, save(false));
  app.post('/api/browser-state/import', requireAuth, save(true));
}
