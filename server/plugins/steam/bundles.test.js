import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicBundle, registerBundleRoutes } from './bundles.js';
const config = {
  gamesCollectionId: 'g',
  bundlesCollectionId: 'b',
  bundleRelationPropertyId: 'rel',
};
const state = {
  collections: [
    {
      id: 'g',
      plugins: { steam: { role: 'games' } },
      properties: [
        { id: 'app', type: 'steam', name: 'Steam' },
        { id: 'rel', type: 'relation', relation: { targetCollectionId: 'b' } },
        { id: 'secret', type: 'password' },
      ],
      items: [
        { id: 'game', app: { appid: 10, name: '<Game>' }, rel: ['pack'], secret: 'private' },
        { id: 'other', app: { appid: 20 }, rel: [] },
      ],
    },
    {
      id: 'b',
      plugins: { steam: { role: 'bundles' } },
      properties: [
        { id: 'title', type: 'text', name: 'Nom' },
        { id: 'secret', type: 'password' },
      ],
      items: [{ id: 'pack', title: 'Pack', secret: 'private' }],
    },
  ],
};
test('public snapshot includes only bundle games and safe accessible fields', () => {
  const snapshot = buildPublicBundle(state, config, 'pack', () => true);
  assert.equal(snapshot.games.length, 1);
  assert.equal(snapshot.title, 'Pack');
  assert.equal(snapshot.games[0].app.appid, 10);
  assert.equal(JSON.stringify(snapshot).includes('private'), false);
  assert.equal(snapshot.games[0].rel, undefined);
});
test('publication rejects inaccessible games and excludes invalid Steam IDs', () => {
  assert.throws(() => buildPublicBundle(state, config, 'pack', (_c, id) => id !== 'game'), {
    status: 403,
  });
  const invalid = structuredClone(state);
  invalid.collections[0].items[0].app.appid = 0;
  const snapshot = buildPublicBundle(invalid, config, 'pack', () => true);
  assert.equal(snapshot.games.length, 0);
  assert.equal(snapshot.excludedGameCount, 1);
  assert.equal(invalid.collections[0].items.length, 2);
});
test('authenticated publication cannot write without permission', async () => {
  const routes = new Map();
  let queriedSnapshot = false;
  const app = Object.fromEntries(
    ['get', 'post', 'delete'].map((method) => [
      method,
      (path, ...handlers) => routes.set(`${method} ${path}`, handlers),
    ]),
  );
  registerBundleRoutes({
    app,
    appContext: {
      pool: {
        query: async (sql) => {
          if (sql.includes('plugin_configs')) return { rows: [{ config }] };
          if (sql.includes('app_state')) {
            queriedSnapshot = true;
            return { rows: [{ data: state }] };
          }
          return { rows: [] };
        },
      },
      requireAuth() {},
      hasPermission: () => false,
      logger: { error() {} },
    },
  });
  let status;
  let body;
  const res = {
    status(s) {
      status = s;
      return this;
    },
    json(b) {
      body = b;
    },
  };
  await routes.get('post /api/plugins/steam/bundles/:bundleId/publish').at(-1)(
    { auth: { activeOrganization: { id: 'org' } }, params: { bundleId: 'pack' } },
    res,
  );
  assert.equal(status, 403);
  assert.equal(queriedSnapshot, true);
  assert.ok(body.error);
});

test('publication shares valid games while keeping games without Steam IDs in the source', () => {
  const mixed = structuredClone(state);
  mixed.collections[0].items.push({ id: 'no-id', rel: ['pack'], app: 'Sans identifiant' });
  const snapshot = buildPublicBundle(mixed, config, 'pack', () => true);
  assert.deepEqual(
    snapshot.games.map((g) => g.app.appid),
    [10],
  );
  assert.equal(snapshot.excludedGameCount, 1);
  assert.equal(mixed.collections[0].items.length, 3);
});
