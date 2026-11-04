import { eachMonthOfInterval, eachWeekOfInterval, eachDayOfInterval, endOfMonth, endOfWeek, endOfDay, startOfDay, startOfWeek, format, getISOWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Item, Property } from '@/lib/types';
import { getItemIntervalsForDateField } from './recapColumnUtils';

const WEEK_OPTIONS = { weekStartsOn: 1 as const };

export function getAssignmentKey(collectionId: string | undefined, itemId: string, dateFieldId: string | undefined) {
  return JSON.stringify([collectionId, itemId, dateFieldId]);
}

export function getAssignedDate(item: Item, dateField: Property | undefined, value: string | undefined) {
  if (!value) return undefined;
  const date = parseISO(value);
  const start = startOfDay(date).getTime();
  const end = endOfDay(date).getTime();
  const interval = getItemIntervalsForDateField(item, dateField)
    .find((range) => range.end >= start && range.start <= end);
  return interval ? Math.max(start, interval.start) : undefined;
}

export function formatAssignmentPeriod(date: Date) {
  const week = startOfWeek(date, WEEK_OPTIONS);
  const weekEnd = endOfWeek(week, WEEK_OPTIONS);
  return `${format(date, 'MMMM yyyy', { locale: fr })} · S${getISOWeek(week)} · ${format(week, 'dd/MM')} au ${format(weekEnd, 'dd/MM')}`;
}

export function getAssignmentOptions(item: Item, dateField?: Property, hiddenDays: number[] = []) {
  const options = new Map<string, { date: string; label: string }>();
  for (const interval of getItemIntervalsForDateField(item, dateField)) {
    const start = new Date(interval.start);
    const end = new Date(interval.end);
    for (const month of eachMonthOfInterval({ start, end })) {
      const from = new Date(Math.max(interval.start, month.getTime()));
      const to = new Date(Math.min(interval.end, endOfMonth(month).getTime()));
      for (const week of eachWeekOfInterval({ start: from, end: to }, WEEK_OPTIONS)) {
        const weekEnd = endOfWeek(week, WEEK_OPTIONS);
        const first = new Date(Math.max(from.getTime(), week.getTime()));
        const last = new Date(Math.min(to.getTime(), weekEnd.getTime()));
        const days = eachDayOfInterval({ start: first, end: last });
        const day = days.find((value) => !hiddenDays.includes(value.getDay())) ?? first;
        const key = `${format(month, 'yyyy-MM')}/${format(week, 'yyyy-MM-dd')}`;
        const option = {
          date: format(day, 'yyyy-MM-dd'),
          label: formatAssignmentPeriod(day),
        };
        const existing = options.get(key);
        if (!existing || option.date < existing.date) options.set(key, option);
      }
    }
  }
  return [...options].sort(([a], [b]) => a.localeCompare(b)).map(([, option]) => option);
}
