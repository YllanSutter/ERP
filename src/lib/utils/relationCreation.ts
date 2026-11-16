/** Carry the search into the first plain text field, leaving other defaults intact. */
export function prefillRelationDraft(
  properties: { id: string; type: string; options?: (string | { value: string })[] }[],
  defaults: Record<string, unknown>,
  query: string,
  filter?: { fieldId: string; value: unknown },
): Record<string, unknown> {
  const firstText = properties.find(property => property.type === 'text');
  const text = query.trim();
  const draft = firstText && text ? { ...defaults, [firstText.id]: text } : { ...defaults };
  const field = filter && properties.find(property => property.id === filter.fieldId);
  if (!field || filter?.value === undefined || filter.value === null || filter.value === '') return draft;
  const option = field.options?.find(option => String(typeof option === 'string' ? option : option.value).toLowerCase() === String(filter.value).toLowerCase());
  const value = option ? (typeof option === 'string' ? option : option.value) : filter.value;
  draft[field.id] = ['multi_select', 'multiselect'].includes(field.type) ? [value]
    : field.type === 'number' ? Number(value)
    : field.type === 'checkbox' ? String(value).toLowerCase() === 'true'
    : value;
  return draft;
}
