/** Index segments once per month, rather than scanning every item for every day. */
export function groupCalendarMonth(items: any[], year: number, month: number) {
  const days = new Map<number, Map<string, { id: string; item: any; segments: any[] }>>();
  for (const item of items) {
    for (const segment of Array.isArray(item._eventSegments) ? item._eventSegments : []) {
      const start = new Date(segment.start || segment.__eventStart);
      if (start.getFullYear() !== year || start.getMonth() !== month) continue;
      const day = start.getDate();
      let groups = days.get(day);
      if (!groups) { groups = new Map(); days.set(day, groups); }
      const key = `${item.__collectionId || ''}:${item.id || item.__id || item.name || JSON.stringify(item)}`;
      let group = groups.get(key);
      if (!group) { group = { id: key, item, segments: [] }; groups.set(key, group); }
      group.segments.push(segment);
    }
  }
  return new Map([...days].map(([day, groups]) => [day, [...groups.values()]]));
}
