import React from 'react';
import type { Collection, Item, Property } from '@/lib/types';
import SteamCardFullArt from '@/components/views/SteamCardFullArt';

interface CardsGridProps {
  items: Item[];
  cardColumns?: number | 'auto';
  steamProperty?: Property;
  styleProperty?: Property;
  properties: Property[];
  collection: Collection;
  collections: Collection[];
  canEdit: boolean;
  canEditField: (fieldId: string) => boolean;
  onViewDetail: (item: Item) => void;
  onEdit: (item: Item) => void;
  onRelationChange: (property: Property, item: Item, value: unknown) => void;
  onNavigateToCollection: (collectionId: string, linkedIds?: string[]) => void;
}

const CardsGrid: React.FC<CardsGridProps> = ({
  items,
  cardColumns = 'auto',
  steamProperty,
  styleProperty,
  properties,
  collection,
  collections,
  canEdit,
  canEditField,
  onViewDetail,
  onEdit,
  onRelationChange,
  onNavigateToCollection,
}) => {
  const columnCount = Math.max(1, Math.min(6, Number(cardColumns) || 1));
  const columnClassName = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6',
  }[columnCount as 1 | 2 | 3 | 4 | 5 | 6];

  return (
    <div
      className={`grid gap-4 p-4 ${cardColumns === 'auto' ? 'grid-cols-[repeat(auto-fill,minmax(250px,1fr))]' : columnClassName}`}
    >
      {items.map((item) => (
        <SteamCardFullArt
          key={item.id}
          item={item}
          steamProperty={steamProperty}
          styleProperty={styleProperty}
          properties={properties}
          onViewDetail={onViewDetail}
          onEdit={onEdit}
          canEdit={canEdit}
          canEditField={canEditField}
          collections={collections}
          collection={collection}
          onRelationChange={onRelationChange}
          onNavigateToCollection={onNavigateToCollection}
        />
      ))}
    </div>
  );
};

export default CardsGrid;
