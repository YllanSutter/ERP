import React from 'react';
import { Eye, Trash2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import EditableProperty from '@/components/fields/EditableProperty';

export interface ItemContextMenuProps {
  item: any;
  children: React.ReactNode;
  onViewDetail: (item: any) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  quickEditProperties?: any[];
  onEdit?: (item: any) => void;
  collections?: any[];
  onRelationChange?: (prop: any, item: any, value: any) => void;
  onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
  canEditField?: (fieldId: string) => boolean;
}

const ItemContextMenu: React.FC<ItemContextMenuProps> = ({
  item,
  children,
  onViewDetail,
  onDelete,
  canEdit,
  quickEditProperties = [],
  onEdit,
  collections = [],
  onRelationChange,
  onNavigateToCollection,
  canEditField,
}) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onViewDetail(item)} className="gap-2">
          <Eye size={14} />
          <span>Détails</span>
        </ContextMenuItem>

        {quickEditProperties.length > 0 && (
          <>
            <ContextMenuSeparator />
            <ContextMenuLabel className="text-xs">Édition rapide</ContextMenuLabel>
            <ContextMenuSeparator />
            {quickEditProperties.map((prop: any) => (
              <ContextMenuItem
                key={prop.id}
                className="flex items-center justify-between gap-4 cursor-default"
                onSelect={(e) => e.preventDefault()}
              >
                <span className="text-xs text-neutral-400">{prop.name}:</span>
                <div className="flex-1 max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                  {onEdit && (
                    <EditableProperty
                      property={prop}
                      value={item[prop.id]}
                      onChange={(val) => onEdit({ ...item, [prop.id]: val })}
                      size="sm"
                      collections={collections}
                      currentItem={item}
                      onRelationChange={onRelationChange}
                      onNavigateToCollection={onNavigateToCollection}
                      readOnly={!canEdit || !canEditField?.(prop.id)}
                    />
                  )}
                </div>
              </ContextMenuItem>
            ))}
          </>
        )}

        {canEdit && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => onDelete(item.id)}
              className="gap-2 text-red-500 focus:bg-red-500/20"
            >
              <Trash2 size={14} />
              <span>Supprimer</span>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default ItemContextMenu;
