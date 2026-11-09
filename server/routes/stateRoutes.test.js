import assert from 'node:assert/strict';
import test from 'node:test';
import { registerStateRoutes } from './stateRoutes.js';

test('concurrent item and structure patches cannot overwrite each other', async () => {
  const initialState = { collections: [{ id: 'col', items: [{ id: 'item', title: 'Original' }] }] };
  let row = { data: JSON.stringify(initialState), version: 1 };
  const handlers = new Map();
  let reads = 0;
  let releaseReads;
  const bothRead = new Promise((resolve) => { releaseReads = resolve; });
  const pool = {
    async query(sql, args) {
      if (sql.startsWith('SELECT data, version')) {
        const snapshot = row;
        if (++reads === 2) releaseReads();
        await bothRead;
        return { rows: [snapshot] };
      }
      if (sql.includes('FROM automations')) return { rows: [] };
      assert.match(sql, /AND version = \$3 AND data = \$4 RETURNING version/);
      const [data, , version, previousData] = args;
      if (row.version !== version || row.data !== previousData) return { rowCount: 0, rows: [] };
      row = { data, version: version + 1 };
      return { rowCount: 1, rows: [row] };
    },
  };
  registerStateRoutes({
    app: {
      patch(path, ...middleware) { handlers.set(path, middleware.at(-1)); },
      get() {},
      post() {},
    },
    appContext: {
      pool,
      logger: console,
      requireAuth() {},
      requirePermission() {},
      hasPermission: () => true,
      getCalendarConfigForUser() {},
      shouldRecalculateSegments: () => false,
    },
  });

  const patch = async (path, body) => {
    const res = {
      code: 200,
      status(code) { this.code = code; return this; },
      json(value) { this.body = value; },
    };
    await handlers.get(path)({
      body,
      auth: { user: { id: 'user' }, activeOrganization: { id: 'org' } },
    }, res);
    return res;
  };

  const itemPath = '/api/state/item';
  const structurePath = '/api/state/structure';
  const item = { collectionId: 'col', itemId: 'item', fields: { title: 'Updated' } };
  const structure = { type: 'favorites', payload: ['col'] };
  const [itemResponse, structureResponse] = await Promise.all([
    patch(itemPath, { ...item, stateVersion: 1 }),
    patch(structurePath, { ...structure, stateVersion: 1 }),
  ]);

  assert.deepEqual([itemResponse.code, structureResponse.code].sort(), [200, 409]);
  assert.equal(row.version, 2);
  assert.equal((await patch(itemPath, { ...item, stateVersion: 1 })).code, 409);

  const retry = itemResponse.code === 409
    ? await patch(itemPath, { ...item, stateVersion: 2 })
    : await patch(structurePath, { ...structure, stateVersion: 2 });
  assert.equal(retry.body.stateVersion, 3);
  assert.equal(JSON.parse(row.data).collections[0].items[0].title, 'Updated');
  assert.deepEqual(JSON.parse(row.data).favorites, ['col']);
});
