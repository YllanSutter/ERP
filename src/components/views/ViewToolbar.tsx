import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FieldGroup, FieldGroupsLayout } from '@/lib/types';
import {
  Plus,
  Filter,
  Layers,
  Table,
  Layout,
  Columns,
  LayoutGrid,
  X,
  Settings,
  Calendar as CalendarIcon,
  Zap
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { getViewRegistrations } from '@/lib/views';
import ViewSettingsPanel from '@/components/views/ViewSettingsPanel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ShinyButton from '@/components/ui/ShinyButton';
import { ToolbarButton } from '@/components/ui/toolbar-button';
import { IconButton } from '@/components/ui/icon-button';
import { SettingsField } from '@/components/ui/settings-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import DraggableList from '@/components/inputs/DraggableList';
import FilterValueDisplay from '@/components/filters/FilterValueDisplay';
import { useCanEdit } from '@/lib/hooks/useCanEdit';
import { useAuth } from '@/auth/AuthProvider';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu';

const ROW_SELECTION_FIELD_ID = '__rowSelection';

interface ViewToolbarProps {
  currentCollection: any;
  currentViews: any[];
  currentViewConfig: any;
  activeView: string | null;
  orderedProperties: any[];
  collections: any[];
  allViews?: Record<string, any[]>;
  showViewSettings: boolean;
  relationFilter: { collectionId: string | null; ids: string[] };
  activeCollection: string | null;
  favorites: { views: string[]; items: string[] };
  onSetActiveView: (viewId: string) => void;
  onDeleteView: (viewId: string) => void;
  onShowNewViewModal: () => void;
  onShowFilterModal: () => void;
  onShowGroupModal: () => void;
  onShowNewPropertyModal: () => void;
  onShowNewItemModal: (prefill?: Record<string, any>) => void;
  onQuickCreateItem: (prefill?: Record<string, any>) => void;
  onSetShowViewSettings: (show: boolean) => void;
  onToggleFieldVisibility: (fieldId: string) => void;
  onUpdateViewFieldOrder: (nextOrder: string[]) => void;
  onSetTotalField: (fieldId: string, totalType: string | null) => void;
  onEditProperty: (property: any) => void;
  onEditFilter: (index: number) => void;
  onUpdateFilterValue: (index: number, value: any) => void;
  onRemoveFilter: (index: number) => void;
  onClearRelationFilter: () => void;
  onRemoveGroup: (property: string) => void;
  onSetGroupDisplayMode: (groupId: string, mode: 'accordion' | 'columns' | 'tabs') => void;
  onToggleFavoriteView: (viewId: string) => void;
  onManageViewVisibility: (viewId: string) => void;
  onEditView: (viewId: string) => void;
  onUpdateCollectionVisibleFields: (collectionId: string, visibleFieldIds: string[]) => void;
  onDuplicateView: (viewId: string) => void;
  onOpenItemFromSearch: (collection: any, item: any) => void;
  /** Met à jour les groupes de champs de la vue courante */
  onUpdateFieldGroups: (groups: FieldGroup[]) => void;
  onUpdateFieldGroupsLayout: (layout: FieldGroupsLayout) => void;
  onUpdateViewConfig: (updates: Record<string, unknown>) => void;
}

const ViewToolbar: React.FC<ViewToolbarProps> = ({
  currentCollection,
  currentViews,
  currentViewConfig,
  activeView,
  orderedProperties,
  collections,
  allViews,
  showViewSettings,
  relationFilter,
  activeCollection,
  favorites,
  onSetActiveView,
  onDeleteView,
  onShowNewViewModal,
  onShowFilterModal,
  onShowGroupModal,
  onShowNewPropertyModal,
  onShowNewItemModal,
  onQuickCreateItem,
  onSetShowViewSettings,
  onToggleFieldVisibility,
  onUpdateViewFieldOrder,
  onSetTotalField,
  onEditProperty,
  onEditFilter,
  onUpdateFilterValue,
  onRemoveFilter,
  onClearRelationFilter,
  onRemoveGroup,
  onSetGroupDisplayMode,
  onToggleFavoriteView,
  onManageViewVisibility,
  onEditView,
  onUpdateCollectionVisibleFields,
  onDuplicateView,
  onOpenItemFromSearch,
  onUpdateFieldGroups,
  onUpdateFieldGroupsLayout,
  onUpdateViewConfig,
}) => {
  const settingsRef = useRef<HTMLDivElement>(null);
  
  // Hook de permission
  const canEdit = useCanEdit(activeCollection);
  const { isAdmin, isEditor, permissions } = useAuth();
  const canViewFieldFn = (fieldId: string, collectionId?: string | null) => {
    const targetCollectionId = collectionId ?? activeCollection;
    if (isAdmin || isEditor) return true;
    const perms = permissions || [];
    if (fieldId) {
      const fieldPerm = perms.find(
        (p: any) =>
          (p.field_id || null) === fieldId &&
          (p.collection_id || null) === targetCollectionId &&
          (p.item_id || null) === null
      );
      if (fieldPerm) return Boolean(fieldPerm.can_read);
    }
    if (targetCollectionId) {
      const collectionPerm = perms.find(
        (p: any) =>
          (p.collection_id || null) === targetCollectionId &&
          (p.item_id || null) === null &&
          (p.field_id || null) === null
      );
      if (collectionPerm) return Boolean(collectionPerm.can_read);
    }
    const globalPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === null &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (globalPerm) return Boolean(globalPerm.can_read);
    return false;
  };
  
  // Filtrer les propriétés que l'utilisateur peut voir
  const viewableProperties = orderedProperties.filter(prop => canViewFieldFn(prop.id));
  const tableSystemOptions = useMemo(() => {
    if (currentViewConfig?.type !== 'table') return [];
    return [{ id: ROW_SELECTION_FIELD_ID, name: 'Cases de sélection' }];
  }, [currentViewConfig?.type]);
  const viewableSettingsItems = useMemo(
    () => [...tableSystemOptions, ...viewableProperties],
    [tableSystemOptions, viewableProperties]
  );
  const operatorLabels: Record<string, string> = {
    equals: 'Est égal à',
    not_equals: 'Est différent de',
    contains: 'Contient',
    not_contains: 'Ne contient pas',
    greater: 'Supérieur à',
    less: 'Inférieur à',
    is_empty: 'Est vide',
    is_not_empty: "N'est pas vide"
  };
  const compactOperatorLabels: Record<string, string> = {
    equals: '=',
    not_equals: '≠',
    contains: 'contient',
    not_contains: 'exclut',
    greater: '>',
    less: '<',
    is_empty: 'vide',
    is_not_empty: 'non vide'
  };
  const getOperatorLabel = (op: string) => operatorLabels[op] || op;
  const getCompactOperatorLabel = (op: string) => compactOperatorLabels[op] || getOperatorLabel(op);
  const getFilterSource = (filter: any) => {
    const sourceCollection =
      (filter?.sourceCollectionId
        ? collections.find((c: any) => c.id === filter.sourceCollectionId)
        : null) ||
      collections.find((c: any) => c.properties?.some((p: any) => p.id === filter.property)) ||
      currentCollection;
    const sourceProp = sourceCollection?.properties?.find((p: any) => p.id === filter.property);
    return { sourceCollection, sourceProp };
  };
  const calendarCollectionIds = Array.isArray(currentViewConfig?.calendarCollectionIds)
    ? currentViewConfig.calendarCollectionIds
    : currentCollection
    ? [currentCollection.id]
    : [];
  const calendarCollections = collections.filter((c: any) => calendarCollectionIds.includes(c.id));
  // Sécurise l'accès à l'icône de la collection
  let IconComponent = Icons.Folder;
  if (currentCollection && typeof currentCollection.icon === 'string' && (Icons as any)[currentCollection.icon]) {
    IconComponent = (Icons as any)[currentCollection.icon];
  }

  const newItemLabel = currentCollection?.name ? `Nouveau ${currentCollection.name}` : 'Nouvel élément';

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchCollectionId, setSearchCollectionId] = useState<string | null>(null);
  const [showToolbarTools, setShowToolbarTools] = useState(false);
  // État pour la gestion des groupes de champs dans le panneau Paramètres
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupLabel, setEditingGroupLabel] = useState('');
  const [groupFieldPickerOpen, setGroupFieldPickerOpen] = useState<string | null>(null);

  const activeCollections = calendarCollections.length > 0 ? calendarCollections : currentCollection ? [currentCollection] : [];
  const normalizeSearchText = (input: any): string => {
    if (input === null || input === undefined) return '';
    if (typeof input === 'string') return input;
    if (typeof input === 'number' || typeof input === 'boolean') return String(input);
    if (Array.isArray(input)) return input.map((v) => normalizeSearchText(v)).join(' ');
    if (typeof input === 'object') {
      const candidate = input.name ?? input.label ?? input.title ?? input.value ?? input.id ?? input.appid;
      if (candidate !== null && candidate !== undefined) return String(candidate);
      try {
        return JSON.stringify(input);
      } catch {
        return '';
      }
    }
    return String(input);
  };

  const getItemLabel = (collection: any, item: any) => {
    const props = collection?.properties || [];
    const nameField = props.find((p: any) => p.name === 'Nom' || p.id === 'name') || props[0];
    const rawLabel = !nameField
      ? item?.name || item?.id || 'Élément'
      : item?.[nameField.id] || item?.name || item?.id || 'Élément';
    const normalized = normalizeSearchText(rawLabel).trim();
    return normalized || 'Élément';
  };

  const activeSearchCollectionId =
    searchCollectionId || (activeCollections.length > 1 ? 'all' : activeCollections[0]?.id || null);
  const getGroupDisplayMode = (groupId: string, groupIndex: number): 'accordion' | 'columns' | 'tabs' => {
    const specific = currentViewConfig?.groupDisplayModes?.[groupId];
    if (specific === 'columns' || specific === 'tabs' || specific === 'accordion') return specific;
    if (groupIndex > 0) return 'accordion';
    const legacy = currentViewConfig?.groupDisplayMode;
    if (legacy === 'columns' || legacy === 'tabs' || legacy === 'accordion') return legacy;
    return 'accordion';
  };

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (activeSearchCollectionId === 'all') {
      const MAX_RESULTS = 50;
      const entries = activeCollections.flatMap((col: any) => {
        const items = Array.isArray(col.items) ? col.items : [];
        const filtered = query
          ? items.filter((item: any) => getItemLabel(col, item).toLowerCase().includes(query))
          : items.slice(0, 10);
        return filtered.map((item: any) => ({ collection: col, item }));
      });
      return { collection: null, items: entries.slice(0, MAX_RESULTS) };
    }
    const selectedCollection = activeCollections.find((c: any) => c.id === activeSearchCollectionId);
    if (!selectedCollection) return { collection: null, items: [] };
    const items = Array.isArray(selectedCollection.items) ? selectedCollection.items : [];
    const filtered = query
      ? items.filter((item: any) => getItemLabel(selectedCollection, item).toLowerCase().includes(query))
      : items.slice(0, 10);
    return { collection: selectedCollection, items: filtered };
  }, [activeCollections, activeSearchCollectionId, searchQuery]);

  const viewIcons: Record<string, typeof Table> = {
    table: Table,
    cards: LayoutGrid,
    steamcards: LayoutGrid,
    kanban: Columns,
    calendar: CalendarIcon,
    layout: Layers,
  } as const;
  const viewTypeMeta = getViewRegistrations().map((registration) => ({
    ...registration,
    icon: viewIcons[registration.type] || LayoutGrid,
  }));

  const viewsByType = useMemo(() => {
    const grouped = new Map<string, any[]>();
    currentViews.forEach((view: any) => {
      const key = view?.type || 'table';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(view);
    });
    return grouped;
  }, [currentViews]);

  return (
    <motion.div
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.15 }}
      className="relative min-w-0 border-b border-black/5 dark:border-white/5 px-2 py-3 sm:px-4 sm:py-4 lg:px-6 z-10"
    >

      <div className="flex min-w-0 items-center gap-2 flex-wrap">
        <ToolbarButton
          type="button"
          onClick={() => setShowToolbarTools((prev) => !prev)}
          active={showToolbarTools}
          size="icon"
          title="Outils de vue"
          aria-label="Outils de vue"
        >
          <Settings size={14} />
        </ToolbarButton>
        <div className="inline-flex min-w-0 max-w-full shrink overflow-x-auto rounded-full bg-white/5 p-1 border border-black/10 dark:border-white/10">
          {viewTypeMeta
            .filter((meta) => (viewsByType.get(meta.type) || []).length > 0)
            .map((meta) => {
              const Icon = meta.icon;
              const typeViews = viewsByType.get(meta.type) || [];
              const isActiveType = typeViews.some((v: any) => v.id === activeView);
              const firstViewId = typeViews[0]?.id || null;
              return (
                <div key={meta.type} className="relative group">
                  <ToolbarButton
                    type="button"
                    onClick={() => {
                      if (firstViewId) onSetActiveView(firstViewId);
                    }}
                    active={isActiveType}
                    className="h-auto rounded-full px-3 py-1"
                  >
                    <Icon size={12} />
                    {meta.label}
                  </ToolbarButton>
                  <div className="absolute left-0 top-full min-w-[220px] rounded-xl border border-black/10 dark:border-white/10 bg-background dark:bg-neutral-950/95 p-2 shadow-xl backdrop-blur z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto">
                    {/* <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1 px-2">
                      {meta.label}
                    </div> */}
                    <div className="space-y-1">
                      {typeViews.map((view: any) => {
                        const isActive = view.id === activeView;
                        const isFavorite = favorites.views.includes(view.id);
                        return (
                          <ContextMenu key={view.id}>
                            <ContextMenuTrigger asChild>
                              <Button
                                type="button"
                                onClick={() => onSetActiveView(view.id)}
                                variant={isActive ? 'secondary' : 'ghost'}
                                size="sm"
                                className={cn(
                                  'h-auto w-full justify-start px-2 py-1 text-left text-xs transition-all',
                                  isActive
                                    ? 'bg-brand-500/20 text-neutral-600 dark:text-brand-100 border border-brand-400/30'
                                    : 'dark:text-neutral-300 text-neutral-700 hover:bg-white/10 dark:hover:bg-black/10'
                                )}
                              >
                                <span>{isFavorite && <span className="text-brand-500">★ </span>}{view.name}</span>
                              </Button>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="min-w-[200px]">
                              <ContextMenuItem onSelect={() => onEditView(view.id)} className="gap-2">
                                <Settings size={14} className="text-brand-400" />
                                <span>Modifier…</span>
                              </ContextMenuItem>
                              <ContextMenuItem onSelect={() => onManageViewVisibility(view.id)} className="gap-2">
                                <Icons.Eye size={14} className="text-brand-400" />
                                <span>Visibilité…</span>
                              </ContextMenuItem>
                              <ContextMenuItem onSelect={() => onToggleFavoriteView(view.id)} className="gap-2">
                                <Icons.Star
                                  size={14}
                                  className={isFavorite ? 'text-brand-500' : 'text-neutral-300'}
                                  fill={isFavorite ? 'currentColor' : 'none'}
                                />
                                <span>{isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
                              </ContextMenuItem>
                              <ContextMenuItem onSelect={() => onDuplicateView(view.id)} className="gap-2">
                                <Icons.Copy size={14} className="text-neutral-300" />
                                <span>Dupliquer</span>
                              </ContextMenuItem>
                              {currentViews.length > 1 && <ContextMenuSeparator />}
                              {currentViews.length > 1 && (
                                <ContextMenuItem
                                  onSelect={() => onDeleteView(view.id)}
                                  className="gap-2 text-red-500 focus:bg-red-500/20"
                                >
                                  <Icons.Trash size={14} />
                                  <span>Supprimer la vue</span>
                                </ContextMenuItem>
                              )}
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconButton
                    onClick={() => canEdit && onShowNewViewModal()}
                    label="Nouvelle vue"
                    className={
                      'h-6 w-6 rounded-full border transition-all ' +
                      (!canEdit
                        ? 'opacity-60 pointer-events-none bg-black/5 dark:bg-white/5 text-neutral-400 border-black/10 dark:border-white/10'
                        : 'bg-black/5 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 border-black/10 dark:border-white/10 hover:bg-white/10')
                    }
                  >
                    <Plus size={14} />
                  </IconButton>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  Nouvelle vue
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
        </div>
      
        <div className="flex min-w-0 items-center gap-2 flex-wrap">
          <div className="flex min-w-0 items-center gap-2 flex-wrap">
              <div className="relative">
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onBlur={() => setTimeout(() => setIsSearchOpen(false), 150)}
              placeholder="Rechercher un projet…"
              className="h-9 w-[min(16rem,calc(100vw-7rem))] max-w-full text-xs"
            />
            {isSearchOpen && activeCollections.length > 0 && (
              <div className="absolute left-0 mt-2 w-[28rem] max-w-[80vw] rounded-lg border border-black/10 dark:border-white/10 bg-background dark:bg-neutral-900 shadow-xl backdrop-blur z-30 p-3">
                <div className="lg:text-sm text-xs text-neutral-700 dark:text-neutral-400 mb-2">
                  {searchQuery.trim()
                    ? 'Résultats de recherche'
                    : ''}
                </div>
                {activeCollections.length > 1 && (
                  <div className="flex items-center gap-2 mb-3">
                    <ToolbarButton
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setSearchCollectionId('all')}
                      active={activeSearchCollectionId === 'all'}
                      className={cn(
                        'h-auto px-2.5 py-1 text-sm font-semibold',
                        activeSearchCollectionId === 'all'
                          ? 'bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/30'
                          : 'text-neutral-700 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 border border-black/10 dark:border-white/10 '
                      )}
                    >
                      Tout
                    </ToolbarButton>
                    {activeCollections.map((col: any) => (
                      <ToolbarButton
                        key={col.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setSearchCollectionId(col.id)}
                        active={activeSearchCollectionId === col.id}
                        className={cn(
                          'h-auto px-2.5 py-1 text-sm font-semibold',
                          activeSearchCollectionId === col.id
                            ? 'bg-brand-500/20 text-brand-600 dark:text-brand-300 border border-brand-500/30'
                            : 'text-neutral-700 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 border border-black/10 dark:border-white/10'
                        )}
                      >
                        {col.name}
                      </ToolbarButton>
                    ))}
                  </div>
                )}
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {activeSearchCollectionId === 'all' ? (
                    searchResults.items.length > 0 ? (
                      searchResults.items.map(({ collection, item }: any) => (
                        <Button
                          key={`${collection.id}-${item.id}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            onOpenItemFromSearch(collection, item);
                            setIsSearchOpen(false);
                          }}
                          variant="ghost"
                          size="sm"
                          className="h-auto w-full justify-between px-2 py-1 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-white/10"
                        >
                          <span className="truncate">{getItemLabel(collection, item)}</span>
                          <span className="text-[11px] text-neutral-700 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 ">{collection.name}</span>
                        </Button>
                      ))
                    ) : (
                      <div className="text-sm text-neutral-700 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 ">Aucun résultat.</div>
                    )
                  ) : searchResults.collection && searchResults.items.length > 0 ? (
                    searchResults.items.map((item: any) => (
                      <Button
                        key={item.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onOpenItemFromSearch(searchResults.collection, item);
                          setIsSearchOpen(false);
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-auto w-full justify-between px-2 py-1 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-white/10"
                      >
                        <span className="truncate">{getItemLabel(searchResults.collection, item)}</span>
                      </Button>
                    ))
                  ) : (
                    <div className="text-sm text-neutral-700 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 ">Aucun résultat.</div>
                  )}
                </div>
              </div>
            )}
          </div>
            <TooltipProvider>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => canEdit && onShowNewItemModal()}
                      className="px-3 py-2 rounded-lg lg:text-sm text-xs font-medium bg-gray-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-200 hover:bg-white/10 duration-300 transition-all"
                      disabled={!canEdit}
                    >
                      <Plus size={14} className="inline" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    {newItemLabel}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => canEdit && onQuickCreateItem()}
                      className="px-3 py-2 rounded-lg lg:text-sm text-xs font-medium bg-gray-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-200 hover:bg-white/10 duration-300 transition-all"
                      disabled={!canEdit}
                    >
                      <Zap size={14} className="inline" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="center">
                    Création rapide
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
            </div>
        
        </div>
      </div>

      {showToolbarTools && (
        <div className="flex items-center gap-2 flex-wrap mt-4">
          {currentViewConfig?.type !== 'layout' && (
            <>
              <ToolbarButton
                onClick={onShowFilterModal}
              >
                <Filter size={14} />
                Filtrer
              </ToolbarButton>
              <ToolbarButton
                onClick={onShowGroupModal}
              >
                <Layers size={14} />
                Grouper
              </ToolbarButton>
              <div className="relative" ref={settingsRef}>
                <ToolbarButton
                  onClick={() => onSetShowViewSettings(!showViewSettings)}
                  active={showViewSettings}
                >
                  <Settings size={14} />
                  Paramètres
                </ToolbarButton>

            <AnimatePresence>
              {showViewSettings && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="view-settings-panel absolute top-full -mt-2 left-0 w-[420px] max-w-[calc(100vw-1rem)] rounded-[var(--view-control-radius)] bg-gray-200 p-4 backdrop-blur dark:bg-neutral-900 border border-black/10 dark:border-white/10 z-[140]"
                >
                  <ViewSettingsPanel
                    view={currentViewConfig}
                    collection={currentCollection}
                    properties={orderedProperties}
                    collections={collections}
                    views={allViews}
                    onUpdate={onUpdateViewConfig}
                  />
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-black dark:text-white">Colonnes visibles</h4>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <ToolbarButton
                          onClick={() => { onSetShowViewSettings(false); onShowNewPropertyModal(); }}
                          className="h-auto px-2 py-1 text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white"
                          title="Ajouter une propriété"
                        >
                          <Plus size={12} />
                          Propriété
                        </ToolbarButton>
                      )}
                      <IconButton
                        onClick={() => onSetShowViewSettings(false)}
                        label="Fermer les paramètres"
                        className="h-7 w-7 text-neutral-700 dark:text-neutral-500 hover:text-black dark:hover:text-white"
                      >
                        <X size={14} />
                      </IconButton>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {currentViewConfig?.type === 'calendar' && calendarCollections.length > 0 ? (
                      <div className="space-y-4">
                        {calendarCollections.map((col) => {
                          const props = col.properties || [];
                          const visibleIds = Array.isArray(col.defaultVisibleFieldIds)
                            ? col.defaultVisibleFieldIds
                            : props[0]
                            ? [props[0].id]
                            : [];
                          const viewable = props.filter((p: any) => canViewFieldFn(p.id, col.id));
                          return (
                            <div key={col.id} className="rounded-lg border border-black/10 dark:border-white/10 p-2">
                              <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">{col.name}</div>
                              <div className="columns-2 gap-1">
                                {viewable.map((prop: any) => {
                                  const isVisible = visibleIds.includes(prop.id);
                                  const PropIcon = (Icons as any)[prop.icon] || Icons.Tag;
                                  return (
                                    <label
                                      key={prop.id}
                                      className="break-inside-avoid mb-1 flex items-center gap-1.5 justify-between text-xs text-neutral-700 dark:text-neutral-300 p-1.5 rounded-md hover:bg-white/5 group cursor-pointer select-none"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <PropIcon size={13} className="text-neutral-400 shrink-0" />
                                        <span className="truncate">{prop.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <IconButton
                                          onClick={(e) => { e.preventDefault(); if (!canEdit) return; onEditProperty(prop); }}
                                          label="Modifier la propriété"
                                          className="h-5 w-5 opacity-0 text-neutral-500 transition-opacity hover:text-brand-400 group-hover:opacity-100"
                                        >
                                          <Icons.Edit2 size={11} />
                                        </IconButton>
                                        <Button
                                          role="checkbox"
                                          aria-checked={isVisible}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            const next = isVisible
                                              ? visibleIds.filter((id: string) => id !== prop.id)
                                              : Array.from(new Set([...visibleIds, prop.id]));
                                            const normalized = next.length ? next : (props[0] ? [props[0].id] : []);
                                            onUpdateCollectionVisibleFields(col.id, normalized);
                                          }}
                                          variant="outline"
                                          size="sm"
                                          className={cn(
                                            'size-4 shrink-0 rounded-[4px] border p-0 transition-colors',
                                            isVisible
                                              ? 'bg-brand-500 border-brand-500 text-white'
                                              : 'border-neutral-400 dark:border-neutral-600 text-transparent'
                                          )}
                                        >
                                          <Icons.Check size={10} strokeWidth={3} />
                                        </Button>
                                      </div>
                                    </label>
                                  );
                                })}
                                {viewable.length === 0 && (
                                  <div className="col-span-2 text-xs text-neutral-500">Aucun champ visible.</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <DraggableList
                        items={viewableSettingsItems}
                        getId={(p) => p.id}
                        onReorder={(next) => {
                          const nextOrder = next
                            .map((p: any) => p.id)
                            .filter((id: string) => id !== ROW_SELECTION_FIELD_ID);
                          onUpdateViewFieldOrder(nextOrder);
                        }}
                        renderContainer={(children) => (
                          <div className="columns-2 gap-1">{children}</div>
                        )}
                        renderItem={(prop: any, { isDragging }) => {
                          const isHidden = currentViewConfig?.hiddenFields?.includes(prop.id);
                          const isSystemOption = prop.id === ROW_SELECTION_FIELD_ID;
                          const PropIcon = isSystemOption ? Icons.Square : ((Icons as any)[prop.icon] || Icons.Tag);
                          return (
                            <div
                              className={cn(
                                'break-inside-avoid flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300 p-1.5 rounded-md transition-colors hover:bg-white/5 group select-none mb-1',
                                isDragging && 'opacity-50'
                              )}
                            >
                              {!isSystemOption ? (
                                <Icons.GripVertical size={13} className="text-neutral-500 shrink-0" />
                              ) : (
                                <div className="w-[13px] shrink-0" />
                              )}
                              <PropIcon size={13} className="text-neutral-400 shrink-0" />
                              <span className="flex-1 truncate">{prop.name}</span>
                              {!isSystemOption && (
                                <IconButton
                                  onClick={(e) => { e.stopPropagation(); if (!canEdit) return; onEditProperty(prop); }}
                                  label="Modifier la propriété"
                                  className="h-5 w-5 shrink-0 opacity-0 text-neutral-500 transition-opacity hover:text-brand-400 group-hover:opacity-100"
                                >
                                  <Icons.Edit2 size={11} />
                                </IconButton>
                              )}
                              <Button
                                role="checkbox"
                                aria-checked={!isHidden}
                                onClick={(e) => { e.stopPropagation(); onToggleFieldVisibility(prop.id); }}
                                variant="outline"
                                size="sm"
                                className={cn(
                                  'size-4 shrink-0 rounded-[4px] border p-0 transition-colors',
                                  !isHidden
                                    ? 'bg-brand-500 border-brand-500 text-white'
                                    : 'border-neutral-400 dark:border-neutral-600 text-transparent'
                                )}
                              >
                                <Icons.Check size={10} strokeWidth={3} />
                              </Button>
                            </div>
                          );
                        }}
                      />
                    )}
                  </div>

                  {/* ── Groupes de champs ───────────────────────────────── */}
                  {currentViewConfig?.type !== 'calendar' && (
                    <div className="mt-4 pt-3 border-t border-black/10 dark:border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">Groupes de champs</span>
                      </div>
                      <div className="flex items-center gap-1 mb-3">
                        <span className="text-[10px] text-neutral-500 mr-1">Affichage</span>
                        {([
                          { value: 'stacked', label: 'Empilés' },
                          { value: 'tabs', label: 'Onglets' },
                        ] as const).map((option) => (
                          <ToolbarButton
                            key={option.value}
                            type="button"
                            onClick={() => onUpdateFieldGroupsLayout(option.value)}
                            active={(currentViewConfig?.fieldGroupsLayout || 'stacked') === option.value}
                            className={cn(
                              'h-auto px-2 py-1 text-[10px] border',
                              (currentViewConfig?.fieldGroupsLayout || 'stacked') === option.value
                                ? 'border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-300'
                                : 'border-black/10 dark:border-white/10 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                            )}
                          >
                            {option.label}
                          </ToolbarButton>
                        ))}
                      </div>

                      {/* Liste des groupes existants */}
                      {(currentViewConfig?.fieldGroups || []).map((group: FieldGroup) => {
                        const isEditing = editingGroupId === group.id;
                        const isPickerOpen = groupFieldPickerOpen === group.id;
                        return (
                          <div key={group.id} className="mb-2 rounded-lg border border-black/10 dark:border-white/10 p-2">
                            {/* En-tête du groupe */}
                            <div className="flex items-center gap-1 mb-1.5">
                              {isEditing ? (
                                <input
                                  autoFocus
                                  value={editingGroupLabel}
                                  onChange={(e) => setEditingGroupLabel(e.target.value)}
                                  onBlur={() => {
                                    const trimmed = editingGroupLabel.trim();
                                    if (trimmed) {
                                      const next = (currentViewConfig?.fieldGroups || []).map((g: FieldGroup) =>
                                        g.id === group.id ? { ...g, label: trimmed } : g
                                      );
                                      onUpdateFieldGroups(next);
                                    }
                                    setEditingGroupId(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                    if (e.key === 'Escape') { setEditingGroupId(null); }
                                  }}
                                  className="flex-1 text-xs bg-transparent border-b border-brand-500 outline-none text-neutral-800 dark:text-neutral-200 py-0.5"
                                />
                              ) : (
                                <Button
                                  type="button"
                                  onClick={() => { setEditingGroupId(group.id); setEditingGroupLabel(group.label); }}
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto flex-1 justify-start truncate p-0 text-left text-xs font-medium text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
                                  title="Cliquer pour renommer"
                                >
                                  {group.label}
                                </Button>
                              )}
                              <IconButton
                                onClick={() => {
                                  const next = (currentViewConfig?.fieldGroups || []).filter((g: FieldGroup) => g.id !== group.id);
                                  onUpdateFieldGroups(next);
                                  if (groupFieldPickerOpen === group.id) setGroupFieldPickerOpen(null);
                                }}
                                label="Supprimer le groupe"
                                className="h-6 w-6 p-0.5 text-neutral-500 hover:text-red-500"
                              >
                                <Icons.X size={12} />
                              </IconButton>
                            </div>
                            {currentViewConfig?.type === 'cards' || currentViewConfig?.type === 'steamcards' ? (
                              <SettingsField label="Emplacement" className="mb-2">
                                <Select
                                  value={(currentViewConfig.cardGroupPlacements || {})[group.id] || 'description'}
                                  onValueChange={(placement) => {
                                    onUpdateViewConfig({ cardGroupPlacements: { ...(currentViewConfig.cardGroupPlacements || {}), [group.id]: placement } });
                                  }}
                                >
                                  <SelectTrigger className="h-7 w-full text-xs"><SelectValue placeholder="Emplacement" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="header">En-tête</SelectItem>
                                    <SelectItem value="description">Description</SelectItem>
                                    <SelectItem value="footer">Encart bas</SelectItem>
                                    <SelectItem value="tags">Tags sur l’image</SelectItem>
                                    <SelectItem value="hidden">Masqué</SelectItem>
                                  </SelectContent>
                                </Select>
                              </SettingsField>
                            ) : null}

                            {/* Champs du groupe */}
                            <div className="flex flex-wrap gap-1 min-h-[22px]">
                              {group.fieldIds.map((fid) => {
                                const prop = viewableProperties.find((p) => p.id === fid);
                                if (!prop) return null;
                                return (
                                  <span key={fid} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 text-neutral-700 dark:text-neutral-300">
                                    {prop.name}
                                    <IconButton
                                      onClick={() => {
                                        const next = (currentViewConfig?.fieldGroups || []).map((g: FieldGroup) =>
                                          g.id === group.id ? { ...g, fieldIds: g.fieldIds.filter((id) => id !== fid) } : g
                                        );
                                        onUpdateFieldGroups(next);
                                      }}
                                      label={`Retirer ${prop.name}`}
                                      className="h-4 w-4 text-neutral-400 hover:text-red-400"
                                    >
                                      <Icons.X size={9} />
                                    </IconButton>
                                  </span>
                                );
                              })}
                              {/* Bouton + ajouter un champ */}
                              <Button
                                type="button"
                                onClick={() => setGroupFieldPickerOpen(isPickerOpen ? null : group.id)}
                                variant="outline"
                                size="sm"
                                className="h-auto border-dashed border-neutral-400 px-1.5 py-0.5 text-[10px] text-neutral-500 hover:border-brand-500 hover:text-brand-500 dark:border-neutral-600"
                              >
                                + champ
                              </Button>
                            </div>

                            {/* Picker de champs — exclut relations, titre et champs déjà dans un groupe */}
                            {isPickerOpen && (() => {
                              const allAssignedIds = new Set(
                                (currentViewConfig?.fieldGroups || []).flatMap((g: FieldGroup) => g.fieldIds)
                              );
                              const titleFieldId = (currentCollection?.properties || [])[0]?.id;
                              const available = viewableProperties.filter((p) =>
                                !allAssignedIds.has(p.id) &&
                                p.type !== 'relation' &&
                                p.id !== titleFieldId
                              );
                              return (
                                <div className="mt-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-gray-100 dark:bg-neutral-800 p-1.5 max-h-32 overflow-y-auto">
                                  {available.map((prop) => (
                                    <Button
                                      key={prop.id}
                                      type="button"
                                      onClick={() => {
                                        const next = (currentViewConfig?.fieldGroups || []).map((g: FieldGroup) =>
                                          g.id === group.id ? { ...g, fieldIds: [...g.fieldIds, prop.id] } : g
                                        );
                                        onUpdateFieldGroups(next);
                                        setGroupFieldPickerOpen(null);
                                      }}
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto w-full justify-start truncate px-2 py-1 text-left text-xs text-neutral-700 hover:bg-black/5 dark:text-neutral-300 dark:hover:bg-white/10"
                                    >
                                      {prop.name}
                                    </Button>
                                  ))}
                                  {available.length === 0 && (
                                    <div className="text-xs text-neutral-500 px-2 py-1">Tous les champs sont déjà assignés</div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}

                      {(currentViewConfig?.type === 'cards' || currentViewConfig?.type === 'steamcards') && (() => {
                        const groupedIds = new Set((currentViewConfig?.fieldGroups || []).flatMap((group: FieldGroup) => group.fieldIds));
                        const ungroupedCount = viewableProperties.filter((property) => !groupedIds.has(property.id)).length;
                        if (!ungroupedCount) return null;
                        return (
                          <SettingsField label={`Autres champs visibles · ${ungroupedCount}`} className="mb-2 rounded-lg border border-dashed border-border p-2">
                            <Select value={(currentViewConfig.cardGroupPlacements || {}).__ungrouped__ || 'description'} onValueChange={(placement) => onUpdateViewConfig({ cardGroupPlacements: { ...(currentViewConfig.cardGroupPlacements || {}), __ungrouped__: placement } })}>
                              <SelectTrigger className="h-7 w-full text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="header">En-tête</SelectItem><SelectItem value="description">Description</SelectItem><SelectItem value="footer">Encart bas</SelectItem><SelectItem value="tags">Tags sur l’image</SelectItem><SelectItem value="hidden">Masqué</SelectItem></SelectContent>
                            </Select>
                          </SettingsField>
                        );
                      })()}

                      {/* Créer un nouveau groupe */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <Input
                          type="text"
                          value={newGroupLabel}
                          onChange={(e) => setNewGroupLabel(e.target.value)}
                          placeholder="Nom du groupe…"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const trimmed = newGroupLabel.trim();
                              if (!trimmed) return;
                              const newGroup: FieldGroup = { id: `group_${Date.now()}`, label: trimmed, fieldIds: [] };
                              onUpdateFieldGroups([...(currentViewConfig?.fieldGroups || []), newGroup]);
                              setNewGroupLabel('');
                            }
                          }}
                          className="h-auto flex-1 py-1.5 text-xs text-neutral-700 dark:text-neutral-300"
                        />
                        <IconButton
                          onClick={() => {
                            const trimmed = newGroupLabel.trim();
                            if (!trimmed) return;
                            const newGroup: FieldGroup = { id: `group_${Date.now()}`, label: trimmed, fieldIds: [] };
                            onUpdateFieldGroups([...(currentViewConfig?.fieldGroups || []), newGroup]);
                            setNewGroupLabel('');
                          }}
                          disabled={!newGroupLabel.trim()}
                          label="Créer le groupe"
                          variant="default"
                          className="h-7 w-7 bg-brand-600 text-white hover:bg-brand-500"
                        >
                          <Icons.Plus size={12} />
                        </IconButton>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
              </div>
            </>
          )}

          {currentViewConfig?.type === 'layout' && (
            <div className="relative" ref={settingsRef}>
              <ToolbarButton onClick={() => onSetShowViewSettings(!showViewSettings)} active={showViewSettings}>
                <Settings size={14} />
                Paramètres
              </ToolbarButton>
              <AnimatePresence>
                {showViewSettings && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="view-settings-panel absolute left-0 top-full z-[140] -mt-2 w-[520px] max-w-[calc(100vw-1rem)] rounded-[var(--view-control-radius)] border border-black/10 bg-gray-200 p-4 backdrop-blur dark:border-white/10 dark:bg-neutral-900">
                    <ViewSettingsPanel view={currentViewConfig} collection={currentCollection} properties={orderedProperties} collections={collections} views={allViews} onUpdate={onUpdateViewConfig} />
                    <div className="flex justify-end"><IconButton onClick={() => onSetShowViewSettings(false)} label="Fermer les paramètres" className="h-7 w-7 text-neutral-700 dark:text-neutral-500 hover:text-black dark:hover:text-white"><X size={14} /></IconButton></div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {currentViewConfig?.filters.map((filter: any, idx: number) => {
            const { sourceCollection, sourceProp } = getFilterSource(filter);
            const previousFilter = idx > 0 ? currentViewConfig?.filters?.[idx - 1] : null;
            const previousSource = previousFilter ? getFilterSource(previousFilter) : null;
            const showCollectionName =
              !previousSource?.sourceCollection?.id ||
              previousSource.sourceCollection.id !== sourceCollection?.id;
            const hasValue = !['is_empty', 'is_not_empty'].includes(filter.operator);
            const accentColor = sourceCollection?.color || '#8b5cf6';

            return (
            <React.Fragment key={idx}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-neutral-700 dark:text-neutral-200"
                style={{
                  backgroundColor: `${accentColor}22`,
                  borderColor: `${accentColor}55`
                }}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {showCollectionName && sourceCollection?.name && (
                    <span className="max-w-[120px] truncate text-[11px] font-medium" style={{ color: accentColor }} title={sourceCollection.name}>{sourceCollection.name}</span>
                  )}
                  <span className="max-w-[130px] truncate font-medium" title={sourceProp?.name || 'Champ'}>{sourceProp?.name || 'Champ'}</span>
                  <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
                    {getCompactOperatorLabel(filter.operator)}
                  </span>
                </span>
                {hasValue && (
                  <div className="min-w-0 flex-shrink overflow-hidden">
                    <FilterValueDisplay
                      filter={filter}
                      property={sourceProp}
                      collections={collections}
                      currentCollection={currentCollection}
                      canEdit={canEdit}
                      compact
                      onUpdateValue={(newValue) => onUpdateFilterValue(idx, newValue)}
                    />
                  </div>
                )}
                <IconButton
                  onClick={() => {
                    if (!canEdit) return;
                    onEditFilter(idx);
                  }}
                  label="Modifier la règle"
                  className={cn('ml-0.5 h-6 w-6 rounded-full p-1', !canEdit && 'pointer-events-none opacity-60')}
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${accentColor}33`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <Icons.SlidersHorizontal size={13} />
                </IconButton>
                <IconButton
                  onClick={() => onRemoveFilter(idx)}
                  label="Retirer le filtre"
                  className="h-6 w-6 rounded-full p-1"
                  style={{ backgroundColor: 'transparent' }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${accentColor}33`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <X size={13} />
                </IconButton>
              </motion.div>
            </React.Fragment>
            );
          })}

          {relationFilter.collectionId === activeCollection && relationFilter.ids.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/20 text-neutral-700 dark:text-whiterounded-lg text-sm border border-brand-500/30"
            >
              <span>Filtre relation : {relationFilter.ids.length} élément(s)</span>
              <IconButton onClick={onClearRelationFilter} label="Retirer le filtre relation" className="h-6 w-6 rounded p-0.5 hover:bg-brand-500/30">
                <X size={14} />
              </IconButton>
            </motion.div>
          )}

          {currentViewConfig?.groups.map((group: string, idx: number) => (
            <ContextMenu key={idx}>
              <ContextMenuTrigger asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/20 text-neutral-700 dark:text-white rounded-lg text-xs border border-brand-500/30"
                >
                  <span>
                    Groupé par: {orderedProperties.find((p: any) => p.id === group)?.name || currentCollection?.properties.find((p: any) => p.id === group)?.name || group}
                  </span>
                  <IconButton
                    onClick={() => onRemoveGroup(group)}
                    label="Retirer ce groupage"
                    className="h-6 w-6 rounded p-0.5 hover:bg-brand-500/30"
                  >
                    <X size={14} />
                  </IconButton>
                </motion.div>
              </ContextMenuTrigger>
              <ContextMenuContent className="min-w-[220px]">
                <ContextMenuLabel>Affichage des groupes</ContextMenuLabel>
                <ContextMenuRadioGroup
                  value={getGroupDisplayMode(group, idx)}
                  onValueChange={(value) => {
                    const nextMode = value === 'columns' || value === 'tabs' ? value : 'accordion';
                    onSetGroupDisplayMode(group, nextMode);
                  }}
                >
                  <ContextMenuRadioItem value="accordion">Chevron (accordéon)</ContextMenuRadioItem>
                  <ContextMenuRadioItem value="columns">Colonnes</ContextMenuRadioItem>
                  <ContextMenuRadioItem value="tabs">Onglets</ContextMenuRadioItem>
                </ContextMenuRadioGroup>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => onRemoveGroup(group)} className="text-red-600 dark:text-red-400">
                  Retirer ce groupage
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      )}

    </motion.div>
  );
};

export default ViewToolbar;
