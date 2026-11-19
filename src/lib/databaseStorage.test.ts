import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { clearDatabaseStorage, databaseStorage, flushDatabaseStorage, initializeDatabaseStorage } from './databaseStorage';
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
  expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
    organizationId: 'org', entries: { 'erp-theme': 'light', 'erp-item-draft:c:new': null },
  });
  expect(legacy.size).toBe(0);
});
it('imports without overwriting the database and only cleans acknowledged legacy keys', async () => {
  legacy.set('erp-theme', 'light');
  legacy.set('erp-item-versions:other:c:i', 'restricted');
  legacy.set('other-app', 'keep');
  request.mockResolvedValueOnce(ok({ entries: { 'erp-theme': 'dark' } }))
    .mockResolvedValueOnce(ok({ entries: { 'erp-theme': 'dark' }, importedKeys: ['erp-theme'] }));
  await initializeDatabaseStorage('u', 'org');
  expect(databaseStorage.getItem('erp-theme')).toBe('dark');
  expect(legacy.has('erp-theme')).toBe(false);
  expect(legacy.get('erp-item-versions:other:c:i')).toBe('restricted');
  expect(legacy.get('other-app')).toBe('keep');
});
it('retains local originals if import fails', async () => {
  legacy.set('erp-item-draft:c:new', 'precious');
  request.mockResolvedValueOnce(ok({ entries: {} })).mockResolvedValueOnce({ ok: false });
  await expect(initializeDatabaseStorage('u', 'org')).rejects.toThrow();
  expect(legacy.get('erp-item-draft:c:new')).toBe('precious');
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
