import React from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Check, GripVertical } from 'lucide-react';
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
  isFavorite?: boolean;
  visibleProperties: Property[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onToggleFavoriteItem?: (itemId: string) => void;
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
  enableDragReorder?: boolean;
  onDragStart?: (itemId: string, e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (itemId: string) => void;
  onDragOver?: (e: React.DragEvent<HTMLTableRowElement>) => void;
  onDrop?: (itemId: string, e: React.DragEvent<HTMLTableRowElement>) => void;
  onDragEnd?: () => void;
  onRowDragStart?: React.DragEventHandler<HTMLTableRowElement>;
  onRowDragEnter?: React.DragEventHandler<HTMLTableRowElement>;
  onRowDragOver?: React.DragEventHandler<HTMLTableRowElement>;
  onRowDrop?: React.DragEventHandler<HTMLTableRowElement>;
  onRowDragEnd?: React.DragEventHandler<HTMLTableRowElement>;
}

const TableItemRow: React.FC<TableItemRowProps> = ({
  item,
  isFavorite = false,
  visibleProperties,
  onEdit,
  onDelete,
  onToggleFavoriteItem,
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
  enableDragReorder = false,
  onDragStart,
  onDragEnter,
  onDragOver,
  onDrop,
  onDragEnd,
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

  const handleRowDragStart = (e: React.DragEvent<HTMLTableRowElement>) => {
    // Empêcher le drag si on vient d'un input ou élement éditable
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      e.preventDefault();
      return;
    }
    onRowDragStart?.(e);
  };

  const rowDragProps = !animate
    ? {
        draggable: draggableRow,
        onDragStart: handleRowDragStart,
        onDragEnter: onRowDragEnter,
        onDragOver: onRowDragOver,
        onDrop: onRowDrop,
        onDragEnd: onRowDragEnd,
      }
    : {};

  const handleDragHandleStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDragStart?.(item.id, e);
  };

  const rowDropProps = !animate
    ? {
        onDragEnter: () => onDragEnter?.(item.id),
        onDragOver: onDragOver,
        onDrop: (e: React.DragEvent<HTMLTableRowElement>) => onDrop?.(item.id, e),
        onDragEnd: onDragEnd,
      }
    : {};

  const resolveDisplayValueForLinkedColumn = (prop: any) => {
    if (!prop?.isRelationLinkedColumn || !prop?.sourceRelationPropertyId || !prop?.sourceDisplayFieldId) {
      return item[prop.id];
    }

    const sourceRelationValue = item[prop.sourceRelationPropertyId];
    const relatedIds = Array.isArray(sourceRelationValue)
      ? sourceRelationValue
      : sourceRelationValue
        ? [sourceRelationValue]
        : [];

    if (!relatedIds.length) return null;

    const targetCollection = collections.find((c: any) => c.id === prop.sourceTargetCollectionId)
      || collections.find((c: any) => c.id === (collection?.properties || []).find((p: any) => p.id === prop.sourceRelationPropertyId)?.relation?.targetCollectionId);
    const targetItems = targetCollection?.items || [];

    const rawValues = relatedIds
      .map((id: string) => targetItems.find((it: any) => it.id === id)?.[prop.sourceDisplayFieldId])
      .filter((v: any) => v !== undefined && v !== null && v !== '');

    if (!rawValues.length) return null;

    if (prop.type === 'multi_select') {
      const flattened = rawValues.flatMap((v: any) => Array.isArray(v) ? v : [v]);
      return Array.from(new Set(flattened));
    }

    if (prop.type === 'checkbox') {
      return rawValues.some(Boolean);
    }

    return rawValues[0];
  };

  // Propriétés à afficher dans le menu contextuel
  const contextMenuProperties = visibleProperties.filter((p: any) => !p.isRelationLinkedColumn && p.showContextMenu && canEditField(p.id));

  // Propriétés à afficher dans la vue (excluant celles du menu contextuel)
  const displayProperties = visibleProperties.filter((p: any) => !p.showContextMenu);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <RowComponent
          {...motionProps}
          {...(rowDropProps as any)}
          className={`hover:bg-white/5 transition-colors border-b border-black/5 dark:border-white/5 cursor-context-menu leading-tight ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'outline outline-1 outline-violet-500/60' : ''}`}
        >
          {enableDragReorder && (
            <td className="px-1 py-1 text-center align-middle w-8">
              <div
                draggable
                onDragStart={handleDragHandleStart}
                className="inline-flex items-center justify-center cursor-grab active:cursor-grabbing hover:text-violet-400 transition-colors"
                title="Glisser pour réorganiser"
              >
                <GripVertical size={14} />
              </div>
            </td>
          )}
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
          {displayProperties.map((prop: any) => {
            const isLinkedRelationColumn = Boolean(prop?.isRelationLinkedColumn && prop?.sourceRelationPropertyId);
            const effectiveProperty = prop;
            const effectiveValue = resolveDisplayValueForLinkedColumn(prop);
            const permissionFieldId = isLinkedRelationColumn ? prop.sourceRelationPropertyId : effectiveProperty.id;
            const canEditEffectiveField = canEditField(permissionFieldId);

            return (
            <td
              key={prop.id}
              className="px-4 py-1 whitespace-nowrap text-xs text-neutral-700 dark:text-neutral-300 relative user-select-auto"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <EditableProperty
                property={effectiveProperty}
                value={effectiveValue}
                onChange={(val) => {
                  if (isLinkedRelationColumn) return;
                  // Pas de recalcul côté client - le serveur le fera
                  const updated = { ...item, [effectiveProperty.id]: val };
                  onEdit(updated);
                }}
                size="md"
                isNameField={effectiveProperty.id === 'name' || effectiveProperty.name === 'Nom'}
                onViewDetail={effectiveProperty.id === 'name' || effectiveProperty.name === 'Nom' ? () => onViewDetail(item) : undefined}
                disableNameLink={true}
                collections={collections}
                currentItem={item}
                onRelationChange={onRelationChange}
                onNavigateToCollection={onNavigateToCollection}
                readOnly={isLinkedRelationColumn || !canEdit || !canEditEffectiveField}
                collection={collection}
              />
            </td>
            );
          })}
         
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
              <div className="px-6 py-2 whitespace-nowrap text-right text-sm">
                <div className="flex items-center justify-end gap-3 text-neutral-500">
                  <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-400">
                    <Icons.Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </ContextMenuItem>
        {onToggleFavoriteItem && (
          <ContextMenuItem onClick={() => onToggleFavoriteItem(item.id)}>
            <Icons.Star size={14} className={`mr-2 ${isFavorite ? 'text-yellow-500 fill-yellow-500' : ''}`} />
            <span>{isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>
          </ContextMenuItem>
        )}
        {contextMenuProperties.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuLabel className="text-xs">Édition rapide</ContextMenuLabel>
            <ContextMenuSeparator />
            {contextMenuProperties.map((prop: any) => {
              const effectiveProperty = prop;
              const effectiveValue = item[prop.id];

              return (
                <ContextMenuItem key={prop.id} className="flex items-center justify-between gap-4 cursor-default" onSelect={(e) => e.preventDefault()}>
                  <span className="text-xs text-neutral-400">{prop.name}:</span>
                  <div className="flex-1 max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                    <EditableProperty
                      property={effectiveProperty}
                      value={effectiveValue}
                      onChange={(val) => {
                        // Pas de recalcul côté client - le serveur le fera
                        const updated = { ...item, [effectiveProperty.id]: val };
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
              );
            })}
            
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default React.memo(TableItemRow);
