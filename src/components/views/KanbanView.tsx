import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { GripHorizontal, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import EditableProperty from '@/components/fields/EditableProperty';
import ItemContextMenu from '@/components/menus/ItemContextMenu';
import { useCanEdit, useCanEditField, useCanViewField } from '@/lib/hooks/useCanEdit';
import { getNameValue } from '@/lib/calendarUtils';
import { compareValues } from '@/lib/utils/sortUtils';
import { shouldShowColumn } from '@/lib/utils/columnFilterUtils';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

type KanbanColumnSettings = {
  visibleFieldIds?: string[];
  sortFieldId?: string | null;
  sortDirection?: 'asc' | 'desc';
};

interface KanbanViewProps {
  collection: any;
  items: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onViewDetail: (item: any) => void;
  groupBy?: string;
  hiddenFields?: string[];
  onChangeGroupBy?: (groupBy: string) => void;
  collections?: any[];
  onRelationChange?: (property: any, item: any, value: any) => void;
  onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
  filters?: any[];
  orderedProperties?: any[];
  columnSettings?: Record<string, Record<string, KanbanColumnSettings>>;
  showFieldsOnHover?: boolean;
  onUpdateViewConfig?: (updates: Record<string, any>) => void;
  onShowNewItemModal?: (prefill?: Record<string, any>) => void;
}

const KanbanView: React.FC<KanbanViewProps> = ({
  collection,
  items,
  onEdit,
  onDelete,
  onViewDetail,
  groupBy,
  hiddenFields = [],
  onChangeGroupBy,
  collections = [],
  onRelationChange,
  onNavigateToCollection,
  filters = [],
  orderedProperties,
  columnSettings = {},
  showFieldsOnHover = false,
  onUpdateViewConfig,
  onShowNewItemModal,
}) => {
  const [draggedItem, setDraggedItem] = useState<any>(null);
  // Hooks de permissions
  const canEdit = useCanEdit(collection?.id);
  const canEditFieldFn = (fieldId: string) => useCanEditField(fieldId, collection?.id);
  const canViewFieldFn = (fieldId: string) => useCanViewField(fieldId, collection?.id);

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        <p>Collection non accessible</p>
      </div>
    );
  }

  // Find available select properties
  const selectProps = collection.properties.filter((p: any) => p.type === 'select');
  
  // Determine groupBy property
  let groupByProp = selectProps.find((p: any) => p.id === groupBy);
  if (!groupByProp && selectProps.length > 0) {
    groupByProp = selectProps[0];
  }

  // Group items
  const groupedItems: Record<string, any[]> = {};
  const columnColors: Record<string, string> = {};
  
  if (groupByProp) {
    // Initialize all options from the select property
    if (groupByProp.options) {
      groupByProp.options.forEach((option: any) => {
        const optValue = typeof option === 'string' ? option : option.value;
        const optColor = typeof option === 'string' ? '#8b5cf6' : (option.color || '#8b5cf6');
        groupedItems[optValue] = [];
        columnColors[optValue] = optColor;
      });
    }
    
    // Distribute items into columns (skip items without value)
    items.forEach(item => {
      const key = item[groupByProp.id];
      if (key && groupedItems[key]) {
        groupedItems[key].push(item);
      }
    });
  } else {
    groupedItems['Toutes les données'] = items;
    columnColors['Toutes les données'] = '#8b5cf6';
  }


  const columns = Object.keys(groupedItems).filter(col => shouldShowColumn(col, filters, groupByProp?.id ?? null));

  const allDisplayableProps = useMemo(
    () =>
      (orderedProperties || collection.properties).filter(
        (p: any) => !p.showContextMenu && canViewFieldFn(p.id)
      ),
    [orderedProperties, collection.properties, canViewFieldFn]
  );

  const defaultVisibleFieldIds = useMemo(
    () =>
      allDisplayableProps
        .filter((p: any) => !hiddenFields.includes(p.id))
        .map((p: any) => p.id),
    [allDisplayableProps, hiddenFields]
  );

  const settingsGroupKey = groupByProp?.id || '__all__';
  const columnSettingsForGroup = columnSettings?.[settingsGroupKey] || {};

  const getColumnSettings = (columnName: string): KanbanColumnSettings =>
    columnSettingsForGroup[columnName] || {};

  const updateColumnSettings = (columnName: string, patch: Partial<KanbanColumnSettings>) => {
    if (!onUpdateViewConfig) return;
    const current = getColumnSettings(columnName);
    const nextForGroup = {
      ...columnSettingsForGroup,
      [columnName]: {
        ...current,
        ...patch,
      },
    };
    onUpdateViewConfig({
      kanbanColumnSettings: {
        ...(columnSettings || {}),
        [settingsGroupKey]: nextForGroup,
      },
    });
  };

  const getSelectedFieldIdsForColumn = (columnName: string) => {
    const preferred = getColumnSettings(columnName).visibleFieldIds;
    const defaultIds = defaultVisibleFieldIds;
    if (!Array.isArray(preferred) || preferred.length === 0) return defaultIds;
    const allowed = new Set(allDisplayableProps.map((p: any) => p.id));
    const filtered = preferred.filter((id) => allowed.has(id));
    const uniqueFiltered = Array.from(new Set(filtered));
    return uniqueFiltered.length > 0 ? uniqueFiltered : defaultIds;
  };

  const sortItemsForColumn = (columnItems: any[], columnName: string) => {
    const { sortFieldId, sortDirection } = getColumnSettings(columnName);
    if (!sortFieldId) return columnItems;

    const extractValue = (item: any) => {
      if (sortFieldId === '__name') return getNameValue(item, collection);
      return item?.[sortFieldId];
    };

    return [...columnItems].sort((a, b) => compareValues(extractValue(a), extractValue(b), sortDirection as 'asc' | 'desc'));
  };


  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (columnName: string) => {
    if (draggedItem && groupByProp) {
      const currentValue = draggedItem[groupByProp.id] || 'Sans valeur';
      // Only update if dropped in a different column
      if (currentValue !== columnName) {
        const newValue = columnName === 'Sans valeur' ? null : columnName;
        const updatedItem = { ...draggedItem, [groupByProp.id]: newValue };
        onEdit(updatedItem);
      }
      setDraggedItem(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with GroupBy Selector */}
      {selectProps.length > 0 && (
        <div className="flex items-center gap-3 px-2">
          <span className="text-sm font-medium text-neutral-400">Grouper par:</span>
          <select
            value={groupByProp?.id || ''}
            onChange={(e) => onChangeGroupBy?.(e.target.value)}
            className="px-3 py-1.5 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-sm text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
          >
            {selectProps.map((prop: any) => (
              <option key={prop.id} value={prop.id}>{prop.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map((column, colIdx) => {
          const selectedFieldIds = getSelectedFieldIdsForColumn(column);
          const selectedProps = allDisplayableProps.filter((prop: any) => selectedFieldIds.includes(prop.id));
          const cardProps = selectedProps;
          const sortedColumnItems = sortItemsForColumn(groupedItems[column], column);
          const columnSortField = getColumnSettings(column).sortFieldId || null;
          const columnSortDirection = getColumnSettings(column).sortDirection || 'asc';

          return (
          <ContextMenu key={column}>
            <ContextMenuTrigger asChild>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: colIdx * 0.1 }}
                className="flex-shrink-0 w-80"
              >
            {/* Column Header */}
            <div 
              className="mb-4 rounded-lg border p-4"
              style={{
                borderColor: `${columnColors[column]}40`,
                background: `linear-gradient(to bottom right, ${columnColors[column]}30, ${columnColors[column]}05)`
              }}
            >
              <h3 className="font-semibold text-neutral-700 dark:text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: columnColors[column] }} />
                  <span>{column}</span>
                </div>
                <span className="text-xs bg-white/10 px-2 py-1 rounded-full">{groupedItems[column].length}</span>
              </h3>
            </div>

            {/* Cards Container */}
            <div 
              className="space-y-3 max-h-[450px] rounded-lg border border-black/5 dark:border-white/5 bg-black/10 dark:bg-white/10 p-4 overflow-y-auto"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column)}
            >
              {sortedColumnItems.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
                  Aucun élément
                </div>
              ) : (
                sortedColumnItems.map((item, idx) => (
                  <ItemContextMenu
                    item={item}
                    onViewDetail={onViewDetail}
                    onDelete={onDelete}
                    canEdit={canEdit}
                    quickEditProperties={(orderedProperties || collection.properties).filter((p: any) => p.showContextMenu && canEditFieldFn(p.id))}
                    onEdit={onEdit}
                    collections={collections}
                    onRelationChange={onRelationChange}
                    onNavigateToCollection={onNavigateToCollection}
                    canEditField={canEditFieldFn}
                  >
                    <motion.div
                      key={item.id}
                      draggable={canEdit}
                      onDragStart={canEdit ? () => setDraggedItem(item) : undefined}
                      onDragEnd={canEdit ? () => setDraggedItem(null) : undefined}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={canEdit ? { scale: 1.02 } : {}}
                      className={cn(
                        "group rounded-lg border border-black/10 dark:border-white/10 p-4 hover:border-white/20 transition-all space-y-3",
                        "bg-gradient-to-br from-white/80 to-neutral-100/80 dark:from-neutral-800/50 dark:to-neutral-900/50",
                        canEdit && "cursor-move",
                        showFieldsOnHover && "space-y-2 p-3 pb-1",
                        draggedItem?.id === item.id ? 'opacity-50 border-violet-500/50' : ''
                      )}
                    >
                    {/* Title with Grip */}
                    <div className="flex gap-2 items-center">
                      {canEdit && <GripHorizontal size={14} className="text-neutral-600 transition-opacity flex-shrink-0" />}
                      <button
                        onClick={() => onViewDetail(item)}
                        className="font-medium dark:text-white hover:text-cyan-300 text-sm flex-1 line-clamp-2 text-left"
                      >
                        {getNameValue(item, collection)}
                      </button>
                    </div>

                    {/* Editable Properties */}
                    <div
                      className={cn(
                        "space-y-2",
                        showFieldsOnHover &&
                          "max-h-0 opacity-0 overflow-hidden pointer-events-none transition-all duration-200 group-hover:max-h-[420px] group-hover:opacity-100 group-hover:pointer-events-auto"
                      )}
                    >
                      {cardProps.map((prop: any) => (
                        <div key={prop.id} className="text-xs flex justify-between items-center">
                          <span className="text-neutral-500 block mb-1 justify-between">{prop.name}:</span>
                          <div className="text-right">
                            <EditableProperty
                              property={prop}
                              value={item[prop.id]}
                              onChange={(val) => {
                                const updated = { ...item, [prop.id]: val };
                                onEdit(updated);
                              }}
                              size="sm"
                              collections={collections}
                              currentItem={item}
                              onRelationChange={onRelationChange}
                              onNavigateToCollection={onNavigateToCollection}
                              readOnly={!canEdit || !canEditFieldFn(prop.id)}
                              maxVisible={prop.type === 'multi_select' ? 1 : undefined}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 pt-2 absolute -top-7 left-1">
                      <button
                        onClick={() => onViewDetail(item)}
                        className="px-2 py-0.5 rounded text-xs text-white dark:text-white bg-blue-800/50 hover:bg-blue-800 transition-all duration-300 opacity-0 group-hover:opacity-100"
                      >
                        Éditer
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => onDelete(item.id)}
                          className="px-2 py-0.5 rounded text-xs text-white bg-red-800/50 hover:bg-red-800 transition-all duration-300 opacity-0 group-hover:opacity-100"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                    </motion.div>
                  </ItemContextMenu>
                ))
              )}
            </div>

            {canEdit && onShowNewItemModal && groupByProp && column !== 'Toutes les données' && (
              <button
                type="button"
                onClick={() => onShowNewItemModal(column !== 'Sans valeur' ? { [groupByProp.id]: column } : {})}
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-white/10 text-xs text-neutral-500 hover:text-neutral-300 hover:border-white/20 hover:bg-white/5 transition-colors"
              >
                <Plus size={13} />
                Ajouter
              </button>
            )}
              </motion.div>
            </ContextMenuTrigger>
            <ContextMenuContent className="min-w-[230px]">
              <ContextMenuLabel>{column}</ContextMenuLabel>
              <ContextMenuSeparator />

              <ContextMenuSub>
                <ContextMenuSubTrigger>Champs affichés</ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-72 overflow-y-auto">
                  {allDisplayableProps.map((prop: any) => {
                    const isChecked = selectedFieldIds.includes(prop.id);
                    return (
                      <ContextMenuCheckboxItem
                        key={prop.id}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          const shouldCheck = Boolean(checked);
                          if (!shouldCheck && selectedFieldIds.length <= 1) return;
                          const next = shouldCheck
                            ? Array.from(new Set([...selectedFieldIds, prop.id]))
                            : selectedFieldIds.filter((id: string) => id !== prop.id);
                          updateColumnSettings(column, { visibleFieldIds: next });
                        }}
                      >
                        {prop.name}
                      </ContextMenuCheckboxItem>
                    );
                  })}
                </ContextMenuSubContent>
              </ContextMenuSub>

              <ContextMenuSub>
                <ContextMenuSubTrigger>Trier par</ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-72 overflow-y-auto">
                  <ContextMenuRadioGroup
                    value={columnSortField || '__none'}
                    onValueChange={(value) =>
                      updateColumnSettings(column, { sortFieldId: value === '__none' ? null : value })
                    }
                  >
                    <ContextMenuRadioItem value="__none">Aucun</ContextMenuRadioItem>
                    <ContextMenuRadioItem value="__name">Nom</ContextMenuRadioItem>
                    {allDisplayableProps.map((prop: any) => (
                      <ContextMenuRadioItem key={prop.id} value={prop.id}>
                        {prop.name}
                      </ContextMenuRadioItem>
                    ))}
                  </ContextMenuRadioGroup>
                  <ContextMenuSeparator />
                  <ContextMenuLabel>Ordre</ContextMenuLabel>
                  <ContextMenuRadioGroup
                    value={columnSortDirection}
                    onValueChange={(value) =>
                      updateColumnSettings(column, { sortDirection: value === 'desc' ? 'desc' : 'asc' })
                    }
                  >
                    <ContextMenuRadioItem value="asc">Croissant</ContextMenuRadioItem>
                    <ContextMenuRadioItem value="desc">Décroissant</ContextMenuRadioItem>
                  </ContextMenuRadioGroup>
                </ContextMenuSubContent>
              </ContextMenuSub>
            </ContextMenuContent>
          </ContextMenu>
        )})}
      </div>
    </div>
  );
};

export default KanbanView;
