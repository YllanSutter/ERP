import { describe, expect, it } from 'vitest';
import { getFilteredItems } from '@/lib/filterUtils';

const sites = {
  id: 'sites',
  properties: [{ id: 'status', type: 'select' }, { id: 'owner', type: 'select' }],
  items: [
    { id: 's1', status: 'active', owner: 'a' },
    { id: 's2', status: 'active', owner: 'b' },
    { id: 's3', status: 'done', owner: 'a' },
  ],
  pinnedFilters: [{ property: 'status', operator: 'equals', value: ['active'] }],
};
const noRelation = { collectionId: null, ids: [] };

describe('collection view filters', () => {
  it('applies the pinned rules across views and intersects them with local rules', () => {
    const views = [
      { type: 'table' },
      { type: 'layout', filters: [{ property: 'owner', operator: 'equals', value: ['a'] }] },
    ];

    const ids = views.map((view) =>
      getFilteredItems(sites, view, noRelation, sites.id, [sites]).map(({ id }) => id)
    );

    expect(ids).toEqual([['s1', 's2'], ['s1']]);
  });

  it('keeps unrelated panels independent of the active collection relation filter', () => {
    const tasks = { id: 'tasks', properties: [], items: [{ id: 't1' }] };

    expect(getFilteredItems(tasks, {}, { collectionId: sites.id, ids: ['s1'] }, sites.id, [sites, tasks]))
      .toEqual(tasks.items);
  });
});
