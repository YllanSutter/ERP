import { describe, expect, it } from 'vitest';
import { createTemporaryRelationView, splitTemporaryView } from './temporaryRelationView';
import { getFilteredItems } from '../filterUtils';

const collection = {
  id: 'sites', properties: [{ id: 'status', type: 'text' }],
  pinnedFilters: [{ property: 'status', operator: 'equals', value: 'active' }],
  items: [{ id: 's1', status: 'active' }, { id: 's2', status: 'done' }, { id: 's3', status: 'done' }],
};

describe('temporary relation views', () => {
  it('opens a fresh table with only linked items, ignoring pinned and previous view filters', () => {
    const view = createTemporaryRelationView();
    expect(view.type).toBe('table');
    expect(view.filters).toEqual([]);
    expect(view.groups).toEqual([]);
    expect(getFilteredItems(collection, view, { collectionId: 'sites', ids: ['s2'] }, 'sites', [collection])).toEqual([collection.items[1]]);
  });
  it('leaves saved view filtering unchanged', () => {
    expect(getFilteredItems(collection, { filters: [] }, { collectionId: null, ids: [] }, 'sites', [collection])).toEqual([collection.items[0]]);
  });
  it('keeps an empty relation empty', () => {
    expect(getFilteredItems(collection, createTemporaryRelationView(), { collectionId: 'sites', ids: [] }, 'sites', [collection])).toEqual([]);
  });
  it('keeps temporary configuration out of persisted views', () => {
    const temporary = createTemporaryRelationView();
    const saved = { id: 'saved', filters: [{ property: 'status', value: 'active' }] };
    const updated = { ...temporary, hiddenFields: ['status'] };
    const result = splitTemporaryView({ sites: [saved, updated] }, 'sites', temporary.id);
    expect(result.saved).toEqual({ sites: [saved] });
    expect(result.temporary).toEqual(updated);
    expect(saved.filters).toEqual([{ property: 'status', value: 'active' }]);
  });
});
