/**
 * DashboardAddModule – modal pour ajouter un nouveau module.
 */

import React, { useState } from 'react';
import { BarChart2, Table2, Columns, CalendarDays, List, Gauge, LayoutGrid } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import {
  DashboardModuleConfig,
  ModuleType,
} from '@/lib/dashboardTypes';
import { getDashboardModuleOptions } from './dashboardModuleTypes';

import { SettingsDialog, SettingsTabs, SettingsTabContent, SettingsFooter, SettingsSectionTitle } from '@/components/ui/settings-panel';
import { Button } from '@/components/ui/button';
import { getViewLabel, type ViewDefinition } from '@/lib/views';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MODULE_TYPE_ICONS: Record<ModuleType, React.ReactNode> = {
  table:    <Table2 size={24} />,
  kanban:   <Columns size={24} />,
  calendar: <CalendarDays size={24} />,
  chart:    <BarChart2 size={24} />,
  metric:   <Gauge size={24} />,
  list:     <List size={24} />,
  recap:    <LayoutGrid size={24} />,
};

const MODULE_TYPE_DESC: Record<ModuleType, string> = {
  table:    'Vue tableau complète avec groupement et tri',
  kanban:   'Vue kanban en colonnes par valeur de champ',
  calendar: 'Vue calendrier mensuelle ou hebdomadaire',
  chart:    'Graphique configurable (barres, lignes, camembert…)',
  metric:   'Valeur KPI unique (comptage, somme, moyenne…)',
  list:     "Liste compacte d'éléments avec champs clés",
  recap:    'Tableau croisé semaines × colonnes ou mois × colonnes',
};

const MODULE_COLORS: Record<ModuleType, string> = {
  table:    '#3b82f6',
  kanban:   '#8b5cf6',
  calendar: '#10b981',
  chart:    '#f97316',
  metric:   '#6366f1',
  list:     '#ec4899',
  recap:    '#0ea5e9',
};

interface Props {
  excludeLayout?: boolean;
  existingViews?: {
    byCollection: Record<string, ViewDefinition[]>;
    onAdd: (collectionId: string, viewId: string) => void;
  };
  collections: any[];
  currentOrder: number;
  onAdd: (module: DashboardModuleConfig) => void;
  onClose: () => void;
}

const DashboardAddModule: React.FC<Props> = ({ collections, currentOrder, onAdd, onClose, excludeLayout, existingViews }) => {
  const [selectedType, setSelectedType] = useState<ModuleType | null>(null);
  const [selectedCollection, setSelectedCollection] = useState(collections[0]?.id ?? '');

  const [mode, setMode] = useState<'module' | 'view'>('module');
  const [selectedView, setSelectedView] = useState('');
  const availableViews = (existingViews?.byCollection[selectedCollection] ?? []).filter(({ type }) => type !== 'layout');
  const selectCollection = (id: string) => {
    setSelectedCollection(id);
    setSelectedView('');
  };

  const handleAdd = () => {
    if (mode === 'view') {
      if (!existingViews || !availableViews.some(({ id }) => id === selectedView)) return;
      existingViews.onAdd(selectedCollection, selectedView);
      onClose();
      return;
    }
    if (!selectedType) return;

    const newModule: DashboardModuleConfig = {
      id: uuidv4(),
      type: selectedType,
      collectionId: selectedCollection || undefined,
      filters: [],
      layout: {
        w: selectedType === 'metric' ? 3 : selectedType === 'chart' ? 6 : 12,
        h: selectedType === 'metric' ? 200 : selectedType === 'chart' ? 400 : selectedType === 'recap' ? 500 : 400,
        order: currentOrder,
      },
      // Valeurs par défaut selon le type
      ...(selectedType === 'chart' ? {
        chartType: 'bar',
        chartYMode: 'aggregation',
        chartYAggregation: 'count',
        chartShowLegend: true,
        chartLegendLabelSource: 'aggregation',
        chartTooltipLabelSource: 'aggregation',
        chartTooltipValueFormat: 'number',
        chartPieLabelMode: 'name',
        chartShowGrid: true,
      } : {}),
      ...(selectedType === 'metric' ? {
        metricAggregation: 'count',
      } : {}),
      ...(selectedType === 'recap' ? {
        recapMode: 'month' as const,
        recapColumns: [],
      } : {}),
    };

    onAdd(newModule);
    onClose();
  };

  return (
    <SettingsDialog open title="Ajouter un module" description="Créer un module ou intégrer une vue existante."
      onOpenChange={(open) => { if (!open) onClose(); }}>
      <SettingsTabs value={mode} onValueChange={(value) => setMode(value as 'module' | 'view')}
        items={existingViews
          ? [{ id: 'module', label: 'Nouveau module' }, { id: 'view', label: 'Vues existantes' }]
          : [{ id: 'module', label: 'Nouveau module' }]}>
        <SettingsTabContent value={mode}>
          <div className="space-y-4">
          {mode === 'view' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={selectedCollection} onValueChange={selectCollection}>
                <SelectTrigger aria-label="Collection source"><SelectValue placeholder="Collection source" /></SelectTrigger>
                <SelectContent>
                  {collections.map(({ id, name }) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedView} onValueChange={setSelectedView} disabled={!availableViews.length}>
                <SelectTrigger aria-label="Vue existante">
                  <SelectValue placeholder={availableViews.length ? 'Choisir une vue' : 'Aucune vue disponible'} />
                </SelectTrigger>
                <SelectContent>
                  {availableViews.map((view) => <SelectItem key={view.id} value={view.id}>{getViewLabel(view)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <SettingsSectionTitle>Type de module</SettingsSectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {getDashboardModuleOptions().filter(([type]) => !excludeLayout || type !== 'layout').map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-left transition-all ${
                      selectedType === type
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border hover:bg-accent/50'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${MODULE_COLORS[type] ?? '#64748b'}20`, color: MODULE_COLORS[type] ?? '#64748b' }}
                    >
                      {MODULE_TYPE_ICONS[type] ?? <LayoutGrid size={24} />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-tight">
                        {MODULE_TYPE_DESC[type] ?? 'Vue de collection'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          )}

          {/* Collection source */}
          {mode === 'module' && selectedType && collections.length > 0 && (
            <div>
              <SettingsSectionTitle>Collection source</SettingsSectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => selectCollection(col.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
                      selectedCollection === col.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:bg-accent text-muted-foreground'
                    }`}
                  >
                    {col.icon && <span>{col.icon}</span>}
                    <span className="truncate">{col.name}</span>
                    <span className="ml-auto text-xs opacity-60">{col.items?.length ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          </div>
        </SettingsTabContent>
      </SettingsTabs>
      <SettingsFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
        <Button type="button" size="sm" onClick={handleAdd} disabled={mode === 'view' ? !selectedView : !selectedType}>
          {mode === 'view' ? 'Ajouter la vue' : 'Ajouter le module'}
        </Button>
      </SettingsFooter>
    </SettingsDialog>
  );
};

export default DashboardAddModule;
