import React from 'react';
import CalendarView from './CalendarView';
import type { ViewRendererProps } from '@/lib/views';

const CalendarRenderer: React.FC<ViewRendererProps> = ({
  collection,
  items,
  collections,
  view,
  views,
  relationFilter,
  activeCollectionId,
  onEdit,
  onDelete,
  onViewDetail,
  onRelationChange,
  onUpdateView,
  onShowNewItemModalForCollection,
}) => {
  if (!onEdit || !onDelete || !onViewDetail) {
    return <div role="alert">Le renderer Calendrier n&apos;a pas reçu ses actions requises.</div>;
  }

  return (
    <CalendarView
      collection={collection}
      items={items}
      onEdit={onEdit}
      onDelete={onDelete}
      onViewDetail={onViewDetail}
      onRelationChange={onRelationChange}
      dateProperty={typeof view.dateProperty === 'string' ? view.dateProperty : undefined}
      hiddenFields={Array.isArray(view.hiddenFields) ? view.hiddenFields : []}
      collections={collections}
      viewConfig={view}
      showCollectionsSelector={view.showCollectionsSelector !== false}
      views={views}
      relationFilter={relationFilter}
      activeCollectionId={activeCollectionId}
      onChangeDateProperty={(propId) => onUpdateView({ dateProperty: propId })}
      onUpdateViewConfig={onUpdateView}
      onShowNewItemModalForCollection={onShowNewItemModalForCollection}
    />
  );
};

export default CalendarRenderer;
