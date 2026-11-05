import { Globe, PinOff, Plus, Settings2 } from 'lucide-react';
import { useState } from 'react';
import FilterModal from '@/components/modals/FilterModal';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
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
  onSave: (index: number | null, filter: CollectionFilter) => void;
  onUnpin: (index: number) => void;
}

export default function PinnedCollectionFilters({ collection, collections, canEdit, onUpdateValue, onUnpin, onSave }: Props) {
  const [editor, setEditor] = useState<number | 'new' | null>(null);
  const filters = collection.pinnedFilters ?? [];
  if (!filters.length && !canEdit) return null;

  const getProperty = (filter: CollectionFilter) => {
    const source = filter.sourceCollectionId && filter.sourceCollectionId !== collection.id
      ? collections.find(({ id }) => id === filter.sourceCollectionId)
      : collection;
    return getOrderedProperties(source, null, collections).find(({ id }) => id === filter.property);
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Filtres épinglés de la collection">
      {filters.map((filter, index) => {
        const property = getProperty(filter);
        const mappedNames = Object.entries(filter.collectionFields ?? {}).flatMap(([collectionId, ids]) => {
          const source = collections.find(({ id }) => id === collectionId);
          const names = getOrderedProperties(source, null, collections).filter(({ id }) => ids.includes(id)).map(({ name }) => name);
          return names.length ? [`${source?.name} · ${names.join(' ou ')}`] : [];
        });
        const target = property?.type === 'relation' && collections.find(({ id }) => id === property.relation?.targetCollectionId);
        const label = mappedNames.length > 1 && target ? target.name : property?.name ?? 'Champ';
        const details = mappedNames.length ? mappedNames.join('\n') : label;
        const hasValue = filter.operator !== 'is_empty' && filter.operator !== 'is_not_empty';
        return (
          <div key={index} className="flex min-w-0 items-center gap-1.5 rounded-md border border-primary/25 bg-primary/5 px-2 py-0.5 text-xs">
            <Globe size={12} className="shrink-0 text-primary" aria-hidden="true" />
            <span className="max-w-44 truncate font-medium" title={details}>{label}</span>
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
              <IconButton label="Modifier le filtre global" className="h-6 w-6" onClick={() => setEditor(index)}>
                <Settings2 size={12} />
              </IconButton>
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
      {canEdit && (
        <>
          <IconButton label="Ajouter un filtre global à la collection" className="h-7 w-7" onClick={() => setEditor('new')}>
            <Plus size={15} />
          </IconButton>
          <Sheet open={editor !== null} onOpenChange={(open) => { if (!open) setEditor(null); }}>
            <SheetContent side="right" overlayClassName="z-[309] bg-transparent" className="z-[310] flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
              <SheetTitle className="border-b px-4 py-3 pr-10 text-sm">Filtre global · {collection.name}</SheetTitle>
              <SheetDescription className="sr-only">Ce filtre s’applique à toutes les vues de la collection.</SheetDescription>
              {editor !== null && (
                <div className="min-h-0 overflow-y-auto p-3">
                  <FilterModal key={editor} embedded globalFilter scopeCollectionName={collection.name} properties={collection.properties} collections={collections}
                    initialFilter={editor === 'new' ? null : filters[editor]}
                    onClose={() => setEditor(null)}
                    onAdd={(property, operator, value, sourceCollectionId, meta) => {
                      onSave(editor === 'new' ? null : editor, { property, operator, value, sourceCollectionId, ...meta });
                      setEditor(null);
                    }} />
                </div>
              )}
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
