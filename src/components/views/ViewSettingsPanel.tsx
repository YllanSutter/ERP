import CopyViewSettings from './CopyViewSettings';
import React from 'react';
import type { Collection, Property } from '@/lib/types';
import { getViewRegistration } from '@/lib/views';
import type { ViewDefinition } from '@/lib/views';
import { Input } from '@/components/ui/input';
import { SettingsSelect, SettingsLabel } from '@/components/ui/settings-panel';
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
          <SettingsLabel>Type</SettingsLabel>
          <SettingsSelect value={view.type} onChange={(type) => onUpdate({ type })}
            options={viewTypes.map((entry) => ({ value: entry.type, label: entry.label }))} />
        </label>
        <label className="grid gap-1 text-xs">
          <SettingsLabel>Nom</SettingsLabel>
          <Input
            value={view.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
            className="settings-control"
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
      <CopyViewSettings key={view.id} view={view} views={views?.[collection.id] || []} onUpdate={onUpdate} />
    </div>
  );
};

export default ViewSettingsPanel;
