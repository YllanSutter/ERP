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
