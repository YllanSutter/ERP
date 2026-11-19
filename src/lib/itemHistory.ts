import { databaseStorage } from '@/lib/databaseStorage';
/** Organization item history: one baseline, followed by lossless field deltas. */
export type HistoryPatch = { set: Record<string, any>; unset: string[]; deltas?: Record<string, [number, number, string]> };
export type ItemHistory = { base: any; versions: any[] };
const equal = (a: any, b: any) => a === b || JSON.stringify(a) === JSON.stringify(b);
export const historyKey = (organizationId: string, collectionId: string, itemId: string) =>
  `erp-item-versions:${organizationId}:${collectionId}:${itemId}`;

export function computePatch(previous: any = {}, next: any = {}): HistoryPatch {
  const patch: HistoryPatch = { set: {}, unset: [] };
  for (const key of Object.keys(next)) {
    if (equal(previous[key], next[key])) continue;
    const before = JSON.stringify(previous[key]);
    const after = JSON.stringify(next[key]);
    if (before && after && after.length > 128) {
      let start = 0;
      while (start < before.length && start < after.length && before[start] === after[start]) start++;
      let tail = 0;
      while (tail < before.length - start && tail < after.length - start && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
      const delta: [number, number, string] = [start, before.length - start - tail, after.slice(start, after.length - tail)];
      if (JSON.stringify(delta).length + 20 < after.length) {
        (patch.deltas ||= {})[key] = delta;
        continue;
      }
    }
    patch.set[key] = next[key];
  }
  for (const key of Object.keys(previous)) if (!(key in next)) patch.unset.push(key);
  return patch;
}

export function applyPatch(base: any, patch: HistoryPatch): any {
  const next = { ...base, ...patch.set };
  for (const key of patch.unset || []) delete next[key];
  for (const [key, [start, removed, inserted]] of Object.entries(patch.deltas || {})) {
    const value = JSON.stringify(base[key]);
    next[key] = JSON.parse(value.slice(0, start) + inserted + value.slice(start + removed));
  }
  return next;
}
export function buildSnapshotAt(base: any, versions: any[], index: number): any {
  let snapshot = { ...base };
  for (let i = 0; i <= index; i++) snapshot = applyPatch(snapshot, versions[i].patch || { set: {}, unset: [] });
  return snapshot;
}

export function sanitizeHistoryItem(item: any, properties: any[]): any {
  const secretIds = new Set(properties.filter(p => p.type === 'password').map(p => p.id));
  const result: any = {};
  for (const [key, value] of Object.entries(item || {})) {
    // Derived segments and editor/plugin drafts can be regenerated and are often large.
    if (key.startsWith('_')) continue;
    result[key] = secretIds.has(key) && value != null && value !== '' ? '********' : value;
  }
  return result;
}

/** Re-encode old patches without dropping any version or changing its metadata. */
export function compactHistory(history: ItemHistory, properties: any[]): ItemHistory {
  let original = history.base;
  let previous = sanitizeHistoryItem(original, properties);
  const base = previous;
  const versions = history.versions.map(version => {
    original = applyPatch(original, version.patch || { set: {}, unset: [] });
    const current = sanitizeHistoryItem(original, properties);
    const patch = computePatch(previous, current);
    previous = current;
    return { ...version, patch };
  });
  return { base, versions };
}
export function readItemHistory(organizationId: string, collection: any, itemId: string): ItemHistory | null {
  try {
    const key = historyKey(organizationId, collection.id, itemId);
    const legacyKey = `erp-item-versions:${collection.id}:${itemId}`;
    const scoped = databaseStorage.getItem(key);
    const raw = scoped || databaseStorage.getItem(legacyKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.base || !Array.isArray(parsed.versions)) return null;
    const compact = compactHistory(parsed, collection.properties || []);
    const encoded = JSON.stringify(compact);
    try {
      if (scoped !== encoded) databaseStorage.setItem(key, encoded);
      // Remove only the duplicate legacy copy after verifying the new write.
      if (!scoped && databaseStorage.getItem(key) === encoded) databaseStorage.removeItem(legacyKey);
    } catch (error) { console.warn('Impossible de compacter l’historique', error); }
    return compact;
  } catch { return null; }
}

/** Called only after the shared save path is acknowledged by the server. */
export function recordCollectionHistory(previous: any[], next: any[], organizationId: string, user: any) {
  let changed = false;
  for (const collection of next) {
    const priorCollection = previous.find(c => c.id === collection.id);
    if (priorCollection === collection || priorCollection?.items === collection.items) continue;
    const before = new Map((priorCollection?.items || []).map((item: any) => [item.id, item]));
    for (const item of collection.items || []) {
      const old = before.get(item.id);
      if (old && equal(old, item)) continue;
      try {
        const properties = collection.properties || [];
        const snapshot = sanitizeHistoryItem(item, properties);
        let history = readItemHistory(organizationId, collection, item.id);
        if (!history) {
          // Preserve unreadable existing data instead of replacing it with a new history.
          if (databaseStorage.getItem(historyKey(organizationId, collection.id, item.id)) ||
              databaseStorage.getItem(`erp-item-versions:${collection.id}:${item.id}`)) {
            throw new Error('Historique existant illisible : données conservées');
          }
          history = { base: sanitizeHistoryItem(old || item, properties), versions: [] };
        }
        const latest = buildSnapshotAt(history.base, history.versions, history.versions.length - 1);
        const patch = computePatch(latest, snapshot);
        const hasChanges = Object.keys(patch.set).length || patch.unset.length || Object.keys(patch.deltas || {}).length;
        if (!hasChanges && (old || history.versions.length)) continue;
        if (old && !history.versions.length) {
          history.versions.push({ id: crypto.randomUUID(), ts: new Date().toISOString(), userId: null, userName: 'État avant suivi',
            action: 'baseline', patch: { set: {}, unset: [] } });
        }
        history.versions.push({ id: crypto.randomUUID(), ts: new Date().toISOString(), userId: user?.id || null,
          userName: user?.name || user?.email || 'Utilisateur', action: old ? 'update' : 'create', patch });
        databaseStorage.setItem(historyKey(organizationId, collection.id, item.id), JSON.stringify(history));
        changed = true;
      } catch (error) { console.warn('Historique indisponible', error); }
    }
  }
  if (changed && typeof window !== 'undefined') window.dispatchEvent(new Event('erp-item-history-changed'));
}

/** Restore business fields only; keep live identity, metadata, secrets and restricted fields. */
export function restoreHistorySnapshot(live: any, snapshot: any, properties: any[], canWrite: (id: string) => boolean) {
  const restored = { ...live };
  for (const property of properties) {
    if (property.id === 'id' || property.type === 'password' || !canWrite(property.id)) continue;
    if (Object.hasOwn(snapshot, property.id)) restored[property.id] = snapshot[property.id];
    else delete restored[property.id];
    // Duration is an editable companion value of a date field.
    if (property.type === 'date') {
      const durationKey = `${property.id}_duration`;
      if (Object.hasOwn(snapshot, durationKey)) restored[durationKey] = snapshot[durationKey];
      else delete restored[durationKey];
    }
  }
  return restored;
}
