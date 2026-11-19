import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackupScheduler, createScopedBackupOperations } from './backupScheduler.js';
const NOW = Date.parse('2026-11-19T12:00:00Z');
function setup({ backups = [], fail = false, intervalMinutes = 1440 } = {}) {
  const timers = []; const calls = [];
  const scheduler = createBackupScheduler({ intervalMinutes, now: () => NOW,
    listBackups: async () => backups,
    createBackup: async label => { calls.push(label); if (fail) throw new Error('disk full'); return { name: 'valid.tar', createdAt: new Date(NOW), size: 100 }; },
    logger: { info() {}, error() {} }, schedule: (fn, delay) => { timers.push({ fn, delay }); return 1; }, cancel: () => calls.push('cancel'),
  });
  return { scheduler, timers, calls };
}
test('creates a backup immediately on startup if absent or overdue', async () => {
  for (const backups of [[], [{ size: 100, createdAt: new Date(NOW - 2 * 86400000) }]]) {
    const { scheduler, timers, calls } = setup({ backups });
    await scheduler.start();
    assert.deepEqual(calls, ['auto']);
    assert.equal(timers[0].delay, 86400000);
    assert.equal(scheduler.getStatus().lastError, null);
    assert.equal(scheduler.getStatus().lastSuccessAt, new Date(NOW).toISOString());
  }
});
test('restarts do not postpone the next backup past the last success plus interval', async () => {
  const { scheduler, timers, calls } = setup({ backups: [{ size: 100, createdAt: new Date(NOW - 3600000) }] });
  await scheduler.start();
  assert.deepEqual(calls, []);
  assert.equal(timers[0].delay, 23 * 3600000);
});
test('reports failures and retries within five minutes', async () => {
  const { scheduler, timers } = setup({ fail: true });
  await scheduler.start();
  assert.equal(timers[0].delay, 300000);
  assert.ok(scheduler.getStatus().lastError);
  assert.equal(scheduler.getStatus().running, false);
});
test('disabled or invalid intervals never run and stop cancels the next attempt', async () => {
  for (const intervalMinutes of [0, -1, NaN, Infinity, 99999999]) {
    const { scheduler, timers, calls } = setup({ intervalMinutes });
    await scheduler.start();
    assert.equal(scheduler.getStatus().enabled, false);
    assert.deepEqual(calls, []);
    assert.equal(timers.length, 0);
  }
  const { scheduler, timers, calls } = setup();
  await scheduler.start(); scheduler.stop(); await timers[0].fn();
  assert.deepEqual(calls, ['auto', 'cancel']);
});

test('a complete backup never hides a missing organization backup from the scheduler', async () => {
  const calls = [];
  const operations = createScopedBackupOperations({
    pool: { query: async () => ({ rows: [{ id:'A' },{ id:'B' }] }) },
    listBackups: async () => [{scope:'database',size:100,createdAt:new Date(NOW)}, {scope:'organization',organizationId:'A',size:100,createdAt:new Date(NOW)}],
    createOrganizationBackup: async (id,label) => calls.push([id,label]),
    createDbBackup: async label => { calls.push(['database',label]); return { name:'full.tar', createdAt:new Date(NOW) }; },
  });
  assert.deepEqual(await operations.listBackups(),[]);
  await operations.createBackup('auto');
  assert.deepEqual(calls,[['A','auto'],['B','auto'],['database','auto']]);
});
test('automatic freshness uses the oldest required scope, not the newest manual backup', async () => {
  const oldest = new Date(NOW-2*86400000);
  const operations = createScopedBackupOperations({
    pool: { query: async () => ({rows:[{id:'A'}]}) },
    listBackups: async () => [{scope:'database',size:100,createdAt:new Date(NOW)}, {scope:'organization',organizationId:'A',size:100,createdAt:oldest}],
  });
  assert.equal((await operations.listBackups())[0].createdAt,oldest);
});
