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

export type ArchiveSort = 'newest' | 'oldest' | 'name';
export const ARCHIVE_PAGE_SIZE = 25;
const archiveCollator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
const normalizeArchiveSearch = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');

export function getArchiveItemTitle(collection: any, item: any): string {
  const titleProperty = (collection.properties || []).find((property: any) => property.isTitle)
    || (collection.properties || []).find((property: any) => property.id === 'name')
    || (collection.properties || []).find((property: any) => property.type === 'text');
  return String(item[titleProperty?.id] || item.name || item.title || item.id);
}

export function getArchivePage(collection: any, query = '', sort: ArchiveSort = 'newest', requestedPage = 1) {
  const archived = (collection.items || []).filter(isArchivedItem);
  const search = normalizeArchiveSearch(query.trim());
  const matches = archived
    .map((item: any) => ({ item, title: getArchiveItemTitle(collection, item) }))
    .filter(({ item, title }: { item: any; title: string }) => !search || normalizeArchiveSearch(`${title} ${item.id}`).includes(search))
    .sort((a: { item: any; title: string }, b: { item: any; title: string }) => {
      const byName = archiveCollator.compare(a.title, b.title) || archiveCollator.compare(a.item.id, b.item.id);
      if (sort === 'name') return byName;
      const byDate = String(a.item._archivedAt).localeCompare(String(b.item._archivedAt));
      return (sort === 'oldest' ? byDate : -byDate) || byName;
    });
  const pageCount = Math.max(1, Math.ceil(matches.length / ARCHIVE_PAGE_SIZE));
  const page = Math.max(1, Math.min(requestedPage, pageCount));
  const start = (page - 1) * ARCHIVE_PAGE_SIZE;
  return {
    items: matches.slice(start, start + ARCHIVE_PAGE_SIZE),
    total: archived.length,
    filteredTotal: matches.length,
    page, pageCount,
    first: matches.length ? start + 1 : 0,
    last: Math.min(start + ARCHIVE_PAGE_SIZE, matches.length),
  };
}
