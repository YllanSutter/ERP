import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Filter,
  Layers,
  Table,
  Layout,
  X,
  Settings,
  Calendar as CalendarIcon,
  Zap
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import ShinyButton from '@/components/ui/ShinyButton';
import DraggableList from '@/components/inputs/DraggableList';
import { useCanEdit } from '@/lib/hooks/useCanEdit';
import { useAuth } from '@/auth/AuthProvider';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu';

interface ViewToolbarProps {
  currentCollection: any;
  currentViews: any[];
  currentViewConfig: any;
  activeView: string | null;
  orderedProperties: any[];
  collections: any[];
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
  onShowNewItemModal: () => void;
  onQuickCreateItem: () => void;
  onSetShowViewSettings: (show: boolean) => void;
  onToggleFieldVisibility: (fieldId: string) => void;
  onUpdateViewFieldOrder: (nextOrder: string[]) => void;
  onEditProperty: (property: any) => void;
  onEditFilter: (index: number) => void;
  onRemoveFilter: (index: number) => void;
  onClearRelationFilter: () => void;
  onRemoveGroup: (property: string) => void;
  onToggleFavoriteView: (viewId: string) => void;
  onManageViewVisibility: (viewId: string) => void;
  onEditView: (viewId: string) => void;
  onUpdateCollectionVisibleFields: (collectionId: string, visibleFieldIds: string[]) => void;
  onDuplicateView: (viewId: string) => void;
  onOpenItemFromSearch: (collection: any, item: any) => void;
}

