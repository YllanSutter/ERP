import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShutdownHandler } from './shutdownService.js';

test('drains requests before backup, closes database afterwards, handles duplicate signals', async () => {
  const calls = [];
  const shutdown = createShutdownHandler({
    getSockets: () => ({ close: (done) => { calls.push('sockets'); done(); } }),
    getServer: () => ({ listening: true, close: (done) => { calls.push('requests'); done(); } }),
    stopBackups: () => calls.push('stop-timer'),
    createBackup: async (label) => { calls.push(label); return { name: 'backup.sql' }; },
    closeDatabase: async () => calls.push('database'),
    logger: { info() {}, error() {} },
    exit: (code) => calls.push(`exit-${code}`),
  });
  await Promise.all([shutdown('SIGTERM'), shutdown('SIGINT')]);
  assert.deepEqual(calls, ['stop-timer', 'sockets', 'requests', 'shutdown', 'database', 'exit-0']);
});

test('closes database and reports failure if backup fails', async () => {
  const calls = [];
  await createShutdownHandler({
    getSockets: () => null,
    getServer: () => ({ listening: false }),
    stopBackups() {},
    createBackup: async () => { throw new Error('disk full'); },
    closeDatabase: async () => calls.push('database'),
    logger: { info() {}, error: () => calls.push('error') },
    exit: (code) => calls.push(code),
  })('SIGTERM');
  assert.deepEqual(calls, ['error', 'database', 1]);
});
