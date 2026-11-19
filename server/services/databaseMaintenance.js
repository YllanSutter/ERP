// Drain existing HTTP requests before replacing the schema; reject new requests meanwhile.
export function createDatabaseMaintenance({ timeoutMs = 30_000 } = {}) {
  let restoring = false;
  const active = new Set();
  const listeners = new Set();
  const middleware = (req, res, next) => {
    if (restoring) {
      res.setHeader('Retry-After', '5');
      return res.status(503).json({ error: 'Sauvegarde ou restauration en cours. Réessayez dans quelques instants.' });
    }
    active.add(req);
    const done = () => {
      active.delete(req);
      for (const notify of listeners) notify();
    };
    res.once('finish', done);
    res.once('close', done);
    next();
  };
  const run = async (request, operation) => {
    if (restoring) throw new Error('Une sauvegarde ou une restauration est déjà en cours.');
    restoring = true;
    try {
      await new Promise((resolve, reject) => {
        let timer;
        const check = () => {
          if ([...active].some(req => req !== request)) return;
          clearTimeout(timer);
          listeners.delete(check);
          resolve();
        };
        timer = setTimeout(() => {
          listeners.delete(check);
          reject(new Error('Des requêtes sont encore en cours. La base n’a pas été modifiée. Réessayez.'));
        }, timeoutMs);
        listeners.add(check);
        check();
      });
      return await operation();
    } finally {
      restoring = false;
    }
  };
  return { middleware, run };
}
