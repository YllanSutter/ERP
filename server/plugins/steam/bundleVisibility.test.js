import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncPublicBundlesAfterSave } from './bundleVisibility.js';

const state = {
  collections: [
    {
      id: 'games',
      plugins: { steam: { role: 'games' } },
      properties: [
        { id: 'app', name: 'Steam', type: 'steam' },
        { id: 'rel', type: 'relation', relation: { targetCollectionId: 'bundles' } },
      ],
      items: [],
    },
    {
      id: 'bundles',
      plugins: { steam: { role: 'bundles' } },
      properties: [{ id: 'title', name: 'Nom', type: 'text' }],
      items: [{ id: 'pack', title: 'Pack' }],
    },
  ],
};
function context(defaultPublic, publications = [], permission = true) {
  const writes = [];
  const appContext = {
    pool: {
      query: async (sql, args) => {
        if (sql.includes('plugin_configs'))
          return { rows: [{ config: { bundlesPublicByDefault: defaultPublic } }] };
        if (sql.startsWith('SELECT bundle_id')) return { rows: publications };
        writes.push({ sql, args });
        return { rows: [] };
      },
    },
    hasPermission: () => permission,
    logger: { error() {} },
  };
  return { writes, appContext, auth: { activeOrganization: { id: 'org' } } };
}
const beforeCreation = () => {
  const previous = structuredClone(state);
  previous.collections[1].items = [];
  return previous;
};

test('public default publishes a newly saved empty bundle', async () => {
  const ctx = context(true);
  await syncPublicBundlesAfterSave({ ...ctx, previousState: beforeCreation(), state });
  const insert = ctx.writes.find((w) => w.sql.startsWith('INSERT'));
  assert.ok(insert);
  const snapshot = JSON.parse(insert.args[3]);
  assert.equal(snapshot.title, 'Pack');
  assert.deepEqual(snapshot.games, []);
});

test('private default does not publish new bundles', async () => {
  const ctx = context(false);
  await syncPublicBundlesAfterSave({ ...ctx, previousState: beforeCreation(), state });
  assert.equal(
    ctx.writes.some((w) => w.sql.startsWith('INSERT')),
    false,
  );
});

test('adding games refreshes an existing publication even if the default is now private', async () => {
  const changed = structuredClone(state);
  changed.collections[0].items.push(
    { id: 'valid', app: { appid: 10, name: 'Game' }, rel: ['pack'] },
    { id: 'invalid', rel: ['pack'] },
  );
  const ctx = context(false, [{ bundle_id: 'pack', snapshot: { games: [] } }]);
  await syncPublicBundlesAfterSave({ ...ctx, previousState: state, state: changed });
  const update = ctx.writes.find((w) => w.sql.startsWith('UPDATE'));
  assert.ok(update);
  const snapshot = JSON.parse(update.args[0]);
  assert.equal(snapshot.games.length, 1);
  assert.equal(snapshot.games[0].app.appid, 10);
  assert.equal(snapshot.excludedGameCount, 1);
  assert.equal(
    ctx.writes.some((w) => w.sql.startsWith('INSERT')),
    false,
  );
});

test('enabling the default does not republish an existing private bundle', async () => {
  const changed = structuredClone(state);
  changed.collections[1].items[0].title = 'Changed';
  const ctx = context(true);
  await syncPublicBundlesAfterSave({ ...ctx, previousState: state, state: changed });
  assert.equal(
    ctx.writes.some((w) => w.sql.startsWith('INSERT') || w.sql.startsWith('UPDATE')),
    false,
  );
});

test('automatic publication still checks write permissions', async () => {
  const ctx = context(true, [], false);
  await syncPublicBundlesAfterSave({ ...ctx, previousState: beforeCreation(), state });
  assert.equal(
    ctx.writes.some((w) => w.sql.startsWith('INSERT')),
    false,
  );
});
