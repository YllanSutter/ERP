import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerBrowserStateRoutes, validStorageEntries, isSharedStorageKey } from './browserStateRoutes.js';
test('validates persistence values and separates shared history from personal state', () => {
  assert.equal(validStorageEntries({ 'erp-theme': 'dark', 'erp-item-draft:c:new': null }), true);
  assert.equal(validStorageEntries({ unrelated: 'x' }), false);
  assert.equal(validStorageEntries({ 'erp-theme': { unexpected: true } }), false);
  assert.equal(isSharedStorageKey('erp-item-versions:org:c:i'), true);
  assert.equal(isSharedStorageKey('erp-item-draft:c:i'), false);
});
function setup(rows = []) {
  const routes = {};
  const calls = [];
  const client = { query: async (...args) => { calls.push(args); return { rows }; }, release() {} };
  const pool = { query: client.query, connect: async () => client };
  registerBrowserStateRoutes({ app: Object.fromEntries(['get', 'patch', 'post'].map(method => [method, (path, ...handlers) => { routes[`${method} ${path}`] = handlers.at(-1); }])),
    appContext: { pool, requireAuth() {}, hasPermission: (_ctx, scope) => scope.field_id !== 'secret', logger: { error() {} } } });
  const req = { auth: { user: { id: 'alice' }, activeOrganization: { id: 'org' } }, body: {} };
  const res = { code: 200, status(code) { this.code = code; return this; }, json(value) { this.body = value; return this; } };
  return { routes, calls, req, res };
}
test('reads only current user and organization state and hides restricted history', async () => {
  const { routes, calls, req, res } = setup([
    { key: 'erp-theme', value: 'dark' },
    { key: 'erp-item-versions:org:c:i', value: JSON.stringify({ base: { secret: 'hidden' }, versions: [] }) },
  ]);
  await routes['get /api/browser-state'](req, res);
  assert.deepEqual(calls[0][1], ['org', 'alice', 'organization']);
  assert.deepEqual(res.body.entries, { 'erp-theme': 'dark' });
});
test('rejects writes after an organization switch', async () => {
  const { routes, calls, req, res } = setup();
  req.body = { organizationId: 'other', entries: { 'erp-theme': 'dark' } };
  await routes['patch /api/browser-state'](req, res);
  assert.equal(res.code, 409);
  assert.equal(calls.length, 0);
});
test('imports idempotently and retains unauthorized originals in the browser', async () => {
  const { routes, calls, req, res } = setup();
  req.body = { entries: { 'erp-theme': 'light', 'erp-item-versions:other:c:i': '{}' } };
  await routes['post /api/browser-state/import'](req, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.importedKeys, ['erp-theme']);
  assert.match(calls.find(([sql]) => sql.startsWith('INSERT'))[0], /DO NOTHING/);
  assert.deepEqual(calls.find(([sql]) => sql.startsWith('INSERT'))[1], ['org', 'alice', 'erp-theme', 'light']);
});
