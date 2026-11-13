export function isTotalFieldVisible(id: string, hiddenFields: string[] = [], overrides: Record<string, boolean> = {}): boolean {
  return typeof overrides[id] === 'boolean' ? overrides[id] : !hiddenFields.includes(id);
}
