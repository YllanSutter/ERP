import { expect, it } from 'vitest';
import { mergeSavedCollections } from './mergeSavedCollections';

it('preserves new edits, additions and deletions alongside server automation results', () => {
  const submitted = [{ id: 'tasks', items: [{ id: 'a', name: 'old', date: 'initial' }, { id: 'deleted' }] }];
  const saved = [{ id: 'tasks', items: [{ id: 'a', name: 'old', date: 'calculated' }, { id: 'deleted' }, { id: 'auto' }] }];
  const local = [{ id: 'tasks', items: [{ id: 'a', name: 'new', date: 'initial' }, { id: 'added' }] }];
  expect(mergeSavedCollections(submitted, saved, local)[0].items).toEqual([
    { id: 'a', name: 'new', date: 'calculated' }, { id: 'added' }, { id: 'auto' },
  ]);
});


it('applies server deletions while keeping a newer local edit', () => {
  const submitted = [{ id: 'tasks', items: [{ id: 'a', name: 'old' }, { id: 'b', name: 'old' }] }];
  const saved = [{ id: 'tasks', items: [] }];
  const local = [{ id: 'tasks', items: [{ id: 'a', name: 'new' }, { id: 'b', name: 'old' }] }];
  expect(mergeSavedCollections(submitted, saved, local)[0].items).toEqual([{ id: 'a', name: 'new' }]);
});

it('keeps a newer calendar edit marked for preservation after the first save', () => {
  const first = {
    id: 'a',
    _eventSegments: [{ start: '2026-11-04T09:00:00Z', end: '2026-11-04T10:00:00Z' }],
    _preserveEventSegments: true,
  };
  const second = {
    ...first,
    _eventSegments: [{ start: '2026-11-04T09:00:00Z', end: '2026-11-04T11:00:00Z' }],
  };
  const acknowledged = { id: first.id, _eventSegments: first._eventSegments };
  const collection = (item: object) => [{ id: 'tasks', items: [item] }];

  expect(mergeSavedCollections(collection(first), collection(acknowledged), collection(second))[0].items)
    .toEqual([second]);
  expect(mergeSavedCollections(collection(first), collection(acknowledged), collection(first))[0].items)
    .toEqual([acknowledged]);
});
