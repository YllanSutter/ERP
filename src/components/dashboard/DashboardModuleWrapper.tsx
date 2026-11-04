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
  DashboardModuleConfig, RecapAssignments,
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
import { getDashboardViewConfig, getDashboardViewRegistration } from './dashboardModuleTypes';
import type { ViewDefinition } from '@/lib/views';
import { getOrderedProperties } from '@/lib/filterUtils';

const noop = () => {};

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
  views?: Record<string, ViewDefinition[]>;
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
  recapAssignments?: RecapAssignments;
  onRecapAssignmentChange?: (key: string, date?: string) => void;
  onUpdateModule?: (patch: Partial<DashboardModuleConfig>) => void;
}

const DashboardModuleWrapper: React.FC<Props> = ({
  module,
  data,
  globalFilter,
  collections,
  views,
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
  recapAssignments,
  onRecapAssignmentChange,
}) => {
  const registration = getDashboardViewRegistration(module.type);
  const Renderer = registration?.Renderer;
  const viewCollection = module.type === 'layout' && data.collection
    ? { ...data.collection, items: data.filteredItems }
    : data.collection;
  const viewCollections = module.type === 'layout' && viewCollection
    ? collections.map((collection) => collection.id === viewCollection.id ? viewCollection : collection)
    : collections;
  const view = registration && viewCollection
    ? getDashboardViewConfig(module, registration, viewCollection.id, views)
    : undefined;
  const label = MODULE_TYPE_LABELS[module.type] ?? registration?.label ?? module.type;
  const title = module.title ?? (data.collection ? `${data.collection.name} · ${label}` : label);

  const gridColSpan = `col-span-${module.layout.w}`;

  return (
    <div
      className={`${gridColSpan} flex flex-col rounded-xl border border-border shadow-sm overflow-hidden transition-shadow ${isEditMode ? '' : ''}`}
      style={{ height: module.layout.h }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0">
        {/* Icône type */}
        <span className="text-muted-foreground flex-shrink-0">
          {MODULE_ICONS[module.type] ?? <LayoutGrid size={14} />}
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
        {registration && Renderer && (viewCollection && view ? (
          <div className="h-full overflow-auto">
            <Renderer
              key={module.type}
              collection={viewCollection}
              collections={viewCollections}
              view={view}
              views={views}
              items={data.filteredItems}
              properties={module.type === 'cards' || module.type === 'steamcards'
                ? getOrderedProperties(viewCollection, view, viewCollections)
                : data.properties}
              activeCollectionId={viewCollection.id}
              relationFilter={{ collectionId: null, ids: [] }}
              onEdit={onEdit ?? noop}
              onViewDetail={onViewDetail ?? noop}
              onDelete={noop}
              onRelationChange={noop}
              onNavigateToCollection={noop}
              onUpdateView={(updates) => onUpdateModule?.({ viewSettings: { ...module.viewSettings, ...updates } })}
              onShowNewItemModalForCollection={onShowNewItemModal}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Aucune collection sélectionnée
          </div>
        ))}
        {!Renderer && !Object.hasOwn(MODULE_TYPE_LABELS, module.type) && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Ce type de vue est indisponible
          </div>
        )}
        {module.type === 'chart' && (
          <ChartModule module={module} data={data} />
        )}
        {module.type === 'metric' && (
          <MetricModule module={module} data={data} />
        )}
        {module.type === 'list' && (
          <ListModule
            module={module}
            data={data}
            assignments={recapAssignments}
            onAssignmentChange={onRecapAssignmentChange}
            onViewDetail={onViewDetail}
          />
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
            assignments={recapAssignments}
            onAssignmentChange={onRecapAssignmentChange}
            onViewDetail={onViewDetail}
            onShowNewItemModal={onShowNewItemModal}
          />
        )}
      </div>
    </div>
  );
};

export default DashboardModuleWrapper;
