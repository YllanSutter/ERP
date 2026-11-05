import type { Collection } from '@/lib/types';
import type { ViewDefinition } from '@/lib/views';
import { getViewRegistration } from '@/lib/views';
import { getOrderedProperties } from '@/lib/filterUtils';
import { Input } from '@/components/ui/input';
import { SettingsSelect, SettingsLabel } from '@/components/ui/settings-panel';
import ModulePeriodSelect from '@/components/dashboard/ModulePeriodSelect';
import LayoutPanelsEditor, { type LayoutPanelConfig } from './LayoutPanelsEditor';

interface Props {
  panel: LayoutPanelConfig;
  collection: Collection;
  collections: Collection[];
  views?: Record<string, ViewDefinition[]>;
  onChange: (panel?: LayoutPanelConfig) => void;
}

export default function LayoutPanelSettings({ panel, collection, collections, views, onChange }: Props) {
  const sourceId = panel.collectionId || collection.id;
  const source = collections.find(({ id }) => id === sourceId);
  const view = views?.[sourceId]?.find(({ id }) => id === panel.viewId);
  const Settings = view && view.type !== 'layout' ? getViewRegistration(view.type).Settings : undefined;
  const properties = source && view ? getOrderedProperties(source, view, collections) : [];
  const dateFields = properties.filter(({ type }) => type === 'date' || type === 'date_range');

  return (
    <div className="space-y-3">
      <LayoutPanelsEditor hideAdd panels={[panel]} collection={collection} collections={collections} views={views}
        onChange={([next]) => onChange(next && (next.viewId !== panel.viewId || next.collectionId !== panel.collectionId
          ? { ...next, dateField: undefined, viewSettings: undefined }
          : next))} />
      <label className="grid gap-1 text-xs font-medium">
        <SettingsLabel>Titre du panneau</SettingsLabel>
        <Input className="h-8" placeholder={view?.name ?? 'Nom de la vue'} value={panel.title ?? ''}
          onChange={(event) => onChange({ ...panel, title: event.target.value })} />
      </label>
      <div className="space-y-1">
        <SettingsLabel>Période du panneau</SettingsLabel>
        <ModulePeriodSelect inherit value={panel.period} onChange={(period) => onChange({ ...panel, period })} />
      </div>
      {dateFields.length > 0 && (
        <div className="space-y-1">
          <SettingsLabel>Champ date de la période</SettingsLabel>
          <SettingsSelect value={panel.dateField ?? ''} aria-label="Champ date de la période"
            onChange={(value) => onChange({ ...panel, dateField: value || undefined })}
            options={[{ value: '', label: 'Champ date de la vue' }, ...dateFields.map(({ id, name }) => ({ value: id, label: name }))]} />

        </div>
      )}
      {Settings && source && view && (
        <div className="border-t border-border pt-3">
          <Settings view={{ ...view, ...panel.viewSettings }} collection={source} collections={collections}
            properties={properties} views={views} onUpdate={(patch) =>
              onChange({ ...panel, viewSettings: { ...panel.viewSettings, ...patch } })} />
        </div>
      )}
    </div>
  );
}
