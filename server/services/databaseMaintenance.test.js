import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createDatabaseMaintenance } from './databaseMaintenance.js';
const response = () => Object.assign(new EventEmitter(), { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.body = data; } });
test('drains existing requests and rejects new work while restoring', async () => {
  const maintenance = createDatabaseMaintenance();
  const req = {}; const res = response(); const restore = {}; const restoreRes = response();
  maintenance.middleware(req, res, () => {});
  maintenance.middleware(restore, restoreRes, () => {});
  let ran = false;
  const operation = maintenance.run(restore, async () => { ran = true; });
  const blocked = response(); maintenance.middleware({}, blocked, () => assert.fail());
  assert.equal(blocked.code, 503); assert.equal(ran, false);
  res.emit('finish'); await operation;
  assert.equal(ran, true);
  let resumed = false; maintenance.middleware({}, response(), () => { resumed = true; });
  assert.equal(resumed, true);
});
test('a failed restore or drain timeout always reopens requests without running the operation', async () => {
  const maintenance = createDatabaseMaintenance({ timeoutMs: 5 });
  await assert.rejects(maintenance.run({}, async () => { throw new Error('restore failed'); }), /restore failed/);
  maintenance.middleware({}, response(), () => {});
  let ran = false;
  await assert.rejects(maintenance.run({}, async () => { ran = true; }), /requêtes sont encore en cours/);
  assert.equal(ran, false);
  let resumed = false; maintenance.middleware({}, response(), () => { resumed = true; });
  assert.equal(resumed, true);
});
