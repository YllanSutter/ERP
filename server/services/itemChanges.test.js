import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { buildItemChanges, applyItemChanges } from '../../shared/itemChanges.js';
import { registerStateRoutes } from '../routes/stateRoutes.js';
import { decryptStateSecrets } from './secretFieldService.js';

const copy = (value) => structuredClone(value);
const initial = () => ({ collections: [
  { id: 'tasks', properties: [], items: [{ id: 'a', name: 'A', obsolete: 'value', _eventSegments: [] }] },
  { id: 'companies', properties: [], items: [{ id: 'co', tasks: [], _eventSegments: [] }] },
], views: {}, favorites: { views: [], items: [] } });

function harness(state = initial(), options = {}) {
  const routes = new Map();
  let stored = JSON.stringify(state), version = 1, writes = 0, automationLoads = 0;
  const pool = { query: async (sql, params = []) => {
    if (sql.includes('FROM automations')) {
      automationLoads++;
      return { rows: options.automations || [] };
    }
    if (sql.startsWith('SELECT data, version')) return { rows: [{ data: stored, version }], rowCount: 1 };
    if (sql.startsWith('SELECT version')) return { rows: [{ version }], rowCount: 1 };
    if (sql.startsWith('UPDATE app_state')) {
      if (options.concurrentState) {
        stored = JSON.stringify(options.concurrentState);
        if (options.bumpConcurrentVersion) version++;
        delete options.concurrentState;
      }
      if (params[2] !== version || options.race || (sql.includes('AND data = $4') && params[3] !== stored)) return { rowCount: 0 };
      stored = params[0]; version++; writes++;
      return { rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${sql}`);
  } };
  const app = Object.fromEntries(['get', 'post', 'patch'].map((method) => [method, (path, ...handlers) => routes.set(`${method.toUpperCase()} ${path}`, handlers.at(-1))]));
  registerStateRoutes({ app, appContext: {
    pool, logger: { error() {} }, requireAuth() {}, requirePermission: () => () => {},
    hasPermission: (_auth, scope, action) => action === 'can_write'
      ? !options.denied?.includes(scope.collection_id)
      : !options.unreadable?.includes(scope.field_id),
    INITIAL_APP_STATE: initial(), syncAppStateIdSequence: async () => {},
    getCalendarConfigForUser: () => ({}), shouldRecalculateSegments: (_before, after) => Boolean(after.date),
    calculateEventSegments: (item) => ({ ...item, _eventSegments: item.date ? [{ start: item.date }] : [] }),
    logAudit: async () => {}, defaultCalendarConfig: {},
  } });
  return {
    get state() { return decryptStateSecrets(JSON.parse(stored)); },
    get raw() { return stored; },
    get writes() { return writes; },
    get automationLoads() { return automationLoads; },
    async call(body, method = 'PATCH', path = '/api/state/items') {
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
      await routes.get(`${method} ${path}`)({ method, body, auth: { user: { id: 'user' }, activeOrganization: { id: 'org' } } }, res);
      return res;
    },
  };
}

test('a small creation does not send unrelated collections or their item IDs', () => {
  const previous = initial().collections;
  previous.push({ id: 'large', items: [{ id: 'big', text: 'a'.repeat(2000000) }] });
  const next = copy(previous);
  next[0].items.push({ id: 'new', custom_field: { arbitrary: ['value'] } });
  const changes = buildItemChanges(previous, next);
  assert.equal(JSON.stringify(changes).length < 300, true);
  assert.equal(changes[0].order, undefined);
  assert.deepEqual(applyItemChanges(previous, changes), next);
});

test('saves creation, deletion, unset fields, arbitrary values, calendar and reciprocal relations together', async () => {
  const state = initial();
  const next = copy(state.collections);
  next[0].items = [{ id: 'b', date: '2026-11-03T07:00:00.000Z', company: 'co', custom: { text: ['x'] } }];
  next[1].items[0].tasks = ['b'];
  const h = harness(state);
  const response = await h.call({ stateVersion: 1, mutationId: randomUUID(), itemChanges: buildItemChanges(state.collections, next) });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.collections, undefined);
  assert.deepEqual(h.state.collections[1].items[0].tasks, ['b']);
  assert.equal(h.state.collections[0].items[0].id, 'b');
  assert.equal(h.state.collections[0].items[0]._eventSegments[0].start, next[0].items[0].date);
  assert.deepEqual(applyItemChanges(state.collections, response.body.itemChanges), h.state.collections);
  const edited = copy(h.state.collections);
  delete edited[0].items[0].custom;
  const update = await h.call({ stateVersion: 2, mutationId: randomUUID(), itemChanges: buildItemChanges(h.state.collections, edited) });
  assert.equal(update.statusCode, 200);
  assert.equal(Object.hasOwn(h.state.collections[0].items[0], 'custom'), false);
});

test('reorders items without sending their contents', () => {
  const previous = [{ id: 'col', items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }];
  const next = [{ id: 'col', items: [...previous[0].items].reverse() }];
  const changes = buildItemChanges(previous, next);
  assert.deepEqual(changes[0], { collectionId: 'col', added: [], updated: [], deleted: [], order: ['b', 'a'] });
  assert.deepEqual(applyItemChanges(previous, changes), next);
});

test('lost responses can be retried without creating a second automation item', async () => {
  const state = initial();
  const next = copy(state.collections);
  next[0].items.push({ id: 'new', name: 'New' });
  const h = harness(state, { automations: [{ id: 'auto', trigger_data: { type: 'item_created', collectionId: 'tasks' }, actions_data: [{ type: 'create_item', collectionId: 'companies', fields: { name: 'Automatic' } }] }] });
  const payload = { stateVersion: 1, mutationId: randomUUID(), itemChanges: buildItemChanges(state.collections, next) };
  const first = await h.call(payload);
  const second = await h.call(payload);
  assert.equal(first.statusCode, 200);
  assert.deepEqual(second.body, first.body);
  assert.equal(h.writes, 1);
  assert.equal(h.automationLoads, 1);
  assert.equal(h.state.collections[1].items.length, 2);
});

test('rejects stale versions and invalid operations without a partial write', async () => {
  const state = initial();
  const next = copy(state.collections);
  next[0].items[0].name = 'Edited';
  const h = harness(state);
  const payload = { stateVersion: 1, mutationId: randomUUID(), itemChanges: buildItemChanges(state.collections, next) };
  assert.equal((await h.call({ ...payload, stateVersion: 2 })).statusCode, 409);
  assert.equal(h.writes, 0);
  payload.itemChanges[0].updated.push({ itemId: 'missing', fields: { name: 'bad' }, unset: [] });
  assert.equal((await h.call(payload)).statusCode, 400);
  assert.equal(h.writes, 0);
  assert.deepEqual(h.state, state);
});

test('checks permissions only for touched collections and rejects writes to forbidden ones', async () => {
  const state = initial();
  const next = copy(state.collections);
  next[0].items[0].name = 'Edited';
  const payload = { stateVersion: 1, mutationId: randomUUID(), itemChanges: buildItemChanges(state.collections, next) };
  assert.equal((await harness(state, { denied: ['companies'] }).call(payload)).statusCode, 200);
  const denied = harness(state, { denied: ['tasks'] });
  assert.equal((await denied.call(payload)).statusCode, 403);
  assert.equal(denied.writes, 0);
});

test('keeps the legacy full-state API and advertises the new capability', async () => {
  const state = initial(), h = harness(state);
  assert.equal((await h.call({ ...state, stateVersion: 1 }, 'POST', '/api/state')).statusCode, 200);
  const response = await h.call(undefined, 'GET', '/api/state');
  assert.equal(response.body.supportsItemChanges, true);
  assert.equal(Object.hasOwn(response.body, '_lastItemMutation'), false);
});

test('masks password values in the reply and receipt, encrypts storage', async () => {
  const previousKey = process.env.FIELD_ENCRYPTION_KEY;
  process.env.FIELD_ENCRYPTION_KEY = 'item-changes-test';
  try {
    const state = initial();
    state.collections[0].properties.push({ id: 'secret', type: 'password' });
    const next = copy(state.collections);
    next[0].items[0].secret = 'private-value';
    const h = harness(state);
    const response = await h.call({ stateVersion: 1, mutationId: randomUUID(), itemChanges: buildItemChanges(state.collections, next) });
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.stringify(response.body).includes('private-value'), false);
    assert.equal(h.raw.includes('private-value'), false);
    assert.equal(h.state.collections[0].items[0].secret, 'private-value');
  } finally {
    if (previousKey === undefined) delete process.env.FIELD_ENCRYPTION_KEY;
    else process.env.FIELD_ENCRYPTION_KEY = previousKey;
  }
});


test('detects a concurrent legacy write even when it did not increment the version', async () => {
  const state = initial(), next = copy(state.collections), concurrent = initial();
  next[0].items[0].name = 'My edit';
  concurrent.collections[1].items.push({ id: 'remote', name: 'Another session' });
  const h = harness(state, { concurrentState: concurrent });
  const response = await h.call({ stateVersion: 1, mutationId: randomUUID(), itemChanges: buildItemChanges(state.collections, next) });
  assert.equal(response.statusCode, 409);
  assert.equal(h.writes, 0);
  assert.deepEqual(h.state, concurrent);
});

test('preserves update and deletion automations on the targeted path', async () => {
  const state = initial(), next = copy(state.collections);
  next[0].items[0].name = 'Edited';
  const h = harness(state, { automations: [
    { id: 'updated', trigger_data: { type: 'item_updated', collectionId: 'tasks', watchFields: ['name'] }, actions_data: [{ type: 'update_field', collectionId: 'tasks', fieldId: 'status', value: 'auto' }] },
    { id: 'deleted', trigger_data: { type: 'item_deleted', collectionId: 'tasks' }, actions_data: [{ type: 'create_item', collectionId: 'companies', fields: { name: 'Deleted task' } }] },
  ] });
  const updated = await h.call({ stateVersion: 1, mutationId: randomUUID(), itemChanges: buildItemChanges(state.collections, next) });
  assert.equal(updated.statusCode, 200);
  assert.equal(h.state.collections[0].items[0].status, 'auto');
  const without = copy(h.state.collections);
  without[0].items = [];
  const deleted = await h.call({ stateVersion: 2, mutationId: randomUUID(), itemChanges: buildItemChanges(h.state.collections, without) });
  assert.equal(deleted.statusCode, 200);
  assert.equal(h.state.collections[0].items.length, 0);
  assert.equal(h.state.collections[1].items.length, 2);
});

test('rebases independent updates on the same item and rejects competing values', async () => {
  const state = initial();
  const h = harness(state);
  const mutation = (fields) => {
    const next = copy(state.collections);
    Object.assign(next[0].items[0], fields);
    return { stateVersion: 1, mutationId: randomUUID(), itemChanges: buildItemChanges(state.collections, next, true) };
  };

  assert.equal((await h.call(mutation({ name: 'Alice' }))).statusCode, 200);
  const independent = mutation({ obsolete: 'Bob' });
  const merged = await h.call(independent);
  assert.equal(merged.statusCode, 200);
  assert.equal(merged.body.stateVersion, 3);
  assert.deepEqual(merged.body.rebasedCollections[0].items[0], {
    id: 'a', name: 'Alice', obsolete: 'Bob', _eventSegments: [],
  });
  assert.deepEqual((await h.call(independent)).body, merged.body);

  assert.equal((await h.call(mutation({ name: 'Charlie' }))).statusCode, 409);
  assert.equal(h.writes, 2);
  assert.equal(h.state.collections[0].items[0].name, 'Alice');
});

test('retries a compatible item update when another write wins the SQL race', async () => {
  const state = initial();
  const concurrentState = copy(state);
  concurrentState.collections[1].items[0].name = 'Other session';
  const h = harness(state, { concurrentState, bumpConcurrentVersion: true });
  const next = copy(state.collections);
  next[0].items[0].name = 'My edit';
  const reply = await h.call({
    stateVersion: 1, mutationId: randomUUID(), itemChanges: buildItemChanges(state.collections, next, true),
  });
  assert.equal(reply.statusCode, 200);
  assert.equal(reply.body.stateVersion, 3);
  assert.equal(h.state.collections[0].items[0].name, 'My edit');
  assert.equal(h.state.collections[1].items[0].name, 'Other session');
});

test('a confirmed replacement checks that the reviewed value is still current', async () => {
  const state = initial();
  const h = harness(state);
  const mutation = (name, stateVersion, previous = state.collections) => {
    const next = copy(previous);
    next[0].items[0].name = name;
    return { stateVersion, mutationId: randomUUID(), itemChanges: buildItemChanges(previous, next, true) };
  };

  await h.call(mutation('First value', 1));
  const local = mutation('My value', 1);
  const firstConflict = await h.call(local);
  assert.equal(firstConflict.statusCode, 409);
  assert.deepEqual(firstConflict.body.conflicts, [
    { collectionId: 'tasks', itemId: 'a', key: 'name', current: 'First value' },
  ]);

  await h.call(mutation('Newer value', 2, h.state.collections));
  local.itemChanges[0].updated[0].previous.name = firstConflict.body.conflicts[0].current;
  const secondConflict = await h.call(local);
  assert.equal(secondConflict.statusCode, 409);
  assert.equal(secondConflict.body.conflicts[0].current, 'Newer value');

  local.itemChanges[0].updated[0].previous.name = secondConflict.body.conflicts[0].current;
  assert.equal((await h.call(local)).statusCode, 200);
  assert.equal(h.state.collections[0].items[0].name, 'My value');
});

test('conflict details omit values the caller cannot read', async () => {
  const state = initial();
  const h = harness(state, { unreadable: ['name'] });
  const edit = (name) => {
    const next = copy(state.collections);
    next[0].items[0].name = name;
    return { stateVersion: 1, mutationId: randomUUID(), itemChanges: buildItemChanges(state.collections, next, true) };
  };
  await h.call(edit('Private value'));
  const reply = await h.call(edit('Other value'));
  assert.equal(reply.statusCode, 409);
  assert.equal(reply.body.conflicts, undefined);
});

test('a Steam exchange survives the save response when the received game is created in the same save', async () => {
  const exchangeField = '_steamExchangeReceivedIds';
  const state = initial();
  state.collections[0].plugins = { steam: { role: 'games' } };
  const next = copy(state.collections);
  next[0].items[0][exchangeField] = ['received'];
  next[0].items.push({ id: 'received', name: 'Jeu reçu' });
  const h = harness(state);
  const save = async (previous, updated, stateVersion) => h.call({
    stateVersion,
    mutationId: randomUUID(),
    itemChanges: buildItemChanges(previous, updated, true),
  });

  const response = await save(state.collections, next, 1);
  assert.equal(response.statusCode, 200);
  const synced = applyItemChanges(state.collections, response.body.itemChanges);
  assert.deepEqual(synced[0].items[0][exchangeField], ['received']);
  assert.deepEqual(h.state.collections[0].items[0][exchangeField], ['received']);

  const cancelled = copy(synced);
  cancelled[0].items[0][exchangeField] = [];
  const cancellation = await save(synced, cancelled, 2);
  assert.equal(cancellation.statusCode, 200);
  assert.deepEqual(h.state.collections[0].items[0][exchangeField], []);
});
