vi.mock('@/lib/databaseStorage', () => ({ subscribeDatabaseStorage: () => () => {}, databaseStorage: { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value), removeItem: (key: string) => localStorage.removeItem(key) } }));
import * as ReactModule from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { normalizePinnedFields, usePinnedItemFields } from './usePinnedItemFields';

vi.mock('react', { spy: true });
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.spyOn(ReactModule, 'useSyncExternalStore').mockImplementation((_subscribe, getSnapshot) => getSnapshot());
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('pins multiple fields and remembers each original-placement choice across reopening', () => {
  let result = usePinnedItemFields('org', 'user', 'collection');
  result.update('status', true);
  result = usePinnedItemFields('org', 'user', 'collection');
  result.update('price', true, false);
  result = usePinnedItemFields('org', 'user', 'collection');
  result.update('status', true, false);
  result = usePinnedItemFields('org', 'user', 'collection');
  expect(result.fields).toEqual([{ id: 'status', keepOriginal: false }, { id: 'price', keepOriginal: false }]);
  result.update('status', false);
  expect(usePinnedItemFields('org', 'user', 'collection').fields).toEqual([{ id: 'price', keepOriginal: false }]);
});

it('isolates preferences across collections, users and organizations without stale pins', () => {
  usePinnedItemFields('org', 'user', 'collection').update('status', true);
  expect(usePinnedItemFields('org', 'user', 'another').fields).toEqual([]);
  expect(usePinnedItemFields('org', 'another', 'collection').fields).toEqual([]);
  expect(usePinnedItemFields('another', 'user', 'collection').fields).toEqual([]);
  expect(usePinnedItemFields('org', 'user', 'collection').fields).toEqual([{ id: 'status', keepOriginal: true }]);
});

it('ignores corrupted preferences and duplicate ids', () => {
  expect(normalizePinnedFields([null, { id: 1 }, { id: 'status' }, { id: 'status', keepOriginal: false }])).toEqual([{ id: 'status', keepOriginal: true }]);
  expect(normalizePinnedFields({})).toEqual([]);
  storage.set('erp-pinned-item-fields:org:user:collection', 'invalid json');
  expect(usePinnedItemFields('org', 'user', 'collection').fields).toEqual([]);
});

it('shares changes between property settings and the item header without losing other pins', () => {
  const propertySettings = usePinnedItemFields('org', 'user', 'collection');
  const itemHeader = usePinnedItemFields('org', 'user', 'collection');
  propertySettings.update('status', true, false);
  itemHeader.update('price', true);
  expect(usePinnedItemFields('org', 'user', 'collection').fields).toEqual([
    { id: 'status', keepOriginal: false }, { id: 'price', keepOriginal: true },
  ]);
});
