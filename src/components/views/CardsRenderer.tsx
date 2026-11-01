import React from 'react';
import CardsView from './CardsView';
import type { ViewRendererProps } from '@/lib/views';
import type { TableViewProps } from '@/lib/types';

type CardsRendererProps = ViewRendererProps & Partial<TableViewProps>;

const CardsRenderer: React.FC<CardsRendererProps> = ({
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
  ...legacyProps
}) => {
  if (!onEdit || !onDelete || !onViewDetail || !onRelationChange || !onNavigateToCollection) {
    return <div role="alert">Le renderer Cartes n&apos;a pas reçu ses actions requises.</div>;
  }

  return (
    <CardsView
      collection={collection}
      items={items}
      onEdit={onEdit}
      onDelete={onDelete}
      onViewDetail={onViewDetail}
      collections={collections}
      orderedProperties={properties}
      hiddenFields={Array.isArray(view.hiddenFields) ? view.hiddenFields : []}
      onRelationChange={onRelationChange}
      onNavigateToCollection={onNavigateToCollection}
      onReorderItems={legacyProps.onReorderItems || (() => {})}
      onToggleField={legacyProps.onToggleField || (() => {})}
      onDeleteProperty={legacyProps.onDeleteProperty || (() => {})}
      onEditProperty={legacyProps.onEditProperty || (() => {})}
      groups={Array.isArray(view.groups) ? view.groups as string[] : []}
      {...legacyProps}
    />
  );
};

export default CardsRenderer;
