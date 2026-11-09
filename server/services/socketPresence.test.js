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
