import { expect, it } from 'vitest';
import { getCalendarEventColors, getEventLayout } from './calendarUtils';

it('places concurrent events side by side and restores full width for later events', () => {
  const layout = getEventLayout([
    { startTime: 11, endTime: 12 },
    { startTime: 9, endTime: 10 },
    { startTime: 9.5, endTime: 11 },
    { startTime: 10, endTime: 10.5 },
  ]);
  expect(layout.map(({ column, totalColumns }) => [column, totalColumns])).toEqual([
    [0, 2], [1, 2], [0, 2], [0, 1],
  ]);
});

it('keeps the collection accent while varying the fill by event', () => {
  const first = getCalendarEventColors('a', 'tasks', '#2563eb');
  const second = getCalendarEventColors('b', 'tasks', '#2563eb');
  expect(first.border).toBe(second.border);
  expect(first.bg).not.toBe(second.bg);
  expect(getCalendarEventColors('a', 'tasks', '#2563eb')).toEqual(first);
});

it('prioritizes the item color and preserves the collection fallback', () => {
  expect(getCalendarEventColors('a', 'tasks', '#2563eb', '#ef4444').border).toBe('#ef4444');
  expect(getCalendarEventColors('a', 'tasks', '#2563eb', '').border).toBe('#2563eb');
  expect(getCalendarEventColors('a', 'tasks', '#2563eb', 'invalid')).toEqual(getCalendarEventColors('a', 'tasks', '#2563eb'));
  expect(getCalendarEventColors('a', 'tasks', undefined, '#abc').border).toBe('#aabbcc');
});
