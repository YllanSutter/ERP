/**
 * DashboardModuleConfigPanel – panneau latéral de configuration d'un module.
 * S'ouvre en overlay depuis la droite.
 */

import React, { useState, useCallback } from 'react';
import {
  X, Plus, Trash2, ChevronDown, BarChart2, LineChart, PieChart, AreaChart,
  Table2, Columns, CalendarDays, List, Gauge, LayoutGrid, GitBranch
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  DashboardModuleConfig,
  ModuleType,
  ChartType,
  AggregationType,
  DateGrouping,
  RecapDisplayType,
  MODULE_WIDTH_OPTIONS,
  MODULE_HEIGHT_OPTIONS,
  AGGREGATION_LABELS,
  DATE_GROUPING_LABELS,
  MODULE_TYPE_LABELS,
  RecapColumn,
} from '@/lib/dashboardTypes';
import { getPropOptions } from '@/lib/utils/recapColumnUtils';
import { Property, Collection } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  module: DashboardModuleConfig;
  collections: Collection[];
  onUpdate: (patch: Partial<DashboardModuleConfig>) => void;
  onClose: () => void;
}

type ConfigTab = 'type' | 'infos' | 'columns';

// Icônes par type de module
const MODULE_TYPE_ICONS: Record<ModuleType, React.ReactNode> = {
  table:    <Table2 size={16} />,
  kanban:   <Columns size={16} />,
  calendar: <CalendarDays size={16} />,
  chart:    <BarChart2 size={16} />,
  metric:   <Gauge size={16} />,
  list:     <List size={16} />,
  recap:    <LayoutGrid size={16} />,
};

const CHART_TYPE_OPTIONS: { value: ChartType; label: string; icon: React.ReactNode }[] = [
  { value: 'bar',  label: 'Barres',    icon: <BarChart2 size={14} /> },
  { value: 'line', label: 'Lignes',    icon: <LineChart size={14} /> },
  { value: 'area', label: 'Zones',     icon: <AreaChart size={14} /> },
  { value: 'pie',  label: 'Camembert', icon: <PieChart size={14} /> },
];

const OPERATOR_LABELS: Record<string, string> = {
  equals: '=',
  not_equals: '≠',
  contains: '∋',
  greater: '>',
  less: '<',
  is_empty: 'vide',
  is_not_empty: 'non vide',
};

// Petit composant Select réutilisable
const Sel: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, options, placeholder, className }) => (
  <div className={`relative ${className ?? ''}`}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none bg-background border border-border rounded-md px-2 py-1.5 text-sm pr-7 focus:outline-none focus:ring-1 focus:ring-ring"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
  </div>
);

// Label de section
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-5 mb-2 first:mt-0">
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Éditeur de colonnes Recap – version récursive avec sous-colonnes
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7',
];

const DISPLAY_TYPE_OPTIONS: { value: RecapDisplayType; label: string }[] = [
  { value: 'count',    label: 'Nombre' },
  { value: 'sum',      label: 'Somme' },
  { value: 'duration', label: 'Durée (Xh Ym)' },
];

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Dim' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Jeu' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sam' },
];

interface ModuleDefaults {
  displayTypes?: RecapDisplayType[];
  aggregationField?: string;
  durationField?: string;
}

interface RecapColumnsEditorProps {
  columns: RecapColumn[];
  properties: Property[];
  collections: Collection[];
  moduleCollectionId?: string;
  moduleDefaults?: ModuleDefaults;
  onChange: (cols: RecapColumn[]) => void;
}

// ── Éditeur récursif d'un nœud de colonne ──────────────────────────────────

interface RecapColumnItemEditorProps {
  col: RecapColumn;
  properties: Property[];
  collections: Collection[];
  moduleCollectionId?: string;
  depth: number;      // 0 = top, 1 = sub, 2 = sub-sub (feuille forcée)
  moduleDefaults?: ModuleDefaults;
  onUpdate: (updated: RecapColumn) => void;
  onRemove: () => void;
}

