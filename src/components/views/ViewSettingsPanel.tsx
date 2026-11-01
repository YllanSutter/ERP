import React from 'react';
import { Settings } from 'lucide-react';
import type { Collection, Property } from '@/lib/types';
import { getViewRegistration } from '@/lib/views';
import type { ViewDefinition } from '@/lib/views';
import { Input } from '@/components/ui/input';

interface ViewSettingsPanelProps {
  view: ViewDefinition;
  collection: Collection;
  properties: Property[];
  onUpdate: (updates: Record<string, unknown>) => void;
}

const ViewSettingsPanel: React.FC<ViewSettingsPanelProps> = ({
  view,
  collection,
  properties,
  onUpdate,
}) => {
  const registration = getViewRegistration(view.type);
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
            onUpdate={onUpdate}
          />
        </div>
      )}
    </div>
  );
};

export default ViewSettingsPanel;
