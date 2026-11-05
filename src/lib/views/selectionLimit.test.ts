import { describe, expect, it } from 'vitest';
import { getSelectionLimit, toggleLimitedSelection } from '@/lib/utils/selectionLimit';

describe('limited multi-selection', () => {
  it('treats empty and invalid limits as unlimited', () => {
    expect(['', undefined, null, 0, -1, 1.5, 'wrong'].map(getSelectionLimit))
      .toEqual(Array(7).fill(undefined));
    expect(getSelectionLimit('2')).toBe(2);
  });

  it('replaces the selection for a one-value limit, including older over-limit data', () => {
    expect(toggleLimitedSelection(['a'], 'b', 1)).toEqual(['b']);
    expect(toggleLimitedSelection(['a'], 'a', 1)).toEqual(['a']);
    expect(toggleLimitedSelection(['a', 'b'], 'b', 1)).toEqual(['b']);
  });

  it('allows removals at the limit and prevents additions past it', () => {
    expect(toggleLimitedSelection(['a', 'b'], 'c', 2)).toEqual(['a', 'b']);
    expect(toggleLimitedSelection(['a', 'b'], 'a', 2)).toEqual(['b']);
    expect(toggleLimitedSelection(['a'], 'b', 2)).toEqual(['a', 'b']);
    expect(toggleLimitedSelection(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
  });
});
