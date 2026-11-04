import type { Collection } from '@/lib/types';
import type { ViewDefinition } from '@/lib/views';
import { getViewRegistration } from '@/lib/views';
import { getOrderedProperties } from '@/lib/filterUtils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
        Titre du panneau
        <Input className="h-8" placeholder={view?.name ?? 'Nom de la vue'} value={panel.title ?? ''}
          onChange={(event) => onChange({ ...panel, title: event.target.value })} />
      </label>
      <div className="space-y-1">
        <p className="text-xs font-medium">Période du panneau</p>
        <ModulePeriodSelect inherit value={panel.period} onChange={(period) => onChange({ ...panel, period })} />
      </div>
      {dateFields.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Champ date de la période</p>
          <Select value={panel.dateField || '__auto__'} onValueChange={(value) =>
            onChange({ ...panel, dateField: value === '__auto__' ? undefined : value })}>
            <SelectTrigger aria-label="Champ date de la période" className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">Champ date de la vue</SelectItem>
              {dateFields.map(({ id, name }) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
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
