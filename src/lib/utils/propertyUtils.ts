export function cloneValue(value: any): any {
  if (value === null || typeof value !== 'object') return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export function getEmptyValueForProperty(prop: any): any {
  if (!prop) return '';
  if (prop.type === 'checkbox') return false;
  if (prop.type === 'multi_select' || prop.type === 'multiselect') return [];
  if (prop.type === 'number') return null;
  if (prop.type === 'date' || prop.type === 'date_range') return null;
  return '';
}
