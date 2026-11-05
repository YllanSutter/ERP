import { describe, expect, it } from 'vitest';
import type { Collection } from '@/lib/types';
import { getFilteredItems, routeLayoutFilters } from '@/lib/filterUtils';

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

it('keeps a pinned Tâches rule out of the Sites events in a shared calendar', () => {
  const ownerFilter = { sourceCollectionId: 'tasks', property: 'owner', operator: 'not_equals', value: ['yllan'] };
  const tasks = {
    id: 'tasks',
    properties: [{ id: 'owner', type: 'select' }],
    items: [{ id: 't1', owner: 'yllan' }, { id: 't2', owner: 'other' }],
  };
  const calendarSites = { ...sites, pinnedFilters: [...sites.pinnedFilters, ownerFilter] };
  const collections = [calendarSites, tasks];
  const view = { type: 'calendar', calendarCollectionIds: ['sites', 'tasks'] };

  expect(getFilteredItems(calendarSites, view, noRelation, 'sites', collections).map(({ id }) => id))
    .toEqual(['s1', 's2']);
  expect(getFilteredItems(tasks, { filters: [ownerFilter] }, noRelation, 'sites', collections).map(({ id }) => id))
    .toEqual(['t2']);
});

it.each(['pinned', 'layout'])('routes a %s rule to the agenda’s secondary collection', (scope) => {
  const ownerFilter = { sourceCollectionId: 'tasks', property: 'owner', operator: 'not_equals', value: ['yllan'] };
  const calendarSites = { ...sites, pinnedFilters: [...sites.pinnedFilters, ownerFilter] };
  const tasks = {
    id: 'tasks', name: 'Tâches',
    properties: [{ id: 'owner', name: 'Employé', type: 'select' }],
    items: [{ id: 't1', owner: 'yllan' }, { id: 't2', owner: 'other' }],
  };
  const owner = { ...(scope === 'pinned' ? calendarSites : sites), name: 'Sites' };
  const layoutFilters = scope === 'layout' ? [ownerFilter] : [];
  const collections = [owner, tasks] as Collection[];
  const routed = routeLayoutFilters(collections[0], collections, layoutFilters);

  expect(getFilteredItems(owner, { type: 'layout', filters: layoutFilters }, noRelation, 'sites', collections).map(({ id }) => id))
    .toEqual(['s1', 's2']);
  expect(getFilteredItems(routed[1], {}, noRelation, 'sites', routed).map(({ id }) => id))
    .toEqual(['t2']);
});

describe('a global rule with fields per collection', () => {
  const owner = {
    id: 'sites', name: 'Sites',
    properties: [
      { id: 'dev', name: 'Dev', type: 'relation', relation: { targetCollectionId: 'employees' } },
      { id: 'redac', name: 'Rédac', type: 'relation', relation: { targetCollectionId: 'employees' } },
    ],
    items: [
      { id: 'dev-site', dev: ['yllan'], redac: ['other'] },
      { id: 'redac-site', dev: ['other'], redac: ['yllan'] },
      { id: 'other-site', dev: ['other'], redac: [] },
    ],
  } as Collection;
  const tasks = {
    id: 'tasks', name: 'Tâches',
    properties: [{ id: 'employee', name: 'Employé', type: 'relation', relation: { targetCollectionId: 'employees' } }],
    items: [{ id: 'my-task', employee: ['yllan'] }, { id: 'other-task', employee: ['other'] }],
  } as Collection;
  const notes = { id: 'notes', name: 'Notes', properties: [], items: [{ id: 'note' }] } as Collection;
  const rule = {
    property: 'dev', sourceCollectionId: 'sites', operator: 'equals', value: ['yllan'],
    collectionFields: { sites: ['dev', 'redac'], tasks: ['employee'] },
  };

  it('accepts Dev OR Rédac and matches Employé separately without filtering Notes', () => {
    const globalOwner = { ...owner, pinnedFilters: [rule] };
    const collections = routeLayoutFilters(globalOwner, [globalOwner, tasks, notes]);
    expect(collections.map((collection) => getFilteredItems(collection, {}, noRelation, 'sites', collections).map(({ id }) => id)))
      .toEqual([['dev-site', 'redac-site'], ['my-task'], ['note']]);
  });

  it('excludes Yllan if any of the mapped fields contains that employee', () => {
    const collection = { ...owner, pinnedFilters: [{ ...rule, operator: 'not_equals' }] };
    expect(getFilteredItems(collection, {}, noRelation, 'sites', [collection]).map(({ id }) => id))
      .toEqual(['other-site']);
  });

  it('does not apply a legacy foreign global filter to the base table', () => {
    const collection = { ...owner, pinnedFilters: [{ property: 'employee', sourceCollectionId: 'tasks', operator: 'equals', value: ['yllan'] }] };
    expect(getFilteredItems(collection, { type: 'table' }, noRelation, 'sites', [collection, tasks]))
      .toEqual(owner.items);
  });

  it('resolves select options by label when their IDs differ across collections', () => {
    const primary = {
      id: 'sites', name: 'Sites', properties: [{ id: 'dev', name: 'Dev', type: 'select', options: [{ value: 'a', label: 'Yllan' }] }],
      items: [{ id: 'site', dev: 'a' }],
      pinnedFilters: [{ ...rule, value: ['a'], collectionFields: { sites: ['dev'], tasks: ['employee'] } }],
    } as unknown as Collection;
    const secondary = {
      id: 'tasks', name: 'Tâches', properties: [{ id: 'employee', name: 'Employé', type: 'select', options: [{ value: 'b', label: 'Yllan' }] }],
      items: [{ id: 'task', employee: 'b' }, { id: 'other', employee: 'c' }],
    } as unknown as Collection;
    const collections = routeLayoutFilters(primary, [primary, secondary]);
    expect(getFilteredItems(collections[1], {}, noRelation, 'sites', collections).map(({ id }) => id)).toEqual(['task']);
  });
});
