import React, * as ReactModule from 'react';
import ItemContextMenu from '@/components/menus/ItemContextMenu';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import KanbanView from './KanbanView';

vi.mock('react', { spy: true });
vi.mock('./ViewGrouping', () => ({ useViewGrouping: () => ({ groupedStructure: null }) }));

vi.mock('@/lib/hooks/useCanEdit', () => ({
  useCanEdit: () => true,
  useCanEditFields: () => () => true,
  useCanViewFields: () => () => true,
}));
vi.mock('@/components/menus/ItemContextMenu', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/fields/EditableProperty', () => ({ default: ({ property }: any) => <span>{property.name}</span> }));

const collection = {
  id: 'collection', name: 'Achats', properties: [
    { id: 'name', name: 'Nom', type: 'text', showContextMenu: true },
    { id: 'status', name: 'Statut', type: 'select', options: ['À acheter'] },
    { id: 'price', name: 'Prix', type: 'number', numberSuffix: ' €' },
    { id: 'tags', name: 'Tag', type: 'multiselect', options: ['Anniversaire'] },
  ],
};
const item = { id: '1', name: 'Armagnac', status: 'À acheter', price: 35, tags: ['Anniversaire'] };

describe('Kanban card presentation', () => {
  it('keys the outer menu wrapper by item id for every card in a column', () => {
    vi.spyOn(ReactModule, 'useCallback').mockImplementation((callback) => callback);
    vi.mocked(ReactModule.useState).mockReturnValueOnce([null, vi.fn()]);
    vi.mocked(ReactModule.useMemo)
      .mockImplementationOnce((factory) => factory())
      .mockImplementationOnce((factory) => factory());
    const secondItem = { ...item, id: '2', name: 'Autre achat' };
    const element = KanbanView({ collection, items: [item, secondItem], groupBy: 'status',
      collections: [], onEdit: vi.fn(), onDelete: vi.fn(), onViewDetail: vi.fn() });
    const menus: React.ReactElement[] = [];
    const visit = (node: React.ReactNode) => {
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement(child)) return;
        if (child.type === ItemContextMenu) menus.push(child);
        visit((child.props as any).children);
      });
    };
    visit(element);
    expect(menus.map((menu) => menu.key)).toEqual(['1', '2']);
  });

  it('keeps actions inside the header and shows compact previews instead of field controls', () => {
    const html = renderToStaticMarkup(<KanbanView collection={collection} items={[item]} groupBy="status"
      collections={[]} onEdit={() => {}} onDelete={() => {}} onViewDetail={() => {}} />);
    expect(html).toContain('Armagnac');
    expect(html).toContain('Champs de Armagnac');
    expect(html).toContain('Supprimer l’élément');
    expect(html).toContain('35 €');
    expect(html).toContain('Anniversaire');
    expect(html).not.toContain('-top-7');
    expect(html).not.toContain('Augmenter');
    expect(html).not.toContain('Diminuer');
    expect(html).not.toContain('>Éditer<');
  });
});


describe('Kanban totals', () => {
  const render = (position: string, grouped = true) => renderToStaticMarkup(<KanbanView collection={collection}
    items={[item, { ...item, id: '2', price: 15 }]} groupBy={grouped ? 'status' : null}
    totalFields={{ price: 'sum' }} totalsPosition={position}
    onEdit={() => {}} onDelete={() => {}} onViewDetail={() => {}} />);
  it.each(['top', 'bottom', 'both'])('shows totals at %s without requiring grouping', (position) => {
    const html = render(position, false);
    expect(html).toContain('Toutes les données');
    expect(html).toContain('50 €');
    expect(html.includes('data-kanban-total-position="top"')).toBe(position !== 'bottom');
    expect(html.includes('data-kanban-total-position="bottom"')).toBe(position !== 'top');
  });
  it('can hide totals', () => {
    expect(render('none')).not.toContain('data-kanban-total-position');
  });
  it('uses per-column fields and positions instead of view defaults', () => {
    const html = renderToStaticMarkup(<KanbanView collection={collection} items={[item]} groupBy="status"
      totalFields={{ price: 'sum' }} totalsPosition="top"
      columnSettings={{ status: { 'À acheter': { totalFields: { price: 'avg' }, totalsPosition: 'bottom' } } }}
      onEdit={() => {}} onDelete={() => {}} onViewDetail={() => {}} />);
    expect(html).not.toContain('data-kanban-total-position="top"');
    expect(html).toContain('data-kanban-total-position="bottom"');
    expect(html).toContain('35,00 €');
  });
});

describe('Kanban column resets and visibility', () => {
  it('resets fields to view defaults and preserves totals, sorting and other columns', () => {
    vi.spyOn(ReactModule, 'useCallback').mockImplementation((callback) => callback);
    vi.mocked(ReactModule.useState).mockReturnValueOnce([null, vi.fn()]);
    vi.mocked(ReactModule.useMemo).mockImplementationOnce((factory) => factory()).mockImplementationOnce((factory) => factory());
    const onUpdateViewConfig = vi.fn();
    const settings = { visibleFieldIds: ['price'], totalFields: { price: 'sum' }, totalsPosition: 'both', sortFieldId: 'price' };
    const props = { collection, items: [item], groupBy: 'status', hiddenFields: ['tags'],
      columnSettings: { status: { 'À acheter': settings, Autre: { visibleFieldIds: ['tags'] } } },
      onEdit: vi.fn(), onDelete: vi.fn(), onViewDetail: vi.fn(), onUpdateViewConfig };
    const element = KanbanView(props);
    const elements: React.ReactElement<any>[] = [];
    const visit = (node: React.ReactNode) => React.Children.forEach(node, (child) => {
      if (!React.isValidElement(child)) return;
      elements.push(child);
      visit((child.props as any).children);
    });
    visit(element);
    elements.find((node) => node.props.children === 'Réinitialiser les champs affichés')!.props.onSelect();
    const updated = onUpdateViewConfig.mock.calls[0][0].kanbanColumnSettings;
    expect(updated.status['À acheter']).toEqual({ ...settings, visibleFieldIds: null });
    expect(updated.status.Autre).toEqual(props.columnSettings.status.Autre);
    const html = renderToStaticMarkup(<KanbanView {...props} columnSettings={updated} />);
    expect(html).toContain('title="Statut"');
    expect(html).toContain('title="Prix"');
    expect(html).not.toContain('title="Tag"');
    const toggle = elements.find((node) => node.props.children === 'Afficher les totaux')!;
    toggle.props.onCheckedChange(false);
    const hidden = onUpdateViewConfig.mock.calls[1][0].kanbanColumnSettings;
    expect(hidden.status['À acheter']).toEqual({ ...settings, showTotals: false });
    expect(renderToStaticMarkup(<KanbanView {...props} columnSettings={hidden} />)).not.toContain('data-kanban-total-position');
    toggle.props.onCheckedChange(true);
    const shown = onUpdateViewConfig.mock.calls[2][0].kanbanColumnSettings;
    const shownHtml = renderToStaticMarkup(<KanbanView {...props} columnSettings={shown} />);
    expect(shownHtml).toContain('data-kanban-total-position="top"');
    expect(shownHtml).toContain('data-kanban-total-position="bottom"');
  });
});
