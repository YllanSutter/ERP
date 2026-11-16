import { describe, expect, it } from 'vitest';
import { appendSelectOption, findMatchingOption } from './selectOptions';

describe('inline select option creation', () => {
  it('recognizes existing labels and values ignoring accents and case', () => {
    const option = { value: 'dev', label: 'Développeur', color: '#123456' };
    expect(findMatchingOption([option], ' DEVeloppeur ')).toBe(option);
    expect(findMatchingOption([option], 'DEV')).toBe(option);
  });
  it('updates only the intended collection and field without mutating data', () => {
    const source = [{ id: 'a', properties: [{ id: 'role', type: 'multi_select', options: ['Dev'] }] }, { id: 'b', properties: [{ id: 'role', type: 'select', options: [] }] }];
    const result = appendSelectOption(source, 'a', 'role', '  Commercial  ');
    expect(result[0].properties[0].options).toEqual(['Dev', { value: 'Commercial', label: 'Commercial', color: '#8b5cf6' }]);
    expect(source[0].properties[0].options).toEqual(['Dev']);
    expect(result[1]).toBe(source[1]);
  });
  it('prevents duplicate, blank and non-select options', () => {
    const source = [{ id: 'a', properties: [{ id: 'role', type: 'select', options: ['Développeur'] }, { id: 'name', type: 'text', options: [] }] }];
    expect(appendSelectOption(source, 'a', 'role', 'developpeur')).toEqual(source);
    expect(appendSelectOption(source, 'a', 'role', '  ')).toBe(source);
    expect(appendSelectOption(source, 'a', 'name', 'No')).toEqual(source);
  });
  it('preserves the icon and color chosen before creating an option', () => {
    const source = [{ id: 'a', properties: [{ id: 'role', type: 'select', options: [] }] }];
    const result = appendSelectOption(source, 'a', 'role', 'Dev', { icon: 'Code', color: '#123456' });
    expect(result[0].properties[0].options).toEqual([{ value: 'Dev', label: 'Dev', icon: 'Code', color: '#123456' }]);
  });

});
