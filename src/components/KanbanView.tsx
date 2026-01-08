import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, GripHorizontal, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EditableProperty from '@/components/EditableProperty';
import { useCanEdit, useCanEditField, useCanViewField } from '@/lib/hooks/useCanEdit';

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
}

const KanbanView: React.FC<KanbanViewProps> = ({ collection, items, onEdit, onDelete, onViewDetail, groupBy, hiddenFields = [], onChangeGroupBy, collections = [], onRelationChange, onNavigateToCollection, filters = [], orderedProperties }) => {
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

  // Fonction pour vérifier si une valeur de colonne doit être affichée selon les filtres
  const shouldShowColumn = (columnValue: string) => {
    if (!groupByProp || filters.length === 0) return true;
    
    // Vérifier s'il y a des filtres sur le champ de groupement
    const filtersOnGroupBy = filters.filter(f => f.property === groupByProp.id);
    if (filtersOnGroupBy.length === 0) return true;
    
    // Séparer les filtres par type
    const equalsFilters = filtersOnGroupBy.filter(f => f.operator === 'equals');
    const notEqualsFilters = filtersOnGroupBy.filter(f => f.operator === 'not_equals');
    const otherFilters = filtersOnGroupBy.filter(f => f.operator !== 'equals' && f.operator !== 'not_equals');
    
    // Pour les filtres "equals", la colonne doit correspondre à AU MOINS UN
    if (equalsFilters.length > 0) {
      const matchesEquals = equalsFilters.some(f => columnValue === f.value);
      if (!matchesEquals) return false;
    }
    
    // Pour les filtres "not_equals", la colonne NE doit correspondre à AUCUN
    if (notEqualsFilters.length > 0) {
      const matchesNotEquals = notEqualsFilters.some(f => columnValue === f.value);
      if (matchesNotEquals) return false;
    }
    
    // Pour les autres filtres
    for (const filter of otherFilters) {
      const filterValue = filter.value;
      
      if (filter.operator === 'contains') {
        if (!columnValue?.toLowerCase().includes(filterValue?.toLowerCase())) return false;
      } else if (filter.operator === 'not_contains') {
        if (columnValue?.toLowerCase().includes(filterValue?.toLowerCase())) return false;
      } else if (filter.operator === 'is_empty') {
        if (columnValue !== 'Sans valeur' && columnValue !== null && columnValue !== '') return false;
      } else if (filter.operator === 'is_not_empty') {
        if (columnValue === 'Sans valeur' || columnValue === null || columnValue === '') return false;
      }
    }
    
    return true;
  };

  const columns = Object.keys(groupedItems).filter(col => shouldShowColumn(col));

  const getNameValue = (item: any) => {
    const nameField = collection.properties.find((p: any) => p.name === 'Nom' || p.id === 'name');
    return nameField ? item[nameField.id] : item.name || 'Sans titre';
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
            className="px-3 py-1.5 bg-neutral-800/50 border border-white/10 rounded-lg text-sm text-white focus:border-violet-500 focus:outline-none"
          >
            {selectProps.map((prop: any) => (
              <option key={prop.id} value={prop.id}>{prop.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map((column, colIdx) => (
          <motion.div
            key={column}
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
              <h3 className="font-semibold text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: columnColors[column] }} />
                  <span>{column}</span>
                </div>
                <span className="text-xs bg-white/10 px-2 py-1 rounded-full">{groupedItems[column].length}</span>
              </h3>
            </div>

            {/* Cards Container */}
            <div 
              className="space-y-3 min-h-[400px] rounded-lg border border-white/5 bg-white/[0.02] p-4"
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column)}
            >
              {groupedItems[column].length === 0 ? (
                <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
                  Aucun élément
                </div>
              ) : (
                groupedItems[column].map((item, idx) => (
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
                      "group rounded-lg border border-white/10 bg-gradient-to-br from-neutral-800/50 to-neutral-900/50 p-4 hover:border-white/20 transition-all space-y-3",
                      canEdit && "cursor-move",
                      draggedItem?.id === item.id ? 'opacity-50 border-violet-500/50' : ''
                    )}
                  >
                    {/* Title with Grip */}
                    <div className="flex gap-2 items-center">
                      {canEdit && <GripHorizontal size={14} className="text-neutral-600 transition-opacity flex-shrink-0" />}
                      {(() => {
                        const firstProp = (orderedProperties || collection.properties).find((p: any) => 
                          !hiddenFields.includes(p.id) && canViewFieldFn(p.id)
                        );
                        if (!firstProp) return (
                          <button
                            onClick={() => onViewDetail(item)}
                            className="font-medium text-cyan-400 hover:text-cyan-300 hover:underline text-sm flex-1 line-clamp-2 text-left"
                          >
                            {getNameValue(item)}
                          </button>
                        );
                        return (
                          <div className="flex-1 flex items-center gap-2">
                            <span className="text-neutral-500 text-xs">{firstProp.name}:</span>
                            <div className="flex-1">
                              <EditableProperty
                                property={firstProp}
                                value={item[firstProp.id]}
                                onChange={(val) => onEdit({...item, [firstProp.id]: val})}
                                size="sm"
                                collections={collections}
                                currentItem={item}
                                onRelationChange={onRelationChange}
                                onNavigateToCollection={onNavigateToCollection}
                                readOnly={!canEdit || !canEditFieldFn(firstProp.id)}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Editable Properties */}
                    <div className="space-y-2">
                      {(orderedProperties || collection.properties)
                        .slice(1)
                        .filter((prop: any) => 
                          !hiddenFields.includes(prop.id) && 
                          canViewFieldFn(prop.id)
                        )
                        .map((prop: any) => (
                          <div key={prop.id} className="text-xs flex justify-between items-center">
                            <span className="text-neutral-500 block mb-1">{prop.name}:</span>
                            <EditableProperty
                              property={prop}
                              value={item[prop.id]}
                              onChange={(val) => onEdit({...item, [prop.id]: val})}
                              size="sm"
                              collections={collections}
                              currentItem={item}
                              onRelationChange={onRelationChange}
                              onNavigateToCollection={onNavigateToCollection}
                              readOnly={!canEdit || !canEditFieldFn(prop.id)}
                            />
                          </div>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 pt-2 absolute -top-7 left-1">
                      <button
                        onClick={() => onViewDetail(item)}
                        className="px-2 py-0.5 rounded text-xs text-white bg-blue-500/20 hover:bg-blue-800 transition-all duration-300 opacity-0 group-hover:opacity-100"
                      >
                        Éditer
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => onDelete(item.id)}
                          className="px-2 py-0.5 rounded text-xs text-white bg-red-500/20 hover:bg-red-800 transition-all duration-300 opacity-0 group-hover:opacity-100"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default KanbanView;
