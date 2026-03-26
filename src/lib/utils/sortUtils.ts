/**
 * Compare deux valeurs pour le tri, avec gestion des null/undefined, nombres et strings.
 */
export function compareValues(a: any, b: any, direction: 'asc' | 'desc'): number {
  if (a === undefined || a === null || a === '') return 1;
  if (b === undefined || b === null || b === '') return -1;
  const dir = direction === 'asc' ? 1 : -1;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
  return String(a).localeCompare(String(b), 'fr', { numeric: true, sensitivity: 'base' }) * dir;
}
