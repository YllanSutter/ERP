export function createShutdownHandler({ getServer, getSockets, stopBackups, createBackup, closeDatabase, logger, exit }) {
  let shuttingDown = false;
  return async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    let exitCode = 0;
    logger.info(`${signal}: arrêt des requêtes puis sauvegarde de la base`);
    stopBackups();
    try {
      const sockets = getSockets();
      if (sockets) await new Promise((resolve, reject) => sockets.close((error) => error ? reject(error) : resolve()));
      const server = getServer();
      if (server?.listening) {
        await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      }
      const backup = await createBackup('shutdown');
      logger.info({ backup: backup.name }, 'Sauvegarde avant arrêt terminée');
    } catch (error) {
      exitCode = 1;
      logger.error({ error }, 'Échec de la sauvegarde avant arrêt');
    } finally {
      try {
        await closeDatabase();
      } catch (error) {
        exitCode = 1;
        logger.error({ error }, 'Échec de fermeture de la base');
      }
      exit(exitCode);
    }
  };
}
