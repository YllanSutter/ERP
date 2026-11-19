import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { clearDatabaseStorage, databaseStorage, flushDatabaseStorage, initializeDatabaseStorage, claimLegacyStorage, getLegacyClaims, getDraftRecoveries, refreshDatabaseStorage } from './databaseStorage';
let legacy: Map<string, string>;
let request: ReturnType<typeof vi.fn>;
const ok = (body: unknown) => ({ ok: true, json: async () => body });
beforeEach(() => {
  vi.useFakeTimers();
  clearDatabaseStorage();
  legacy = new Map();
  vi.stubGlobal('window', {
    localStorage: {
      get length() { return legacy.size; },
      key: (index: number) => [...legacy.keys()][index],
      getItem: (key: string) => legacy.get(key) ?? null,
      removeItem: (key: string) => legacy.delete(key),
    },
    dispatchEvent: vi.fn(),
  });
  request = vi.fn();
  vi.stubGlobal('fetch', request);
});
afterEach(() => { clearDatabaseStorage(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('hydrates before reading and persists deletions and changes per organization', async () => {
  request.mockResolvedValueOnce(ok({ entries: { 'erp-theme': 'dark', 'erp-item-draft:c:new': 'draft' } }));
  await initializeDatabaseStorage('user', 'org');
  expect(databaseStorage.getItem('erp-theme')).toBe('dark');
  databaseStorage.removeItem('erp-item-draft:c:new');
  databaseStorage.setItem('erp-theme', 'light');
  request.mockResolvedValueOnce(ok({ ok: true }));
  await flushDatabaseStorage();
  expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({
    organizationId: 'org', entries: { 'erp-theme': 'light', 'erp-item-draft:c:new': null },
  });
  expect(legacy.size).toBe(0);
});
it('imports without overwriting the database and only cleans acknowledged legacy keys', async () => {
  legacy.set('erp-pinned-item-fields:org:u:c', '[]');
  legacy.set('erp-item-versions:other:c:i', 'restricted');
  legacy.set('other-app', 'keep');
  request.mockResolvedValueOnce(ok({ entries: { 'erp-theme': 'dark' } }))
    .mockResolvedValueOnce(ok({ entries: { 'erp-theme': 'dark' }, importedKeys: ['erp-pinned-item-fields:org:u:c'] }));
  await initializeDatabaseStorage('u', 'org');
  expect(databaseStorage.getItem('erp-theme')).toBe('dark');
  expect(legacy.has('erp-pinned-item-fields:org:u:c')).toBe(false);
  expect(legacy.get('erp-item-versions:other:c:i')).toBe('restricted');
  expect(legacy.get('other-app')).toBe('keep');
});
it('retains local originals if import fails', async () => {
  legacy.set('erp-item-versions:org:c:i', 'precious');
  request.mockResolvedValueOnce(ok({ entries: {} })).mockResolvedValueOnce({ ok: false });
  await expect(initializeDatabaseStorage('u', 'org')).rejects.toThrow();
  expect(legacy.get('erp-item-versions:org:c:i')).toBe('precious');
});
it('retries a failed batch without losing newer edits', async () => {
  request.mockResolvedValueOnce(ok({ entries: {} }));
  await initializeDatabaseStorage('u', 'org');
  databaseStorage.setItem('erp-theme', 'dark');
  request.mockRejectedValueOnce(new Error('offline'));
  await expect(flushDatabaseStorage()).rejects.toThrow('offline');
  databaseStorage.setItem('erp-theme', 'light');
  request.mockResolvedValueOnce(ok({ ok: true }));
  await flushDatabaseStorage();
  expect(JSON.parse(request.mock.calls.at(-1)![1].body).entries['erp-theme']).toBe('light');
});
it('clears the memory cache between users', async () => {
  request.mockResolvedValueOnce(ok({ entries: { 'erp-item-draft:c:new': 'private' } }))
    .mockResolvedValueOnce(ok({ entries: {} }));
  await initializeDatabaseStorage('alice', 'org');
  await initializeDatabaseStorage('bob', 'org');
  expect(databaseStorage.getItem('erp-item-draft:c:new')).toBe(null);
});
it('works with browser storage disabled', async () => {
  Object.defineProperty(window, 'localStorage', { get() { throw new Error('disabled'); } });
  request.mockResolvedValueOnce(ok({ entries: { 'erp-theme': 'dark' } }));
  await initializeDatabaseStorage('u', 'org');
  expect(databaseStorage.getItem('erp-theme')).toBe('dark');
});
it('does not resurrect another account cache when an old request finishes after logout', async () => {
  let resolve!: (value: unknown) => void;
  request.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const hydration = initializeDatabaseStorage('alice', 'org');
  await Promise.resolve();
  clearDatabaseStorage();
  resolve(ok({ entries: { 'erp-item-draft:c:new': 'alice private' } }));
  await expect(hydration).rejects.toThrow('Session changed');
  expect(databaseStorage.getItem('erp-item-draft:c:new')).toBe(null);
});

it('leaves ambiguous and foreign legacy values untouched until explicitly claimed', async () => {
  legacy.set('erp-item-draft:c:new', 'mine?');
  legacy.set('erp-pinned-item-fields:other:u:c', '[]');
  legacy.set('erp-pinned-item-fields:org:other:c', '[]');
  request.mockResolvedValueOnce(ok({ entries: {} }));
  await initializeDatabaseStorage('u', 'org');
  expect(request).toHaveBeenCalledTimes(1);
  expect(getLegacyClaims()).toEqual({ 'erp-item-draft:c:new': 'mine?' });
  expect(legacy.size).toBe(3);
  request.mockResolvedValueOnce(ok({ entries: { 'erp-item-draft:c:new': 'mine?' }, importedKeys: ['erp-item-draft:c:new'] }));
  await claimLegacyStorage();
  expect(JSON.parse(request.mock.calls[1][1].body).claimUnscoped).toBe(true);
  expect(legacy.size).toBe(2);
});
it('refreshes remote preferences without replacing pending edits', async () => {
  request.mockResolvedValueOnce(ok({ entries: { 'erp-theme': 'dark' } }));
  await initializeDatabaseStorage('u', 'org');
  request.mockResolvedValueOnce(ok({ entries: { 'erp-theme': 'light' } }));
  await refreshDatabaseStorage();
  expect(databaseStorage.getItem('erp-theme')).toBe('light');
  databaseStorage.setItem('erp-theme', 'dark');
  await refreshDatabaseStorage();
  expect(request).toHaveBeenCalledTimes(2);
  expect(databaseStorage.getItem('erp-theme')).toBe('dark');
});
it('uses the confirmed draft baseline and exposes server-preserved conflicts', async () => {
  request.mockResolvedValueOnce(ok({ entries: { 'erp-item-draft:c:new': 'baseline' } }));
  await initializeDatabaseStorage('u', 'org');
  databaseStorage.setItem('erp-item-draft:c:new', 'my edit');
  const recovery = JSON.stringify({ draftKey: 'erp-item-draft:c:new', value: 'my edit' });
  request.mockResolvedValueOnce(ok({ entries: { 'erp-item-draft:c:new': 'remote edit', 'erp-draft-recovery:hash': recovery } }));
  await flushDatabaseStorage();
  expect(JSON.parse(request.mock.calls[1][1].body).expected).toEqual({ 'erp-item-draft:c:new': 'baseline' });
  expect(databaseStorage.getItem('erp-item-draft:c:new')).toBe('remote edit');
  expect(getDraftRecoveries()[0].value).toBe('my edit');
});
it('saves large item histories without the browser keepalive size limit', async () => {
  request.mockResolvedValueOnce(ok({ entries: {} }));
  await initializeDatabaseStorage('u', 'org');
  const history = JSON.stringify({ base: { notes: 'x'.repeat(100000), status: 'todo' }, versions: [] });
  databaseStorage.setItem('erp-item-versions:org:c:i', history);
  request.mockResolvedValueOnce(ok({ ok: true }));
  await flushDatabaseStorage();
  const options = request.mock.calls[1][1];
  expect(options.keepalive).toBe(false);
  expect(JSON.parse(options.body).entries['erp-item-versions:org:c:i']).toBe(history);
});
it('applies a delta acknowledgement without discarding unrelated preferences', async () => {
  request.mockResolvedValueOnce(ok({entries:{'erp-theme':'dark',calendarViewMode:'month'}}));
  await initializeDatabaseStorage('u','org');databaseStorage.setItem('erp-theme','light');
  request.mockResolvedValueOnce(ok({partial:true,entries:{'erp-theme':'light'}}));
  await flushDatabaseStorage();
  expect(databaseStorage.getItem('calendarViewMode')).toBe('month');
  expect(JSON.parse(request.mock.calls[1][1].body).delta).toBe(true);
});
it('does not parse or reapply unchanged preference responses', async () => {
  request.mockResolvedValueOnce({...ok({entries:{'erp-theme':'dark'}}),headers:{get:()=> 'version-1'}});
  await initializeDatabaseStorage('u','org');
  const json=vi.fn();request.mockResolvedValueOnce({ok:false,status:304,json});
  await refreshDatabaseStorage();
  expect(json).not.toHaveBeenCalled();
  expect(request.mock.calls[1][1].headers['If-None-Match']).toBe('version-1');
});
