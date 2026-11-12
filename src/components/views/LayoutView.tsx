import { v4 as uuidv4 } from 'uuid';
import React, { useMemo, useState } from 'react';
import { getLayoutTileHeight, LAYOUT_HEIGHT_OPTIONS, LAYOUT_TILE_GAP } from '@/lib/layoutDimensions';
import { createPortal } from 'react-dom';
import { SettingsSheet, SettingsBody } from '@/components/ui/settings-panel';
import LayoutPanelSettings from './LayoutPanelSettings';
import { getLayoutPanelHeight, type LayoutPanelConfig } from './LayoutPanelsEditor';
import { computeDateRange } from '@/lib/utils/dashboardUtils';
import { getItemIntervalsForDateField } from '@/lib/utils/recapColumnUtils';
import { CalendarDays, ChevronDown, ChevronUp, Columns3, LayoutGrid, Plus, Settings2, Table2 } from 'lucide-react';
import { getFilteredItems, getOrderedProperties, routeLayoutFilters } from '@/lib/filterUtils';
import { getViewLabel, getViewRegistration } from '@/lib/views';
import type { CollectionFilter } from '@/lib/types';
import type { ViewRendererProps } from '@/lib/views';
import { getLayoutEntries, moveLayoutEntry } from './layoutOrder';
import type { DashboardModuleConfig, ModulePeriod, RecapAssignments } from '@/lib/dashboardTypes';
import ModulePeriodSelect from '@/components/dashboard/ModulePeriodSelect';
import DashboardAddModule from '@/components/dashboard/DashboardAddModule';
import DashboardModuleConfigPanel from '@/components/dashboard/DashboardModuleConfigPanel';
import DashboardModuleWrapper from '@/components/dashboard/DashboardModuleWrapper';
import { IconButton } from '@/components/ui/icon-button';
import { Button } from '@/components/ui/button';

const panelIcons = {
  table: Table2,
  calendar: CalendarDays,
  kanban: Columns3,
} as const;

// Four-pixel grid tracks let short tiles stack beside tall ones.
const getTileRow = (height: number) => `span ${Math.ceil((height + LAYOUT_TILE_GAP) / 4)}`;

const noRelationFilter = { collectionId: null, ids: [] };

