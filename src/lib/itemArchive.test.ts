import { describe, it, expect } from 'vitest';
import { archiveItems, restoreArchivedItem, purgeArchivedItem, visibleCollections, getArchivePage } from './itemArchive';
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

describe('archive browsing', () => {
  const collection = {
    id: 'sites',
    properties: [{ id: 'name', type: 'text' }],
    items: Array.from({ length: 613 }, (_, index) => ({
      id: `site-${index + 1}`, name: `Site ${index + 1}`,
      _archivedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    })),
  };

  it('paginates hundreds of items, with stable sorting and no lost or repeated rows', () => {
    const seen: string[] = [];
    for (let page = 1; page <= 25; page++) {
      const result = getArchivePage(collection, '', 'name', page);
      expect(result.total).toBe(613);
      expect(result.pageCount).toBe(25);
      expect(result.items.length).toBeLessThanOrEqual(25);
      seen.push(...result.items.map(({ item }: any) => item.id));
    }
    expect(new Set(seen).size).toBe(613);
    expect(seen).toEqual(collection.items.map((item) => item.id));
    const last = getArchivePage(collection, '', 'name', 25);
    expect([last.first, last.last]).toEqual([601, 613]);
  });

  it('searches case and accent independently, excludes active items, and sorts both date directions', () => {
    const data = { ...collection, items: [...collection.items, { id: 'accent', name: 'École de Paris', _archivedAt: '2026-02-01T00:00:00.000Z' }, { id: 'active', name: 'École active' }] };
    expect(getArchivePage(data, ' ECOLE ').items.map(({ item }: any) => item.id)).toEqual(['accent']);
    expect(getArchivePage(data, 'site-613').items.map(({ item }: any) => item.id)).toEqual(['site-613']);
    expect(getArchivePage(data, '', 'newest').items[0].item.id).toBe('accent');
    expect(getArchivePage(data, '', 'oldest').items[0].item.id).toBe('site-1');
    expect(getArchivePage(data).total).toBe(614);
  });

  it('clamps an out-of-range page after restoration or filtering, including empty results', () => {
    expect(getArchivePage(collection, 'Site 613', 'newest', 25)).toMatchObject({ page: 1, pageCount: 1, first: 1, last: 1, filteredTotal: 1 });
    expect(getArchivePage(collection, 'Unknown', 'newest', 25)).toMatchObject({ page: 1, pageCount: 1, first: 0, last: 0, items: [], total: 613, filteredTotal: 0 });
    const small = { ...collection, items: collection.items.slice(0, 26) };
    const restored = restoreArchivedItem([small], small.id, 'site-26')[0];
    expect(getArchivePage(restored, '', 'name', 2)).toMatchObject({ page: 1, pageCount: 1, total: 25 });
  });
});
