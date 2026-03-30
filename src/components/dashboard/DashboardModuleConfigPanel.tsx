/**
 * DashboardModuleConfigPanel – panneau latéral de configuration d'un module.
 * S'ouvre en overlay depuis la droite.
 */

import React, { useState, useCallback } from 'react';
import {
  X, Plus, Trash2, ChevronDown, BarChart2, LineChart, PieChart, AreaChart,
  Table2, Columns, CalendarDays, List, Gauge
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DashboardModuleConfig,
  ModuleType,
  ChartType,
  AggregationType,
  DateGrouping,
  MODULE_WIDTH_OPTIONS,
  MODULE_HEIGHT_OPTIONS,
  AGGREGATION_LABELS,
  DATE_GROUPING_LABELS,
  MODULE_TYPE_LABELS,
} from '@/lib/dashboardTypes';
import { Property, Collection } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  module: DashboardModuleConfig;
  collections: Collection[];
  onUpdate: (patch: Partial<DashboardModuleConfig>) => void;
  onClose: () => void;
}

// Icônes par type de module
const MODULE_TYPE_ICONS: Record<ModuleType, React.ReactNode> = {
  table:    <Table2 size={16} />,
  kanban:   <Columns size={16} />,
  calendar: <CalendarDays size={16} />,
  chart:    <BarChart2 size={16} />,
  metric:   <Gauge size={16} />,
  list:     <List size={16} />,
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
  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-1.5 first:mt-0">
    {children}
  </div>
);

const DashboardModuleConfigPanel: React.FC<Props> = ({ module, collections, onUpdate, onClose }) => {
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
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">

        {/* Type de module */}
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

        {/* Titre */}
        <SectionLabel>Titre</SectionLabel>
        <input
          type="text"
          value={module.title ?? ''}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="Titre du module (optionnel)"
          className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />

        {/* Mise en page */}
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

        {/* Collection source */}
        <SectionLabel>Source de données</SectionLabel>
        <Sel
          value={module.collectionId ?? ''}
          onChange={(v) => patch({ collectionId: v })}
          options={collections.map((c) => ({ value: c.id, label: c.name }))}
          placeholder="Choisir une collection…"
        />

        {/* Champ date (pour modules avec groupement temporel) */}
        {dateProps.length > 0 && (module.type === 'chart' || module.type === 'table' || module.type === 'metric' || module.type === 'list') && (
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
        {module.type === 'chart' && (
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
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="showLegend"
                    checked={module.chartShowLegend ?? true}
                    onChange={(e) => patch({ chartShowLegend: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="showLegend" className="text-sm text-muted-foreground">Afficher la légende</label>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="showGrid"
                    checked={module.chartShowGrid ?? true}
                    onChange={(e) => patch({ chartShowGrid: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="showGrid" className="text-sm text-muted-foreground">Afficher la grille</label>
                </div>
              </>
            )}
          </>
        )}

        {/* ---- Options spécifiques : METRIC ---- */}
        {module.type === 'metric' && (
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
        {module.type === 'table' && (
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
        {module.type === 'kanban' && (
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
        {module.type === 'calendar' && (
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
        {(module.type === 'table' || module.type === 'list') && (
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
        {(module.type === 'list' || module.type === 'table') && allProps.length > 0 && (
          <>
            <SectionLabel>Champs visibles</SectionLabel>
            <div className="space-y-1">
              {allProps.map((prop) => {
                const hidden = module.hiddenFields?.includes(prop.id) ?? false;
                return (
                  <label key={prop.id} className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground text-muted-foreground py-0.5">
                    <input
                      type="checkbox"
                      checked={!hidden}
                      onChange={(e) => {
                        const current = new Set(module.hiddenFields ?? []);
                        if (e.target.checked) current.delete(prop.id);
                        else current.add(prop.id);
                        patch({ hiddenFields: Array.from(current) });
                      }}
                      className="rounded"
                    />
                    {prop.name}
                  </label>
                );
              })}
            </div>
          </>
        )}

        {/* ---- Filtres ---- */}
        {collection && (
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