const LayoutView: React.FC<ViewRendererProps> = ({
  view,
  collection,
  collections,
  views = {},
  items,
  relationFilter = noRelationFilter,
  activeCollectionId = null,
  canConfigureLayout = false,
  onUpdateView,
  onEdit,
  onDelete,
  onViewDetail,
  onRelationChange,
  onNavigateToCollection,
  onShowNewItemModalForCollection,
}) => {
  const { panels, modules, entries, order } = getLayoutEntries(view);
  const tileBackground = view.layoutTileBackground === true;
  const layoutPeriod = view.layoutPeriod as ModulePeriod | undefined;
  const assignments = view.layoutRecapAssignments as RecapAssignments | undefined;
  const [addingModule, setAddingModule] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const configuredPanel = panels.find(({ id }) => id === panelId);
  const savePanel = (id: string, updated?: LayoutPanelConfig) => {
    if (!canConfigureLayout) return;
    onUpdateView({ layoutPanels: updated ? panels.map((panel) => panel.id === id ? updated : panel) : panels.filter((panel) => panel.id !== id) });
    if (!updated) setPanelId(null);
  };
  const configuring = modules.find(({ id }) => id === configuringId);
  const panelCollections = useMemo(() => routeLayoutFilters(
    collection, collections, view.filters as CollectionFilter[] | undefined
  ), [collection, collections, view.filters]);
  const moduleCollections = useMemo(() => [
    { ...collection, items },
    ...panelCollections.filter(({ id }) => id !== collection.id).map((target) => target.pinnedFilters?.length
      ? { ...target, items: getFilteredItems(target, {}, noRelationFilter, null, collections) }
      : target),
  ], [collection, collections, items, panelCollections]);

  const saveModules = (next: DashboardModuleConfig[]) => {
    if (canConfigureLayout) onUpdateView({ layoutModules: next });
  };
  const updateModule = (id: string, patch: Partial<DashboardModuleConfig>) =>
    saveModules(modules.map((module) => module.id === id ? { ...module, ...patch } : module));
  const moveEntry = (index: number, offset: number) => onUpdateView({ layoutOrder: moveLayoutEntry(order, index, offset) });

  return (
    <>
      {canConfigureLayout && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ModulePeriodSelect value={layoutPeriod} onChange={(period) => onUpdateView({ layoutPeriod: period })} />
          <div className="flex-1" />
          {order.length > 0 && (
            <Button size="sm" variant={reordering ? 'secondary' : 'outline'} aria-pressed={reordering} onClick={() => setReordering(!reordering)}>
              <Settings2 size={14} /> {reordering ? 'Terminer' : 'Réorganiser'}
            </Button>
          )}
          <Button size="sm" onClick={() => setAddingModule(true)}><Plus size={14} /> Ajouter un module</Button>
        </div>
      )}
      {panels.length === 0 && modules.length === 0 && (
        <div className="grid min-h-56 place-content-center justify-items-center gap-2 rounded-xl border border-dashed border-border p-4 text-center">
          <LayoutGrid size={22} className="text-muted-foreground" />
          <p className="text-sm font-medium">Ce layout est vide</p>
          <p className="text-xs text-muted-foreground">Ajoutez une vue depuis les paramètres ou choisissez un module.</p>
        </div>
      )}
      <div className="grid auto-rows-[4px] grid-cols-12 items-start gap-x-3 md:grid-flow-row-dense">
        {order.map((key, index) => {
          const { panel, module } = entries.get(key)!;
          if (module) {
            const period = module.period ?? layoutPeriod;
            const height = getLayoutTileHeight(module.layout.h);
            return (
              <div
                key={key}
                className="col-span-12 min-w-0 md:[grid-column:var(--layout-panel-column)]"
                style={{
                  '--layout-panel-column': `span ${Math.min(12, Math.max(1, module.layout.w))}`,
                  gridRow: getTileRow(height),
                } as React.CSSProperties}
              >
                <DashboardModuleWrapper
                  module={height === module.layout.h ? module : { ...module, layout: { ...module.layout, h: height } }}
                  globalFilter={period && period.preset !== 'all' && (period.preset !== 'custom' || (period.start && period.end)) ? {
                    preset: period.preset,
                    start: period.start,
                    end: period.end,
                    matchIntervals: true,
                  } : undefined}
                  showReorder={canConfigureLayout}
                  withBackground={tileBackground}
                  collections={moduleCollections}
                  views={views}
                  isEditMode={canConfigureLayout && reordering}
                  isFirst={index === 0}
                  isLast={index === order.length - 1}
                  showConfig={canConfigureLayout}
                  onEdit={onEdit}
                  onViewDetail={onViewDetail}
                  onShowNewItemModal={onShowNewItemModalForCollection}
                  onConfigOpen={() => setConfiguringId(module.id)}
                  onDelete={() => saveModules(modules.filter(({ id }) => id !== module.id))}
                  onMoveUp={() => moveEntry(index, -1)}
                  onMoveDown={() => moveEntry(index, 1)}
                  onUpdateModule={canConfigureLayout ? (patch) => updateModule(module.id, patch) : undefined}
                  recapAssignments={assignments}
                  recapCountDateField={modules.find((candidate) =>
                    candidate.type === 'recap' && candidate.collectionId === module.collectionId
                  )?.recapDateField}
                  onRecapAssignmentChange={canConfigureLayout ? (key, date) => {
                    const next = { ...assignments };
                    if (date) next[key] = date;
                    else delete next[key];
                    onUpdateView({ layoutRecapAssignments: next });
                  } : undefined}
                />
              </div>
            );
          }
          if (!panel) return null;
          const collectionId = panel.collectionId || collection.id;
          const target = panelCollections.find(({ id }) => id === collectionId) ?? (collectionId === collection.id ? collection : undefined);
          const sourceView = views[collectionId]?.find(({ id }) => id === panel.viewId);
          const panelView = sourceView && { ...sourceView, ...panel.viewSettings };
          const properties = getOrderedProperties(target, panelView, collections);
          const dateFields = properties.filter(({ type }) => type === 'date' || type === 'date_range');
          const dateField = dateFields.find(({ id }) => id === (panel.dateField ?? panelView?.dateProperty)) ?? dateFields[0];
          const period = panel.period ?? layoutPeriod;
          const range = period && period.preset !== 'all' && (period.preset !== 'custom' || (period.start && period.end))
            ? computeDateRange(period.preset, period.start, period.end)
            : undefined;
          const Renderer = panelView && panelView.type !== 'layout' ? getViewRegistration(panelView.type).Renderer : undefined;
          const Icon = panelIcons[panelView?.type as keyof typeof panelIcons] ?? LayoutGrid;
          const colSpan = Math.min(12, Math.max(1, panel.colSpan || 6));
          const height = getLayoutPanelHeight(panel);
          const style = {
            '--layout-panel-column': `span ${colSpan} / span ${colSpan}`,
            height,
            gridRow: getTileRow(height),
          } as React.CSSProperties;

          const matchingItems = target && panelView
            ? getFilteredItems(
              target.id === collection.id ? { ...target, items, pinnedFilters: [] } : target,
              panelView,
              relationFilter,
              activeCollectionId,
              collections
            )
            : [];
          const panelItems = range && dateField ? matchingItems.filter((item) =>
            getItemIntervalsForDateField(item, dateField).some(({ start, end }) =>
              start <= range.end.getTime() && end >= range.start.getTime()
            )
          ) : matchingItems;

          return (
            <section key={key} style={style} className={`col-span-12 flex min-w-0 flex-col overflow-hidden rounded-xl border border-border shadow-sm md:[grid-column:var(--layout-panel-column)] ${tileBackground ? 'bg-card' : 'bg-transparent'}`}>
              <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
                <Icon size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{panel.title || (panelView ? getViewLabel(panelView) : 'Panneau sans vue')}</h2>
                {target && target.id !== collection.id && (
                  <span className="max-w-[40%] truncate text-xs text-muted-foreground">{target.name}</span>
                )}
                {canConfigureLayout && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <IconButton label="Configurer la vue" className="size-6" onClick={() => setPanelId(panel.id)}><Settings2 size={13} /></IconButton>
                    <IconButton label="Monter" disabled={index === 0} className="size-6" onClick={() => moveEntry(index, -1)}><ChevronUp size={13} /></IconButton>
                    <IconButton label="Descendre" disabled={index === order.length - 1} className="size-6" onClick={() => moveEntry(index, 1)}><ChevronDown size={13} /></IconButton>
                  </div>
                )}
              </header>
              <div className="min-h-0 min-w-0 flex-1 overflow-auto">
                {Renderer && target && panelView ? (
                  <Renderer
                    key={panelView.id}
                    view={panelView}
                    viewModeStorageKey={`layout:${collection.id}:${view.id}:${panel.id}:${panelView.id}`}
                    collection={target}
                    collections={panelCollections}
                    items={panelItems}
                    properties={properties}
                    onUpdateView={(patch) => savePanel(panel.id, { ...panel, viewSettings: { ...panel.viewSettings, ...patch } })}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onViewDetail={onViewDetail}
                    onRelationChange={onRelationChange}
                    onNavigateToCollection={onNavigateToCollection}
                    views={views}
                    relationFilter={relationFilter}
                    activeCollectionId={activeCollectionId}
                    onShowNewItemModalForCollection={onShowNewItemModalForCollection}
                  />
                ) : (
                  <div className="grid h-full place-items-center p-3 text-sm text-muted-foreground">
                    {panel.viewId ? 'Vue indisponible' : 'Choisissez une vue dans les paramètres du layout.'}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {canConfigureLayout && configuredPanel && (
        <SettingsSheet nested open onOpenChange={(open) => { if (!open) setPanelId(null); }}
          title="Configurer la vue" description="Réglages du panneau dans ce layout.">
            <SettingsBody>
              <LayoutPanelSettings panel={configuredPanel} collection={collection} collections={collections} views={views}
                onChange={(updated) => savePanel(configuredPanel.id, updated)} />
            </SettingsBody>
        </SettingsSheet>
      )}
      {canConfigureLayout && addingModule && createPortal(
        <DashboardAddModule
          excludeLayout
          collections={moduleCollections}
          currentOrder={modules.length}
          existingViews={{
            byCollection: views,
            onAdd: (collectionId, viewId) => onUpdateView({
              layoutPanels: [...panels, {
                id: uuidv4(),
                collectionId,
                viewId,
                colSpan: 6,
                height: LAYOUT_HEIGHT_OPTIONS[1].value,
              }],
              layoutOrder: order,
            }),
          }}
          onAdd={(module) => {
            const height = LAYOUT_HEIGHT_OPTIONS[module.type === 'metric' ? 0 : module.type === 'recap' ? 2 : 1].value;
            saveModules([...modules, { ...module, layout: { ...module.layout, h: height } }]);
            setReordering(true);
            setConfiguringId(module.id);
          }}
          onClose={() => setAddingModule(false)}
        />,
        document.body,
      )}
      {canConfigureLayout && configuring && createPortal(
        <>
          <div className="fixed inset-0 z-[309]" onClick={() => setConfiguringId(null)} />
          <DashboardModuleConfigPanel
            excludeLayout
            raised
            allowPeriod
            useLayoutUnits
            module={configuring}
            collections={moduleCollections}
            views={views}
            onUpdate={(patch) => updateModule(configuring.id, patch)}
            onClose={() => setConfiguringId(null)}
          />
        </>,
        document.body,
      )}
    </>
  );
};

export default LayoutView;
