import type { Collection, Property } from '@/lib/types';
import { getOrderedProperties } from '@/lib/filterUtils';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  collections: Collection[];
  sourceCollectionId: string;
  property: Property;
  fields: Record<string, string[]>;
  operator: string;
  onChange: (fields: Record<string, string[]>) => void;
}

const selectTypes = new Set(['select', 'multiselect', 'multi_select']);

export default function FilterCollectionFields({ collections, sourceCollectionId, property, fields, onChange, operator }: Props) {
  const isCompatible = (candidate: Property) => {
    if (property.type === 'relation') {
      return candidate.type === 'relation' && candidate.relation?.targetCollectionId === property.relation?.targetCollectionId;
    }
    if (selectTypes.has(property.type)) return selectTypes.has(candidate.type);
    return candidate.type === property.type;
  };

  const exclude = ['not_equals', 'not_contains', 'is_empty'].includes(operator);
  return (
    <section className="space-y-2 border-t border-border pt-4" aria-label="Champs par collection">
      <div className="space-y-1 pb-1">
        <h3 className="text-sm font-medium">Où appliquer ce filtre ?</h3>
        <p className="text-xs text-muted-foreground">
          {exclude ? 'L’élément est masqué si un de ses champs correspond.' : 'L’élément est affiché si un de ses champs correspond.'}
          {' '}Choisis les champs à tester dans chaque collection.
        </p>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border">
        {collections.map((collection) => {
          const properties = getOrderedProperties(collection, null, collections).filter(isCompatible);
          const selected = fields[collection.id] ?? [];
          return (
            <div key={collection.id} role="group" aria-label={collection.name} className="grid gap-2 p-3 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)]">
              <div className="space-y-0.5">
                <p className="truncate text-xs font-medium" title={collection.name}>{collection.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {selected.length === 0 ? 'Non filtrée' : selected.length > 1 ? exclude ? 'Aucun de ces champs' : 'Un de ces champs' : 'Filtrée'}
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-1.5">
                {properties.map((field) => {
                  const checked = selected.includes(field.id);
                  const required = collection.id === sourceCollectionId && field.id === property.id;
                  return (
                    <button key={field.id} type="button" aria-pressed={checked} disabled={required}
                      title={required ? 'Champ de référence' : field.name}
                      className={cn('inline-flex min-h-7 max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        checked ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent')}
                      onClick={() => onChange({ ...fields, [collection.id]: checked
                        ? selected.filter((id) => id !== field.id)
                        : [...selected, field.id] })}>
                      {checked && <Check size={12} className="shrink-0" />}
                      <span className="truncate">{field.name}</span>
                    </button>
                  );
                })}
                {properties.length === 0 && <span className="text-xs text-muted-foreground">Aucun champ compatible</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Une collection sans champ sélectionné reste visible.</p>
    </section>
  );
}
