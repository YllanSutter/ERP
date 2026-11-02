export const GROUPING_SELECTION_CHANGE_EVENT = 'erp:grouping-selection-change';

/**
 * Persists a grouping choice and notifies other mounted views in this tab.
 * The native `storage` event only reaches other browser tabs, hence this small
 * companion event for Table, Cards and future renderers.
 */
export function saveGroupingSelection(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new CustomEvent(GROUPING_SELECTION_CHANGE_EVENT, {
      detail: { key, value },
    }));
  } catch {
    // A grouping choice must never make a view unusable when storage is unavailable.
  }
}

const groupSelectionKey = (collectionId: string) => `erp:group-selection:${collectionId}`;

export function readGroupFieldSelections(collectionId: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(groupSelectionKey(collectionId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** A collection-level selection is independent from a renderer and group order. */
export function saveGroupFieldSelection(collectionId: string, fieldId: string, path: string) {
  if (!fieldId || !path) return;
  const key = groupSelectionKey(collectionId);
  const next = { ...readGroupFieldSelections(collectionId), [fieldId]: path };
  saveGroupingSelection(key, JSON.stringify(next));
}

export const getGroupSelectionStorageKey = groupSelectionKey;
