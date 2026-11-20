import test from 'node:test';
import assert from 'node:assert/strict';
import { registerUserAccessRoutes } from './userAccessRoutes.js';

const USER = '00000000-0000-0000-0000-000000000002';

const setup = ({ isSiteAdmin = false, targetExists = true } = {}) => {
  const routes = new Map();
  const changes = [];
  const app = Object.fromEntries(['get', 'post', 'delete', 'patch'].map((method) => [method, (path, ...handlers) => routes.set(`${method} ${path}`, handlers.at(-1))]));
  registerUserAccessRoutes({ app, appContext: {
    logger: { error() {} }, pool: { query: async () => ({ rowCount: targetExists ? 1 : 0, rows: targetExists ? [{ id: USER }] : [] }) },
    bcrypt: {}, requireAuth() {}, requirePermission() {}, requireBaseAdminOrPermission() {}, logAudit: async () => {},
    wouldRemoveLastOrganizationAdmin: async () => false, isSiteCreator: async () => isSiteAdmin,
    setSiteAdministrator: async (...args) => changes.push(args),
  } });
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  return { routes, changes, response };
};

test('only a super administrator can grant or revoke super administrator status', async () => {
  const denied = setup();
  const deniedRes = denied.response();
  await denied.routes.get('patch /api/users/:id/site-admin')({ params: { id: USER }, body: { enabled: true }, auth: { user: { id: 'ordinary-user' } } }, deniedRes);
  assert.equal(deniedRes.code, 403);
  assert.deepEqual(denied.changes, []);

  const allowed = setup({ isSiteAdmin: true });
  const allowedRes = allowed.response();
  await allowed.routes.get('patch /api/users/:id/site-admin')({ params: { id: USER }, body: { enabled: true }, auth: { user: { id: 'super-user' } } }, allowedRes);
  assert.equal(allowedRes.code, 200);
  assert.equal(allowed.changes.length, 1);
  assert.equal(allowed.changes[0][1], USER);
  assert.equal(allowed.changes[0][2], true);
});

test('super administrator status requires an existing account and a boolean value', async () => {
  const { routes, changes, response } = setup({ isSiteAdmin: true, targetExists: false });
  const missingRes = response();
  await routes.get('patch /api/users/:id/site-admin')({ params: { id: USER }, body: { enabled: true }, auth: { user: { id: 'super-user' } } }, missingRes);
  assert.equal(missingRes.code, 404);

  const invalidRes = response();
  await routes.get('patch /api/users/:id/site-admin')({ params: { id: USER }, body: { enabled: 'yes' }, auth: { user: { id: 'super-user' } } }, invalidRes);
  assert.equal(invalidRes.code, 400);
  assert.deepEqual(changes, []);
});
