import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { pdfServerPlugin } from './index.js';

test('template routes only expose models from the active organization', async (t) => {
  const routes = new Map();
  const app = {
    post() {},
    get(path, ...handlers) {
      routes.set(path, handlers.at(-1));
    },
  };
  const templates = [
    { id: 'tpl_a', organizationId: 'org-a', name: 'Model A' },
    { id: 'tpl_b', organizationId: 'org-b', name: 'Model B' },
    { id: 'tpl_orphan', name: 'Unassigned model' },
  ];

  t.mock.method(fs, 'mkdirSync', () => {});
  t.mock.method(fs, 'existsSync', () => true);
  t.mock.method(fs, 'readdirSync', () => templates.map(({ id }) => `${id}.meta.json`));
  t.mock.method(fs, 'readFileSync', (file) => {
    const template = templates.find(({ id }) => file.endsWith(`/${id}.meta.json`));
    return template ? JSON.stringify(template) : 'invalid metadata';
  });
  const stream = t.mock.method(fs, 'createReadStream', () => ({ pipe() {} }));

  pdfServerPlugin.register({ app, appContext: { requireAuth() {}, logger: console } });

  const request = async (path, organizationId, { query = {}, params = {} } = {}) => {
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
      },
      setHeader() {},
    };
    const auth = { activeOrganization: organizationId ? { id: organizationId } : null };
    await routes.get(path)({ auth, query, params }, res);
    return res;
  };

  const list = '/api/plugins/pdf/templates';
  const download = '/api/plugins/pdf/templates/:templateId/file';

  const ownList = await request(list, 'org-a', { query: { organizationId: 'org-b' } });
  assert.deepEqual(ownList.body, [templates[0]]);
  assert.equal((await request(list, null)).statusCode, 403);

  for (const templateId of ['tpl_b', 'tpl_orphan', 'tpl_invalid']) {
    assert.equal((await request(download, 'org-a', { params: { templateId } })).statusCode, 404);
  }
  assert.equal((await request(download, null, { params: { templateId: 'tpl_a' } })).statusCode, 403);
  assert.equal(stream.mock.callCount(), 0);

  assert.equal((await request(download, 'org-a', { params: { templateId: 'tpl_a' } })).statusCode, 200);
  assert.equal(stream.mock.callCount(), 1);
});
