import React, { useMemo } from 'react';
import TableView from '@/components/views/TableView';
import KanbanView from '@/components/views/KanbanView';
import CalendarView from '@/components/views/CalendarView';
import { getFilteredItems, getOrderedProperties } from '@/lib/filterUtils';

interface LayoutPanelConfig {
  id: string;
  collectionId?: string;
  viewId: string;
  colSpan?: number;
  rowSpan?: number;
}

interface LayoutViewProps {
  viewConfig: any;
  collection: any;
  collections: any[];
  views: Record<string, any[]>;
  items: any[];
  orderedProperties: any[];
  relationFilter?: { collectionId: string | null; ids: string[] };
  activeCollectionId?: string | null;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onViewDetail: (item: any) => void;
  onRelationChange?: (property: any, item: any, value: any) => void;
  onUpdateViewConfig?: (viewId: string, updates: Record<string, any>) => void;
  onShowNewItemModalForCollection?: (collection: any, item?: any) => void;
}

const LayoutView: React.FC<LayoutViewProps> = ({
  viewConfig,
  collection,
  collections,
  views,
  items,
  orderedProperties,
  relationFilter = { collectionId: null, ids: [] },
  activeCollectionId = null,
  onEdit,
  onDelete,
  onViewDetail,
  onRelationChange,
  onUpdateViewConfig,
  onShowNewItemModalForCollection,
}) => {
  const layoutPanels: LayoutPanelConfig[] = Array.isArray(viewConfig?.layoutPanels)
    ? viewConfig.layoutPanels
    : [];

  const resolvedPanels = useMemo(() => {
    return (layoutPanels || []).map((panel) => {
      const targetCollectionId = panel.collectionId || collection?.id;
      const targetCollection = collections.find((c: any) => c.id === targetCollectionId) || collection;
      const collectionViews = views[targetCollectionId || ''] || [];
      const viewConfig = collectionViews.find((v: any) => v.id === panel.viewId);
      return { panel, viewConfig, targetCollection };
    });
  }, [layoutPanels, views, collections, collection]);

  if (!collection) {
    return <div className="text-sm text-neutral-500">Aucune collection.</div>;
  }

  if (!layoutPanels || layoutPanels.length === 0) {
    return (
      <div className="text-sm text-neutral-500">
        Aucune vue combinée. Ajoute des panneaux dans les paramètres de la vue.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4 auto-rows-[140px]">
      {resolvedPanels.map(({ panel, viewConfig, targetCollection }) => {
        const colSpan = Math.min(12, Math.max(1, panel.colSpan || 6));
        const rowSpan = Math.min(6, Math.max(1, panel.rowSpan || 2));

        if (!viewConfig) {
          return (
            <div
              key={panel.id}
              className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-neutral-500"
              style={{ gridColumn: `span ${colSpan} / span ${colSpan}`, gridRow: `span ${rowSpan} / span ${rowSpan}` }}
            >
              Vue introuvable.
            </div>
          );
        }

        if (viewConfig.type === 'layout') {
          return (
            <div
              key={panel.id}
              className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-neutral-500"
              style={{ gridColumn: `span ${colSpan} / span ${colSpan}`, gridRow: `span ${rowSpan} / span ${rowSpan}` }}
            >
              La vue "Layout" ne peut pas être imbriquée.
            </div>
          );
        }

        const filteredItems = getFilteredItems(
          targetCollection,
          viewConfig,
          relationFilter,
          activeCollectionId,
          collections
        );

        const panelOrderedProps = getOrderedProperties(targetCollection, viewConfig);

        return (
          <div
            key={panel.id}
            className="rounded-lg border border-dark/5 dark:border-white/5 p-3 overflow-hidden"
            style={{ gridColumn: `span ${colSpan} / span ${colSpan}`, gridRow: `span ${rowSpan} / span ${rowSpan}` }}
          >
            <div className="text-xs font-semibold text-neutral-500 mb-2">{viewConfig.name}</div>
            <div className="h-[calc(100%-1.5rem)] overflow-auto">
              {viewConfig.type === 'table' && (
                <TableView
                  collection={targetCollection}
                  items={filteredItems}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onViewDetail={onViewDetail}
                  hiddenFields={viewConfig.hiddenFields || []}
                  orderedProperties={panelOrderedProps}
                  onReorderItems={() => {}}
                  onToggleField={() => {}}
                  onDeleteProperty={() => {}}
                  onEditProperty={() => {}}
                  collections={collections}
                  onRelationChange={onRelationChange || (() => {})}
                  onNavigateToCollection={() => {}}
                  groups={viewConfig.groups || []}
                />
              )}
              {viewConfig.type === 'kanban' && (
                <KanbanView
                  collection={targetCollection}
                  items={filteredItems}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onViewDetail={onViewDetail}
                  groupBy={viewConfig.groupBy}
                  hiddenFields={viewConfig.hiddenFields || []}
                  collections={collections}
                  onRelationChange={onRelationChange}
                  orderedProperties={panelOrderedProps}
                  filters={viewConfig.filters || []}
                />
              )}
              {viewConfig.type === 'calendar' && (
                <CalendarView
                  collection={targetCollection}
                  items={filteredItems}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onViewDetail={onViewDetail}
                  onRelationChange={onRelationChange}
                  dateProperty={viewConfig.dateProperty}
                  hiddenFields={viewConfig.hiddenFields || []}
                  collections={collections}
                  viewConfig={viewConfig}
                  views={views}
                  relationFilter={relationFilter}
                  activeCollectionId={activeCollectionId}
                  viewModeStorageKey={`${viewConfig.id}:panel:${panel.id || panel.viewId}`}
                  onUpdateViewConfig={(updates) => onUpdateViewConfig?.(viewConfig.id, updates)}
                  onShowNewItemModalForCollection={onShowNewItemModalForCollection}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LayoutView;
