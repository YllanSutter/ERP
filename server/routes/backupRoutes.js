import fs from 'fs';

export const registerBackupRoutes = ({ app, requireAuth, logAudit, backup }) => {
  const {
    listBackups,
    createDbBackup,
    restoreDbBackup,
    resolveBackupPath,
    formatBackupError,
  } = backup;

  app.get('/api/db/backups', requireAuth, async (req, res) => {
    const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
    try {
      const backups = await listBackups();
      return res.json(backups);
    } catch (err) {
      console.error('Failed to list backups', err);
      return res.status(500).json({ error: 'Failed to list backups' });
    }
  });

  app.post('/api/db/backups', requireAuth, async (req, res) => {
    const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
    try {
      const label = req.body?.label || '';
      const backupResult = await createDbBackup(label);
      await logAudit(req.auth?.user?.id, 'db.backup.create', 'backup', backupResult.name, backupResult);
      return res.json({ ok: true, backup: backupResult });
    } catch (err) {
      console.error('Failed to create backup', err);
      return res.status(500).json({ error: 'Failed to create backup', detail: formatBackupError(err) });
    }
  });

  app.get('/api/db/backups/:name', requireAuth, async (req, res) => {
    const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
    const filePath = resolveBackupPath(req.params.name);
    if (!filePath) return res.status(400).json({ error: 'Invalid backup name' });
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
      await logAudit(req.auth?.user?.id, 'db.backup.download', 'backup', req.params.name, {});
      return res.download(filePath);
    } catch (err) {
      console.error('Failed to download backup', err);
      return res.status(404).json({ error: 'Backup not found' });
    }
  });

  app.delete('/api/db/backups/:name', requireAuth, async (req, res) => {
    const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
    const filePath = resolveBackupPath(req.params.name);
    if (!filePath) return res.status(400).json({ error: 'Invalid backup name' });
    try {
      await fs.promises.unlink(filePath);
      await logAudit(req.auth?.user?.id, 'db.backup.delete', 'backup', req.params.name, {});
      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to delete backup', err);
      return res.status(404).json({ error: 'Backup not found' });
    }
  });

  app.post('/api/db/backups/:name/restore', requireAuth, async (req, res) => {
    const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
    const filePath = resolveBackupPath(req.params.name);
    if (!filePath) return res.status(400).json({ error: 'Invalid backup name' });
    try {
      await restoreDbBackup(req.params.name);
      await logAudit(req.auth?.user?.id, 'db.backup.restore', 'backup', req.params.name, {});
      if (global.io) {
        global.io.emit('stateUpdated', { userId: req.auth?.user?.id || null, source: 'db.restore' });
      }
      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to restore backup', err);
      return res.status(500).json({ error: 'Failed to restore backup' });
    }
  });
};
