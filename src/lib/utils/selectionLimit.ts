export function getSelectionLimit(value: unknown): number | undefined {
  const limit = Number(value);
  return Number.isInteger(limit) && limit > 0 ? limit : undefined;
}

export function toggleLimitedSelection(values: string[], value: string, maxValues?: number): string[] {
  if (maxValues === 1) return [value];
  if (values.includes(value)) return values.filter((selected) => selected !== value);
  if (maxValues !== undefined && values.length >= maxValues) return values;
  return [...values, value];
}
