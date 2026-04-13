/**
 * DashboardView – composant principal du dashboard modulaire.
 * Remplace l'ancien DashboardShell.
 *
 * Grille 12 colonnes configurable. Chaque module est indépendant,
 * avec ses propres données, filtres et configuration persistés en BDD.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus, CalendarRange, ChevronDown, X
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  DashboardConfig,
  DashboardModuleConfig,
  GlobalDatePreset,
  GLOBAL_DATE_PRESET_LABELS,
} from '@/lib/dashboardTypes';
import { useDashboardItemData, GlobalDateFilter } from '@/lib/hooks/useDashboardItemData';
import DashboardModuleWrapper from './DashboardModuleWrapper';
import DashboardModuleConfigPanel from './DashboardModuleConfigPanel';
import DashboardAddModule from './DashboardAddModule';

interface Props {
  dashboard: DashboardConfig | null;
  collections: any[];
  onUpdate: (patch: Partial<DashboardConfig>) => void;
  onEdit?: (item: any) => void;
  onViewDetail?: (item: any) => void;
  onShowNewItemModal?: (collection: any, item?: any) => void;
}

// Composant interne pour un seul module (avec son propre hook de données)
const ModuleWithData: React.FC<{
  module: DashboardModuleConfig;
  collections: any[];
  globalFilter?: GlobalDateFilter;
  isEditMode: boolean;
  isFirst: boolean;
  isLast: boolean;
  onEdit?: (item: any) => void;
  onViewDetail?: (item: any) => void;
  onShowNewItemModal?: (collection: any, item?: any) => void;
  onConfigOpen: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateModule?: (patch: Partial<DashboardModuleConfig>) => void;
}> = (props) => {
  const data = useDashboardItemData(props.module, props.collections, props.globalFilter);

  return (
    <DashboardModuleWrapper
      module={props.module}
      data={data}
      globalFilter={props.globalFilter}
      collections={props.collections}
      isEditMode={props.isEditMode}
      isFirst={props.isFirst}
      isLast={props.isLast}
      onEdit={props.onEdit}
      onViewDetail={props.onViewDetail}
      onShowNewItemModal={props.onShowNewItemModal}
      onConfigOpen={props.onConfigOpen}
      onDelete={props.onDelete}
      onMoveUp={props.onMoveUp}
      onMoveDown={props.onMoveDown}
      onUpdateModule={props.onUpdateModule}
    />
  );
};

const PRESET_OPTIONS = Object.entries(GLOBAL_DATE_PRESET_LABELS).map(([value, label]) => ({
  value: value as GlobalDatePreset,
  label,
}));

const DashboardView: React.FC<Props> = ({
  dashboard,
  collections,
  onUpdate,
  onEdit,
  onViewDetail,
  onShowNewItemModal,
}) => {
  const [isEditMode] = useState(true);
  const [showAddModule, setShowAddModule] = useState(false);
  const [configuringModuleId, setConfiguringModuleId] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Filtre date global
  const globalFilter: GlobalDateFilter | undefined = useMemo(() => {
    if (!dashboard?.globalDatePreset) return undefined;
    return {
      preset: dashboard.globalDatePreset,
      start: dashboard.globalDateStart,
      end: dashboard.globalDateEnd,
      field: dashboard.globalDateField,
    };
  }, [dashboard?.globalDatePreset, dashboard?.globalDateStart, dashboard?.globalDateEnd, dashboard?.globalDateField]);

  const currentGlobalMonth = useMemo(() => {
    if (dashboard?.globalDateStart) {
      const parsed = parseISO(dashboard.globalDateStart);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }, [dashboard?.globalDateStart]);

  const globalMonthLabel = format(currentGlobalMonth, 'MMMM yyyy', { locale: fr });

  const updateGlobalMonth = useCallback((delta: number) => {
    const base = dashboard?.globalDateStart ? parseISO(dashboard.globalDateStart) : new Date();
    const safeBase = Number.isNaN(base.getTime()) ? new Date() : base;
    const nextMonth = addMonths(safeBase, delta);
    const start = startOfMonth(nextMonth);
    const end = endOfMonth(nextMonth);
    onUpdate({
      globalDatePreset: 'custom',
      globalDateStart: start.toISOString(),
      globalDateEnd: end.toISOString(),
    });
  }, [dashboard?.globalDateStart, onUpdate]);

  // Modules triés par order
  const sortedModules = useMemo(
    () => [...(dashboard?.modules ?? [])].sort((a, b) => a.layout.order - b.layout.order),
    [dashboard?.modules]
  );

  const patchModules = useCallback(
    (modules: DashboardModuleConfig[]) => {
      onUpdate({ modules });
    },
    [onUpdate]
  );

  const handleAddModule = useCallback(
    (module: DashboardModuleConfig) => {
      const modules = [...(dashboard?.modules ?? []), module];
      patchModules(modules);
    },
    [dashboard?.modules, patchModules]
  );

  const handleUpdateModule = useCallback(
    (moduleId: string, patch: Partial<DashboardModuleConfig>) => {
      const modules = (dashboard?.modules ?? []).map((m) =>
        m.id === moduleId ? { ...m, ...patch } : m
      );
      patchModules(modules);
    },
    [dashboard?.modules, patchModules]
  );

  const handleDeleteModule = useCallback(
    (moduleId: string) => {
      const modules = (dashboard?.modules ?? []).filter((m) => m.id !== moduleId);
      patchModules(modules);
      if (configuringModuleId === moduleId) setConfiguringModuleId(null);
    },
    [dashboard?.modules, patchModules, configuringModuleId]
  );

  const handleMoveModule = useCallback(
    (moduleId: string, direction: 'up' | 'down') => {
      const sorted = [...sortedModules];
      const idx = sorted.findIndex((m) => m.id === moduleId);
      if (idx === -1) return;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= sorted.length) return;

      // Swap orders
      const updated = sorted.map((m, i) => {
        if (i === idx) return { ...m, layout: { ...m.layout, order: sorted[targetIdx].layout.order } };
        if (i === targetIdx) return { ...m, layout: { ...m.layout, order: sorted[idx].layout.order } };
        return m;
      });
      patchModules(updated);
    },
    [sortedModules, patchModules]
  );

  const configuringModule = useMemo(
    () => dashboard?.modules.find((m) => m.id === configuringModuleId) ?? null,
    [dashboard?.modules, configuringModuleId]
  );

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Aucun dashboard sélectionné
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* ===== Barre d'outils ===== */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
        {/* Titre */}
        {isEditMode ? (
          <input
            type="text"
            value={dashboard.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="text-base font-semibold bg-transparent border-b border-primary focus:outline-none text-foreground min-w-0 flex-shrink"
          />
        ) : (
          <h1 className="text-base font-semibold text-foreground truncate">{dashboard.name}</h1>
        )}

        <div className="flex-1" />

        {/* Filtre date global */}
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
              dashboard.globalDatePreset
                ? 'border-primary/50 bg-primary/5 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent'
            }`}
          >
            <CalendarRange size={14} />
            {dashboard.globalDatePreset
              ? GLOBAL_DATE_PRESET_LABELS[dashboard.globalDatePreset]
              : 'Toutes les dates'}
            <ChevronDown size={12} />
          </button>

          <AnimatePresence>
            {showDatePicker && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-20 w-48"
              >
                <button
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent text-muted-foreground"
                  onClick={() => { onUpdate({ globalDatePreset: undefined }); setShowDatePicker(false); }}
                >
                  Toutes les dates
                </button>
                {PRESET_OPTIONS.filter(o => o.value !== 'custom').map((opt) => (
                  <button
                    key={opt.value}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${
                      dashboard.globalDatePreset === opt.value ? 'text-primary font-medium' : 'text-foreground'
                    }`}
                    onClick={() => { onUpdate({ globalDatePreset: opt.value }); setShowDatePicker(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
                {/* Plage personnalisée */}
                <div className="px-3 py-2 border-t border-border mt-1">
                  <div className="text-xs text-muted-foreground mb-1">Personnalisé</div>
                  <div className="flex gap-1">
                    <input
                      type="date"
                      value={dashboard.globalDateStart ?? ''}
                      onChange={(e) => onUpdate({ globalDatePreset: 'custom', globalDateStart: e.target.value })}
                      className="flex-1 text-xs border border-border rounded px-1.5 py-1 bg-background"
                    />
                    <input
                      type="date"
                      value={dashboard.globalDateEnd ?? ''}
                      onChange={(e) => onUpdate({ globalDatePreset: 'custom', globalDateEnd: e.target.value })}
                      className="flex-1 text-xs border border-border rounded px-1.5 py-1 bg-background"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-background/50">
          <button
            onClick={() => updateGlobalMonth(-1)}
            className="px-2 py-1 rounded hover:bg-accent text-muted-foreground"
            title="Mois précédent"
          >
            <ChevronDown size={12} className="rotate-90" />
          </button>
          <button
            onClick={() => onUpdate({ globalDatePreset: 'custom', globalDateStart: startOfMonth(currentGlobalMonth).toISOString(), globalDateEnd: endOfMonth(currentGlobalMonth).toISOString() })}
            className="text-xs font-medium text-foreground whitespace-nowrap px-2"
            title="Appliquer ce mois à tous les modules"
          >
            {globalMonthLabel}
          </button>
          <button
            onClick={() => updateGlobalMonth(1)}
            className="px-2 py-1 rounded hover:bg-accent text-muted-foreground"
            title="Mois suivant"
          >
            <ChevronDown size={12} className="-rotate-90" />
          </button>
        </div>

        {/* Ajouter module */}
        <button
          onClick={() => setShowAddModule(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
        >
          <Plus size={14} />
          Module
        </button>
      </div>

      {/* ===== Grille de modules ===== */}
      <div
        className="flex-1 overflow-y-auto p-4"
        onClick={() => showDatePicker && setShowDatePicker(false)}
      >
        {sortedModules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Plus size={28} className="text-muted-foreground" />
            </div>
            <div>
              <div className="font-medium text-foreground">Dashboard vide</div>
              <div className="text-sm text-muted-foreground mt-1">
                Ajoutez votre premier module pour commencer
              </div>
            </div>
            <button
              onClick={() => setShowAddModule(true)}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              Ajouter un module
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-3 auto-rows-auto">
            {sortedModules.map((module, idx) => (
              <div
                key={module.id}
                style={{ gridColumn: `span ${module.layout.w}` }}
              >
                <ModuleWithData
                  module={module}
                  collections={collections}
                  globalFilter={globalFilter}
                  isEditMode={isEditMode}
                  isFirst={idx === 0}
                  isLast={idx === sortedModules.length - 1}
                  onEdit={onEdit}
                  onViewDetail={onViewDetail}
                  onShowNewItemModal={onShowNewItemModal}
                  onConfigOpen={() => setConfiguringModuleId(module.id)}
                  onDelete={() => handleDeleteModule(module.id)}
                  onMoveUp={() => handleMoveModule(module.id, 'up')}
                  onMoveDown={() => handleMoveModule(module.id, 'down')}
                  onUpdateModule={(patch) => handleUpdateModule(module.id, patch)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Panneau de config module ===== */}
      <AnimatePresence>
        {configuringModule && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setConfiguringModuleId(null)}
            />
            <DashboardModuleConfigPanel
              module={configuringModule}
              collections={collections}
              onUpdate={(patch) => handleUpdateModule(configuringModule.id, patch)}
              onClose={() => setConfiguringModuleId(null)}
            />
          </>
        )}
      </AnimatePresence>

      {/* ===== Modal ajout module ===== */}
      <AnimatePresence>
        {showAddModule && (
          <DashboardAddModule
            collections={collections}
            currentOrder={sortedModules.length}
            onAdd={handleAddModule}
            onClose={() => setShowAddModule(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default DashboardView;
