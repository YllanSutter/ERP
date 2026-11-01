import React, { useMemo } from 'react';
import { Settings } from 'lucide-react';
import type { Collection, Property } from '@/lib/types';
import { getViewRegistration } from '@/lib/views';
import type { ViewDefinition } from '@/lib/views';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ViewSettingsPanelProps {
  view: ViewDefinition;
  collection: Collection;
  properties: Property[];
  onUpdate: (updates: Record<string, unknown>) => void;
}

const fieldOptions = (properties: Property[], types?: string[]) =>
  properties.filter((property) => !types || types.includes(property.type));

const ViewSettingsPanel: React.FC<ViewSettingsPanelProps> = ({
  view,
  collection,
  properties,
  onUpdate,
}) => {
  const registration = getViewRegistration(view.type);
  const multiselectProperties = useMemo(
    () => fieldOptions(properties, ['multiselect', 'multi_select']),
    [properties]
  );
  const fieldValue = (key: string) => typeof view[key] === 'string' ? String(view[key]) : '';
  const selectProperties = useMemo(
    () => fieldOptions(properties, ['select']),
    [properties]
  );
  const dateProperties = useMemo(
    () => fieldOptions(properties, ['date', 'date_range']),
    [properties]
  );

  const renderSelect = (
    label: string,
    value: string,
    options: Property[],
    key: string,
  ) => (
    <label className="grid gap-1 text-xs">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{label}</span>
      <Select
        value={value || '__none__'}
        onValueChange={(nextValue) => onUpdate({ [key]: nextValue === '__none__' ? null : nextValue })}
      >
        <SelectTrigger className="h-8 min-w-0 border-black/10 bg-white/70 px-2.5 text-xs dark:border-white/10 dark:bg-white/5">
          <SelectValue placeholder="Aucun" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Aucun</SelectItem>
          {options.map((property) => <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  );

  return (
    <div className="mb-4 border-b border-black/10 pb-4 dark:border-white/10">
      <div className="mb-3 flex items-center gap-2">
        <Settings size={14} className="text-violet-500" />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-neutral-800 dark:text-white">Paramètres de la vue</h4>
          <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">{registration.label} · {collection.name}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Nom</span>
          <input
            value={view.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
            className="h-8 min-w-0 rounded-md border border-black/10 bg-white/70 px-2.5 text-xs text-neutral-800 outline-none transition-colors hover:border-violet-400/60 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200"
          />
        </label>

        {(view.type === 'cards' || view.type === 'steamcards') && (
          <>
            {renderSelect('Champ des icônes', fieldValue('cardIconFieldId'), multiselectProperties, 'cardIconFieldId')}
            {renderSelect('Champ des couleurs', fieldValue('cardColorFieldId'), multiselectProperties, 'cardColorFieldId')}
            <label className="grid gap-1 text-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Style de carte</span>
              <Select
                value={fieldValue('cardStyle') || (view.type === 'steamcards' ? 'steamFullArt' : 'default')}
                onValueChange={(value) => onUpdate({ cardStyle: value })}
              >
                <SelectTrigger className="h-8 min-w-0 border-black/10 bg-white/70 px-2.5 text-xs dark:border-white/10 dark:bg-white/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Standard</SelectItem>
                  <SelectItem value="steamFullArt">Steam Full Art</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </>
        )}

        {view.type === 'kanban' && renderSelect('Regrouper par', fieldValue('groupBy'), selectProperties, 'groupBy')}
        {view.type === 'calendar' && renderSelect('Propriété de date', fieldValue('dateProperty'), dateProperties, 'dateProperty')}
      </div>

      {registration.Settings && (
        <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
          <registration.Settings
            view={view}
            collection={collection}
            properties={properties}
            onUpdate={onUpdate}
          />
        </div>
      )}
    </div>
  );
};

export default ViewSettingsPanel;
