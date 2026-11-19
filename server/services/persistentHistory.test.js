import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergePersistentHistory } from './persistentHistory.js';
test('merges concurrent versions and deduplicates retries without replaying stale string offsets', () => {
  const current = { base: { notes: 'old', price: 1 }, versions: [{ ts: '1', userId: 'a', action: 'update', patch: { set: { price: 2 }, unset: [] } }] };
  const incoming = { base: { notes: 'old', price: 1 }, versions: [{ ts: '2', userId: 'b', action: 'update', patch: { set: {}, unset: [], deltas: { notes: [1, 3, 'new'] } } }] };
  const merged = mergePersistentHistory(JSON.stringify(current), JSON.stringify(incoming));
  const result = JSON.parse(merged);
  assert.equal(result.versions.length, 2);
  assert.deepEqual(result.versions[1].patch, { set: { notes: 'new' }, unset: [] });
  assert.equal(mergePersistentHistory(merged, JSON.stringify(incoming)), merged);
  assert.deepEqual(result.base, current.base);
});
