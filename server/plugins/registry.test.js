import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerServerPlugin, notifyServerPluginsStateSaved } from './registry.js';

test('after-save notifications reach plugins and isolate extension failures', async () => {
  const received = [];
  registerServerPlugin({
    id: 'failing-save-test',
    register() {},
    onStateSaved() {
      throw new Error('plugin failure');
    },
  });
  registerServerPlugin({
    id: 'working-save-test',
    register() {},
    onStateSaved(ctx) {
      received.push(ctx.state);
    },
  });
  const errors = [];
  const state = { collections: [] };
  await notifyServerPluginsStateSaved({
    appContext: {
      logger: {
        error(...args) {
          errors.push(args);
        },
      },
    },
    state,
  });
  assert.deepEqual(received, [state]);
  assert.equal(errors.length, 1);
});
