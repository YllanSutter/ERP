import React, { useRef } from 'react';
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
  Star,
  Trash,
  Eye
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
  onSetShowViewSettings: (show: boolean) => void;
  onToggleFieldVisibility: (fieldId: string) => void;
  onUpdateViewFieldOrder: (nextOrder: string[]) => void;
  onEditProperty: (property: any) => void;
  onRemoveFilter: (index: number) => void;
  onClearRelationFilter: () => void;
  onRemoveGroup: (property: string) => void;
  onToggleFavoriteView: (viewId: string) => void;
  onManageViewVisibility: (viewId: string) => void;
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
  onSetShowViewSettings,
  onToggleFieldVisibility,
  onUpdateViewFieldOrder,
  onEditProperty,
  onRemoveFilter,
  onClearRelationFilter,
  onRemoveGroup,
  onToggleFavoriteView,
  onManageViewVisibility
}) => {
  const settingsRef = useRef<HTMLDivElement>(null);
  
  // Hook de permission
  const canEdit = useCanEdit(activeCollection);
  const { isAdmin, isEditor, permissions } = useAuth();
  const canViewFieldFn = (fieldId: string) => {
    if (isAdmin || isEditor) return true;
    const perms = permissions || [];
    if (fieldId) {
      const fieldPerm = perms.find(
        (p: any) =>
          (p.field_id || null) === fieldId &&
          (p.collection_id || null) === activeCollection &&
          (p.item_id || null) === null
      );
      if (fieldPerm) return Boolean(fieldPerm.can_read);
    }
    if (activeCollection) {
      const collectionPerm = perms.find(
        (p: any) =>
          (p.collection_id || null) === activeCollection &&
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
  // Sécurise l'accès à l'icône de la collection
  let IconComponent = Icons.Folder;
  if (currentCollection && typeof currentCollection.icon === 'string' && (Icons as any)[currentCollection.icon]) {
    IconComponent = (Icons as any)[currentCollection.icon];
  }

  return (
    <motion.div
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.15 }}
      className="border-b border-black/5 dark:border-white/5bg-neutral-900/30 backdrop-blur px-8 py-4 z-10"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <IconComponent size={18} style={{ color: '#fff' }} />
          <h2 className="text-xl font-bold">{currentCollection?.name || 'Aucune collection'}</h2>
        </div>
        <ShinyButton
          onClick={() => {
            if (!canEdit) return;
            onShowNewItemModal();
          }}
          className={!canEdit ? 'opacity-60 pointer-events-none' : ''}
        >
          <Plus size={16} />
          Nouveau
        </ShinyButton>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {currentViews.map((view: any, i: number) => {
          const isFavorite = favorites.views.includes(view.id);
          return (
            <ContextMenu key={view.id}>
              <ContextMenuTrigger asChild>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * i }}
                  className="relative group"
                >
                  <button
                    onClick={() => {
                      onSetActiveView(view.id);
                      setTimeout(() => {
                        console.log('activeView enregistré en localStorage :', localStorage.getItem('erp_activeView'));
                      }, 100);
                    }}
                    className={cn(
                      'px-4 py-2 pr-9 rounded-lg text-sm font-medium transition-all relative inline-flex items-center duration-300',
                      activeView === view.id
                        ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg'
                        : 'bg-black/5 dark:bg-white/5 text-neutral-400 hover:bg-white/10'
                    )}
                  >
                    {view.type === 'table' && <Table size={14} className="inline mr-1.5" />}
                    {view.type === 'kanban' && <Layout size={14} className="inline mr-1.5" />}
                    {view.type === 'calendar' && <CalendarIcon size={14} className="inline mr-1.5" />}
                    {view.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavoriteView(view.id);
                    }}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-all",
                      isFavorite 
                        ? "text-yellow-500 hover:text-yellow-400" 
                        : "text-neutral-500 hover:text-yellow-500 opacity-0 group-hover:opacity-100"
                    )}
                    title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  >
                    <Star size={14} fill={isFavorite ? "currentColor" : "none"} />
                  </button>
                  {currentViews.length > 1 && activeView === view.id && (
                    <button
                      onClick={() => onDeleteView(view.id)}
                      className="absolute -top-1 -right-1 p-1 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Supprimer la vue"
                    >
                      <X size={12} />
                    </button>
                  )}
                </motion.div>
              </ContextMenuTrigger>
              <ContextMenuContent className="min-w-[200px]">
                <ContextMenuItem
                  onSelect={() => onManageViewVisibility(view.id)}
                  className="gap-2"
                >
                  <Eye size={14} className="text-cyan-400" />
                  <span>Visibilité…</span>
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => onToggleFavoriteView(view.id)}
                  className="gap-2"
                >
                  <Star
                    size={14}
                    className={isFavorite ? 'text-yellow-400' : 'text-neutral-300'}
                    fill={isFavorite ? 'currentColor' : 'none'}
                  />
                  <span>{isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
                </ContextMenuItem>
                {currentViews.length > 1 && <ContextMenuSeparator />}
                {currentViews.length > 1 && (
                  <ContextMenuItem
                    onSelect={() => onDeleteView(view.id)}
                    className="gap-2 text-red-300 focus:bg-red-500/20"
                  >
                    <Trash size={14} />
                    <span>Supprimer la vue</span>
                  </ContextMenuItem>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => canEdit && onShowNewViewModal()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-black/5 dark:bg-white/5 text-neutral-400 hover:bg-white/10 duration-300 transition-all"
          disabled={!canEdit}
        >
          <Plus size={14} className="inline mr-1" />
          Nouvelle vue
        </motion.button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onShowFilterModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/10 dark:bg-white/5 text-neutral-400 rounded-lg hover:bg-white/10 text-sm transition-all duration-300"
        >
          <Filter size={14} />
          Filtrer
        </button>
        <button
          onClick={onShowGroupModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/10 dark:bg-white/5 text-neutral-400 rounded-lg hover:bg-white/10 text-sm transition-all duration-300"
        >
          <Layers size={14} />
          Grouper
        </button>
        <button
          onClick={() => canEdit && onShowNewPropertyModal()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-black/10 dark:bg-white/5 text-neutral-400 rounded-lg hover:bg-white/10 text-sm transition-all duration-300"
          disabled={!canEdit}
        >
          <Plus size={14} />
          Propriété
        </button>

        <div className="relative z-[1000]" ref={settingsRef}>
          <button
            onClick={() => onSetShowViewSettings(!showViewSettings)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black/10 dark:bg-white/5 text-neutral-400 rounded-lg hover:bg-white/10 text-sm transition-all duration-300"
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
                className="absolute top-full mt-2 right-0 w-72 bg-gray-200 dark:bg-neutral-900/95 border border-black/10 dark:border-white/10 rounded-lg shadow-xl backdrop-blur z-[1000] p-4"
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
                  <DraggableList
                    items={viewableProperties}
                    getId={(p) => p.id}
                    onReorder={(next) => {
                      const nextOrder = next.map((p: any) => p.id);
                      onUpdateViewFieldOrder(nextOrder);
                    }}
                    renderItem={(prop: any, { isDragging }) => {
                      const isHidden = currentViewConfig?.hiddenFields?.includes(prop.id);
                      const PropIcon = (Icons as any)[prop.icon] || Icons.Tag;
                      return (
                        <div
                          className={cn(
                            'flex items-center gap-3 text-sm text-neutral-700 dark:text-neutral-300 p-2 transition-colors hover:bg-white/5  border-b border-[#ffffff20]',
                            isDragging && 'border border-cyan-500/60'
                          )}
                        >
                          <div className="text-neutral-500 cursor-grab">
                            <Icons.GripVertical size={16} />
                          </div>
                          <div className="relative flex items-center">
                            <input
                              type="checkbox"
                              checked={!isHidden}
                              onChange={() => onToggleFieldVisibility(prop.id)}
                              className="peer h-4 w-4 appearance-none rounded border-2 border-black/20 dark:border-white/20 bg-background dark:bg-neutral-800 checked:bg-neutral-400  checked:border-transparent transition-all cursor-pointer"
                            />
                            <svg
                              className="absolute left-0.5 top-0.5 h-3 w-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity"
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
                            className="ml-auto text-neutral-500 hover:text-cyan-400 p-1 rounded hover:bg-white/10"
                            title="Modifier la propriété"
                          >
                            <Icons.Edit2 size={14} />
                          </button>
                        </div>
                      );
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {currentViewConfig?.filters.map((filter: any, idx: number) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 text-neutral-700 dark:text-white rounded-lg text-sm border border-violet-500/30"
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
                      <span className="text-neutral-500">{sourceCollection.name} · </span>
                    )}
                    {sourceProp?.name || 'Champ'}{' '}
                  </>
                );
              })()}
              {filter.operator}{' '}
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
                      .join(', ');
                  } else {
                    const item = targetCol.items.find((i: any) => i.id === filter.value);
                    return item ? item[nameField.id] || item.name || filter.value : filter.value;
                  }
                }
                return filter.value;
              })()}
            </span>
            <button onClick={() => onRemoveFilter(idx)} className="hover:bg-violet-500/30 rounded p-0.5">
              <X size={14} />
            </button>
          </motion.div>
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
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-neutral-700 dark:text-white rounded-lg text-sm border border-cyan-500/30"
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

    </motion.div>
  );
};

export default ViewToolbar;
