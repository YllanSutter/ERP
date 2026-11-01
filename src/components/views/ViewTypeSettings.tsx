import React from 'react';
import type { ViewSettingsProps } from '@/lib/views';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const fieldClassName =
  'h-8 min-w-0 rounded-md border border-black/10 bg-white/70 px-2.5 text-xs text-neutral-800 outline-none transition-colors hover:border-violet-400/60 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200';
const labelClassName = 'text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400';

const SettingsSelect: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="grid gap-1 text-xs">
    <span className={labelClassName}>{label}</span>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={fieldClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
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
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-violet-500" />
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
    <SettingsSelect
      label="Densité"
      value={typeof view.tableDensity === 'string' ? view.tableDensity : 'comfortable'}
      options={[
        { value: 'compact', label: 'Compacte' },
        { value: 'comfortable', label: 'Confortable' },
        { value: 'spacious', label: 'Aérée' },
      ]}
      onChange={(value) => onUpdate({ tableDensity: value })}
    />
  </div>
);

export const CardsViewSettings: React.FC<ViewSettingsProps> = ({ view, onUpdate }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    <SettingsSelect
      label="Colonnes"
      value={String(view.cardColumns || 'auto')}
      options={[
        { value: 'auto', label: 'Automatique' },
        ...[1, 2, 3, 4, 5, 6].map((value) => ({ value: String(value), label: `${value} colonne${value > 1 ? 's' : ''}` })),
      ]}
      onChange={(value) => onUpdate({ cardColumns: value === 'auto' ? 'auto' : Number(value) })}
    />
    <SettingsSelect
      label="Densité"
      value={typeof view.cardDensity === 'string' ? view.cardDensity : 'comfortable'}
      options={[
        { value: 'compact', label: 'Compacte' },
        { value: 'comfortable', label: 'Confortable' },
        { value: 'spacious', label: 'Aérée' },
      ]}
      onChange={(value) => onUpdate({ cardDensity: value })}
    />
  </div>
);

export const KanbanViewSettings: React.FC<ViewSettingsProps> = ({ view, onUpdate }) => (
  <div className="grid gap-2 sm:grid-cols-2">
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

export const CalendarViewSettings: React.FC<ViewSettingsProps> = ({ view, onUpdate }) => (
  <div className="grid gap-2 sm:grid-cols-2">
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

export const LayoutViewSettings: React.FC<ViewSettingsProps> = ({ view, onUpdate }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    <SettingsToggle
      label="Panneaux redimensionnables"
      checked={view.layoutResizable !== false}
      onChange={(checked) => onUpdate({ layoutResizable: checked })}
    />
    <SettingsToggle
      label="Adapter la hauteur au contenu"
      checked={Boolean(view.layoutAutoHeight)}
      onChange={(checked) => onUpdate({ layoutAutoHeight: checked })}
    />
  </div>
);
