import React, * as ReactModule from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import ItemContextMenu from './ItemContextMenu';
import { SettingsDialog } from '@/components/ui/settings-panel';
import ColorPicker from '@/components/inputs/ColorPicker';

vi.mock('react', { spy: true });
afterEach(() => vi.restoreAllMocks());
function descendants(node: React.ReactNode): React.ReactElement<any>[] {
  if (!React.isValidElement(node)) return Array.isArray(node) ? node.flatMap(descendants) : [];
  return [node, ...React.Children.toArray((node.props as any).children).flatMap(descendants)];
}
it.each(['context', 'button'] as const)('keeps the color editor outside the %s menu and preserves other fields', (triggerMode) => {
  const property = { id: 'color', name: 'Couleur', type: 'color' };
  const setProperty = vi.fn();
  vi.mocked(ReactModule.useState).mockReturnValueOnce([property, setProperty]);
  const onEdit = vi.fn();
  const tree = ItemContextMenu({ item: { id: '1', name: 'Test', color: '#112233' }, children: <button>Event</button>,
    triggerMode, onEdit, onViewDetail: vi.fn(), canEdit: true, canEditField: () => true, quickEditProperties: [property] });
  const nodes = descendants(tree);
  const row = nodes.find((node) => node.props.onSelect && descendants(node).some((child) => child.props.children === 'Couleur'))!;
  expect(row.props.disabled).toBe(false);
  row.props.onSelect();
  expect(setProperty).toHaveBeenCalledWith(property);
  const topChildren = React.Children.toArray((tree as React.ReactElement<any>).props.children) as React.ReactElement<any>[];
  expect(topChildren[1].type).toBe(SettingsDialog);
  expect(topChildren[1].props.open).toBe(true);
  nodes.find((node) => node.type === ColorPicker)!.props.onChange('#abcdef');
  expect(onEdit).toHaveBeenCalledWith({ id: '1', name: 'Test', color: '#abcdef' });
  expect(setProperty).toHaveBeenCalledTimes(1);
});
it('does not allow editing a protected color field', () => {
  vi.mocked(ReactModule.useState).mockReturnValueOnce([null, vi.fn()]);
  const tree = ItemContextMenu({ item: { id: '1' }, children: <div />, onViewDetail: vi.fn(), onEdit: vi.fn(), canEdit: true,
    canEditField: () => false, quickEditProperties: [{ id: 'color', name: 'Couleur', type: 'color' }] });
  expect(descendants(tree).find((node) => node.props.onSelect && node.props.disabled === true)).toBeDefined();
});
