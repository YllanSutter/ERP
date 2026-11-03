type Collection = { id: string; items?: any[]; [key: string]: any };

// Conserver les calculs/automations du serveur ET les saisies faites durant la requête.
export function mergeSavedCollections(submitted: Collection[], saved: Collection[], local: Collection[]): Collection[] {
  const before = new Map(submitted.map((col) => [col.id, col]));
  const server = new Map(saved.map((col) => [col.id, col]));
  const merged = local.map((col) => {
    const base = before.get(col.id);
    const remote = server.get(col.id);
    if (!base || !remote) return col;
    const baseItems = new Map((base.items || []).map((item) => [item.id, item]));
    const remoteItems = new Map((remote.items || []).map((item) => [item.id, item]));
    const localIds = new Set((col.items || []).map((item) => item.id));
    return {
      ...remote, ...col,
      items: [
        ...(col.items || []).map((item) => {
          const previous = baseItems.get(item.id);
          const stored = remoteItems.get(item.id);
          if (!previous || !stored) return item;
          const result = { ...stored };
          for (const key of new Set([...Object.keys(previous), ...Object.keys(item)])) {
            if (JSON.stringify(previous[key]) === JSON.stringify(item[key])) continue;
            if (Object.hasOwn(item, key)) result[key] = item[key];
            else delete result[key];
          }
          return result;
        }),
        ...(remote.items || []).filter((item) => !baseItems.has(item.id) && !localIds.has(item.id)),
      ],
    };
  });
  const localIds = new Set(local.map((col) => col.id));
  return [...merged, ...saved.filter((col) => !before.has(col.id) && !localIds.has(col.id))];
}
