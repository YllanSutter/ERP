import React from 'react';
import LayoutView from './LayoutView';
import type { ViewRendererProps } from '@/lib/views';

const LayoutRenderer: React.FC<ViewRendererProps> = ({
  collection,
  collections,
  items,
  view,
  views = {},
  properties,
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
    return <div role="alert">Le renderer Layout n&apos;a pas reçu ses actions requises.</div>;
  }

  return (
    <LayoutView
      viewConfig={view}
      collection={collection}
      collections={collections}
      views={views}
      items={items}
      orderedProperties={properties}
      relationFilter={relationFilter}
      activeCollectionId={activeCollectionId}
      onEdit={onEdit}
      onDelete={onDelete}
      onViewDetail={onViewDetail}
      onRelationChange={onRelationChange}
      onUpdateViewConfig={(viewId, updates) => {
        if (viewId === view.id) onUpdateView(updates);
      }}
      onShowNewItemModalForCollection={onShowNewItemModalForCollection}
    />
  );
};

export default LayoutRenderer;