const ViewToolbar: React.FC<ViewToolbarProps> = ({
  currentCollection,
  currentViews,
  currentViewConfig,
  activeView,
  orderedProperties,
  collections,
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
  onEditProperty,
  onEditFilter,
  onRemoveFilter,
  onClearRelationFilter,
  onRemoveGroup,
  onToggleFavoriteView,
  onManageViewVisibility,
  onEditView,
  onUpdateCollectionVisibleFields,
  onDuplicateView,
  onOpenItemFromSearch
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
  const getOperatorLabel = (op: string) => operatorLabels[op] || op;
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

  const activeCollections = calendarCollections.length > 0 ? calendarCollections : currentCollection ? [currentCollection] : [];
  const getItemLabel = (collection: any, item: any) => {
    const props = collection?.properties || [];
    const nameField = props.find((p: any) => p.name === 'Nom' || p.id === 'name') || props[0];
    if (!nameField) return item?.name || item?.id || 'Élément';
    return item?.[nameField.id] || item?.name || item?.id || 'Élément';
  };

  const activeSearchCollectionId =
    searchCollectionId || (activeCollections.length > 1 ? 'all' : activeCollections[0]?.id || null);

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

  const viewTypeMeta = [
    { type: 'table', label: 'Tableau', icon: Table },
    { type: 'kanban', label: 'Kanban', icon: Layout },
    { type: 'calendar', label: 'Calendrier', icon: CalendarIcon },
    { type: 'layout', label: 'Layout', icon: Layers }
  ];

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
      className="relative border-b border-black/5 dark:border-white/5bg-neutral-900/30 backdrop-blur lg-px-8 px-2 py-4 z-10"
    >

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowToolbarTools((prev) => !prev)}
          className={
            'h-8 w-8 rounded-full flex items-center justify-center border transition-all ' +
            (showToolbarTools
              ? 'bg-violet-500 dark:bg-violet-500/30 text-white dark:text-violet-100 border-violet-400/40'
              : 'bg-black/5 dark:bg-white/5 text-neutral-700 dark:text-neutral-400 border-black/10 dark:border-white/10 hover:bg-white/10')
          }
          title="Outils de vue"
          aria-label="Outils de vue"
        >
          <Settings size={14} />
        </button>
        <div className="inline-flex rounded-full bg-white/5 p-1 border border-black/10  dark:border-white/10  max-w-[calc(100%-100px)]">
          {viewTypeMeta
            .filter((meta) => (viewsByType.get(meta.type) || []).length > 0)
            .map((meta) => {
              const Icon = meta.icon;
              const typeViews = viewsByType.get(meta.type) || [];
              const isActiveType = typeViews.some((v: any) => v.id === activeView);
              const firstViewId = typeViews[0]?.id || null;
              return (
                <div key={meta.type} className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      if (firstViewId) onSetActiveView(firstViewId);
                    }}
                    className={
                      'px-3 py-1 text-xs rounded-full transition-all inline-flex items-center gap-1 ' +
                      (isActiveType
                        ? 'bg-violet-500 text-white dark:bg-violet-500/30 dark:text-violet-100 border border-violet-400/40 shadow-sm'
                        : 'text-neutral-700 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5')
                    }
                  >
                    <Icon size={12} />
                    {meta.label}
                  </button>
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
                              <button
                                type="button"
                                onClick={() => onSetActiveView(view.id)}
                                className={cn(
                                  'w-full text-left px-2 py-1 rounded-md text-xs transition-all',
                                  isActive
                                    ? 'bg-violet-500/20 text-neutral-600 dark:text-violet-100 border border-violet-400/30'
                                    : 'dark:text-neutral-300 text-neutral-700 hover:bg-white/10 dark:hover:bg-black/10'
                                )}
                              >
                                <span>{isFavorite ? '★ ' : ''}{view.name}</span>
                              </button>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="min-w-[200px]">
                              <ContextMenuItem onSelect={() => onEditView(view.id)} className="gap-2">
                                <Settings size={14} className="text-violet-400" />
                                <span>Modifier…</span>
                              </ContextMenuItem>
                              <ContextMenuItem onSelect={() => onManageViewVisibility(view.id)} className="gap-2">
                                <Icons.Eye size={14} className="text-cyan-400" />
                                <span>Visibilité…</span>
                              </ContextMenuItem>
                              <ContextMenuItem onSelect={() => onToggleFavoriteView(view.id)} className="gap-2">
                                <Icons.Star
                                  size={14}
                                  className={isFavorite ? 'text-yellow-400' : 'text-neutral-300'}
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
        </div>
        <button
          type="button"
          onClick={() => canEdit && onShowNewViewModal()}
          className={
            'h-8 w-8 rounded-full flex items-center justify-center border transition-all ' +
            (!canEdit
              ? 'opacity-60 pointer-events-none bg-black/5 dark:bg-white/5 text-neutral-400 border-black/10 dark:border-white/10'
              : 'bg-black/5 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 border-black/10 dark:border-white/10 hover:bg-white/10')
          }
          title="Nouvelle vue"
          aria-label="Nouvelle vue"
        >
          <Plus size={14} />
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <ShinyButton
              onClick={() => {
                if (!canEdit) return;
                onShowNewItemModal();
              }}
              className={`!px-3 !py-2 lg:text-sm text-xs ${!canEdit ? 'opacity-60 pointer-events-none' : ''}`}
            >
              <Plus size={14} className="inline mr-1" />
              {newItemLabel}
            </ShinyButton>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => canEdit && onQuickCreateItem()}
              className="px-3 py-2 rounded-lg lg:text-sm text-xs font-medium bg-gray-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-200 hover:bg-white/10 duration-300 transition-all"
              disabled={!canEdit}
            >
              <Zap size={14} className="inline mr-1" />
              Création rapide
            </motion.button>
            </div>
          <div className="relative">
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onBlur={() => setTimeout(() => setIsSearchOpen(false), 150)}
              placeholder="Rechercher un projet…"
              className="bg-background border-b border-black/15 dark:border-white/15 px-3 py-2 lg:text-sm text-xs text-neutral-700 dark:text-neutral-200 placeholder:text-neutral-500 focus:outline-none"
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
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setSearchCollectionId('all')}
                      className={cn(
                        'px-2.5 py-1 rounded-md text-sm font-semibold transition-all',
                        activeSearchCollectionId === 'all'
                          ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30'
                          : 'text-neutral-700 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 border border-black/10 dark:border-white/10 '
                      )}
                    >
                      Tout
                    </button>
                    {activeCollections.map((col: any) => (
                      <button
                        key={col.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setSearchCollectionId(col.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-sm font-semibold transition-all',
                          activeSearchCollectionId === col.id
                            ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30'
                            : 'text-neutral-700 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 border border-black/10 dark:border-white/10'
                        )}
                      >
                        {col.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {activeSearchCollectionId === 'all' ? (
                    searchResults.items.length > 0 ? (
                      searchResults.items.map(({ collection, item }: any) => (
                        <button
                          key={`${collection.id}-${item.id}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            onOpenItemFromSearch(collection, item);
                            setIsSearchOpen(false);
                          }}
                          className="w-full flex items-center justify-between rounded-md px-2 py-1 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-white/10"
                        >
                          <span className="truncate">{getItemLabel(collection, item)}</span>
                          <span className="text-[11px] text-neutral-700 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 ">{collection.name}</span>
                        </button>
                      ))
                    ) : (
                      <div className="text-sm text-neutral-700 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 ">Aucun résultat.</div>
                    )
                  ) : searchResults.collection && searchResults.items.length > 0 ? (
                    searchResults.items.map((item: any) => (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onOpenItemFromSearch(searchResults.collection, item);
                          setIsSearchOpen(false);
                        }}
                        className="w-full flex items-center justify-between rounded-md px-2 py-1 text-sm text-neutral-700 dark:text-neutral-200 hover:bg-white/10"
                      >
                        <span className="truncate">{getItemLabel(searchResults.collection, item)}</span>
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-neutral-700 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 ">Aucun résultat.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showToolbarTools && (
        <div className="flex items-center gap-2 flex-wrap mt-4">
          {currentViewConfig?.type !== 'layout' && (
            <>
              <button
                onClick={onShowFilterModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-neutral-700 dark:text-neutral-400 rounded-lg hover:bg-white/10 lg:text-sm text-xs transition-all duration-300"
              >
                <Filter size={14} />
                Filtrer
              </button>
              <button
                onClick={onShowGroupModal}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-neutral-700 dark:text-neutral-400 rounded-lg hover:bg-white/10 lg:text-sm text-xs transition-all duration-300"
              >
                <Layers size={14} />
                Grouper
              </button>
              <button
                onClick={() => canEdit && onShowNewPropertyModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-neutral-700 dark:text-neutral-400 rounded-lg hover:bg-white/10 lg:text-sm text-xs transition-all duration-300"
                disabled={!canEdit}
              >
                <Plus size={14} />
                Propriété
              </button>

              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => onSetShowViewSettings(!showViewSettings)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-neutral-700 dark:text-neutral-400 rounded-lg hover:bg-white/10 lg:text-sm text-xs transition-all duration-300"
                >
                  <Settings size={14} />
                  Paramètres
                </button>

            <AnimatePresence>
              {showViewSettings && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full  -mt-2 right-0 w-72 bg-gray-200 dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-lg shadow-xl backdrop-blur z-[140] p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-black dark:text-white">Colonnes visibles</h4>
                    <button
                      onClick={() => onSetShowViewSettings(false)}
                      className="text-neutral-700 dark:text-neutral-500 hover:text-black dark:hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
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
                              <div className="space-y-2">
                                {viewable.map((prop: any) => {
                                  const isVisible = visibleIds.includes(prop.id);
                                  return (
                                    <label
                                      key={prop.id}
                                      className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isVisible}
                                        onChange={(e) => {
                                          const next = e.target.checked
                                            ? Array.from(new Set([...visibleIds, prop.id]))
                                            : visibleIds.filter((id: string) => id !== prop.id);
                                          const normalized = next.length ? next : (props[0] ? [props[0].id] : []);
                                          onUpdateCollectionVisibleFields(col.id, normalized);
                                        }}
                                        className="accent-violet-500"
                                      />
                                      <span className="flex-1">{prop.name}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!canEdit) return;
                                          onEditProperty(prop);
                                        }}
                                        className="text-neutral-700 dark:text-neutral-300 hover:text-cyan-400 p-1 rounded hover:bg-dark/10 dark:hover:bg-white/10"
                                        title="Modifier la propriété"
                                      >
                                        <Icons.Edit2 size={14} />
                                      </button>
                                    </label>
                                  );
                                })}
                                {viewable.length === 0 && (
                                  <div className="text-sm text-neutral-700 dark:text-neutral-300">Aucun champ visible.</div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <DraggableList
                        items={viewableProperties}
                        getId={(p) => p.id}
                        onReorder={(next) => {
                          const nextOrder = next.map((p: any) => p.id);
                          onUpdateViewFieldOrder(nextOrder);
                        }}
                        renderItem={(prop: any, { isDragging }) => {
                          const isHidden = currentViewConfig?.hiddenFields?.includes(prop.id);
                          return (
                            <div
                              className={cn(
                                'flex items-center gap-3 text-sm text-neutral-700 dark:text-neutral-300 p-2 transition-colors hover:bg-white/5  border-b border-[#ffffff20]',
                                isDragging && 'border border-cyan-500/60'
                              )}
                            >
                              <div className="text-neutral-700 dark:text-neutral-300 cursor-grab">
                                <Icons.GripVertical size={16} />
                              </div>
                              <div className="relative flex items-center">
                                <input
                                  type="checkbox"
                                  checked={!isHidden}
                                  onChange={() => onToggleFieldVisibility(prop.id)}
                                  className="peer h-4 w-4 appearance-none rounded border-2 border-black/20 dark:border-white/20 bg-background dark:bg-neutral-800 checked:bg-neutral-100  checked:border-transparent transition-all cursor-pointer"
                                />
                                <svg
                                  className="absolute left-0.5 top-0.5 h-3 w-3 text-neutral-700 dark:text-neutral-300 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={3}
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                              <div className="flex items-center gap-2">
                                <span>{prop.name}</span>
                              </div>
                              <button
                                onClick={() => {
                                  if (!canEdit) return;
                                  onEditProperty(prop);
                                }}
                                className="ml-auto text-neutral-700 dark:text-neutral-300 hover:text-cyan-400 p-1 rounded hover:bg-white/10"
                                title="Modifier la propriété"
                              >
                                <Icons.Edit2 size={14} />
                              </button>
                            </div>
                          );
                        }}
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
              </div>
            </>
          )}

          {currentViewConfig?.filters.map((filter: any, idx: number) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-neutral-700 dark:text-neutral-300 text-sm">&</span>}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 text-neutral-700 dark:text-neutral-300 rounded-lg text-sm border border-violet-500/30 lowercase"
              >
                <span>
                  {(() => {
                    const sourceCollection =
                      collections.find((c: any) =>
                        c.properties?.some((p: any) => p.id === filter.property)
                      ) || currentCollection;
                    const sourceProp = sourceCollection?.properties?.find(
                      (p: any) => p.id === filter.property
                    );
                    return (
                      <>
                        {sourceCollection?.name && (
                          <span className="text-neutral-700 dark:text-neutral-300">{sourceCollection.name} · </span>
                        )}
                        {sourceProp?.name || 'Champ'}{' '}
                      </>
                    );
                  })()}
                  {getOperatorLabel(filter.operator)}{' '}
                  {(() => {
                    const sourceCollection =
                      collections.find((c: any) =>
                        c.properties?.some((p: any) => p.id === filter.property)
                      ) || currentCollection;
                    const prop = sourceCollection?.properties?.find(
                      (p: any) => p.id === filter.property
                    );
                    if (prop?.type === 'relation') {
                      const targetCol = collections.find(
                        (c: any) => c.id === prop.relation?.targetCollectionId
                      );
                      if (!targetCol) return filter.value;
                      const nameField =
                        targetCol.properties.find((p: any) => p.name === 'Nom' || p.id === 'name') ||
                        targetCol.properties[0] ||
                        ({ id: 'name' } as any);
                      if (Array.isArray(filter.value)) {
                        return filter.value
                          .map((id: string) => {
                            const item = targetCol.items.find((i: any) => i.id === id);
                            return item ? item[nameField.id] || item.name || id : id;
                          })
                          .join(' & ');
                      } else {
                        const item = targetCol.items.find((i: any) => i.id === filter.value);
                        return item ? item[nameField.id] || item.name || filter.value : filter.value;
                      }
                    }
                    if (Array.isArray(filter.value)) {
                      return filter.value.join(' & ');
                    }
                    return filter.value;
                  })()}
                </span>
                <button
                  onClick={() => {
                    if (!canEdit) return;
                    onEditFilter(idx);
                  }}
                  className={cn('hover:bg-violet-500/30 rounded p-0.5', !canEdit && 'opacity-60 pointer-events-none')}
                  title="Modifier le filtre"
                >
                  <Icons.Edit2 size={14} />
                </button>
                <button onClick={() => onRemoveFilter(idx)} className="hover:bg-violet-500/30 rounded p-0.5">
                  <X size={14} />
                </button>
              </motion.div>
            </React.Fragment>
          ))}

          {relationFilter.collectionId === activeCollection && relationFilter.ids.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-neutral-700 dark:text-whiterounded-lg text-sm border border-cyan-500/30"
            >
              <span>Filtre relation : {relationFilter.ids.length} élément(s)</span>
              <button onClick={onClearRelationFilter} className="hover:bg-cyan-500/30 rounded p-0.5">
                <X size={14} />
              </button>
            </motion.div>
          )}

          {currentViewConfig?.groups.map((group: string, idx: number) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-neutral-700 dark:text-white rounded-lg lg:text-sm text-xs border border-cyan-500/30"
            >
              <span>
                Groupé par: {currentCollection?.properties.find((p: any) => p.id === group)?.name}
              </span>
              <button onClick={() => onRemoveGroup(group)} className="hover:bg-cyan-500/30 rounded p-0.5">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </div>
      )}

    </motion.div>
  );
};

export default ViewToolbar;
