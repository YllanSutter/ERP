import React from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
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
  paddingLeft = 24,
  animate = true,
}) => {
  const RowComponent = animate ? motion.tr : 'tr';
  const motionProps = animate
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
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
          className="hover:bg-white/5 transition-colors border-b border-white/5 cursor-context-menu"
        >
          {displayProperties.map((prop: any, index: number) => (
            <td
              key={prop.id}
              className="px-3 py-2 whitespace-nowrap text-sm text-neutral-300 relative"
              style={index === 0 ? { paddingLeft: `${paddingLeft}px` } : undefined}
            >
              <EditableProperty
                property={prop}
                value={item[prop.id]}
                onChange={(val) => onEdit({ ...item, [prop.id]: val })}
                size="md"
                isNameField={prop.id === 'name' || prop.name === 'Nom'}
                onViewDetail={prop.id === 'name' || prop.name === 'Nom' ? () => onViewDetail(item) : undefined}
                disableNameLink={true}
                collections={collections}
                currentItem={item}
                onRelationChange={onRelationChange}
                onNavigateToCollection={onNavigateToCollection}
                readOnly={!canEdit || !canEditField(prop.id)}
              />
            </td>
          ))}
          {canEdit && (
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
              <div className="flex items-center justify-end gap-3 text-neutral-500">
                <Icons.GripVertical size={16} className="cursor-grab" />
                <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-400">
                  <Icons.Trash2 size={16} />
                </button>
              </div>
            </td>
          )}
        </RowComponent>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onViewDetail(item)}>
          <Icons.Search size={14} className="mr-2" />
          <span>Détails</span>
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
                    onChange={(val) => onEdit({ ...item, [prop.id]: val })}
                    size="sm"
                    collections={collections}
                    currentItem={item}
                    onRelationChange={onRelationChange}
                    onNavigateToCollection={onNavigateToCollection}
                    readOnly={false}
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
