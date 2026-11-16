export const isArchivedItem = (item: any): boolean => Boolean(item?._archivedAt);

export const visibleCollections = (collections: any[]) => collections.map((collection) => ({
  ...collection,
  items: (collection.items || []).filter((item: any) => !isArchivedItem(item)),
}));

export function archiveItems(collections: any[], collectionId: string, itemIds: string[]) {
  const ids = new Set(itemIds);
  const archivedAt = new Date().toISOString();
  return collections.map((collection) => collection.id !== collectionId ? collection : {
    ...collection,
    items: (collection.items || []).map((item: any) => ids.has(item.id) && !isArchivedItem(item)
      ? { ...item, _archivedAt: archivedAt } : item),
  });
}

export function restoreArchivedItem(collections: any[], collectionId: string, itemId: string) {
  return collections.map((collection) => collection.id !== collectionId ? collection : {
    ...collection,
    items: (collection.items || []).map((item: any) => {
      if (item.id !== itemId || !isArchivedItem(item)) return item;
      const { _archivedAt, ...restored } = item;
      return restored;
    }),
  });
}

export function purgeArchivedItem(collections: any[], collectionId: string, itemId: string) {
  const target = collections.find((collection) => collection.id === collectionId)?.items?.find((item: any) => item.id === itemId);
  if (!isArchivedItem(target)) return collections;
  return collections.map((collection) => ({
    ...collection,
    items: (collection.items || [])
      .filter((item: any) => collection.id !== collectionId || item.id !== itemId)
      .map((item: any) => {
        const next = { ...item };
        for (const property of collection.properties || []) {
          if (property.type !== 'relation' || property.relation?.targetCollectionId !== collectionId) continue;
          const value = next[property.id];
          if (Array.isArray(value)) next[property.id] = value.filter((id: string) => id !== itemId);
          else if (value === itemId) next[property.id] = null;
        }
        return next;
      }),
  }));
}
