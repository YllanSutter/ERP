import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Settings2, Trash2 } from 'lucide-react';
import type { ViewSettingsProps } from '@/lib/views';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import LayoutPanelsEditor from './LayoutPanelsEditor';
import LayoutPanelSettings from './LayoutPanelSettings';
import { getLayoutEntries, moveLayoutEntry } from './layoutOrder';
import DashboardModuleConfigPanel from '@/components/dashboard/DashboardModuleConfigPanel';
import { MODULE_TYPE_LABELS } from '@/lib/dashboardTypes';
import { getViewRegistration } from '@/lib/views';
import { IconButton } from '@/components/ui/icon-button';

const fieldClassName =
  'h-8 min-w-0 rounded-md border border-black/10 bg-white/70 px-2.5 text-xs text-neutral-800 outline-none transition-colors hover:border-brand-400/60 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200';
const labelClassName = 'text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400';
const fieldOptions = (properties: ViewSettingsProps['properties'], types: string[]) =>
  properties.filter((property) => types.includes(property.type));

const SettingsSelect: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="grid gap-1 text-xs">
    <span className={labelClassName}>{label}</span>
    <Select
      value={value || '__none__'}
      onValueChange={(nextValue) => onChange(nextValue === '__none__' ? '' : nextValue)}
    >
      <SelectTrigger className={fieldClassName}>
        <SelectValue placeholder="Aucun" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">Aucun</SelectItem>
        {options.filter((option) => option.value).map((option) => (
          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </label>
);

const SettingsToggle: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex min-h-8 cursor-pointer items-center justify-between gap-3 rounded-md border border-black/10 bg-white/40 px-2.5 text-xs dark:border-white/10 dark:bg-white/[0.03]">
    <span className="text-neutral-700 dark:text-neutral-300">{label}</span>
    <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
  </label>
);

export const TableViewSettings: React.FC<ViewSettingsProps> = ({ view, onUpdate }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    <SettingsSelect
      label="Affichage des groupes"
      value={typeof view.groupDisplayMode === 'string' ? view.groupDisplayMode : 'accordion'}
      options={[
        { value: 'accordion', label: 'Accordéon' },
        { value: 'columns', label: 'Colonnes' },
        { value: 'tabs', label: 'Onglets' },
        { value: 'select', label: 'Sélecteur' },
      ]}
      onChange={(value) => onUpdate({ groupDisplayMode: value })}
    />
  </div>
);

export const CardsViewSettings: React.FC<ViewSettingsProps> = (props) => (
  <CardsSettingsContent {...props} />
);

const CardsSettingsContent: React.FC<ViewSettingsProps> = ({ view, properties, onUpdate }) => {
  const multiselects = fieldOptions(properties, ['multiselect', 'multi_select']);
  const fieldOptionsForSelect = [
    { value: '', label: 'Aucun' },
    ...multiselects.map((property) => ({ value: property.id, label: property.name })),
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <SettingsSelect
        label="Champ des icônes"
        value={typeof view.cardIconFieldId === 'string' ? view.cardIconFieldId : ''}
        options={fieldOptionsForSelect}
        onChange={(value) => onUpdate({ cardIconFieldId: value || null })}
      />
      <SettingsSelect
        label="Champ des couleurs"
        value={typeof view.cardColorFieldId === 'string' ? view.cardColorFieldId : ''}
        options={fieldOptionsForSelect}
        onChange={(value) => onUpdate({ cardColorFieldId: value || null })}
      />
      <SettingsSelect
        label="Style de carte"
        value={
          typeof view.cardStyle === 'string'
            ? view.cardStyle
            : view.type === 'steamcards'
              ? 'steamFullArt'
              : 'default'
        }
        options={[
          { value: 'default', label: 'Standard' },
          { value: 'steamFullArt', label: 'Steam Full Art' },
        ]}
        onChange={(value) => onUpdate({ cardStyle: value })}
      />
      <SettingsSelect
        label="Colonnes"
        value={String(view.cardColumns || 'auto')}
        options={[
          { value: 'auto', label: 'Automatique' },
          ...[1, 2, 3, 4, 5, 6].map((value) => ({ value: String(value), label: `${value} colonne${value > 1 ? 's' : ''}` })),
        ]}
        onChange={(value) => onUpdate({ cardColumns: value === 'auto' ? 'auto' : Number(value) })}
      />
    </div>
  );
};

export const KanbanViewSettings: React.FC<ViewSettingsProps> = ({ view, properties, onUpdate }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    <SettingsSelect
      label="Regrouper par"
      value={typeof view.groupBy === 'string' ? view.groupBy : ''}
      options={[
        { value: '', label: 'Aucun' },
        ...fieldOptions(properties, ['select']).map((property) => ({ value: property.id, label: property.name })),
      ]}
      onChange={(value) => onUpdate({ groupBy: value || null })}
    />
    <SettingsToggle
      label="Afficher les champs au survol"
      checked={Boolean(view.kanbanShowFieldsOnHover)}
      onChange={(checked) => onUpdate({ kanbanShowFieldsOnHover: checked })}
    />
    <SettingsSelect
      label="Tri des cartes"
      value={typeof view.kanbanSortDirection === 'string' ? view.kanbanSortDirection : 'asc'}
      options={[
        { value: 'asc', label: 'Croissant' },
        { value: 'desc', label: 'Décroissant' },
      ]}
      onChange={(value) => onUpdate({ kanbanSortDirection: value })}
    />
  </div>
);

export const CalendarViewSettings: React.FC<ViewSettingsProps> = ({ view, properties, onUpdate }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    <SettingsSelect
      label="Propriété de date"
      value={typeof view.dateProperty === 'string' ? view.dateProperty : ''}
      options={[
        { value: '', label: 'Aucune' },
        ...fieldOptions(properties, ['date', 'date_range']).map((property) => ({ value: property.id, label: property.name })),
      ]}
      onChange={(value) => onUpdate({ dateProperty: value || null })}
    />
    <SettingsSelect
      label="Affichage initial"
      value={typeof view.calendarViewMode === 'string' ? view.calendarViewMode : 'month'}
      options={[
        { value: 'month', label: 'Mois' },
        { value: 'week', label: 'Semaine' },
        { value: 'day', label: 'Jour' },
      ]}
      onChange={(value) => onUpdate({ calendarViewMode: value })}
    />
    <SettingsToggle
      label="Sélecteur de collections"
      checked={view.showCollectionsSelector !== false}
      onChange={(checked) => onUpdate({ showCollectionsSelector: checked })}
    />
  </div>
);

export const LayoutViewSettings: React.FC<ViewSettingsProps> = ({ view, collection, collections, views, onUpdate }) => {
  const { panels, modules, entries, order } = getLayoutEntries(view);
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const move = (index: number, offset: number) => onUpdate({ layoutOrder: moveLayoutEntry(order, index, offset) });
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <SettingsToggle label="Fond des vues et modules" checked={view.layoutTileBackground === true} onChange={(checked) => onUpdate({ layoutTileBackground: checked })} />
        <SettingsToggle label="Panneaux redimensionnables" checked={view.layoutResizable !== false} onChange={(checked) => onUpdate({ layoutResizable: checked })} />
        <SettingsToggle label="Adapter la hauteur au contenu" checked={Boolean(view.layoutAutoHeight)} onChange={(checked) => onUpdate({ layoutAutoHeight: checked })} />
      </div>
      <div className="space-y-2 border-t border-black/10 pt-3 dark:border-white/10">
        <h3 className="text-xs font-semibold">Vues et modules</h3>
        {order.map((key, index) => {
          const { panel, module } = entries.get(key)!;
          const moduleCollection = module && (collections ?? [collection]).find(({ id }) => id === module.collectionId);
          const moduleLabel = module && (MODULE_TYPE_LABELS[module.type] ?? getViewRegistration(module.type).label);
          const title = module
            ? module.title ?? (moduleCollection ? `${moduleCollection.name} · ${moduleLabel}` : moduleLabel)
            : panel?.title || views?.[panel?.collectionId || collection.id]?.find(({ id }) => id === panel?.viewId)?.name || 'Vue à configurer';
          return (
            <div key={key} className="space-y-2 rounded-lg border border-border p-2">
              <div className="flex min-w-0 items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-xs font-medium" title={title}>{title}</span>
                <span className="text-[11px] text-muted-foreground">{module ? 'Module' : 'Vue'}</span>
                <IconButton label={`Monter ${title}`} className="size-7" disabled={index === 0} onClick={() => move(index, -1)}><ChevronUp size={14} /></IconButton>
                <IconButton label={`Descendre ${title}`} className="size-7" disabled={index === order.length - 1} onClick={() => move(index, 1)}><ChevronDown size={14} /></IconButton>
                {panel && (
                  <IconButton label={`Configurer ${title}`} className="size-7" onClick={() => setConfiguringId(configuringId === key ? null : key)}><Settings2 size={14} /></IconButton>
                )}
                {module && (
                  <>
                    <IconButton label={`Configurer ${title}`} className="size-7" onClick={() => setConfiguringId(configuringId === module.id ? null : module.id)}><Settings2 size={14} /></IconButton>
                    <IconButton label={`Retirer ${title}`} className="size-7" onClick={() => onUpdate({ layoutModules: modules.filter(({ id }) => id !== module.id) })}><Trash2 size={14} /></IconButton>
                  </>
                )}
              </div>
              {panel && configuringId === key && (
                <LayoutPanelSettings
                  panel={panel}
                  onChange={(updated) => onUpdate({ layoutPanels: updated
                    ? panels.map((entry) => entry.id === panel.id ? updated : entry)
                    : panels.filter(({ id }) => id !== panel.id) })}
                  collection={collection}
                  collections={collections ?? [collection]}
                  views={views}
                />
              )}
              {module && configuringId === module.id && (
                <DashboardModuleConfigPanel
                  embedded
                  allowPeriod
                  useLayoutUnits
                  excludeLayout
                  module={module}
                  collections={collections ?? [collection]}
                  views={views}
                  onUpdate={(patch) => onUpdate({ layoutModules: modules.map((entry) =>
                    entry.id === module.id ? { ...entry, ...patch } : entry) })}
                  onClose={() => setConfiguringId(null)}
                />
              )}
            </div>
          );
        })}
        <LayoutPanelsEditor panels={[]} onChange={(added) => onUpdate({ layoutPanels: [...panels, ...added] })} collection={collection} />
      </div>
    </div>
  );
};
