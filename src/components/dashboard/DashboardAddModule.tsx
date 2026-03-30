/**
 * DashboardAddModule – modal pour ajouter un nouveau module.
 */

import React, { useState } from 'react';
import { X, BarChart2, Table2, Columns, CalendarDays, List, Gauge } from 'lucide-react';
import { motion } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import {
  DashboardModuleConfig,
  ModuleType,
  MODULE_TYPE_LABELS,
} from '@/lib/dashboardTypes';

const MODULE_TYPE_ICONS: Record<ModuleType, React.ReactNode> = {
  table:    <Table2 size={24} />,
  kanban:   <Columns size={24} />,
  calendar: <CalendarDays size={24} />,
  chart:    <BarChart2 size={24} />,
  metric:   <Gauge size={24} />,
  list:     <List size={24} />,
};

const MODULE_TYPE_DESC: Record<ModuleType, string> = {
  table:    'Vue tableau complète avec groupement et tri',
  kanban:   'Vue kanban en colonnes par valeur de champ',
  calendar: 'Vue calendrier mensuelle ou hebdomadaire',
  chart:    'Graphique configurable (barres, lignes, camembert…)',
  metric:   'Valeur KPI unique (comptage, somme, moyenne…)',
  list:     "Liste compacte d'éléments avec champs clés",
};

const MODULE_COLORS: Record<ModuleType, string> = {
  table:    '#3b82f6',
  kanban:   '#8b5cf6',
  calendar: '#10b981',
  chart:    '#f97316',
  metric:   '#6366f1',
  list:     '#ec4899',
};

interface Props {
  collections: any[];
  currentOrder: number;
  onAdd: (module: DashboardModuleConfig) => void;
  onClose: () => void;
}

const DashboardAddModule: React.FC<Props> = ({ collections, currentOrder, onAdd, onClose }) => {
  const [selectedType, setSelectedType] = useState<ModuleType | null>(null);
  const [selectedCollection, setSelectedCollection] = useState(collections[0]?.id ?? '');

  const handleAdd = () => {
    if (!selectedType) return;

    const newModule: DashboardModuleConfig = {
      id: uuidv4(),
      type: selectedType,
      collectionId: selectedCollection || undefined,
      filters: [],
      layout: {
        w: selectedType === 'metric' ? 3 : selectedType === 'chart' ? 6 : 12,
        h: selectedType === 'metric' ? 200 : selectedType === 'chart' ? 400 : 400,
        order: currentOrder,
      },
      // Valeurs par défaut selon le type
      ...(selectedType === 'chart' ? {
        chartType: 'bar',
        chartYAggregation: 'count',
        chartShowLegend: true,
        chartShowGrid: true,
      } : {}),
      ...(selectedType === 'metric' ? {
        metricAggregation: 'count',
      } : {}),
    };

    onAdd(newModule);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-base text-foreground">Ajouter un module</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-accent text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Choix du type */}
          <div>
            <div className="text-sm font-medium text-foreground mb-3">Type de module</div>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(MODULE_TYPE_LABELS) as [ModuleType, string][]).map(([type, label]) => (
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
                    style={{ background: `${MODULE_COLORS[type]}20`, color: MODULE_COLORS[type] }}
                  >
                    {MODULE_TYPE_ICONS[type]}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 leading-tight">
                      {MODULE_TYPE_DESC[type]}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Collection source */}
          {selectedType && collections.length > 0 && (
            <div>
              <div className="text-sm font-medium text-foreground mb-2">Collection source</div>
              <div className="grid grid-cols-2 gap-2">
                {collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => setSelectedCollection(col.id)}
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

          {/* Bouton ajouter */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:bg-accent"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={!selectedType}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ajouter le module
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DashboardAddModule;
