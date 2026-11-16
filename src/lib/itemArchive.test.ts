import { describe, it, expect } from 'vitest';
import { archiveItems, restoreArchivedItem, purgeArchivedItem, visibleCollections } from './itemArchive';
import { useItems } from './hooks/useItems';

const initial = () => [
  { id: 'tasks', properties: [], items: [{ id: 'a', name: 'A', secret: 'kept' }, { id: 'b', name: 'B' }] },
  { id: 'links', properties: [{ id: 'many', type: 'relation', relation: { targetCollectionId: 'tasks' } }, { id: 'one', type: 'relation', relation: { targetCollectionId: 'tasks' } }], items: [{ id: 'link', many: ['a', 'b'], one: 'a' }] },
];

describe('item archives', () => {
  it('archives a selection without losing fields or relations and hides it from normal views', () => {
    const before = initial();
    const archived = archiveItems(before, 'tasks', ['a', 'b']);
    expect(visibleCollections(archived)[0].items).toEqual([]);
    expect(archived[0].items[0]).toMatchObject({ name: 'A', secret: 'kept', _archivedAt: expect.any(String) });
    expect(archived[1]).toEqual(before[1]);
    expect(before[0].items[0]).not.toHaveProperty('_archivedAt');
  });

  it('restores the exact original item with its links intact', () => {
    const before = initial();
    expect(restoreArchivedItem(archiveItems(before, 'tasks', ['a']), 'tasks', 'a')).toEqual(before);
  });

  it('only purges archived items and cleans scalar and multiple relations', () => {
    const before = initial();
    expect(purgeArchivedItem(before, 'tasks', 'a')).toBe(before);
    const after = purgeArchivedItem(archiveItems(before, 'tasks', ['a']), 'tasks', 'a');
    expect(after[0].items.map((item: any) => item.id)).toEqual(['b']);
    expect(after[1].items[0]).toMatchObject({ many: ['b'], one: null });
  });

  it('routes both deletion entry points through functional archive updates', () => {
    let state: any[] = initial();
    const hooks = useItems(state, (update: any) => { state = typeof update === 'function' ? update(state) : update; }, 'tasks');
    hooks.deleteItem('a');
    hooks.bulkDeleteItems(['b']);
    expect(state[0].items).toHaveLength(2);
    expect(visibleCollections(state)[0].items).toHaveLength(0);
    hooks.restoreItem('a', 'tasks');
    hooks.permanentlyDeleteItem('b', 'tasks');
    expect(state[0].items).toEqual([initial()[0].items[0]]);
  });
});
