import { Pin, PinOff } from 'lucide-react';
import type { Collection, CollectionFilter } from '@/lib/types';
import { COMPACT_OPERATOR_LABELS } from '@/components/modals/modalLib';
import { getOrderedProperties } from '@/lib/filterUtils';
import FilterValueDisplay from './FilterValueDisplay';
import { IconButton } from '@/components/ui/icon-button';

interface Props {
  collection: Collection;
  collections: Collection[];
  canEdit: boolean;
  onUpdateValue: (index: number, value: unknown) => void;
  onUnpin: (index: number) => void;
}

export default function PinnedCollectionFilters({ collection, collections, canEdit, onUpdateValue, onUnpin }: Props) {
  if (!collection.pinnedFilters?.length) return null;

  const getProperty = (filter: CollectionFilter) => {
    const source = filter.sourceCollectionId && filter.sourceCollectionId !== collection.id
      ? collections.find(({ id }) => id === filter.sourceCollectionId)
      : collection;
    return getOrderedProperties(source, null, collections).find(({ id }) => id === filter.property);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Filtres épinglés de la collection">
      {collection.pinnedFilters.map((filter, index) => {
        const property = getProperty(filter);
        const hasValue = filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty';
        return (
          <div key={index} className="flex min-w-0 items-center gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-2 py-0.5 text-xs">
            <Pin size={12} className="shrink-0 text-primary" aria-hidden="true" />
            <span className="max-w-28 truncate font-medium">{property?.name ?? 'Champ'}</span>
            <span className="text-muted-foreground">{COMPACT_OPERATOR_LABELS[filter.operator] ?? filter.operator}</span>
            {hasValue && property && (
              <FilterValueDisplay
                filter={filter}
                property={property}
                collections={collections}
                currentCollection={collection}
                canEdit={canEdit}
                compact
                onUpdateValue={(value) => onUpdateValue(index, value)}
              />
            )}
            {canEdit && (
              <IconButton
                label="Désépingler et remettre dans cette vue"
                className="h-6 w-6 shrink-0"
                onClick={() => onUnpin(index)}
              >
                <PinOff size={12} />
              </IconButton>
            )}
          </div>
        );
      })}
    </div>
  );
}
