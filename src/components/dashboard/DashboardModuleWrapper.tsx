/**
 * DashboardModuleWrapper – conteneur d'un module dans la grille.
 * Affiche le titre, les contrôles en mode édition, et délègue le rendu au module.
 */

import React, { useMemo } from 'react';
import {
  Settings2, Trash2, GripVertical, ChevronUp, ChevronDown,
  BarChart2, Table2, Columns, CalendarDays, List, Gauge, LayoutGrid
} from 'lucide-react';
import {
  DashboardModuleConfig,
  ModuleType,
  MODULE_TYPE_LABELS,
} from '@/lib/dashboardTypes';
import { DashboardItemData, GlobalDateFilter } from '@/lib/hooks/useDashboardItemData';
import ChartModule from './modules/ChartModule';
import MetricModule from './modules/MetricModule';
import ListModule from './modules/ListModule';
import TableModule from './modules/TableModule';
import KanbanModule from './modules/KanbanModule';
import CalendarModule from './modules/CalendarModule';
import RecapModule from './modules/RecapModule';

const MODULE_ICONS: Record<ModuleType, React.ReactNode> = {
  table:    <Table2 size={14} />,
  kanban:   <Columns size={14} />,
  calendar: <CalendarDays size={14} />,
  chart:    <BarChart2 size={14} />,
  metric:   <Gauge size={14} />,
  list:     <List size={14} />,
  recap:    <LayoutGrid size={14} />,
};

interface Props {
  module: DashboardModuleConfig;
  data: DashboardItemData;
  globalFilter?: GlobalDateFilter;
  collections: any[];
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
}

const DashboardModuleWrapper: React.FC<Props> = ({
  module,
  data,
  globalFilter,
  collections,
  isEditMode,
  isFirst,
  isLast,
  onEdit,
  onViewDetail,
  onShowNewItemModal,
  onConfigOpen,
  onDelete,
  onMoveUp,
  onMoveDown,
  onUpdateModule,
}) => {
  const title = module.title ?? (data.collection?.name
    ? `${data.collection.name} · ${MODULE_TYPE_LABELS[module.type]}`
    : MODULE_TYPE_LABELS[module.type]);

  const gridColSpan = `col-span-${module.layout.w}`;

  return (
    <div
      className={`${gridColSpan} flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden transition-shadow ${isEditMode ? '' : ''}`}
      style={{ height: module.layout.h }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/80 flex-shrink-0">
        {/* Icône type */}
        <span className="text-muted-foreground flex-shrink-0">
          {MODULE_ICONS[module.type]}
        </span>

        {/* Titre */}
        <span className="text-sm font-medium text-foreground truncate flex-1">
          {title}
        </span>

        {/* Compteur items */}
        {data.collection && (
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {data.filteredItems.length}
          </span>
        )}

        {/* Contrôles édition */}
        {isEditMode && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="p-1 rounded hover:bg-accent disabled:opacity-30 text-muted-foreground hover:text-foreground"
              title="Monter"
            >
              <ChevronUp size={13} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="p-1 rounded hover:bg-accent disabled:opacity-30 text-muted-foreground hover:text-foreground"
              title="Descendre"
            >
              <ChevronDown size={13} />
            </button>
            <button
              onClick={onConfigOpen}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary"
              title="Configurer"
            >
              <Settings2 size={13} />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-destructive"
              title="Supprimer"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Contenu du module */}
      <div className="flex-1 overflow-hidden">
        {module.type === 'chart' && (
          <ChartModule module={module} data={data} />
        )}
        {module.type === 'metric' && (
          <MetricModule module={module} data={data} />
        )}
        {module.type === 'list' && (
          <ListModule module={module} data={data} onViewDetail={onViewDetail} />
        )}
        {module.type === 'table' && (
          <TableModule
            module={module}
            data={data}
            collections={collections}
            onEdit={onEdit}
            onViewDetail={onViewDetail}
          />
        )}
        {module.type === 'kanban' && (
          <KanbanModule
            module={module}
            data={data}
            collections={collections}
            onEdit={onEdit}
            onViewDetail={onViewDetail}
          />
        )}
        {module.type === 'calendar' && (
          <CalendarModule
            module={module}
            data={data}
            collections={collections}
            onEdit={onEdit}
            onViewDetail={onViewDetail}
          />
        )}
        {module.type === 'recap' && (
          <RecapModule
            module={module}
            data={data}
            collections={collections}
            globalFilter={globalFilter}
            onUpdate={onUpdateModule}
            onViewDetail={onViewDetail}
            onShowNewItemModal={onShowNewItemModal}
          />
        )}
      </div>
    </div>
  );
};

export default DashboardModuleWrapper;
