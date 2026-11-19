import * as ReactModule from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { normalizePinnedFields, usePinnedItemFields } from './usePinnedItemFields';

vi.mock('react', { spy: true });
let state: any;
let storage: Map<string, string>;
beforeEach(() => {
  state = undefined;
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  vi.spyOn(ReactModule, 'useState').mockImplementation(((initial: any) => {
    if (state === undefined) state = typeof initial === 'function' ? initial() : initial;
    return [state, (next: any) => { state = next; }];
  }) as typeof ReactModule.useState);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('pins multiple fields and remembers each original-placement choice across reopening', () => {
  let result = usePinnedItemFields('org', 'user', 'collection');
  result.update('status', true);
  result = usePinnedItemFields('org', 'user', 'collection');
  result.update('price', true, false);
  result = usePinnedItemFields('org', 'user', 'collection');
  result.update('status', true, false);
  state = undefined;
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
