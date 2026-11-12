import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ViewGrouping from './ViewGrouping';
import TableGroupTotals from './TableGroupTotals';
import type { Property, Item, TableGroupDisplayMode } from '@/lib/types';

const properties: Property[] = [
  { id: 'category', name: 'Catégorie', type: 'select', options: ['A'] },
  { id: 'status', name: 'Statut', type: 'select', options: ['Ouvert'] },
  { id: 'price', name: 'Prix', type: 'number' },
];
const items = [{ id: '1', category: 'A', status: 'Ouvert', price: 35 }] as Item[];
const totalProps = {
  displayProperties: [properties[2]], totalFields: { price: 'sum' },
  calculateTotal: (_: string, rows: Item[]) => rows.reduce((sum, item) => sum + item.price, 0),
  formatTotal: (_: string, value: number) => `TOTAL=${value}`,
};

function render(mode: TableGroupDisplayMode, position: 'top' | 'bottom' | 'both', enabled = true, nested = false) {
  return renderToStaticMarkup(<ViewGrouping items={items} groups={nested ? ['category', 'status'] : ['category']}
    properties={properties} collections={[]} groupDisplayMode={mode}
    groupDisplayModes={nested ? { category: mode, status: 'tabs' } : {}}
    renderItems={() => <div>ROWS</div>}
    renderGroupTotals={(rows, _, location) => <TableGroupTotals {...totalProps} items={rows}
      config={{ enabled, position }} position={location} />} />);
}

describe.each(['accordion', 'tabs', 'columns', 'select'] as const)('group totals in %s mode', (mode) => {
  it('places bottom totals after the rows', () => {
    const html = render(mode, 'bottom');
    expect(html).not.toContain('data-group-total-position="top"');
    expect(html.indexOf('ROWS')).toBeLessThan(html.indexOf('data-group-total-position="bottom"'));
    expect(html).toContain('TOTAL=35');
  });
  it('places top totals before the rows', () => {
    const html = render(mode, 'top');
    expect(html).not.toContain('data-group-total-position="bottom"');
    expect(html.indexOf('data-group-total-position="top"')).toBeLessThan(html.indexOf('ROWS'));
  });
  it('renders both positions and respects disabled totals', () => {
    const html = render(mode, 'both');
    expect(html.match(/TOTAL=35/g)).toHaveLength(2);
    expect(render(mode, 'both', false)).not.toContain('TOTAL=');
  });
  it('retains totals for parent and child groups', () => {
    expect(render(mode, 'bottom', true, true).match(/TOTAL=35/g)).toHaveLength(2);
  });
});

describe('independent totals per grouping level', () => {
  it.each(['accordion', 'columns', 'tabs'] as const)('retains %s subgroups beneath a select with separate totals and positions', (childMode) => {
    const rows = [
      { id: '1', category: 'A', status: 'Ouvert', price: 35 },
      { id: '2', category: 'A', status: 'Fermé', price: 10 },
      { id: '3', category: 'B', status: 'Ouvert', price: 100 },
    ] as Item[];
    const html = renderToStaticMarkup(<ViewGrouping items={rows} groups={['category', 'status']}
      properties={properties} collections={[]} groupDisplayModes={{ category: 'select', status: childMode }}
      renderItems={(items) => <div>{items.map(({ id }) => `ROW-${id}`).join(',')}</div>}
      renderGroupTotals={(items, groupId, position) => <TableGroupTotals {...totalProps} items={items}
        config={{ enabled: true, position: groupId === 'category' ? 'bottom' : 'top' }} position={position} />} />);
    expect(html).toContain('ROW-1');
    expect(html).not.toContain('ROW-3');
    expect(html).toContain('TOTAL=45');
    expect(html).toContain('TOTAL=35');
    expect(html).not.toContain('TOTAL=100');
    expect(html.indexOf('TOTAL=35')).toBeLessThan(html.indexOf('ROW-1'));
    expect(html.indexOf('TOTAL=45')).toBeGreaterThan(html.indexOf('ROW-1'));
  });
});

it('applies different settings to three nested levels and keeps leaf rows', () => {
  const props: Property[] = [...properties, { id: 'owner', name: 'Responsable', type: 'select', options: ['Alice'] }];
  const rows = [{ ...items[0], owner: 'Alice' }];
  const html = renderToStaticMarkup(<ViewGrouping items={rows} groups={['category', 'status', 'owner']}
    properties={props} collections={[]} groupDisplayModes={{ category: 'select', status: 'tabs', owner: 'accordion' }}
    renderItems={(items) => <div>{items.map(({ id }) => `ROW-${id}`)}</div>}
    renderGroupTotals={(items, groupId, position) => <TableGroupTotals {...totalProps} items={items}
      config={groupId === 'category' ? { enabled: true, position: 'top' }
        : groupId === 'status' ? { enabled: false, position: 'both' } : { enabled: true, position: 'bottom' }}
      position={position} />} />);
  expect(html).toContain('ROW-1');
  expect(html.match(/TOTAL=35/g)).toHaveLength(2);
  expect(html.match(/data-group-total-position="top"/g)).toHaveLength(1);
  expect(html.match(/data-group-total-position="bottom"/g)).toHaveLength(1);
  expect(html.indexOf('data-group-total-position="top"')).toBeLessThan(html.indexOf('ROW-1'));
  expect(html.indexOf('data-group-total-position="bottom"')).toBeGreaterThan(html.indexOf('ROW-1'));
});
