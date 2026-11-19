import assert from 'node:assert/strict';
import test from 'node:test';
import { organizationRoom, setupSocketPresence } from './socketPresence.js';

test('presence derives identity from the session and is scoped to an authorized organization', async () => {
  const rooms = new Map();
  const emissions = [];
  let authenticate;
  let connect;
  const io = {
    engine: { use() {} },
    use(handler) { authenticate = handler; },
    on(_event, handler) { connect = handler; },
    in(room) { return { fetchSockets: async () => rooms.get(room) || [] }; },
    to(room) { return { emit: (event, users) => emissions.push({ room, event, users }) }; },
  };
  setupSocketPresence({
    io,
    parseCookies() {},
    requireAuth: async (req, res, next) => {
      const session = { alice: 'org-a', bob: 'org-b' }[req.cookies.access_token];
      if (!session || session !== req.headers['x-organization-id']) return res.status(403).json({});
      const id = req.cookies.access_token;
      req.auth = { user: { id, name: id.toUpperCase() }, activeOrganization: { id: session } };
      next();
    },
  });

  const socket = (organizationId, token) => {
    const handlers = new Map();
    return {
      handlers,
      data: {},
      handshake: { auth: { organizationId, user: { id: 'spoofed' } } },
      request: { cookies: { access_token: token }, headers: {} },
      on(event, handler) { handlers.set(event, handler); },
      join(room) {
        rooms.set(room, [...(rooms.get(room) || []), this]);
      },
    };
  };
  const authorize = (connection) => new Promise((resolve) => { void authenticate(connection, resolve); });
  assert.ok(await authorize(socket('org-b', 'alice')) instanceof Error);
  assert.ok(await authorize(socket('org-a')) instanceof Error);
  assert.ok(await authorize(socket(null, 'alice')) instanceof Error);

  const alice = socket('org-a', 'alice');
  const bob = socket('org-b', 'bob');
  for (const connection of [alice, bob, socket('org-a', 'alice')]) {
    assert.equal(await authorize(connection), undefined);
    await connect(connection);
    assert.equal(connection.handlers.has('identify'), false);
  }
  assert.deepEqual(emissions, [
    { room: organizationRoom('org-a'), event: 'usersConnected', users: [{ id: 'alice', name: 'ALICE' }] },
    { room: organizationRoom('org-b'), event: 'usersConnected', users: [{ id: 'bob', name: 'BOB' }] },
    { room: organizationRoom('org-a'), event: 'usersConnected', users: [{ id: 'alice', name: 'ALICE' }] },
  ]);
});

test('real presence uses WebSocket, reconnects after transport loss and supports polling fallback', { skip: process.env.RUN_SOCKET_INTEGRATION !== '1' }, async t => {
  const { createServer } = await import('node:http');
  const { Server } = await import('socket.io');
  const { io: connect } = await import('socket.io-client');
  const { default: cookieParser } = await import('cookie-parser');
  const { once } = await import('node:events');
  const { presenceSocketOptions } = await import('../../shared/presenceSocketOptions.js');
  for (const transports of [['websocket', 'polling'], ['polling']]) {
    await t.test(transports[0], async () => {
      const server = createServer();
      const io = new Server(server, { transports });
      setupSocketPresence({ io, parseCookies: cookieParser(), requireAuth: (req,res,next) => {
        if (req.cookies.access_token !== 'alice') return res.status(401).json({});
        req.auth = { user: {id:'alice',name:'Alice'}, activeOrganization: {id:req.headers['x-organization-id']} }; next();
      }});
      server.listen(0,'127.0.0.1'); await once(server,'listening');
      const client = connect(`http://127.0.0.1:${server.address().port}`, { ...presenceSocketOptions('org-a'), extraHeaders: {Cookie:'access_token=alice'}, reconnectionDelay:20,timeout:1000 });
      try {
        await once(client,'connect',{signal:AbortSignal.timeout(4000)});
        assert.equal(client.io.engine.transport.name,transports[0]);
        const users = once(client,'usersConnected',{signal:AbortSignal.timeout(4000)}); client.emit('whoIsConnected');
        assert.deepEqual((await users)[0],[{id:'alice',name:'Alice'}]);
        if(transports[0]==='websocket') {
          const oldId = client.id;
          const reconnect = once(client,'connect',{signal:AbortSignal.timeout(4000)});
          io.sockets.sockets.get(oldId).conn.close(); await reconnect;
          assert.notEqual(client.id,oldId);
          assert.equal(client.io.engine.transport.name,'websocket');
        }
      } finally { client.disconnect(); await new Promise(resolve=>io.close(resolve)); }
    });
  }
});
