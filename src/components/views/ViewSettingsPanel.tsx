import React from 'react';
import type { Collection, Property } from '@/lib/types';
import { getViewRegistration } from '@/lib/views';
import type { ViewDefinition } from '@/lib/views';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getViewRegistrations } from '@/lib/views';

interface ViewSettingsPanelProps {
  view: ViewDefinition;
  collection: Collection;
  properties: Property[];
  collections?: Collection[];
  views?: Record<string, ViewDefinition[]>;
  onUpdate: (updates: Record<string, unknown>) => void;
}

const ViewSettingsPanel: React.FC<ViewSettingsPanelProps> = ({
  view,
  collection,
  properties,
  collections,
  views,
  onUpdate,
}) => {
  const registration = getViewRegistration(view.type);
  const viewTypes = getViewRegistrations();
  return (
    <div className="pb-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Type</span>
          <Select value={view.type} onValueChange={(type) => onUpdate({ type })}>
            <SelectTrigger className="h-8 min-w-0 bg-white/70 px-2.5 text-xs dark:bg-white/5"><SelectValue /></SelectTrigger>
            <SelectContent>{viewTypes.map((entry) => <SelectItem key={entry.type} value={entry.type}>{entry.label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        <label className="grid gap-1 text-xs">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Nom</span>
          <Input
            value={view.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
            className="h-8 min-w-0 bg-white/70 px-2.5 text-xs dark:bg-white/5"
          />
        </label>
      </div>

      {registration.Settings && (
        <div className="mt-3 border-t border-black/10 pt-3 dark:border-white/10">
          <registration.Settings
            view={view}
            collection={collection}
            properties={properties}
            collections={collections}
            views={views}
            onUpdate={onUpdate}
          />
        </div>
      )}
    </div>
  );
};

export default ViewSettingsPanel;
