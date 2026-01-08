import React from 'react';
import * as Icons from 'lucide-react';
import { Property } from '@/lib/types';
import { useCanEdit } from '@/lib/hooks/useCanEdit';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';

export interface TableHeaderProps {
  visibleProperties: Property[];
  onEditProperty: (prop: Property) => void;
  onToggleField: (fieldId: string) => void;
  onDeleteProperty: (propId: string) => void;
  collectionId?: string;
}

const TableHeader: React.FC<TableHeaderProps> = ({
  visibleProperties,
  onEditProperty,
  onToggleField,
  onDeleteProperty,
  collectionId,
}) => {
  const canEdit = useCanEdit(collectionId);
  return (
    <thead className="bg-neutral-900/60 border-b border-white/5">
      <tr>
        {visibleProperties.map((prop: any) => {
          const PropIcon = (Icons as any)[prop.icon] || Icons.Tag;
          return (
            <ContextMenu key={prop.id}>
              <ContextMenuTrigger asChild>
                <th
                  style={{ borderBottomColor: `${prop.color || '#fff'}50` }}
                  className="px-6 py-1 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider border-b border-r border-[#ffffff10] cursor-context-menu"
                >
                  <div className="flex items-center gap-2 font-black">
                    <PropIcon size={14} />
                    {prop.name}
                  </div>
                </th>
              </ContextMenuTrigger>
              {canEdit && (
                <ContextMenuContent>
                  <ContextMenuItem
                    onClick={() => onEditProperty(prop)}
                    className="flex items-center gap-2"
                  >
                    <Icons.Edit2 size={14} />
                    <span>Modifier</span>
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => onToggleField(prop.id)}
                    className="flex items-center gap-2"
                  >
                    <Icons.EyeOff size={14} />
                    <span>Masquer la colonne</span>
                  </ContextMenuItem>
                  {prop.id !== 'name' && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onClick={() => onDeleteProperty(prop.id)}
                        className="flex items-center gap-2 text-red-500 focus:bg-red-500/10"
                      >
                        <Icons.Trash2 size={14} />
                        <span>Supprimer</span>
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              )}
            </ContextMenu>
          );
        })}
        {canEdit && (
          <th className="px-6 py-3 text-right text-xs font-medium text-neutral-400 uppercase">
            Actions
          </th>
        )}
      </tr>
    </thead>
  );
};

export default TableHeader;
