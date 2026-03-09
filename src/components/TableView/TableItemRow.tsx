import React from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Check } from 'lucide-react';
import EditableProperty from '@/components/fields/EditableProperty';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '@/components/ui/context-menu';
import { Item, Property, Collection } from '@/lib/types';

export interface TableItemRowProps {
  item: Item;
  visibleProperties: Property[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onViewDetail: (item: Item) => void;
  collections: Collection[];
  onRelationChange: (prop: Property, item: Item, value: any) => void;
  onNavigateToCollection: (collectionId: string, linkedIds?: string[]) => void;
  canEdit: boolean;
  canEditField: (fieldId: string) => boolean;
  paddingLeft?: number;
  animate?: boolean;
  collection?: any;
  enableSelection?: boolean;
  isSelected?: boolean;
  onSelectionChange?: (itemId: string, checked: boolean) => void;
  draggableRow?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onRowDragStart?: React.DragEventHandler<HTMLTableRowElement>;
  onRowDragEnter?: React.DragEventHandler<HTMLTableRowElement>;
  onRowDragOver?: React.DragEventHandler<HTMLTableRowElement>;
  onRowDrop?: React.DragEventHandler<HTMLTableRowElement>;
  onRowDragEnd?: React.DragEventHandler<HTMLTableRowElement>;
}

const TableItemRow: React.FC<TableItemRowProps> = ({
  item,
  visibleProperties,
  onEdit,
  onDelete,
  onViewDetail,
  collections,
  onRelationChange,
  onNavigateToCollection,
  canEdit,
  canEditField,
  collection,
  paddingLeft = 16,
  animate = true,
  enableSelection = false,
  isSelected = false,
  onSelectionChange,
  draggableRow = false,
  isDragging = false,
  isDragOver = false,
  onRowDragStart,
  onRowDragEnter,
  onRowDragOver,
  onRowDrop,
  onRowDragEnd,
}) => {
  const RowComponent = animate ? motion.tr : 'tr';
  const motionProps = animate
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
      }
    : {};

  const rowDragProps = !animate
    ? {
        draggable: draggableRow,
        onDragStart: onRowDragStart,
        onDragEnter: onRowDragEnter,
        onDragOver: onRowDragOver,
        onDrop: onRowDrop,
        onDragEnd: onRowDragEnd,
      }
    : {};

  // Propriétés à afficher dans le menu contextuel
  const contextMenuProperties = visibleProperties.filter((p: any) => p.showContextMenu && canEditField(p.id));

  // Propriétés à afficher dans la vue (excluant celles du menu contextuel)
  const displayProperties = visibleProperties.filter((p: any) => !p.showContextMenu);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <RowComponent
          {...motionProps}
          {...(rowDragProps as any)}
          className={`hover:bg-white/5 transition-colors border-b border-black/5 dark:border-white/5 cursor-context-menu leading-tight ${draggableRow ? 'cursor-move' : ''} ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'outline outline-1 outline-violet-500/60' : ''}`}
        >
          {enableSelection && (
            <td className="px-2 py-1 text-center align-middle">
              <label
                className="inline-flex items-center justify-center cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onSelectionChange?.(item.id, e.target.checked)}
                  className="sr-only peer"
                  aria-label={`Sélectionner ${item.name || item.id}`}
                />
                <span className="h-4 w-4 rounded-md border border-black/20 dark:border-white/20 bg-white/80 dark:bg-neutral-800 shadow-sm transition-colors peer-checked:bg-violet-500 peer-checked:border-violet-500 flex items-center justify-center">
                  {isSelected && <Check size={12} className="text-white" />}
                </span>
              </label>
            </td>
          )}
          {displayProperties.map((prop: any, index: number) => (
            <td
              key={prop.id}
              className="px-2 py-1 whitespace-nowrap text-xs text-neutral-700 dark:text-neutral-300 relative"
              style={index === 0 ? { paddingLeft: `${paddingLeft}px` } : undefined}
            >
              <EditableProperty
                property={prop}
                value={item[prop.id]}
                onChange={(val) => {
                  // Pas de recalcul côté client - le serveur le fera
                  const updated = { ...item, [prop.id]: val };
                  onEdit(updated);
                }}
                size="md"
                isNameField={prop.id === 'name' || prop.name === 'Nom'}
                onViewDetail={prop.id === 'name' || prop.name === 'Nom' ? () => onViewDetail(item) : undefined}
                disableNameLink={true}
                collections={collections}
                currentItem={item}
                onRelationChange={onRelationChange}
                onNavigateToCollection={onNavigateToCollection}
                readOnly={!canEdit || !canEditField(prop.id)}
                collection={collection}
              />
            </td>
          ))}
         
        </RowComponent>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem >
          <div className="flex justify-between w-full">
            <div className="left flex items-center" onClick={() => onViewDetail(item)}>
              <Icons.Search size={14} className="mr-2" />
              <span>Détails</span>
            </div>
            {canEdit && (
              <div className="px-6 py-4 whitespace-nowrap text-right text-sm">
                <div className="flex items-center justify-end gap-3 text-neutral-500">
                  <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-400">
                    <Icons.Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </ContextMenuItem>
        {contextMenuProperties.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuLabel className="text-xs">Édition rapide</ContextMenuLabel>
            <ContextMenuSeparator />
            {contextMenuProperties.map((prop: any) => (
              <ContextMenuItem key={prop.id} className="flex items-center justify-between gap-4 cursor-default" onSelect={(e) => e.preventDefault()}>
                <span className="text-xs text-neutral-400">{prop.name}:</span>
                <div className="flex-1 max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                  <EditableProperty
                    property={prop}
                    value={item[prop.id]}
                    onChange={(val) => {
                      // Pas de recalcul côté client - le serveur le fera
                      const updated = { ...item, [prop.id]: val };
                      onEdit(updated);
                    }}
                    size="sm"
                    collections={collections}
                    currentItem={item}
                    onRelationChange={onRelationChange}
                    onNavigateToCollection={onNavigateToCollection}
                    readOnly={false}
                    collection={collection}
                  />
                </div>
                
              </ContextMenuItem>
              
            ))}
            
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default React.memo(TableItemRow);
