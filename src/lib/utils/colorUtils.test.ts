import { describe, expect, it } from 'vitest';
import { getItemColorValue, normalizeColor } from './colorUtils';

describe('item color properties', () => {
  const properties = [{ id: 'note', type: 'text' }, { id: 'accent', type: 'color' }, { id: 'other', type: 'color' }];
  it('uses the first valid populated color field', () => {
    expect(getItemColorValue({ note: '#ffffff', accent: '', other: '#ABC' }, properties)).toBe('#aabbcc');
    expect(getItemColorValue({ accent: '#112233', other: '#445566' }, properties)).toBe('#112233');
    expect(getItemColorValue({ accent: 'invalid', other: '#445566' }, properties)).toBe('#445566');
  });
  it('inherits the contextual color when no color is set', () => {
    expect(getItemColorValue({}, properties)).toBeUndefined();
    expect(getItemColorValue({ note: '#ffffff' }, [{ id: 'note', type: 'text' }])).toBeUndefined();
    expect(getItemColorValue({})).toBeUndefined();
  });
  it('rejects malformed values', () => {
    expect(normalizeColor(null)).toBeNull();
    expect(normalizeColor({})).toBeNull();
    expect(normalizeColor('#12345g')).toBeNull();
    expect(normalizeColor(' #ABCDEF ')).toBe('#abcdef');
  });
});
