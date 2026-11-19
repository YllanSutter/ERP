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
function setup(rows = [], checkPermission = (_ctx, scope) => scope.field_id !== 'secret') {
  const routes = {};
  const calls = [];
  const client = { query: async (...args) => { calls.push(args); return { rows }; }, release() {} };
  const pool = { query: client.query, connect: async () => client };
  registerBrowserStateRoutes({ app: Object.fromEntries(['get', 'patch', 'post'].map(method => [method, (path, ...handlers) => { routes[`${method} ${path}`] = handlers.at(-1); }])),
    appContext: { pool, requireAuth() {}, hasPermission: checkPermission, logger: { error() {} } } });
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
  assert.deepEqual(calls.find(([sql]) => sql.startsWith('SELECT key, value'))[1].slice(0, 3), ['org', 'alice', 'organization']);
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
  req.body = { claimUnscoped: true, entries: { 'erp-theme': 'light', 'erp-item-versions:other:c:i': '{}' } };
  await routes['post /api/browser-state/import'](req, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body.importedKeys, ['erp-theme']);
  assert.match(calls.find(([sql]) => sql.startsWith('INSERT'))[0], /DO NOTHING/);
  assert.deepEqual(calls.find(([sql]) => sql.startsWith('INSERT'))[1], ['alice', 'erp-theme', 'light']);
});

test('requires explicit ownership claims and rejects another user or organization even when claiming', async () => {
  const { routes, calls, req, res } = setup();
  req.body = { entries: { 'erp-theme': 'light', 'erp-pinned-item-fields:org:bob:c': '[]' } };
  await routes['post /api/browser-state/import'](req, res);
  assert.deepEqual(res.body.importedKeys, []);
  assert.equal(calls.some(([sql]) => sql.startsWith('INSERT')), false);
  req.body.claimUnscoped = true;
  await routes['post /api/browser-state/import'](req, res);
  assert.deepEqual(res.body.importedKeys, ['erp-theme']);
});
test('preserves an imported conflicting draft separately without overwriting the canonical version', async () => {
  const current = JSON.stringify({ formData: { name: 'server' } });
  const incoming = JSON.stringify({ formData: { name: 'local' } });
  const { routes, calls, req, res } = setup([{ key: 'erp-item-draft:c:new', value: current }]);
  req.body = { claimUnscoped: true, entries: { 'erp-item-draft:c:new': incoming } };
  await routes['post /api/browser-state/import'](req, res);
  assert.equal(res.code, 200);
  const inserts = calls.filter(([sql]) => sql.startsWith('INSERT'));
  assert.equal(inserts.length, 1);
  assert.match(inserts[0][1][2], /^erp-draft-recovery:/);
  assert.equal(JSON.parse(inserts[0][1][3]).value, incoming);
  assert.deepEqual(res.body.importedKeys, ['erp-item-draft:c:new']);
});
test('retains incoming edits from another tab when its draft baseline is stale', async () => {
  const { routes, calls, req, res } = setup([{ key: 'erp-item-draft:c:new', value: 'other tab' }]);
  req.body = { expected: { 'erp-item-draft:c:new': 'old' }, entries: { 'erp-item-draft:c:new': 'my edit' } };
  await routes['patch /api/browser-state'](req, res);
  assert.equal(res.code, 200);
  const insert = calls.find(([sql]) => sql.startsWith('INSERT'));
  assert.match(insert[1][2], /^erp-draft-recovery:/);
  assert.equal(JSON.parse(insert[1][3]).value, 'my edit');
});

test('can save a kanban/calendar edit history with unchanged read-only fields in its baseline', async () => {
  const canEditStatusAndDate = (_ctx, scope, action) => action === 'can_read' || !['reference'].includes(scope.field_id);
  const { routes, req, res } = setup([], canEditStatusAndDate);
  req.body = { entries: {
    'erp-item-versions:org:c:i': JSON.stringify({ base: { reference: 'read-only', status: 'todo', date: '2026-11-19' }, versions: [
      { id: 'move', ts: 'now', action: 'update', patch: { set: { status: 'done', date: '2026-11-20' }, unset: [] } },
    ] }),
    'calendarViewMode': 'week',
  } };
  await routes['patch /api/browser-state'](req, res);
  assert.equal(res.code, 200);
});
test('still refuses new history changes to a read-only field', async () => {
  const { routes, req, res } = setup([], (_ctx, scope, action) => action === 'can_read' || scope.field_id !== 'reference');
  req.body = { entries: { 'erp-item-versions:org:c:i': JSON.stringify({ base: { reference: 'before' }, versions: [
    { id: 'tampered', patch: { set: { reference: 'forged' }, unset: [] } },
  ] }) } };
  await routes['patch /api/browser-state'](req, res);
  assert.equal(res.code, 403);
});
test('retains historical changes from another author when adding an authorized change', async () => {
  const original = { base: { reference: 'before', status: 'todo' }, versions: [
    { id: 'admin-change', patch: { set: { reference: 'after' }, unset: [] } },
  ] };
  const { routes, req, res } = setup([{ key: 'erp-item-versions:org:c:i', value: JSON.stringify(original) }], (_ctx, scope, action) => action === 'can_read' || scope.field_id !== 'reference');
  req.body = { entries: { 'erp-item-versions:org:c:i': JSON.stringify({ ...original, versions: [...original.versions,
    { id: 'my-move', patch: { set: { status: 'done' }, unset: [] } },
  ] }) } };
  await routes['patch /api/browser-state'](req, res);
  assert.equal(res.code, 200);
});

test('appearance writes target the account while view choices stay in the organization', async () => {
  const { routes, calls, req, res } = setup();
  req.body = { userId: 'alice', entries: { 'erp-theme': 'dark', calendarViewMode: 'week' } };
  await routes['patch /api/browser-state'](req,res);
  assert.equal(res.code,200);
  const account = calls.find(([sql]) => sql.startsWith('INSERT INTO user_state'));
  const scoped = calls.find(([sql]) => sql.startsWith('INSERT INTO browser_state'));
  assert.deepEqual(account[1],['alice','erp-theme','dark']);
  assert.deepEqual(scoped[1],['org','alice','calendarViewMode','week']);
});
test('a tab from another logged-in account cannot overwrite global appearance', async () => {
  const { routes, calls, req, res } = setup();
  req.body = { userId: 'bob', entries: { 'erp-theme': 'dark' } };
  await routes['patch /api/browser-state'](req,res);
  assert.equal(res.code,409);
  assert.equal(calls.length,0);
});
