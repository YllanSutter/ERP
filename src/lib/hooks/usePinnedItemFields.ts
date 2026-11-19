import { databaseStorage } from '@/lib/databaseStorage';
import { useState } from 'react';

export type PinnedItemField = { id: string; keepOriginal: boolean };
export function normalizePinnedFields(value: unknown): PinnedItemField[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter(entry => {
    if (!entry || typeof entry.id !== 'string' || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).map(entry => ({ id: entry.id, keepOriginal: entry.keepOriginal !== false }));
}
function read(key: string): PinnedItemField[] {
  try { return normalizePinnedFields(JSON.parse(databaseStorage.getItem(key) || '[]')); }
  catch { return []; }
}
export function usePinnedItemFields(organizationId: string, userId: string, collectionId: string) {
  const key = `erp-pinned-item-fields:${organizationId}:${userId}:${collectionId}`;
  const [state, setState] = useState(() => ({ key, fields: read(key) }));
  const fields = state.key === key ? state.fields : read(key);
  const update = (id: string, pinned: boolean, keepOriginal = true) => {
    const next = fields.filter(field => field.id !== id);
    if (pinned) {
      const index = fields.findIndex(field => field.id === id);
      next.splice(index < 0 ? next.length : index, 0, { id, keepOriginal });
    }
    setState({ key, fields: next });
    try { databaseStorage.setItem(key, JSON.stringify(next)); }
    catch (error) { console.warn('Impossible de mémoriser les champs épinglés', error); }
  };
  return { fields, update };
}
