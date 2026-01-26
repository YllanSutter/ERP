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
  sortState?: { column: string | null; direction: 'asc' | 'desc' };
  onSort?: (columnId: string) => void;
}

const TableHeader: React.FC<TableHeaderProps> = ({
  visibleProperties,
  onEditProperty,
  onToggleField,
  onDeleteProperty,
  collectionId,
  sortState,
  onSort,
}) => {
  const canEdit = useCanEdit(collectionId);
  // Exclure les propriétés en menu contextuel de l'affichage du header
  const displayProperties = visibleProperties.filter((p: any) => !p.showContextMenu);
  return (
    <thead className="bg-gray-300 dark:bg-black/30 border-b border-black/5 dark:border-white/5">
      <tr>
        {displayProperties.map((prop: any) => {
          const PropIcon = (Icons as any)[prop.icon] || Icons.Tag;
          const isSorted = sortState?.column === prop.id;
          return (
            <ContextMenu key={prop.id}>
              <ContextMenuTrigger asChild>
                <th
                  className={
                    "px-6 py-3 text-left text-xs font-medium text-neutral-600 dark:text-white uppercase tracking-wider border-b border-r border-[#ffffff10] cursor-pointer select-none transition hover:bg-violet-100/30 dark:hover:bg-violet-900/10" +
                    (isSorted ? ' bg-violet-200/40 dark:bg-violet-900/30' : '')
                  }
                  onClick={() => onSort && onSort(prop.id)}
                >
                  <div className="flex items-center gap-2 font-black">
                    <PropIcon size={14} />
                    {prop.name}
                    {isSorted && (
                      <span className="ml-1">
                        {sortState && sortState.direction === 'asc' ? <Icons.ChevronUp size={13} /> : <Icons.ChevronDown size={13} />}
                      </span>
                    )}
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
      </tr>
    </thead>
  );
};

export default TableHeader;
