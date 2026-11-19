import test from 'node:test';
import assert from 'node:assert/strict';
import { registerBackupRoutes } from './backupRoutes.js';
import { backupScope } from '../services/backupService.js';
const ORG = '00000000-0000-0000-0000-000000000001';
const OTHER = '00000000-0000-0000-0000-000000000002';
const ownFile = `org-backup-${ORG}-test.tar`;
const otherFile = `org-backup-${OTHER}-test.tar`;
function setup() {
  const handlers = new Map(); const calls = [];
  const app = Object.fromEntries(['get','post','delete'].map(method => [method, (route, _auth, handler) => handlers.set(`${method} ${route}`, handler)]));
  registerBackupRoutes({ app, appContext: {
    logger: { error() {} }, requireAuth() {}, logAudit: async () => {},
    isSiteCreator: async id => id === 'owner',
    withDatabaseMaintenance: async (req, run) => { calls.push('maintenance'); return run(); },
    backup: { backupScope, resolveBackupPath: name => `/tmp/${name}`, formatBackupError: err => err.message,
      getBackupStatus: () => ({ enabled: true }),
      listBackups: async () => [ownFile,otherFile,'db-backup-full.tar'].map(name => ({ name, ...backupScope(name) })),
      createOrganizationBackup: async (...args) => { calls.push(['createOrg', ...args]); return { name: ownFile }; },
      createDbBackup: async () => { calls.push('createFull'); return { name: 'full.tar' }; },
      restoreOrganizationBackup: async (...args) => calls.push(['restoreOrg', ...args]),
      restoreDbBackup: async () => calls.push('restoreFull'),
    },
  } });
  const invoke = async (method, route, { name = ownFile, user = 'admin', role = 'admin', body = {}, query = {} } = {}) => {
    const req = { params: { name }, body, query, auth: { user: { id: user }, roles: [{ name: role }], activeOrganization: { id: ORG } } };
    const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.body = data; return this; } };
    await handlers.get(`${method} ${route}`)(req, res);
    return res;
  };
  return { invoke, calls };
}
test('lists only the active organization by default and hides global backups from its admins', async () => {
  const { invoke } = setup();
  assert.deepEqual((await invoke('get','/api/db/backups')).body.map(b => b.name), [ownFile]);
  assert.equal((await invoke('get','/api/db/backups',{ query: { scope: 'database' } })).code, 403);
  assert.deepEqual((await invoke('get','/api/db/backups',{ user: 'owner', query: { scope: 'database' } })).body.map(b => b.name), ['db-backup-full.tar']);
});
test('an organization admin cannot download, delete or restore another organization or a full database backup', async () => {
  for (const [method,route] of [['get','/api/db/backups/:name'],['delete','/api/db/backups/:name'],['post','/api/db/backups/:name/restore']]) {
    const { invoke, calls } = setup();
    for (const name of [otherFile,'db-backup-full.tar']) assert.equal((await invoke(method,route,{name,body:{scope:'organization',organizationId:ORG}})).code,403);
    assert.deepEqual(calls,[]);
  }
});
test('creation and restoration always use the authenticated active organization', async () => {
  const { invoke, calls } = setup();
  assert.equal((await invoke('post','/api/db/backups',{ body: { organizationId: OTHER } })).code,200);
  assert.deepEqual(calls[1],['createOrg',ORG,'']);
  assert.equal((await invoke('post','/api/db/backups/:name/restore',{ body:{organizationId:OTHER} })).code,200);
  assert.deepEqual(calls[3],['restoreOrg',ownFile,ORG,'admin']);
});
test('only the creator can restore the complete database, with an explicit confirmation', async () => {
  const { invoke, calls } = setup();
  assert.equal((await invoke('post','/api/db/backups/:name/restore',{name:'full.sql',user:'owner'})).code,400);
  assert.equal((await invoke('post','/api/db/backups/:name/restore',{name:'full.sql',user:'owner',body:{confirmScope:'database'}})).code,200);
  assert.deepEqual(calls,['maintenance','restoreFull']);
  assert.equal((await invoke('get','/api/db/backups/status')).body.canManageDatabaseBackups,false);
  assert.equal((await invoke('get','/api/db/backups/status',{user:'owner'})).body.canManageDatabaseBackups,true);
  assert.equal((await invoke('post','/api/db/backups',{role:'viewer'})).code,403);
});
