import { describe, expect, it } from 'vitest';
import { newestFirst, normalizeSearch } from './recentItems';

describe('recent item search', () => {
  it('sorts creation dates and legacy timestamp IDs without mutating the source', () => {
    const items = [{ id: 'old', createdAt: '2024-01-01' }, { id: 'new_1735689600000' }, { id: '1735776000000-abc' }];
    expect(newestFirst(items).map(item => item.id)).toEqual(['1735776000000-abc', 'new_1735689600000', 'old']);
    expect(items[0].id).toBe('old');
  });
  it('uses reverse insertion order when creation dates are unavailable', () => {
    expect(newestFirst([{ id: 'a' }, { id: 'b' }]).map(item => item.id)).toEqual(['b', 'a']);
  });
  it('searches the entire set before limiting results', () => {
    const items = Array.from({ length: 550 }, (_, index) => ({ id: `${1700000000000 + index}-x` }));
    expect(newestFirst(items).slice(0, 12)[0]).toBe(items[549]);
  });
  it('ignores accents, case and surrounding whitespace', () => {
    expect(normalizeSearch('  ÉLÉMENT  ')).toBe('element');
  });
});
