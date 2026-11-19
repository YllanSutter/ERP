type Collection = { id: string; items?: any[]; [key: string]: any };

// Conserver les calculs/automations du serveur ET les saisies faites durant la requête.
export function mergeSavedCollections(submitted: Collection[], saved: Collection[], local: Collection[]): Collection[] {
  const before = new Map(submitted.map((col) => [col.id, col]));
  const server = new Map(saved.map((col) => [col.id, col]));
  const merged = local.map((col) => {
    const base = before.get(col.id);
    const remote = server.get(col.id);
    if (!base || !remote || remote === base) return col;
    const baseItems = new Map((base.items || []).map((item) => [item.id, item]));
    const remoteItems = new Map((remote.items || []).map((item) => [item.id, item]));
    const localIds = new Set((col.items || []).map((item) => item.id));
    const items = [
        ...(col.items || []).flatMap((item) => {
          const previous = baseItems.get(item.id);
          const stored = remoteItems.get(item.id);
          if (!previous) return [item];
          if (!stored) return JSON.stringify(item) === JSON.stringify(previous) ? [] : [item];
          if (stored === previous) return [item];
          const segmentsChanged = JSON.stringify(previous._eventSegments) !== JSON.stringify(item._eventSegments);
          const result = { ...stored };
          for (const key of new Set([...Object.keys(previous), ...Object.keys(item)])) {
            // Une nouvelle édition de segments réutilise parfois le même marqueur que la requête précédente.
            if (!(key === '_preserveEventSegments' && segmentsChanged) &&
                JSON.stringify(previous[key]) === JSON.stringify(item[key])) continue;
            if (Object.hasOwn(item, key)) result[key] = item[key];
            else delete result[key];
          }
          return [JSON.stringify(result) === JSON.stringify(item) ? item : result];
        }),
        ...(remote.items || []).filter((item) => !baseItems.has(item.id) && !localIds.has(item.id)),
      ];
    const unchanged = items.length === (col.items || []).length && items.every((item, index) => item === col.items![index]);
    if (unchanged && Object.keys(remote).every(key => key === 'items' || Object.hasOwn(col, key))) return col;
    return { ...remote, ...col, items };
  });
  const localIds = new Set(local.map((col) => col.id));
  const added = saved.filter((col) => !before.has(col.id) && !localIds.has(col.id));
  if (!added.length && merged.every((col, index) => col === local[index])) return local;
  return [...merged, ...added];
}
