export function createBackupScheduler({ intervalMinutes, createBackup, listBackups, logger, now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  const intervalMs = Number(intervalMinutes) * 60_000;
  const enabled = Number.isFinite(intervalMs) && intervalMs > 0 && intervalMs <= 2_147_483_647;
  let stopped = false;
  let timer;
  const status = { enabled, intervalMinutes: enabled ? Number(intervalMinutes) : null, running: false, lastAttemptAt: null, lastSuccessAt: null, lastError: null, nextRunAt: null };
  const plan = (delay) => {
    if (stopped || !enabled) return;
    status.nextRunAt = new Date(now() + delay).toISOString();
    timer = schedule(() => void tick(), delay);
    timer?.unref?.();
  };
  const tick = async () => {
    if (stopped || !enabled) return;
    status.nextRunAt = null;
    status.running = true;
    try {
      const backups = await listBackups();
      const latest = backups.find(backup => Number(backup.size) > 0);
      const last = latest ? new Date(latest.createdAt).getTime() : NaN;
      if (Number.isFinite(last) && now() - last < intervalMs) {
        status.lastSuccessAt = new Date(last).toISOString();
        plan(Math.max(1, intervalMs - (now() - last)));
        return;
      }
      status.lastAttemptAt = new Date(now()).toISOString();
      const backup = await createBackup('auto');
      status.lastSuccessAt = new Date(backup.createdAt).toISOString();
      status.lastError = null;
      logger.info({ backup: backup.name }, 'Sauvegarde automatique terminée');
      plan(intervalMs);
    } catch (err) {
      status.lastError = 'La dernière sauvegarde automatique a échoué. Consultez les journaux du serveur.';
      logger.error({ err }, 'Échec de la sauvegarde automatique');
      plan(Math.min(intervalMs, 5 * 60_000));
    } finally {
      status.running = false;
    }
  };
  return {
    start: tick,
    stop: () => { stopped = true; cancel(timer); status.nextRunAt = null; },
    getStatus: () => ({ ...status }),
  };
}

// A scheduled run is complete only when every organization and the full database are covered.
export function createScopedBackupOperations({ pool, listBackups, createDbBackup, createOrganizationBackup }) {
  return {
    createBackup: async (label) => {
      const organizations = await pool.query('SELECT id FROM organizations');
      for (const organization of organizations.rows) await createOrganizationBackup(organization.id, label);
      return createDbBackup(label);
    },
    listBackups: async () => {
      const all = (await listBackups()).filter(backup => backup.size > 0);
      const organizations = await pool.query('SELECT id FROM organizations');
      const latest = [all.find(backup => backup.scope === 'database'),
        ...organizations.rows.map(org => all.find(backup => backup.organizationId === org.id))];
      if (latest.some(backup => !backup)) return [];
      return latest.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    },
  };
}
