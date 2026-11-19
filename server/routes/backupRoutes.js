import fs from 'node:fs';
import { organizationRoom } from '../services/socketPresence.js';

export const registerBackupRoutes = ({ app, appContext }) => {
  const { logger, requireAuth, logAudit, backup, withDatabaseMaintenance, isSiteCreator } = appContext;
  const { listBackups, createDbBackup, restoreDbBackup, createOrganizationBackup, restoreOrganizationBackup,
    getBackupStatus, backupScope, resolveBackupPath, formatBackupError } = backup;
  const safely = handler => async (req, res) => {
    try { return await handler(req, res); }
    catch (err) {
      logger.error({ err }, 'Backup request failed');
      return res.status(500).json({ error: 'Le service de sauvegarde est momentanément indisponible.' });
    }
  };
  const isAdmin = req => req.auth.roles.some(role => role.name === 'admin');
  const canAccess = async (req, scope, organizationId) => isAdmin(req) && (scope === 'database'
    ? isSiteCreator(req.auth.user.id) : organizationId && organizationId === req.auth.activeOrganization?.id);
  const scopeForRequest = req => req.query?.scope === 'database' || req.body?.scope === 'database' ? 'database' : 'organization';
  const authorizeFile = async (req, res) => {
    const file = resolveBackupPath(req.params.name);
    if (!file) { res.status(400).json({ error: 'Invalid backup name' }); return null; }
    const scope = backupScope(req.params.name);
    if (!await canAccess(req, scope.scope, scope.organizationId)) { res.status(403).json({ error: 'Accès à cette sauvegarde refusé.' }); return null; }
    return { file, ...scope };
  };

  app.get('/api/db/backups', requireAuth, safely(async (req, res) => {
    const scope = scopeForRequest(req);
    const organizationId = req.auth.activeOrganization?.id;
    if (!await canAccess(req, scope, organizationId)) return res.status(403).json({ error: 'Forbidden' });
    try {
      const backups = (await listBackups()).filter(backup => backup.scope === scope && (scope === 'database' || backup.organizationId === organizationId));
      return res.json(backups);
    } catch (err) {
      logger.error({ err }, 'Failed to list backups');
      return res.status(500).json({ error: 'Failed to list backups' });
    }
  }));

  app.post('/api/db/backups', requireAuth, safely(async (req, res) => {
    const scope = scopeForRequest(req);
    const organizationId = req.auth.activeOrganization?.id;
    if (!await canAccess(req, scope, organizationId)) return res.status(403).json({ error: 'Forbidden' });
    try {
      const label = req.body?.label || '';
      const result = await withDatabaseMaintenance(req, () => scope === 'organization' ? createOrganizationBackup(organizationId, label) : createDbBackup(label));
      await logAudit(req.auth.user.id, 'db.backup.create', 'backup', result.name, { ...result, scope, organizationId });
      return res.json({ ok: true, backup: result });
    } catch (err) {
      logger.error({ err }, 'Failed to create backup');
      return res.status(500).json({ error: 'Failed to create backup', detail: formatBackupError(err) });
    }
  }));

  app.get('/api/db/backups/status', requireAuth, safely(async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
    return res.json({ ...getBackupStatus(), scopedBackupsSupported: true, canManageDatabaseBackups: await isSiteCreator(req.auth.user.id) });
  }));

  app.get('/api/db/backups/:name', requireAuth, safely(async (req, res) => {
    const authorized = await authorizeFile(req, res);
    if (!authorized) return;
    try {
      await fs.promises.access(authorized.file, fs.constants.R_OK);
      await logAudit(req.auth.user.id, 'db.backup.download', 'backup', req.params.name, { scope: authorized.scope });
      return res.download(authorized.file);
    } catch (err) {
      logger.error({ err }, 'Failed to download backup');
      return res.status(404).json({ error: 'Backup not found' });
    }
  }));

  app.delete('/api/db/backups/:name', requireAuth, safely(async (req, res) => {
    const authorized = await authorizeFile(req, res);
    if (!authorized) return;
    try {
      await fs.promises.unlink(authorized.file);
      await logAudit(req.auth.user.id, 'db.backup.delete', 'backup', req.params.name, { scope: authorized.scope });
      return res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, 'Failed to delete backup');
      return res.status(404).json({ error: 'Backup not found' });
    }
  }));

  app.post('/api/db/backups/:name/restore', requireAuth, safely(async (req, res) => {
    const authorized = await authorizeFile(req, res);
    if (!authorized) return;
    try {
      if (authorized.scope === 'database' && req.body?.confirmScope !== 'database') return res.status(400).json({ error: 'Confirmez explicitement la restauration de toute la base.' });
      await withDatabaseMaintenance(req, () => authorized.scope === 'organization'
        ? restoreOrganizationBackup(req.params.name, authorized.organizationId, req.auth.user.id)
        : restoreDbBackup(req.params.name));
      await logAudit(req.auth.user.id, 'db.backup.restore', 'backup', req.params.name, { scope: authorized.scope, organizationId: authorized.organizationId });
      if (global.io) {
        const target = authorized.scope === 'organization' ? global.io.to(organizationRoom(authorized.organizationId)) : global.io;
        target.emit('stateUpdated', { source: 'db.restore', organizationId: authorized.organizationId });
      }
      return res.json({ ok: true, scope: authorized.scope });
    } catch (err) {
      logger.error({ err }, 'Failed to restore backup');
      return res.status(500).json({ error: 'Failed to restore backup', detail: formatBackupError(err) });
    }
  }));
};
