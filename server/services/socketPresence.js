export const setupSocketPresence = ({ io, pool, jwt, jwtSecret }) => {
  // Map socket.id -> user info
  const connectedUsers = new Map();

  const broadcastUsers = () => {
    const users = Array.from(connectedUsers.values());
    io.emit('usersConnected', users);
  };

  io.on('connection', async (socket) => {
    // Identification par événement 'identify' (plus fiable que le cookie)
    let user = null;

    socket.on('identify', async (payload) => {
      if (payload && payload.id && payload.name) {
        user = { id: payload.id, name: payload.name };
        connectedUsers.set(socket.id, user);
        broadcastUsers();
      }
    });

    // (Optionnel) fallback cookie pour compatibilité ancienne version
    try {
      const cookie = socket.handshake.headers.cookie || '';
      // Accepte auth_token OU access_token
      let match = cookie.match(/auth_token=([^;]+)/);
      if (!match) {
        match = cookie.match(/access_token=([^;]+)/);
      }
      if (match) {
        const token = match[1];
        const decoded = jwt.verify(token, jwtSecret);
        const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [decoded.id]);
        if (result.rowCount) {
          user = result.rows[0];
          connectedUsers.set(socket.id, user);
          broadcastUsers();
        }
      }
    } catch {
      // ignore cookie parsing/jwt/db fallback failures
    }

    socket.on('whoIsConnected', () => {
      broadcastUsers();
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(socket.id);
      broadcastUsers();
    });
  });
};
