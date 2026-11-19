import { ACCOUNT_STORAGE_KEYS, isAccountStorageKey, migrateAccountState } from '../services/accountState.js';
import { createHash } from 'node:crypto';
import { legacyStorageScope } from '../../shared/legacyStorageScope.js';
import { historyVersionIdentity, mergePersistentHistory } from '../services/persistentHistory.js';
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
        .every(field_id => hasPermission(req.auth, { collection_id, item_id, field_id }, 'can_read'));
    } catch { return false; }
  };
  const canAppendHistory = (req, key, incomingValue, currentValue) => {
    if (incomingValue === null) return true;
    const [, , collection_id, item_id] = key.split(':');
    const incoming = JSON.parse(incomingValue);
    const known = new Set(currentValue ? JSON.parse(currentValue).versions.map(historyVersionIdentity) : []);
    return incoming.versions.filter(version => !known.has(historyVersionIdentity(version))).every(version => {
      const patch = version.patch || {};
      const fields = new Set([...Object.keys(patch.set || {}), ...Object.keys(patch.deltas || {}), ...(patch.unset || [])]);
      return [...fields].every(field_id => hasPermission(req.auth, { collection_id, item_id, field_id }, 'can_write'));
    });
  };
  const read = async (req, { keys = null, preferencesOnly = false, migrate = true } = {}) => {
    if (migrate) await migrateAccountState(pool, req.auth.user.id, req.auth.activeOrganization.id);
    const result = await pool.query(
      `SELECT key, value FROM browser_state
       WHERE organization_id = $1 AND owner_key IN ($2, $3) AND NOT (key = ANY($4::text[]))
         AND ($5::text[] IS NULL OR key = ANY($5::text[]))
         AND (NOT $6::boolean OR key NOT LIKE 'erp-item-versions:%')
       UNION ALL SELECT key, value FROM user_state WHERE user_id = $2::uuid AND key = ANY($4::text[]) AND value IS NOT NULL
         AND ($5::text[] IS NULL OR key = ANY($5::text[]))`,
      [req.auth.activeOrganization.id, req.auth.user.id, 'organization', ACCOUNT_STORAGE_KEYS, keys, preferencesOnly]);
    return Object.fromEntries(result.rows.filter(row => allowed(req, row.key, row.value)).map(row => [row.key, row.value]));
  };
  const guard = (req, res) => {
    if (req.body?.userId && req.body.userId !== req.auth.user.id) {
      res.status(409).json({ error: 'Account changed; reconnect before saving' }); return false;
    }
    if (!req.auth.activeOrganization?.id) { res.status(400).json({ error: 'No active organization' }); return false; }
    if ((req.body?.organizationId || req.query?.organizationId) && (req.body?.organizationId || req.query?.organizationId) !== req.auth.activeOrganization.id) {
      res.status(409).json({ error: 'Organization changed; reload before saving' }); return false;
    }
    return true;
  };
  app.get('/api/browser-state', requireAuth, async (req, res) => {
    if (!guard(req, res)) return;
    let keys = null;
    if (req.query?.keys) {
      try { keys = JSON.parse(req.query.keys); } catch { return res.status(400).json({ error: 'Invalid keys' }); }
      if (!Array.isArray(keys) || keys.length > 100 || !keys.every(key => typeof key === 'string' && key.length <= 2048)) return res.status(400).json({ error: 'Invalid keys' });
    }
    const preferencesOnly = req.query?.scope === 'preferences';
    try {
      const entries = await read(req, { keys, preferencesOnly, migrate: !preferencesOnly || req.query?.initialize === '1' });
      const payload = { entries, organizationId: req.auth.activeOrganization.id, userId: req.auth.user.id };
      if (preferencesOnly) {
        const etag = `"${createHash('sha256').update(JSON.stringify({ ...payload, entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) })).digest('hex')}"`;
        res.setHeader?.('ETag', etag);
        res.setHeader?.('Cache-Control', 'private, no-cache');
        if (req.headers?.['if-none-match'] === etag) return res.status(304).end();
      }
      res.json(payload);
    }
    catch (error) { logger.error('Load browser state failed', error); res.status(500).json({ error: 'Load failed' }); }
  });
  const save = (importOnly) => async (req, res) => {
    if (!guard(req, res)) return;
    let entries = req.body?.entries;
    if (!validStorageEntries(entries)) return res.status(400).json({ error: 'Invalid entries' });
    if (importOnly) entries = Object.fromEntries(Object.entries(entries).filter(([key, value]) => {
      const scope = legacyStorageScope(key, req.auth.user.id, req.auth.activeOrganization.id);
      return scope !== 'foreign' && (scope === 'owned' || req.body.claimUnscoped === true) && allowed(req, key, value, true);
    }));
    if (!Object.entries(entries).every(([key, value]) => allowed(req, key, value, true))) {
      return res.status(403).json({ error: 'Forbidden history access' });
    }
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      // Serialize organization history merges, including the first insertion.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [req.auth.activeOrganization.id]);
      const importedKeys = [];
      const touched = new Set();
      for (const [originalKey, incomingValue] of Object.entries(entries)) {
        // Old histories lacked the organization in their key. Normalize before
        // merging so imports from different browsers converge on one history.
        const key = originalKey.startsWith('erp-item-versions:') && originalKey.slice('erp-item-versions:'.length).split(':').length === 2
          ? `erp-item-versions:${req.auth.activeOrganization.id}:${originalKey.slice('erp-item-versions:'.length)}` : originalKey;
        let value = incomingValue;
        if (isAccountStorageKey(key)) {
          if (value === null) {
            // A tombstone prevents old organization copies from being reimported.
            if (!importOnly) await client.query(`INSERT INTO user_state (user_id, key, value) VALUES ($1,$2,NULL)
              ON CONFLICT (user_id, key) DO UPDATE SET value=NULL`, [req.auth.user.id, key]);
          } else {
            await client.query(`INSERT INTO user_state (user_id, key, value) VALUES ($1,$2,$3)
              ON CONFLICT (user_id, key) DO ${importOnly ? 'NOTHING' : 'UPDATE SET value=EXCLUDED.value'}`, [req.auth.user.id, key, value]);
          }
          importedKeys.push(originalKey);
          touched.add(key);
          continue;
        }
        const owner = isSharedStorageKey(key) ? 'organization' : req.auth.user.id;
        if (key.startsWith('erp-item-draft:')) {
          const existing = await client.query('SELECT value FROM browser_state WHERE organization_id=$1 AND owner_key=$2 AND key=$3',
            [req.auth.activeOrganization.id, owner, key]);
          const current = existing.rows[0]?.value ?? null;
          const expected = req.body.expected?.[originalKey] ?? null;
          if (current !== value && ((importOnly && current !== null) || (!importOnly && current !== expected))) {
            if (value !== null) {
              const recoveryKey = `erp-draft-recovery:${createHash('sha256').update(key + '\0' + value).digest('hex')}`;
              await client.query(`INSERT INTO browser_state (organization_id, owner_key, key, value) VALUES ($1,$2,$3,$4)
                ON CONFLICT (organization_id, owner_key, key) DO NOTHING`,
                [req.auth.activeOrganization.id, owner, recoveryKey, JSON.stringify({ draftKey: key, value, origin: importOnly ? 'legacy-import' : 'concurrent-edit', createdAt: new Date().toISOString() })]);
              touched.add(recoveryKey);
            }
            importedKeys.push(originalKey);
            touched.add(key);
            continue; // Preserve the canonical draft and the conflicting incoming version.
          }
        }
        if (key.startsWith('erp-item-versions:')) {
          const existing = await client.query('SELECT value FROM browser_state WHERE organization_id=$1 AND owner_key=$2 AND key=$3',
            [req.auth.activeOrganization.id, owner, key]);
          if ((existing.rows[0] && !allowed(req, key, existing.rows[0].value)) ||
              !canAppendHistory(req, key, value, existing.rows[0]?.value)) {
            if (importOnly) continue;
            const error = new Error('Forbidden history changes');
            error.status = 403;
            throw error;
          }
          if (value !== null) value = mergePersistentHistory(existing.rows[0]?.value, value);
        }
        importedKeys.push(originalKey);
        touched.add(key);
        if (value === null) {
          if (!importOnly) await client.query('DELETE FROM browser_state WHERE organization_id=$1 AND owner_key=$2 AND key=$3', [req.auth.activeOrganization.id, owner, key]);
        } else {
          await client.query(`INSERT INTO browser_state (organization_id, owner_key, key, value) VALUES ($1,$2,$3,$4)
            ON CONFLICT (organization_id, owner_key, key) DO ${importOnly && !key.startsWith('erp-item-versions:') ? 'NOTHING' : 'UPDATE SET value=EXCLUDED.value'}`,
          [req.auth.activeOrganization.id, owner, key, value]);
        }
      }
      await client.query('COMMIT');
      const partial = req.body.delta === true;
      const acknowledged = await read(req, partial ? { keys: [...touched], migrate: false } : undefined);
      const responseEntries = partial ? Object.fromEntries([...touched].map(key => [key, acknowledged[key] ?? null])) : acknowledged;
      res.json({ entries: responseEntries, ...(partial ? { partial: true } : {}), ...(importOnly ? { importedKeys } : { ok: true }) });
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      logger.error('Save browser state failed', error);
      res.status(error.status || 500).json({ error: error.status === 403 ? 'Forbidden history changes' : 'Save failed' });
    } finally { client?.release(); }
  };
  app.patch('/api/browser-state', requireAuth, save(false));
  app.post('/api/browser-state/import', requireAuth, save(true));
}
