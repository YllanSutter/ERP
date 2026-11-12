import React, * as ReactModule from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardAddModule from '@/components/dashboard/DashboardAddModule';
import TableRenderer from './TableRenderer';
import LayoutPanelsEditor from './LayoutPanelsEditor';
import { useViews } from '@/lib/hooks/useViews';

vi.mock('react', { spy: true });

const rendererProps = {
  collection: { id: 'collection', properties: [], items: [] },
  collections: [], items: [], properties: [],
  view: { id: 'table', name: 'Tableau', type: 'table', totalFields: { price: 'sum', name: 'count' } },
  onUpdateView: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(),
  onViewDetail: vi.fn(), onRelationChange: vi.fn(), onNavigateToCollection: vi.fn(),
} as any;

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('view regressions', () => {
  it.each(['Mon Kanban', '', '   ', undefined])('offers saved Kanban views with name %s in the layout picker', (name) => {
    vi.mocked(ReactModule.useState)
      .mockReturnValueOnce([null, vi.fn()])
      .mockReturnValueOnce(['collection', vi.fn()])
      .mockReturnValueOnce(['view', vi.fn()])
      .mockReturnValueOnce(['kanban', vi.fn()]);
    const onAdd = vi.fn();
    const onClose = vi.fn();
    const modal = DashboardAddModule({
      collections: [{ id: 'collection', name: 'Collection' }], currentOrder: 0,
      onAdd: vi.fn(), onClose,
      existingViews: {
        byCollection: { collection: [
          rendererProps.view,
          { id: 'kanban', name, type: 'kanban' } as any,
          { id: 'layout', name: 'Layout', type: 'layout' },
        ] }, onAdd,
      },
    }) as React.ReactElement<any>;
    const descendants = (node: any): React.ReactElement<any>[] => {
      if (!React.isValidElement(node)) return [];
      return [node as React.ReactElement<any>, ...React.Children.toArray((node.props as any).children).flatMap(descendants)];
    };
    const elements = descendants(modal);
    expect(elements.some((node) => node.props.value === 'kanban' && node.props.children === (name?.trim() ? name : 'Kanban'))).toBe(true);
    expect(elements.some((node) => node.props.value === 'layout' && node.props.children === 'Layout')).toBe(false);
    elements.find((node) => node.props.children === 'Ajouter la vue')!.props.onClick();
    expect(onAdd).toHaveBeenCalledWith('collection', 'kanban');
    expect(onClose).toHaveBeenCalled();
  });

  it('passes each grouping level’s totals and display settings to layout tables', () => {
    const view = {
      ...rendererProps.view, groups: ['category', 'status'],
      groupTotalsByGroupId: { category: { enabled: true, position: 'bottom' }, status: { enabled: true, position: 'top' } },
      groupDisplayColumnCount: 2, groupDisplayColumnCounts: { status: 3 },
    };
    const table = TableRenderer({ ...rendererProps, view }) as React.ReactElement<any>;
    expect(table.props.groupTotalsByGroupId).toEqual(view.groupTotalsByGroupId);
    expect(table.props.groups).toEqual(['category', 'status']);
    expect(table.props.groupDisplayColumnCount).toBe(2);
    expect(table.props.groupDisplayColumnCounts).toEqual({ status: 3 });
  });

  it('exposes column total actions and preserves other column totals', () => {
    const onUpdateView = vi.fn();
    const table = TableRenderer({ ...rendererProps, onUpdateView }) as React.ReactElement<any>;
    expect(table.props.totalFields).toEqual(rendererProps.view.totalFields);
    table.props.onSetTotalField('price', 'avg');
    expect(onUpdateView).toHaveBeenLastCalledWith({ totalFields: { price: 'avg', name: 'count' } });
    table.props.onSetTotalField('price', null);
    expect(onUpdateView).toHaveBeenLastCalledWith({ totalFields: { name: 'count' } });
    expect(rendererProps.view.totalFields.price).toBe('sum');
  });

  it('adds layout panels when randomUUID is unavailable over HTTP', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    const onChange = vi.fn();
    const editor = LayoutPanelsEditor({ panels: [], collection: { id: 'collection' }, onChange }) as React.ReactElement<any>;
    editor.props.children[1].props.onClick();
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/), collectionId: 'collection', viewId: '',
    })]);
  });

  it('retains existing views and selected panels when creating a layout', () => {
    const setViews = vi.fn();
    const views = { collection: [rendererProps.view, { id: 'cards', name: 'Cartes', type: 'cards' }] };
    const panels = [{ id: 'panel', viewId: 'cards', collectionId: 'collection' }];
    useViews(views, setViews, 'collection', 'table', vi.fn()).addView('Layout', 'layout', { layoutPanels: panels });
    expect(setViews.mock.calls[0][0].collection).toEqual([
      ...views.collection.map((view) => expect.objectContaining(view)), expect.objectContaining({ type: 'layout', layoutPanels: panels }),
    ]);
  });
});
