import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyPatch, buildSnapshotAt, compactHistory, computePatch, historyKey, readItemHistory, recordCollectionHistory, restoreHistorySnapshot } from './itemHistory';

const properties = [{ id: 'notes', type: 'rich_text' }, { id: 'secret', type: 'password' }];
const col = (items: any[]) => [{ id: 'c', properties, items }];
const user = { id: 'u', name: 'Yllan' };
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});

describe('compact item history', () => {
  it('round-trips rich documents losslessly and stores only the changed fragment', () => {
    const before = { notes: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(10000) + 'old' + 'z'.repeat(10000) }] }] }, status: 'Oui', removed: 1 };
    const after = JSON.parse(JSON.stringify(before));
    after.notes.content[0].content[0].text = after.notes.content[0].content[0].text.replace('old', 'new');
    delete after.removed;
    after.status = 'Non';
    const patch = computePatch(before, after);
    expect(patch.deltas?.notes).toBeDefined();
    expect(JSON.stringify(patch).length).toBeLessThan(200);
    expect(applyPatch(before, patch)).toEqual(after);
    expect(before.removed).toBe(1);
  });

  it('records inline edits with their actual before value and deduplicates acknowledged retries', () => {
    const old = { id: 'i', price: 39.79, notes: 'initial' };
    const edited = { ...old, price: 37.99 };
    recordCollectionHistory(col([old]), col([edited]), 'org', user);
    recordCollectionHistory(col([old]), col([edited]), 'org', user);
    const history = readItemHistory('org', col([])[0], 'i')!;
    expect(history.base.price).toBe(39.79);
    expect(history.versions).toHaveLength(2);
    expect(buildSnapshotAt(history.base, history.versions, 0)).toEqual(old);
    expect(buildSnapshotAt(history.base, history.versions, 1)).toEqual(edited);
    expect(history.versions[1].userId).toBe('u');
  });

  it('records creation, then relation and calendar updates through the same writer', () => {
    const created = { id: 'i', relation: [], date: '2026-11-19' };
    const related = { ...created, relation: ['other'] };
    const moved = { ...related, date: '2026-11-20' };
    recordCollectionHistory(col([]), col([created]), 'org', user);
    recordCollectionHistory(col([created]), col([related]), 'org', user);
    recordCollectionHistory(col([related]), col([moved]), 'org', user);
    const history = readItemHistory('org', col([])[0], 'i')!;
    expect(history.versions.map(v => v.action)).toEqual(['create', 'update', 'update']);
    expect(buildSnapshotAt(history.base, history.versions, 2)).toEqual(moved);
  });

  it('ignores derived data and strips passwords and plugin drafts', () => {
    const old = { id: 'i', name: 'old', secret: 'password', _eventSegments: [{ large: 'x'.repeat(10000) }] };
    const next = { ...old, name: 'new', __steamExchangeDrafts: [old] };
    recordCollectionHistory(col([old]), col([next]), 'org', user);
    const raw = storage.get(historyKey('org', 'c', 'i'))!;
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('_eventSegments');
    expect(raw).not.toContain('__steamExchangeDrafts');
    recordCollectionHistory(col([next]), col([{ ...next, _eventSegments: [] }]), 'org', user);
    expect(readItemHistory('org', col([])[0], 'i')!.versions).toHaveLength(2);
  });

  it('compacts legacy history while preserving every snapshot and version metadata', () => {
    const notes = 'a'.repeat(10000);
    const legacy = { base: { notes, secret: 'secret', _eventSegments: [] }, versions: [
      { id: 'old', ts: '2026-01-01', patch: { set: {}, unset: [] } },
      { ts: '2026-02-01', patch: { set: { notes: notes + '!' }, unset: [] } },
      { ts: '2026-03-01', patch: { set: {}, unset: ['notes'] } },
    ] };
    const compact = compactHistory(legacy, properties);
    expect(compact.versions).toHaveLength(3);
    expect(compact.versions[0].id).toBe('old');
    expect(buildSnapshotAt(compact.base, compact.versions, 1)).toEqual({ notes: notes + '!', secret: '********' });
    expect(buildSnapshotAt(compact.base, compact.versions, 2)).toEqual({ secret: '********' });
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(legacy).length * 0.6);
    expect(compactHistory(compact, properties)).toEqual(compact);
  });

  it('migrates legacy keys without duplicate storage and isolates organizations', () => {
    storage.set('erp-item-versions:c:i', JSON.stringify({ base: { id: 'i' }, versions: [] }));
    expect(readItemHistory('org', col([])[0], 'i')!.base).toEqual({ id: 'i' });
    expect(storage.has('erp-item-versions:c:i')).toBe(false);
    expect(storage.has(historyKey('org', 'c', 'i'))).toBe(true);
    storage.delete('erp-item-versions:c:i');
    expect(readItemHistory('another-org', col([])[0], 'i')).toBeNull();
  });

  it('keeps legacy history readable even when storage is full', () => {
    storage.set('erp-item-versions:c:i', JSON.stringify({ base: { id: 'i' }, versions: [] }));
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readItemHistory('org', col([])[0], 'i')!.base.id).toBe('i');
    vi.restoreAllMocks();
  });
});

it('restores editable values while preserving passwords, restrictions and generated metadata', () => {
  const live = { id: 'i', name: 'current', secret: 'actual password', restricted: 5, _eventSegments: [1], obsolete: 'remove', date_duration: 1 };
  const snapshot = { id: 'wrong-id', name: 'old', secret: '********', restricted: 1, _eventSegments: [2], date_duration: 2 };
  const result = restoreHistorySnapshot(live, snapshot, [
    { id: 'name' }, { id: 'secret', type: 'password' }, { id: 'restricted' }, { id: 'obsolete' }, { id: 'date', type: 'date' },
  ], id => id !== 'restricted');
  expect(result).toEqual({ id: 'i', name: 'old', secret: 'actual password', restricted: 5, _eventSegments: [1], date_duration: 2 });
});

it('preserves unreadable existing history rather than overwriting it', () => {
  const raw = '{broken';
  const key = historyKey('org', 'c', 'i');
  storage.set(key, raw);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  recordCollectionHistory(col([{ id: 'i', name: 'old' }]), col([{ id: 'i', name: 'new' }]), 'org', user);
  expect(storage.get(key)).toBe(raw);
  vi.restoreAllMocks();
});
