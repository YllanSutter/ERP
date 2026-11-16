import { normalizeSearch } from './recentItems';
export type SelectOption = string | { value: string; label?: string; color?: string; icon?: string };
export const optionValue = (option: SelectOption) => typeof option === 'string' ? option : option.value;
export const optionLabel = (option: SelectOption) => typeof option === 'string' ? option : option.label || option.value;
export function findMatchingOption(options: SelectOption[], text: string) {
  const query = normalizeSearch(text);
  return options.find(option => normalizeSearch(optionValue(option)) === query || normalizeSearch(optionLabel(option)) === query);
}
export function appendSelectOption(collections: any[], collectionId: string, propertyId: string, label: string, appearance: { color?: string; icon?: string } = {}) {
  const text = label.trim();
  if (!text) return collections;
  return collections.map(collection => collection.id !== collectionId ? collection : {
    ...collection,
    properties: collection.properties.map((property: any) => property.id !== propertyId || !['select', 'multiselect', 'multi_select'].includes(property.type) || findMatchingOption(property.options || [], text)
      ? property : { ...property, options: [...(property.options || []), { value: text, label: text, color: appearance.color || '#8b5cf6', ...(appearance.icon ? { icon: appearance.icon } : {}) }] }),
  });
}
