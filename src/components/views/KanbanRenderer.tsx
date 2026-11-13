import React from 'react';
import KanbanView from './KanbanView';
import type { ViewRendererProps } from '@/lib/views';
import type { KanbanColumnSettings } from './KanbanView';

const KanbanRenderer: React.FC<ViewRendererProps> = ({
  collection,
  items,
  collections,
  properties,
  view,
  onEdit,
  onDelete,
  onViewDetail,
  onRelationChange,
  onNavigateToCollection,
  onShowNewItemModal,
  onUpdateView,
}) => {
  if (!onEdit || !onDelete || !onViewDetail || !onRelationChange || !onNavigateToCollection) {
    return <div role="alert">Le renderer Kanban n&apos;a pas reçu ses actions requises.</div>;
  }

  return (
  <KanbanView
    collection={collection}
    items={items}
    onEdit={onEdit}
    onDelete={onDelete}
    onViewDetail={onViewDetail}
    groupBy={typeof view.groupBy === 'string' ? view.groupBy : view.groupBy === null ? null : undefined}
    totalFields={(view.totalFields || {}) as Record<string, string>}
    totalsAlwaysVisible={Boolean(view.totalsAlwaysVisible)}
    totalsPosition={String(view.totalsPosition || 'none')}
    hiddenFields={Array.isArray(view.hiddenFields) ? view.hiddenFields : []}
    collections={collections}
    onRelationChange={onRelationChange}
    onNavigateToCollection={onNavigateToCollection}
    filters={Array.isArray(view.filters) ? view.filters : []}
    orderedProperties={properties}
    columnSettings={view.kanbanColumnSettings as Record<string, Record<string, KanbanColumnSettings>> | undefined}
    showFieldsOnHover={Boolean(view.kanbanShowFieldsOnHover)}
    onUpdateViewConfig={onUpdateView}
    onShowNewItemModal={onShowNewItemModal}
  />
  );
};

export default KanbanRenderer;