const RecapColumnItemEditor: React.FC<RecapColumnItemEditorProps> = ({
  col, properties, collections, moduleCollectionId, depth, moduleDefaults, onUpdate, onRemove,
}) => {
  const [open, setOpen] = useState(false);

  const activeCollectionId = col.collectionId ?? moduleCollectionId;
  const activeCollection = collections.find((c) => c.id === activeCollectionId) ?? null;
  const activeProperties = activeCollection?.properties ?? properties;

  const selectProps  = activeProperties.filter((p) =>
    p.type === 'select' || p.type === 'multiselect' || (p.type as string) === 'multi_select'
  );
  const numericProps = activeProperties.filter((p) => p.type === 'number');
  const dateProps = activeProperties.filter((p) => p.type === 'date' || (p.type as string) === 'date_range');

  // Mode sous-colonnes : state LOCAL (pas dérivé) pour piloter l'UI du toggle
  // On l'initialise depuis les données puis il vit sa vie indépendamment
  const initSubMode = (): 'none' | 'auto' | 'manual' =>
    col.autoSubFieldId ? 'auto' :
    (col.children?.length ?? 0) > 0 ? 'manual' :
    'none';
  const [subMode, setSubModeState] = useState<'none' | 'auto' | 'manual'>(initSubMode);

  const isLeaf  = subMode === 'none';
  const canNest = depth < 2;

  const autoSubProp    = selectProps.find((p) => p.id === col.autoSubFieldId);
  const autoSubOptions = autoSubProp ? getPropOptions(autoSubProp) : [];

  const getFieldOptions = (fid: string) => {
    const p = activeProperties.find((pp) => pp.id === fid);
    return p ? getPropOptions(p) : [];
  };

  const setSubMode = (mode: 'none' | 'auto' | 'manual') => {
    setSubModeState(mode);
    if (mode === 'none') {
      onUpdate({ ...col, autoSubFieldId: undefined, children: [] });
    } else if (mode === 'manual') {
      // Efface autoSubFieldId mais garde les children existants (ou [] si vide)
      onUpdate({ ...col, autoSubFieldId: undefined, autoSubDisplayType: undefined });
    }
    // Pour 'auto' on ne touche pas aux données tant que l'utilisateur n'a pas
    // sélectionné un champ — le picker le fera lui-même
  };

  const addChild = () => {
    const child: RecapColumn = {
      id:    uuidv4(),
      label: `Sous-col ${(col.children?.length ?? 0) + 1}`,
      color: col.color,
      // Pas de displayType → hérite des défauts module/parent
    };
    onUpdate({ ...col, children: [...(col.children ?? []), child] });
  };

  return (
    <div
      className="border border-border rounded-lg overflow-hidden"
      style={{ marginLeft: depth > 0 ? '10px' : undefined }}
    >
      {/* ─ En-tête ─ */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-accent/50 select-none"
        onClick={() => setOpen(!open)}
      >
        <div
          className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/10"
          style={{ background: col.color ?? '#6366f1' }}
        />
        <span className="flex-1 text-sm font-medium text-foreground truncate">
          {col.label || '–'}
        </span>
        {subMode === 'auto' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Auto</span>
        )}
        {subMode === 'manual' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">
            {col.children?.length ?? 0} sous-col.
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-0.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 size={12} />
        </button>
        <ChevronDown
          size={12}
          className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {/* ─ Détail ─ */}
      {open && (
        <div className="px-2 pb-2 pt-1 border-t border-border space-y-2.5 bg-background/50">

          {/* Nom */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Nom</div>
            <input
              type="text"
              value={col.label}
              onChange={(e) => onUpdate({ ...col, label: e.target.value })}
              placeholder="Nom de la colonne…"
              className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm"
            />
          </div>

          {/* Collection source */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Collection source</div>
            <Sel
              value={col.collectionId ?? ''}
              onChange={(v) => onUpdate({
                ...col,
                collectionId: v || undefined,
                dateFieldId: undefined,
                filterFieldId: undefined,
                filterValues: [],
                autoSubFieldId: undefined,
                autoSubFilterValues: [],
                aggregationField: undefined,
                durationField: undefined,
                autoSubAggregationField: undefined,
              })}
              options={collections.map((c) => ({ value: c.id, label: c.name }))}
              placeholder={moduleCollectionId ? `Défaut module: ${collections.find((c) => c.id === moduleCollectionId)?.name ?? 'Collection'}` : 'Collection du module'}
            />
          </div>

          {/* Champ date source */}
          {dateProps.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Champ date source</div>
              <Sel
                value={col.dateFieldId ?? ''}
                onChange={(v) => onUpdate({ ...col, dateFieldId: v || undefined })}
                options={dateProps.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Défaut module"
              />
            </div>
          )}

          {/* Couleur */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Couleur</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => onUpdate({ ...col, color: c })}
                  className={`w-5 h-5 rounded-full ring-1 ring-black/10 transition-transform ${col.color === c ? 'scale-125 ring-2 ring-offset-1' : 'hover:scale-110'}`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={col.color ?? '#6366f1'}
                onChange={(e) => onUpdate({ ...col, color: e.target.value })}
                className="w-5 h-5 rounded-full border-0 p-0 cursor-pointer"
                title="Couleur personnalisée"
              />
            </div>
          </div>

          {/* Filtre */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Filtrer par champ</div>
            <Sel
              value={col.filterFieldId ?? ''}
              onChange={(v) => onUpdate({ ...col, filterFieldId: v || undefined, filterValues: [] })}
              options={activeProperties.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Aucun filtre (tout afficher)"
            />
          </div>

          {/* Valeurs du filtre */}
          {col.filterFieldId && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Valeurs à inclure</div>
              {getFieldOptions(col.filterFieldId).length > 0 ? (
                <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto pr-1">
                  {getFieldOptions(col.filterFieldId).map((opt) => {
                    const checked = col.filterValues?.includes(opt) ?? false;
                    return (
                      <label key={opt} className="flex items-center gap-1.5 text-xs leading-5 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded-md px-1.5 py-0.5 select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = new Set(col.filterValues ?? []);
                            if (e.target.checked) cur.add(opt); else cur.delete(opt);
                            onUpdate({ ...col, filterValues: Array.from(cur) });
                          }}
                          className="h-3.5 w-3.5 rounded border-border/70"
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <input
                  type="text"
                  value={(col.filterValues ?? []).join(', ')}
                  onChange={(e) => onUpdate({ ...col, filterValues: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  placeholder="Valeurs séparées par des virgules"
                  className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm"
                />
              )}
            </div>
          )}

          {/* Unité de durée — s'applique à la colonne et se propage aux descendants */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Unité durée</span>
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              {(['minutes', 'hours'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => onUpdate({ ...col, durationUnit: u })}
                  className={`px-2 py-0.5 transition-colors ${
                    (col.durationUnit ?? 'minutes') === u
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent text-muted-foreground'
                  }`}
                >
                  {u === 'minutes' ? 'min' : 'h décimal'}
                </button>
              ))}
            </div>
          </div>

          {/* Type d'affichage (uniquement si feuille) */}
          {isLeaf && (() => {
            const parentTypes = moduleDefaults?.displayTypes ?? [];
            // Compatibilité legacy : si displayType (string) mais pas displayTypes (array), on le lit
            const colTypes: RecapDisplayType[] = col.displayTypes?.length
              ? col.displayTypes
              : col.displayType ? [col.displayType] : [];
            // Types effectifs : propres si définis, sinon hérités du parent
            const effectiveTypes = colTypes.length > 0 ? colTypes : parentTypes;
            const isInherited    = colTypes.length === 0;
            // Champ numérique effectif pour sum/duration
            const hasDuration = effectiveTypes.includes('duration');
            return (
              <div>
                <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                  <span>Afficher</span>
                  {isInherited && parentTypes.length > 0 && (
                    <span className="text-[10px] italic text-muted-foreground">hérite du parent</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 mb-1.5">
                  {DISPLAY_TYPE_OPTIONS.map((opt) => {
                    const checked = colTypes.includes(opt.value);
                    return (
                      <label key={opt.value} className="flex items-center gap-1.5 text-xs leading-5 cursor-pointer select-none rounded-md px-1.5 py-0.5 hover:bg-accent/40">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = new Set(colTypes);
                            if (e.target.checked) cur.add(opt.value); else cur.delete(opt.value);
                            onUpdate({ ...col, displayTypes: Array.from(cur), displayType: undefined });
                          }}
                          className="h-3.5 w-3.5 rounded border-border/70"
                        />
                        <span className={checked ? 'font-medium' : 'text-muted-foreground'}>
                          {opt.label}
                        </span>
                        {!checked && isInherited && parentTypes.includes(opt.value) && (
                          <span className="text-[10px] italic text-muted-foreground">(parent)</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {numericProps.length > 0 && (
                  <div className="space-y-1.5">
                    <Sel
                      value={col.aggregationField ?? ''}
                      onChange={(v) => onUpdate({ ...col, aggregationField: v || undefined })}
                      options={numericProps.map((p) => ({ value: p.id, label: p.name }))}
                      placeholder={
                        moduleDefaults?.aggregationField
                          ? `Défaut: ${numericProps.find((p) => p.id === moduleDefaults.aggregationField)?.name ?? '…'}`
                          : 'Source de donnée'
                      }
                    />
                    <Sel
                      value={col.durationField ?? ''}
                      onChange={(v) => onUpdate({ ...col, durationField: v || undefined })}
                      options={numericProps.map((p) => ({ value: p.id, label: p.name }))}
                      placeholder={
                        moduleDefaults?.durationField
                          ? `Temps par défaut: ${numericProps.find((p) => p.id === moduleDefaults.durationField)?.name ?? '…'}`
                          : 'Source temps'
                      }
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* ─ Sous-colonnes (max depth 2) ─ */}
          {canNest && (
            <div className="pt-1 border-t border-border/50">
              <div className="flex items-center gap-1.5 mb-2">
                <GitBranch size={11} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Sous-colonnes
                </span>
              </div>

              {/* Toggle mode */}
              <div className="flex rounded-md border border-border overflow-hidden text-xs mb-2">
                {(['none', 'auto', 'manual'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSubMode(m)}
                    className={`flex-1 py-1 transition-colors ${
                      subMode === m
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent text-muted-foreground'
                    }`}
                  >
                    {m === 'none' ? 'Aucune' : m === 'auto' ? 'Auto' : 'Manuel'}
                  </button>
                ))}
              </div>

              {/* Mode Auto */}
              {subMode === 'auto' && (
                <div className="space-y-1.5">
                  <Sel
                    value={col.autoSubFieldId ?? ''}
                    onChange={(v) => onUpdate({
                      ...col,
                      autoSubFieldId: v || undefined,
                      autoSubFilterValues: [],
                    })}
                    options={selectProps.map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="Champ select/multiselect…"
                  />
                  {col.autoSubFieldId && (
                    <>
                      <div className="rounded-md border border-border/60 p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Options incluses</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:bg-accent"
                              onClick={() => onUpdate({ ...col, autoSubFilterValues: [] })}
                            >
                              Toutes
                            </button>
                            <button
                              type="button"
                              className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:bg-accent"
                              onClick={() => onUpdate({ ...col, autoSubFilterValues: autoSubOptions })}
                            >
                              Prédéfinies
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto pr-1">
                          {autoSubOptions.map((opt) => {
                            const selected = col.autoSubFilterValues?.includes(opt) ?? false;
                            const allSelected = (col.autoSubFilterValues?.length ?? 0) === 0;
                            const checked = allSelected || selected;
                            return (
                              <label
                                key={opt}
                                className="flex items-center gap-1.5 text-xs leading-5 cursor-pointer rounded-md px-1.5 py-0.5 hover:bg-accent/40 text-muted-foreground hover:text-foreground select-none"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const current = new Set(
                                      (col.autoSubFilterValues?.length ?? 0) === 0
                                        ? autoSubOptions
                                        : (col.autoSubFilterValues ?? [])
                                    );
                                    if (e.target.checked) current.add(opt);
                                    else current.delete(opt);
                                    const next = Array.from(current);
                                    onUpdate({
                                      ...col,
                                      autoSubFilterValues: next.length === autoSubOptions.length ? [] : next,
                                    });
                                  }}
                                  className="h-3.5 w-3.5 rounded border-border/70"
                                />
                                {opt}
                              </label>
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {(col.autoSubFilterValues?.length ?? 0) === 0
                            ? 'Toutes les options seront utilisées'
                            : `${col.autoSubFilterValues?.length ?? 0} option(s) sélectionnée(s)`}
                        </div>
                      </div>

                      {(() => {
                        const parentTypes   = moduleDefaults?.displayTypes ?? [];
                        // autoSubDisplayTypes : tableau (priorité sur autoSubDisplayType legacy)
                        const colAutoTypes: RecapDisplayType[] =
                          col.autoSubDisplayTypes ?? (col.autoSubDisplayType ? [col.autoSubDisplayType] : []);
                        const isInherited = colAutoTypes.length === 0;
                        const effectiveAutoTypes = colAutoTypes.length > 0 ? colAutoTypes : parentTypes;
                        const hasDuration = effectiveAutoTypes.includes('duration');
                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Afficher (sous-col.)</span>
                              {isInherited && parentTypes.length > 0 && (
                                <span className="text-[10px] italic text-muted-foreground">hérite du parent</span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              {DISPLAY_TYPE_OPTIONS.map((opt) => {
                                const checked = colAutoTypes.includes(opt.value);
                                return (
                                  <label key={opt.value} className="flex items-center gap-1.5 text-xs leading-5 cursor-pointer select-none rounded-md px-1.5 py-0.5 hover:bg-accent/40">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        const cur = new Set(colAutoTypes);
                                        if (e.target.checked) cur.add(opt.value); else cur.delete(opt.value);
                                        const next = Array.from(cur);
                                        onUpdate({
                                          ...col,
                                          autoSubDisplayTypes: next,
                                          autoSubDisplayType: next.length === 1 ? next[0] : undefined,
                                        });
                                      }}
                                      className="h-3.5 w-3.5 rounded border-border/70"
                                    />
                                    <span className={checked ? 'font-medium' : 'text-muted-foreground'}>
                                      {opt.label}
                                    </span>
                                    {!checked && isInherited && parentTypes.includes(opt.value) && (
                                      <span className="text-[10px] italic text-muted-foreground">(parent)</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                            {numericProps.length > 0 && (
                              <div className="space-y-1.5">
                                <Sel
                                  value={col.autoSubAggregationField ?? ''}
                                  onChange={(v) => onUpdate({ ...col, autoSubAggregationField: v || undefined })}
                                  options={numericProps.map((p) => ({ value: p.id, label: p.name }))}
                                  placeholder={
                                    moduleDefaults?.aggregationField
                                      ? `Défaut: ${numericProps.find((p) => p.id === moduleDefaults.aggregationField)?.name ?? '…'}`
                                      : 'Source de donnée'
                                  }
                                />
                                <Sel
                                  value={col.durationField ?? ''}
                                  onChange={(v) => onUpdate({ ...col, durationField: v || undefined })}
                                  options={numericProps.map((p) => ({ value: p.id, label: p.name }))}
                                  placeholder={
                                    moduleDefaults?.durationField
                                      ? `Temps par défaut: ${numericProps.find((p) => p.id === moduleDefaults.durationField)?.name ?? '…'}`
                                      : 'Source temps'
                                  }
                                />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      {/* Aperçu des sous-colonnes */}
                      {autoSubOptions.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {autoSubOptions.map((opt) => (
                            <span
                              key={opt}
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{
                                background: col.color ? `${col.color}18` : 'hsl(var(--accent))',
                                color: col.color ?? 'hsl(var(--primary))',
                              }}
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Mode Manuel */}
              {subMode === 'manual' && (
                <div className="space-y-1">
                  {(col.children ?? []).map((child, ci) => (
                    <RecapColumnItemEditor
                      key={child.id}
                      col={child}
                      properties={properties}
                      collections={collections}
                      moduleCollectionId={moduleCollectionId}
                      depth={depth + 1}
                      moduleDefaults={moduleDefaults}
                      onUpdate={(updated) => {
                        const next = [...(col.children ?? [])];
                        next[ci] = updated;
                        onUpdate({ ...col, children: next });
                      }}
                      onRemove={() => {
                        const next = (col.children ?? []).filter((_, i) => i !== ci);
                        onUpdate({ ...col, children: next });
                      }}
                    />
                  ))}
                  <button
                    onClick={addChild}
                    className="w-full flex items-center justify-center gap-1 py-1 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-primary hover:border-primary"
                  >
                    <Plus size={11} /> Ajouter une sous-colonne
                  </button>
                </div>
              )}

              {/* Mode None : rien à afficher, mais on montre le type d'affichage si la colonne était déjà une feuille */}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Éditeur de liste de colonnes (niveau racine) ───────────────────────────

const RecapColumnsEditor: React.FC<RecapColumnsEditorProps> = ({ columns, properties, collections, moduleCollectionId, moduleDefaults, onChange }) => {
  const addColumn = () => {
    const newCol: RecapColumn = {
      id:    uuidv4(),
      label: `Colonne ${columns.length + 1}`,
      color: PRESET_COLORS[columns.length % PRESET_COLORS.length],
      // Pas de displayType explicite → hérite du défaut module au calcul
    };
    onChange([...columns, newCol]);
  };

  return (
    <div className="space-y-1.5">
      {columns.map((col, idx) => (
        <RecapColumnItemEditor
          key={col.id}
          col={col}
          properties={properties}
          collections={collections}
          moduleCollectionId={moduleCollectionId}
          depth={0}
          moduleDefaults={moduleDefaults}
          onUpdate={(updated) => {
            const next = [...columns];
            next[idx] = updated;
            onChange(next);
          }}
          onRemove={() => onChange(columns.filter((_, i) => i !== idx))}
        />
      ))}
      <button
        onClick={addColumn}
        className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-primary hover:border-primary transition-colors"
      >
        <Plus size={13} /> Ajouter une colonne
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------

const DashboardModuleConfigPanel: React.FC<Props> = ({ module, collections, onUpdate, onClose }) => {
  const [activeTab, setActiveTab] = useState<ConfigTab>('type');
  const collection = collections.find((c) => c.id === module.collectionId) ?? null;
  const properties: Property[] = collection?.properties ?? [];

  const dateProps = properties.filter((p) => p.type === 'date' || (p.type as string) === 'date_range');
  const numericProps = properties.filter((p) => p.type === 'number');
  const selectProps = properties.filter((p) => p.type === 'select' || p.type === 'multiselect' || (p.type as string) === 'multi_select');
  const allProps = properties.filter((p) => p.type !== 'relation' && p.type !== 'steam');

  const patch = useCallback(
    (p: Partial<DashboardModuleConfig>) => onUpdate(p),
    [onUpdate]
  );

  // Gestion des filtres
  const addFilter = () => {
    const newFilter = { id: uuidv4(), fieldId: allProps[0]?.id ?? '', operator: 'equals' as const, value: '' };
    patch({ filters: [...(module.filters ?? []), newFilter] });
  };

  const updateFilter = (id: string, key: string, value: any) => {
    patch({
      filters: (module.filters ?? []).map((f) =>
        f.id === id ? { ...f, [key]: value } : f
      ),
    });
  };

  const removeFilter = (id: string) => {
    patch({ filters: (module.filters ?? []).filter((f) => f.id !== id) });
  };

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed top-0 right-0 h-full w-80 bg-background border-l border-border shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-semibold text-sm text-foreground">Configurer le module</span>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">

        <div className="flex rounded-lg border border-border overflow-hidden text-xs mb-1">
          <button
            onClick={() => setActiveTab('type')}
            className={`flex-1 py-1.5 transition-colors ${
              activeTab === 'type' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'
            }`}
          >
            Type
          </button>
          <button
            onClick={() => setActiveTab('infos')}
            className={`flex-1 py-1.5 transition-colors ${
              activeTab === 'infos' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'
            }`}
          >
            Paramètres
          </button>
          <button
            onClick={() => setActiveTab('columns')}
            className={`flex-1 py-1.5 transition-colors ${
              activeTab === 'columns' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'
            }`}
          >
            Colonnes
          </button>
        </div>

        {/* Type de module */}
        {activeTab === 'type' && (
          <>
            <SectionLabel>Type</SectionLabel>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.entries(MODULE_TYPE_LABELS) as [ModuleType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => patch({ type })}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs font-medium transition-colors ${
                    module.type === type
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent text-muted-foreground'
                  }`}
                >
                  {MODULE_TYPE_ICONS[type]}
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Titre */}
        {activeTab === 'infos' && (
          <>
            <SectionLabel>Titre</SectionLabel>
            <input
              type="text"
              value={module.title ?? ''}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Titre du module (optionnel)"
              className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </>
        )}

        {/* Mise en page */}
        {activeTab === 'infos' && (
          <>
            <SectionLabel>Mise en page</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Largeur</div>
                <Sel
                  value={String(module.layout.w)}
                  onChange={(v) => patch({ layout: { ...module.layout, w: Number(v) } })}
                  options={MODULE_WIDTH_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Hauteur</div>
                <Sel
                  value={String(module.layout.h)}
                  onChange={(v) => patch({ layout: { ...module.layout, h: Number(v) } })}
                  options={MODULE_HEIGHT_OPTIONS.map((o) => ({ value: String(o.value), label: o.label }))}
                />
              </div>
            </div>
          </>
        )}

        {/* Collection source */}
        {activeTab === 'infos' && (
          <>
            <SectionLabel>Source de données</SectionLabel>
            <Sel
              value={module.collectionId ?? ''}
              onChange={(v) => patch({ collectionId: v })}
              options={collections.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Choisir une collection…"
            />
          </>
        )}

        {/* Champ date (pour modules avec groupement temporel) */}
        {activeTab === 'infos' && dateProps.length > 0 && (module.type === 'chart' || module.type === 'table' || module.type === 'metric' || module.type === 'list') && (
          <>
            <SectionLabel>Champ date (filtre global)</SectionLabel>
            <Sel
              value={module.dateField ?? ''}
              onChange={(v) => patch({ dateField: v })}
              options={dateProps.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Auto-detect"
            />
          </>
        )}

        {/* ---- Options spécifiques : CHART ---- */}
        {activeTab === 'infos' && module.type === 'chart' && (
          <>
            <SectionLabel>Type de graphique</SectionLabel>
            <div className="grid grid-cols-4 gap-1">
              {CHART_TYPE_OPTIONS.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => patch({ chartType: ct.value })}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs transition-colors ${
                    module.chartType === ct.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent text-muted-foreground'
                  }`}
                >
                  {ct.icon}
                  {ct.label}
                </button>
              ))}
            </div>

            <SectionLabel>Axe X (segment)</SectionLabel>
            <Sel
              value={module.chartXField ?? ''}
              onChange={(v) => patch({ chartXField: v })}
              options={allProps.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Choisir un champ…"
            />

            {/* Groupement de dates si champ X = date */}
            {dateProps.some((p) => p.id === module.chartXField) && (
              <>
                <SectionLabel>Regroupement date</SectionLabel>
                <Sel
                  value={module.chartDateGrouping ?? ''}
                  onChange={(v) => patch({ chartDateGrouping: v as DateGrouping })}
                  options={Object.entries(DATE_GROUPING_LABELS).map(([k, l]) => ({ value: k, label: l }))}
                  placeholder="Aucun"
                />
              </>
            )}

            <SectionLabel>Axe Y (valeur)</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <Sel
                value={module.chartYAggregation ?? 'count'}
                onChange={(v) => patch({ chartYAggregation: v as AggregationType })}
                options={Object.entries(AGGREGATION_LABELS).map(([k, l]) => ({ value: k, label: l }))}
              />
              {module.chartYAggregation && module.chartYAggregation !== 'count' && (
                <Sel
                  value={module.chartYField ?? ''}
                  onChange={(v) => patch({ chartYField: v })}
                  options={numericProps.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="Champ numérique…"
                />
              )}
            </div>

            {module.chartType !== 'pie' && (
              <>
                <SectionLabel>Grouper par (optionnel)</SectionLabel>
                <Sel
                  value={module.chartStackBy ?? ''}
                  onChange={(v) => patch({ chartStackBy: v || undefined })}
                  options={selectProps.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="Sans regroupement"
                />
                <div className="flex items-center gap-1.5 mt-2 rounded-md px-1.5 py-1 hover:bg-accent/30">
                  <input
                    type="checkbox"
                    id="showLegend"
                    checked={module.chartShowLegend ?? true}
                    onChange={(e) => patch({ chartShowLegend: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-border/70"
                  />
                  <label htmlFor="showLegend" className="text-xs text-muted-foreground cursor-pointer">Afficher la légende</label>
                </div>
                <div className="flex items-center gap-1.5 mt-1 rounded-md px-1.5 py-1 hover:bg-accent/30">
                  <input
                    type="checkbox"
                    id="showGrid"
                    checked={module.chartShowGrid ?? true}
                    onChange={(e) => patch({ chartShowGrid: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-border/70"
                  />
                  <label htmlFor="showGrid" className="text-xs text-muted-foreground cursor-pointer">Afficher la grille</label>
                </div>
              </>
            )}
          </>
        )}

        {/* ---- Options spécifiques : METRIC ---- */}
        {activeTab === 'infos' && module.type === 'metric' && (
          <>
            <SectionLabel>Métrique</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <Sel
                value={module.metricAggregation ?? 'count'}
                onChange={(v) => patch({ metricAggregation: v as AggregationType })}
                options={Object.entries(AGGREGATION_LABELS).map(([k, l]) => ({ value: k, label: l }))}
              />
              {module.metricAggregation && module.metricAggregation !== 'count' && (
                <Sel
                  value={module.metricField ?? ''}
                  onChange={(v) => patch({ metricField: v })}
                  options={numericProps.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="Champ numérique…"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Préfixe</div>
                <input
                  type="text"
                  value={module.metricPrefix ?? ''}
                  onChange={(e) => patch({ metricPrefix: e.target.value })}
                  placeholder="ex: €"
                  className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Suffixe</div>
                <input
                  type="text"
                  value={module.metricSuffix ?? ''}
                  onChange={(e) => patch({ metricSuffix: e.target.value })}
                  placeholder="ex: h"
                  className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <SectionLabel>Label</SectionLabel>
            <input
              type="text"
              value={module.metricLabel ?? ''}
              onChange={(e) => patch({ metricLabel: e.target.value })}
              placeholder={collection?.name ?? 'Nom de la métrique'}
              className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm"
            />
            <SectionLabel>Couleur</SectionLabel>
            <input
              type="color"
              value={module.metricColor ?? '#6366f1'}
              onChange={(e) => patch({ metricColor: e.target.value })}
              className="h-9 w-full rounded-md border border-border cursor-pointer"
            />
          </>
        )}

        {/* ---- Options spécifiques : TABLE ---- */}
        {activeTab === 'infos' && module.type === 'table' && (
          <>
            <SectionLabel>Groupement (champs select)</SectionLabel>
            <Sel
              value={module.tableGroups?.[0] ?? ''}
              onChange={(v) => patch({ tableGroups: v ? [v] : [] })}
              options={selectProps.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Sans groupement"
            />
            {(module.tableGroups?.length ?? 0) > 0 && (
              <>
                <SectionLabel>Mode d'affichage des groupes</SectionLabel>
                <Sel
                  value={module.tableGroupDisplayMode ?? 'accordion'}
                  onChange={(v) => patch({ tableGroupDisplayMode: v as any })}
                  options={[
                    { value: 'accordion', label: 'Accordéon' },
                    { value: 'columns', label: 'Colonnes' },
                    { value: 'tabs', label: 'Onglets' },
                  ]}
                />
              </>
            )}
          </>
        )}

        {/* ---- Options spécifiques : KANBAN ---- */}
        {activeTab === 'infos' && module.type === 'kanban' && (
          <>
            <SectionLabel>Regrouper par</SectionLabel>
            <Sel
              value={module.kanbanGroupBy ?? ''}
              onChange={(v) => patch({ kanbanGroupBy: v || undefined })}
              options={selectProps.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Premier champ select"
            />
          </>
        )}

        {/* ---- Options spécifiques : CALENDAR ---- */}
        {activeTab === 'infos' && module.type === 'calendar' && (
          <>
            <SectionLabel>Champ date</SectionLabel>
            <Sel
              value={module.dateField ?? ''}
              onChange={(v) => patch({ dateField: v })}
              options={dateProps.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Premier champ date"
            />
          </>
        )}

        {/* ---- Options tri (table/list) ---- */}
        {activeTab === 'infos' && (module.type === 'table' || module.type === 'list') && (
          <>
            <SectionLabel>Tri</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <Sel
                value={module.sortField ?? ''}
                onChange={(v) => patch({ sortField: v || undefined })}
                options={allProps.map((p) => ({ value: p.id, label: p.name }))}
                placeholder="Aucun tri"
              />
              <Sel
                value={module.sortDirection ?? 'asc'}
                onChange={(v) => patch({ sortDirection: v as 'asc' | 'desc' })}
                options={[
                  { value: 'asc', label: '↑ Croissant' },
                  { value: 'desc', label: '↓ Décroissant' },
                ]}
              />
            </div>
          </>
        )}

        {/* ---- Champs visibles (pour list et table) ---- */}
        {activeTab === 'columns' && (module.type === 'list' || module.type === 'table') && allProps.length > 0 && (
          <>
            <SectionLabel>Champs visibles</SectionLabel>
            <div className="grid grid-cols-2 gap-1">
              {allProps.map((prop) => {
                const hidden = module.hiddenFields?.includes(prop.id) ?? false;
                return (
                  <label key={prop.id} className="flex items-center gap-1.5 text-xs leading-5 cursor-pointer hover:text-foreground text-muted-foreground rounded-md px-1.5 py-0.5 hover:bg-accent/40 select-none">
                    <input
                      type="checkbox"
                      checked={!hidden}
                      onChange={(e) => {
                        const current = new Set(module.hiddenFields ?? []);
                        if (e.target.checked) current.delete(prop.id);
                        else current.add(prop.id);
                        patch({ hiddenFields: Array.from(current) });
                      }}
                      className="h-3.5 w-3.5 rounded border-border/70"
                    />
                    {prop.name}
                  </label>
                );
              })}
            </div>
          </>
        )}

        {/* ---- Options spécifiques : RECAP ---- */}
        {activeTab === 'infos' && module.type === 'recap' && (
          <>
            <SectionLabel>Champ date</SectionLabel>
            <Sel
              value={module.recapDateField ?? ''}
              onChange={(v) => patch({ recapDateField: v })}
              options={dateProps.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Premier champ date détecté"
            />

            <SectionLabel>Mode par défaut</SectionLabel>
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button
                onClick={() => patch({ recapMode: 'month' })}
                className={`flex-1 py-1.5 ${module.recapMode !== 'year' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
              >
                Mois
              </button>
              <button
                onClick={() => patch({ recapMode: 'year' })}
                className={`flex-1 py-1.5 ${module.recapMode === 'year' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
              >
                Année
              </button>
            </div>

            <SectionLabel>Jours masqués</SectionLabel>
            <div className="text-[11px] text-muted-foreground leading-snug mb-1.5">
              Les jours masqués disparaissent du tableau, et les semaines vides sont automatiquement supprimées.
            </div>
            <div className="grid grid-cols-3 gap-1">
              {WEEKDAY_OPTIONS.map((day) => {
                const active = (module.recapHiddenWeekDays ?? []).includes(day.value);
                return (
                  <label key={day.value} className="flex items-center gap-1.5 text-xs leading-5 cursor-pointer hover:text-foreground text-muted-foreground rounded-md px-1.5 py-0.5 hover:bg-accent/40 select-none">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => {
                        const current = new Set(module.recapHiddenWeekDays ?? []);
                        if (e.target.checked) current.add(day.value);
                        else current.delete(day.value);
                        patch({ recapHiddenWeekDays: Array.from(current).sort((a, b) => a - b) });
                      }}
                      className="h-3.5 w-3.5 rounded border-border/70"
                    />
                    {day.label}
                  </label>
                );
              })}
            </div>

            <SectionLabel>Types d'affichage par défaut</SectionLabel>
            <div className="space-y-1.5">
              <div className="text-[11px] text-muted-foreground leading-snug">
                Cochez un ou plusieurs types. Si plusieurs sont cochés, chaque colonne génère automatiquement une sous-colonne par type.
              </div>
              <div className="grid grid-cols-2 gap-1">
              {DISPLAY_TYPE_OPTIONS.map((opt) => {
                const active = (module.recapDefaultDisplayTypes ?? []).includes(opt.value);
                return (
                  <label key={opt.value} className="flex items-center gap-1.5 text-xs leading-5 cursor-pointer hover:text-foreground text-muted-foreground rounded-md px-1.5 py-0.5 hover:bg-accent/40 select-none">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => {
                        const cur = new Set(module.recapDefaultDisplayTypes ?? []);
                        if (e.target.checked) cur.add(opt.value);
                        else cur.delete(opt.value);
                        patch({ recapDefaultDisplayTypes: Array.from(cur) });
                      }}
                      className="h-3.5 w-3.5 rounded border-border/70"
                    />
                    {opt.label}
                  </label>
                );
              })}
              </div>
              {/* Champ numérique si sum ou duration sont sélectionnés */}
              {(module.recapDefaultDisplayTypes ?? []).some((t) => t === 'sum' || t === 'duration') && numericProps.length > 0 && (
                <div className="space-y-1.5">
                  {(module.recapDefaultDisplayTypes ?? []).includes('sum') && (
                    <Sel
                      value={module.recapDefaultAggregationField ?? ''}
                      onChange={(v) => patch({ recapDefaultAggregationField: v || undefined })}
                      options={numericProps.map((p) => ({ value: p.id, label: p.name }))}
                      placeholder="Source de donnée par défaut…"
                    />
                  )}
                  {(module.recapDefaultDisplayTypes ?? []).includes('duration') && (
                    <Sel
                      value={module.recapDefaultDurationField ?? ''}
                      onChange={(v) => patch({ recapDefaultDurationField: v || undefined })}
                      options={numericProps.map((p) => ({ value: p.id, label: p.name }))}
                      placeholder="Source temps par défaut…"
                    />
                  )}
                </div>
              )}
              {/* Unité durée si duration est sélectionné */}
              {(module.recapDefaultDisplayTypes ?? []).includes('duration') && (
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-xs text-muted-foreground">Unité durée par défaut</span>
                  <div className="flex rounded-md border border-border overflow-hidden text-xs">
                    {(['minutes', 'hours'] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => patch({ recapDefaultDurationUnit: u })}
                        className={`px-2 py-0.5 transition-colors ${
                          (module.recapDefaultDurationUnit ?? 'minutes') === u
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent text-muted-foreground'
                        }`}
                      >
                        {u === 'minutes' ? 'min' : 'h décimal'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'columns' && module.type === 'recap' && (
          <>
            <SectionLabel>Colonnes</SectionLabel>
            <RecapColumnsEditor
              columns={module.recapColumns ?? []}
              properties={allProps}
              collections={collections}
              moduleCollectionId={module.collectionId}
              moduleDefaults={{
                displayTypes:     module.recapDefaultDisplayTypes,
                aggregationField: module.recapDefaultAggregationField,
                durationField:    module.recapDefaultDurationField,
                durationUnit:     module.recapDefaultDurationUnit,
              }}
              onChange={(cols) => patch({ recapColumns: cols })}
            />
          </>
        )}

        {/* ---- Filtres ---- */}
        {activeTab === 'infos' && collection && module.type !== 'recap' && (
          <>
            <SectionLabel>Filtres</SectionLabel>
            <div className="space-y-2">
              {(module.filters ?? []).map((filter) => {
                const prop = allProps.find((p) => p.id === filter.fieldId);
                const needsValue = !['is_empty', 'is_not_empty'].includes(filter.operator);
                return (
                  <div key={filter.id} className="flex items-center gap-1 flex-wrap">
                    <Sel
                      value={filter.fieldId}
                      onChange={(v) => updateFilter(filter.id, 'fieldId', v)}
                      options={allProps.map((p) => ({ value: p.id, label: p.name }))}
                      className="flex-1 min-w-[90px]"
                    />
                    <Sel
                      value={filter.operator}
                      onChange={(v) => updateFilter(filter.id, 'operator', v)}
                      options={Object.entries(OPERATOR_LABELS).map(([k, l]) => ({ value: k, label: l }))}
                      className="w-[80px]"
                    />
                    {needsValue && (
                      <input
                        type="text"
                        value={filter.value ?? ''}
                        onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                        placeholder="Valeur"
                        className="flex-1 min-w-[60px] bg-background border border-border rounded-md px-2 py-1.5 text-sm"
                      />
                    )}
                    <button
                      onClick={() => removeFilter(filter.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={addFilter}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary py-1"
              >
                <Plus size={13} /> Ajouter un filtre
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default DashboardModuleConfigPanel;
