export const organizationRoom = (organizationId) => `organization:${organizationId}`;

export const setupSocketPresence = ({ io, parseCookies, requireAuth }) => {
  io.engine.use(parseCookies);
  io.use(async (socket, next) => {
    const organizationId = socket.handshake.auth?.organizationId;
    if (typeof organizationId !== 'string' || !organizationId) {
      return next(new Error('Organization required'));
    }

    const req = {
      cookies: socket.request.cookies || {},
      headers: { ...socket.request.headers, 'x-organization-id': organizationId },
    };
    const res = {
      status() { return this; },
      json() { next(new Error('Unauthorized')); },
    };
    await requireAuth(req, res, () => {
      if (req.auth?.activeOrganization?.id !== organizationId) return next(new Error('Unauthorized'));
      const { id, name } = req.auth.user;
      socket.data.organizationId = organizationId;
      socket.data.user = { id, name };
      next();
    });
  });

  const broadcastUsers = async (room) => {
    const sockets = await io.in(room).fetchSockets();
    const users = new Map(sockets.map(({ data }) => [data.user.id, data.user]));
    io.to(room).emit('usersConnected', [...users.values()]);
  };

  io.on('connection', async (socket) => {
    const room = organizationRoom(socket.data.organizationId);
    socket.on('whoIsConnected', () => void broadcastUsers(room));
    socket.on('disconnect', () => void broadcastUsers(room));
    await socket.join(room);
    await broadcastUsers(room);
  });
};
