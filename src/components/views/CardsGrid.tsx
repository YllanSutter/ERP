import React from 'react';
import type { Collection, Item, Property } from '@/lib/types';
import SteamCardFullArt from '@/components/views/SteamCardFullArt';

interface CardsGridProps {
  items: Item[];
  cardColumns?: number | 'auto';
  steamProperty?: Property;
  cardStyle: 'default' | 'steamFullArt';
  cardDensity: 'compact' | 'comfortable' | 'spacious';
  iconProperty?: Property;
  colorProperty?: Property;
  fieldPlacements: Record<string, string>;
  properties: Property[];
  collection: Collection;
  collections: Collection[];
  canEdit: boolean;
  canEditField: (fieldId: string) => boolean;
  onViewDetail: (item: Item) => void;
  onEdit: (item: Item) => void;
  onRelationChange: (property: Property, item: Item, value: unknown) => void;
  onNavigateToCollection: (collectionId: string, linkedIds?: string[]) => void;
  selectedItemIds: Set<string>;
  onSelectionChange: (itemId: string, checked: boolean) => void;
  canReorder: boolean;
  dragItemId: string | null;
  onDragStart: (itemId: string) => void;
  onDragEnd: () => void;
  onDropOnItem: (itemId: string) => void;
}

const CardsGrid: React.FC<CardsGridProps> = ({
  items,
  cardColumns = 'auto',
  steamProperty,
  cardStyle,
  cardDensity,
  iconProperty,
  colorProperty,
  fieldPlacements,
  properties,
  collection,
  collections,
  canEdit,
  canEditField,
  onViewDetail,
  onEdit,
  onRelationChange,
  onNavigateToCollection,
  selectedItemIds,
  onSelectionChange,
  canReorder,
  dragItemId,
  onDragStart,
  onDragEnd,
  onDropOnItem,
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
  const densityGap = cardDensity === 'compact' ? 'gap-2 p-2' : cardDensity === 'spacious' ? 'gap-6 p-6' : 'gap-4 p-4';

  return (
    <div>
      <div className={`grid ${densityGap} ${cardColumns === 'auto' ? 'grid-cols-[repeat(auto-fill,minmax(250px,1fr))]' : columnClassName}`}>
      {items.map((item) => (
        <SteamCardFullArt
          key={item.id}
          item={item}
          steamProperty={steamProperty}
          styleProperty={colorProperty}
          iconProperty={iconProperty}
          fieldPlacements={fieldPlacements}
          fullArt={cardStyle === 'steamFullArt'}
          density={cardDensity}
          properties={properties}
          onViewDetail={onViewDetail}
          onEdit={onEdit}
          canEdit={canEdit}
          canEditField={canEditField}
          collections={collections}
          collection={collection}
          onRelationChange={onRelationChange}
          onNavigateToCollection={onNavigateToCollection}
          selected={selectedItemIds.has(item.id)}
          onSelectionChange={onSelectionChange}
          draggable={canReorder}
          isDragging={dragItemId === item.id}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDropOnItem={onDropOnItem}
        />
      ))}
      </div>
    </div>
  );
};

export default CardsGrid;
