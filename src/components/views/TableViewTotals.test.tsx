import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TableView from './TableView';

vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ isAdmin: true, permissions: [], user: { user_preferences: { erpTotals: { 'table-view:collection': { showTotalsWidget: true } } } } }) }));
vi.mock('@/lib/hooks/useCanEdit', () => ({ useCanEdit: () => false }));
vi.mock('@/components/TableView/TableItemRow', () => ({ default: ({ item }: any) => <tr><td>ROW-{item.id}</td></tr> }));
vi.mock('@/components/TableView/TableHeader', () => ({ default: () => <thead><tr><th>Prix</th></tr></thead> }));

const properties = [{ id: 'year', name: 'Année', type: 'select', options: ['2026'] }, { id: 'month', name: 'Mois', type: 'select', options: ['Juin'] }, { id: 'status', name: 'Statut', type: 'select', options: ['A'] }, { id: 'price', name: 'Prix', type: 'number' }];
const items = Array.from({ length: 51 }, (_, index) => ({ id: String(index), status: 'A', year: '2026', month: 'Juin', price: 1 }));
function render(position?: string, grouped = false, totalsAlwaysVisible = true, overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(<TableView {...{
    collection: { id: 'collection', name: 'Collection', properties, items }, collections: [], orderedProperties: properties,
    items, hiddenFields: [], onEdit: vi.fn(), onDelete: vi.fn(), onViewDetail: vi.fn(), onToggleFavoriteItem: vi.fn(),
    onReorderItems: vi.fn(), onToggleField: vi.fn(), onDeleteProperty: vi.fn(), onEditProperty: vi.fn(),
    onRelationChange: vi.fn(), onNavigateToCollection: vi.fn(), totalsPosition: position, totalsScope: 'view', totalsAlwaysVisible,
    groups: grouped ? ['status'] : [], totalFields: { price: 'sum' }, ...overrides,
  } as any} />);
}
afterEach(() => vi.unstubAllGlobals());

describe.each([false, true])('consistent table totals (grouped=%s)', (grouped) => {
  it('shows one module panel at the top only when requested', () => {
    const html = render('top', grouped);
    expect(html).toContain('Réglages des totaux');
    expect(html).toContain('title="Cartes"');
    expect(html.indexOf('Réglages des totaux')).toBeLessThan(html.indexOf('ROW-0'));
    expect(html).not.toContain('data-view-total-position="bottom"');
    expect(html.match(/Réglages des totaux/g)).toHaveLength(1);
  });
  it('shows the same compact total after the rows and sums all filtered items', () => {
    const html = render('bottom', grouped);
    expect(html).not.toContain('Réglages des totaux');
    expect(html.indexOf('data-view-total-position="bottom"')).toBeGreaterThan(html.indexOf('ROW-0'));
    expect(html.slice(html.indexOf('data-view-total-position="bottom"'))).toContain('51');
    expect(html).not.toContain('<tfoot');
  });
  it('combines the module panel and bottom summary once each', () => {
    const html = render('both', grouped);
    expect(html.match(/Réglages des totaux/g)).toHaveLength(1);
    expect(html.match(/data-view-total-position="bottom"/g)).toHaveLength(1);
  });
  it('hides both displays when totals are disabled', () => {
    const html = render('none', grouped);
    expect(html).not.toContain('Réglages des totaux');
    expect(html).not.toContain('data-view-total-position="bottom"');
  });
});

it('does not let an old widget visibility preference override the default bottom position', () => {
  const html = render();
  expect(html).not.toContain('Réglages des totaux');
  expect(html.indexOf('data-view-total-position="bottom"')).toBeGreaterThan(html.indexOf('ROW-0'));
});

it('hides general totals by default when grouped, and shows them when opted in', () => {
  const hidden = render('both', true, false);
  expect(hidden).not.toContain('Réglages des totaux');
  expect(hidden).not.toContain('data-view-total-position="bottom"');
  expect(render('both', true, true)).toContain('Réglages des totaux');
  expect(render('both', false, false)).toContain('Réglages des totaux');
});

it('consolidates top totals for three grouping levels into one module panel', () => {
  const html = render('none', true, false, {
    groups: ['year', 'month', 'status'], groupDisplayModes: { year: 'select', month: 'select', status: 'accordion' },
    groupTotalsByGroupId: { year: { enabled: true, position: 'top' }, month: { enabled: true, position: 'top' }, status: { enabled: true, position: 'both' } },
  });
  expect(html.match(/Réglages des totaux/g)).toHaveLength(1);
  expect(html).not.toContain('data-group-total-position="top"');
  expect(html).toContain('title="Barres"');
  expect(html).not.toContain('data-view-total-position="bottom"');
});
it('keeps just one top panel when both general and group totals request it', () => {
  const html = render('both', true, true, { totalsScope: 'both', groupTotalsByGroupId: { status: { enabled: true, position: 'both' } } });
  expect(html.match(/Réglages des totaux/g)).toHaveLength(1);
  expect(html.match(/data-view-total-position="bottom"/g)).toHaveLength(1);
});
