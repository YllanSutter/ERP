import { describe, expect, it } from 'vitest';
import { prefillRelationDraft } from './relationCreation';

const properties = [{ id: 'email', type: 'email' }, { id: 'title', type: 'text' }, { id: 'notes', type: 'text' }];
describe('relation creation from search', () => {
  it('prefills only the first plain text field and preserves other defaults', () => {
    const defaults = { title: 'Default', notes: 'Keep', email: 'a@b.fr' };
    expect(prefillRelationDraft(properties, defaults, '  Nouveau client  ')).toEqual({ title: 'Nouveau client', notes: 'Keep', email: 'a@b.fr' });
    expect(defaults.title).toBe('Default');
  });
  it('preserves defaults for an empty search', () => {
    expect(prefillRelationDraft(properties, { title: 'Default' }, '  ')).toEqual({ title: 'Default' });
  });
  it('does not inject text into a different field type', () => {
    expect(prefillRelationDraft([{ id: 'n', type: 'number' }], { n: 5 }, 'Client')).toEqual({ n: 5 });
  });
});

it('prioritizes the relation role over a conflicting default', () => {
  const fields = [{ id: 'role', type: 'select', options: [{ value: 'dev' }, { value: 'sales' }] }];
  expect(prefillRelationDraft(fields, { role: 'sales' }, '', { fieldId: 'role', value: 'DEV' })).toEqual({ role: 'dev' });
});

it('uses an array for a role with multiple values and keeps the searched name', () => {
  const fields = [{ id: 'name', type: 'text' }, { id: 'role', type: 'multi_select' }];
  expect(prefillRelationDraft(fields, { role: ['Commercial'] }, 'Test', { fieldId: 'role', value: 'Développeur' })).toEqual({ name: 'Test', role: ['Développeur'] });
});

it('ignores stale relation filters referencing a missing field', () => {
  expect(prefillRelationDraft(properties, { title: 'Default' }, '', { fieldId: 'missing', value: 'dev' })).toEqual({ title: 'Default' });
});
