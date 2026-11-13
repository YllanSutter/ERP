import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import WeekEventCard from './WeekEventCard';
import MonthView from './MonthView';

const { menus } = vi.hoisted(() => ({ menus: [] as any[] }));
vi.mock('@/lib/hooks/useCanEdit', () => ({
  useCanEdit: () => true, useCanEditField: () => true,
  useCanEditFields: () => (id: string) => id !== 'secret', useCanViewFields: () => (id: string) => id !== 'secret',
}));
vi.mock('@/components/menus/ItemContextMenu', () => ({ default: (props: any) => { menus.push(props); return <>{props.children}</>; } }));
vi.mock('@/components/fields/EditableProperty', () => ({ default: () => null }));
beforeEach(() => { menus.length = 0; });
const properties = [{ id: 'name', name: 'Nom', type: 'text' }, { id: 'color', name: 'Couleur', type: 'color', showContextMenu: true }, { id: 'secret', name: 'Secret', type: 'color', showContextMenu: true }];
const source = { id: 'collection', properties, items: [] };
const item = { id: '1', __collectionId: 'collection', name: 'Événement', color: '#112233', _eventSegments: [{ start: '2026-11-13T09:00:00', end: '2026-11-13T10:00:00' }] };
function check(onEdit: any) {
  expect(menus.map((menu) => menu.triggerMode || 'context')).toEqual(['context', 'button']);
  for (const menu of menus) {
    expect(menu.quickEditProperties.map(({ id }: any) => id)).toEqual(['color']);
    expect(menu.canEditField('color')).toBe(true);
    menu.onEdit({ ...item, color: '#abcdef' });
  }
  expect(onEdit).toHaveBeenCalledTimes(2);
}
it('shares contextual actions between right click and ellipsis in the week view', () => {
  const onEdit = vi.fn();
  const html = renderToStaticMarkup(<WeekEventCard item={item} eventSegments={[{ start: 9, end: 10 }]} multiDayIndex={0} column={0} totalColumns={1}
    colors={{ bg: '#fff', border: '#112233', hover: '#eee', text: 'inherit' }} startHour={8} endHour={18} hoursLength={10}
    visibleMetaFields={properties} hiddenFields={[]} collections={[source]} getNameValue={(item) => item.name} onViewDetail={vi.fn()}
    onReduceDuration={vi.fn()} onEditField={onEdit} />);
  expect(html).toContain('Menu de Événement');
  check(onEdit);
  expect(menus[0].extraActions[0].label).toBe('Supprimer le segment');
});
it('shares contextual actions between right click and ellipsis in the month view', () => {
  const onEdit = vi.fn();
  const html = renderToStaticMarkup(<MonthView currentDate={new Date(2026, 10, 1)} items={[item]} collection={source} collections={[source]}
    dateField={undefined} onDateSelect={vi.fn()} getNameValue={(item) => item.name} getItemsForDate={() => []}
    onViewDetail={vi.fn()} onDelete={vi.fn()} onEdit={onEdit} />);
  expect(html).toContain('Menu de Événement');
  check(onEdit);
});
