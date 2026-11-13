/** Normalize stored colors to six-digit hexadecimal; empty colors inherit their context. */
export function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color)) return '#' + color.slice(1).split('').map((char) => char + char).join('');
  return null;
}

/** The first populated color property in collection order supplies the item's accent. */
export function getItemColorValue(item: Record<string, unknown>, properties: Array<{ id: string; type: string }> = []): string | undefined {
  for (const property of properties) {
    if (property.type !== 'color') continue;
    const color = normalizeColor(item[property.id]);
    if (color) return color;
  }
  return undefined;
}
