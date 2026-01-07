import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, GripHorizontal, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import EditableProperty from '@/components/EditableProperty';

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
}

const KanbanView: React.FC<KanbanViewProps> = ({ collection, items, onEdit, onDelete, onViewDetail, groupBy, hiddenFields = [], onChangeGroupBy, collections = [], onRelationChange, onNavigateToCollection }) => {
  const [draggedItem, setDraggedItem] = useState<any>(null);

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
    // Add "Sans valeur" column for items without a value
    groupedItems['Sans valeur'] = [];
    columnColors['Sans valeur'] = '#6b7280';
    
    // Distribute items into columns
    items.forEach(item => {
      const key = item[groupByProp.id] || 'Sans valeur';
      if (!groupedItems[key]) groupedItems[key] = [];
      groupedItems[key].push(item);
    });
  } else {
    groupedItems['Toutes les données'] = items;
    columnColors['Toutes les données'] = '#8b5cf6';
  }

  const columns = Object.keys(groupedItems);

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
                    draggable
                    onDragStart={() => setDraggedItem(item)}
                    onDragEnd={() => setDraggedItem(null)}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    className={cn(
                      "group cursor-move rounded-lg border border-white/10 bg-gradient-to-br from-neutral-800/50 to-neutral-900/50 p-4 hover:border-white/20 transition-all space-y-3",
                      draggedItem?.id === item.id ? 'opacity-50 border-violet-500/50' : ''
                    )}
                  >
                    {/* Title with Grip */}
                    <div className="flex gap-2 items-start">
                      <GripHorizontal size={14} className="text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                      <button
                        onClick={() => onViewDetail(item)}
                        className="font-medium text-cyan-400 hover:text-cyan-300 hover:underline text-sm flex-1 line-clamp-2 text-left"
                      >
                        {getNameValue(item)}
                      </button>
                    </div>

                    {/* Editable Properties */}
                    <div className="space-y-2">
                      {collection.properties
                        .filter((prop: any) => !hiddenFields.includes(prop.id) && prop.id !== 'name')
                        .map((prop: any) => (
                          <div key={prop.id} className="text-xs">
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
                            />
                          </div>
                        ))}
                    </div>

                    {/* Delete Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => onDelete(item.id)}
                        className="px-2 py-1 rounded text-xs text-red-300 hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        Supprimer
                      </button>
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
