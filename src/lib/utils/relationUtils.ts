/**
 * Normalise une valeur de relation (scalaire ou tableau) en tableau d'IDs.
 */
export function normalizeRelationIds(value: any): string[] {
  if (Array.isArray(value)) return value;
  if (value) return [value];
  return [];
}
