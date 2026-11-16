/** Creation time, including the timestamp IDs used by older items. */
export function itemCreatedTime(item: any): number {
  const raw = item?.createdAt ?? item?.created_at;
  const date = typeof raw === 'number' ? raw : Date.parse(raw);
  if (Number.isFinite(date)) return date;
  const match = String(item?.id ?? '').match(/^(?:new_)?(\d{13})(?:-|$)/);
  return match ? Number(match[1]) : 0;
}

/** Unknown dates retain reverse insertion order, without mutating stored data. */
export function newestFirst<T>(items: readonly T[], getItem: (entry: T) => any = entry => entry): T[] {
  return items.map((entry, index) => ({ entry, index, time: itemCreatedTime(getItem(entry)) }))
    .sort((a, b) => b.time - a.time || b.index - a.index)
    .map(({ entry }) => entry);
}

export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
