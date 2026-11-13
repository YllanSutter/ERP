import React, * as ReactModule from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import TableHeader from './TableHeader';
import { CustomTotalDialog } from '@/components/views/CustomTotalSettings';

vi.mock('react', { spy: true });
vi.mock('@/lib/hooks/useCanEdit', () => ({ useCanEdit: () => true }));
afterEach(() => vi.restoreAllMocks());
it('opens the shared custom total editor from the column menu and saves through the existing action', () => {
  const property = { id: 'price', name: 'Prix', type: 'number' } as any;
  const setProperty = vi.fn();
  vi.mocked(ReactModule.useState).mockReturnValueOnce([property, setProperty]).mockReturnValueOnce([null, vi.fn()]).mockReturnValueOnce([null, vi.fn()]);
  const onToggleTotalField = vi.fn();
  const tree = TableHeader({ visibleProperties: [property], items: [], totalFields: { price: 'sum' }, onToggleTotalField,
    onEditProperty: vi.fn(), onToggleField: vi.fn(), onDeleteProperty: vi.fn() });
  const nodes: React.ReactElement<any>[] = [];
  const visit = (node: React.ReactNode) => React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    nodes.push(child);
    visit((child.props as any).children);
  });
  visit(tree);
  nodes.find((node) => node.props.children === 'Calcul personnalisé…' && node.props.onSelect)!.props.onSelect();
  expect(setProperty).toHaveBeenCalledWith(property);
  const dialog = nodes.find((node) => node.type === CustomTotalDialog)!;
  expect(dialog.props.value).toBe('sum');
  dialog.props.onChange('number-filter:sum:status:Done');
  expect(onToggleTotalField).toHaveBeenCalledWith('price', 'number-filter:sum:status:Done');
});
