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
  ContextMenuLabel,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/components/ui/context-menu';

export interface TableHeaderProps {
  visibleProperties: Property[];
  allProperties?: Property[];
  items: any[];
  onEditProperty: (prop: Property) => void;
  onToggleField: (fieldId: string) => void;
  onDeleteProperty: (propId: string) => void;
  onDuplicateProperty?: (propId: string, options?: { copyValues?: boolean }) => void;
  collectionId?: string;
  sortState?: { column: string | null; direction: 'asc' | 'desc' };
  onSort?: (columnId: string) => void;
  enableSelection?: boolean;
  allSelected?: boolean;
  partiallySelected?: boolean;
  onToggleSelectAll?: (checked: boolean) => void;
  enableDragReorder?: boolean;
  totalFields?: Record<string, string>;
  onToggleTotalField?: (fieldId: string, totalType: string | null) => void;
}

const TableHeader: React.FC<TableHeaderProps> = ({
  visibleProperties,
  allProperties,
  items,
  onEditProperty,
  onToggleField,
  onDeleteProperty,
  onDuplicateProperty,
  collectionId,
  sortState,
  onSort,
  enableSelection = false,
  allSelected = false,
  partiallySelected = false,
  onToggleSelectAll,
  enableDragReorder = false,
  totalFields = {},
  onToggleTotalField,
}) => {
  const canEdit = useCanEdit(collectionId);
  // Exclure les propriétés en menu contextuel de l'affichage du header
  const displayProperties = visibleProperties.filter((p: any) => !p.showContextMenu);
  const numberProperties = (allProperties || visibleProperties).filter((p: any) => p.type === 'number');

  // Types de totaux disponibles selon le type de champ
  const getTotalTypesForProperty = (prop: any) => {
    const common = [
      { value: 'count', label: 'Compte' },
      { value: 'unique', label: 'Valeurs uniques' },
    ];
    
    if (prop.type === 'number') {
      return [
        { value: 'sum', label: 'Somme' },
        { value: 'avg', label: 'Moyenne' },
        { value: 'min', label: 'Minimum' },
        { value: 'max', label: 'Maximum' },
        ...common,
      ];
    }
    
    if (prop.type === 'checkbox') {
      return [
        { value: 'count-true', label: 'Nombre cochés' },
        { value: 'count-false', label: 'Nombre décochés' },
        ...common,
      ];
    }
    
    if (prop.type === 'relation') {
      return [
        { value: 'count-linked', label: 'Nombre liés' },
        { value: 'unique', label: 'Éléments uniques' },
        { value: 'count', label: 'Nombre de lignes' },
      ];
    }
    
    return common;
  };

  const collectValues = (propId: string) => {
    const values: string[] = [];
    (items || []).forEach((item: any) => {
      const raw = item?.[propId];
      if (raw === null || raw === undefined || raw === '') return;
      if (Array.isArray(raw)) {
        raw.forEach((val) => {
          if (val === null || val === undefined || val === '') return;
          values.push(String(val));
        });
        return;
      }
      if (typeof raw === 'object') {
        if (raw.url) values.push(String(raw.url));
        else if (raw.value) values.push(String(raw.value));
        else values.push(JSON.stringify(raw));
        return;
      }
      values.push(String(raw));
    });
    return values;
  };

  const copyValues = async (propId: string) => {
    const values = collectValues(propId);
    const payload = values.join('\n');
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
    } catch (e) {
      // fallback
      const el = document.createElement('textarea');
      el.value = payload;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  const openUrls = (propId: string) => {
    const values = collectValues(propId)
      .map((val) => val.trim())
      .filter((val) => val.startsWith('http://') || val.startsWith('https://'));
    for (let i = values.length - 1; i >= 0; i -= 1) {
      const url = values[i];
      window.open(url, '_blank', 'noopener');
    }
  };
  return (
    <thead className="bg-gray-100 dark:bg-black/30 border-b border-black/5 dark:border-white/5">
      <tr>
        {enableDragReorder && (
          <th className="w-8 px-1 py-2 text-center border-b border-r border-[#ffffff10]"></th>
        )}
        {enableSelection && (
          <th className="w-10 px-2 py-2 text-center border-b border-r border-[#ffffff10]">
            <label
              className="inline-flex items-center justify-center cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                className="sr-only"
                aria-label="Sélectionner tout"
              />
              <span className="h-4 w-4 rounded-md border border-black/20 dark:border-white/20 bg-white/80 dark:bg-neutral-800 shadow-sm transition-colors flex items-center justify-center">
                {(allSelected || partiallySelected) && (
                  allSelected ? <Icons.Check size={12} className="text-violet-500" /> : <Icons.Minus size={12} className="text-violet-500" />
                )}
              </span>
            </label>
          </th>
        )}
        {displayProperties.map((prop: any) => {
          const PropIcon = (Icons as any)[prop.icon] || Icons.Tag;
          const isSorted = sortState?.column === prop.id;
          return (
            <ContextMenu key={prop.id}>
              <ContextMenuTrigger asChild>
                <th
                  className={
                    "px-3 py-2 text-left text-[11px] font-medium text-neutral-600 dark:text-white uppercase tracking-wider border-b border-r border-[#ffffff10] cursor-pointer select-none transition hover:bg-violet-100/30 dark:hover:bg-violet-900/10" +
                    (isSorted ? ' bg-violet-200/40 dark:bg-violet-900/30' : '')
                  }
                  onClick={() => onSort && onSort(prop.id)}
                >
                  <div className="flex items-center gap-1.5 font-black leading-tight">
                    <PropIcon size={12} />
                    {prop.name}
                    {isSorted && (
                      <span className="ml-1">
                        {sortState && sortState.direction === 'asc' ? <Icons.ChevronUp size={12} /> : <Icons.ChevronDown size={12} />}
                      </span>
                    )}
                  </div>
                </th>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => copyValues(prop.id)}
                  className="flex items-center gap-2"
                >
                  <Icons.Copy size={14} />
                  <span>Copier</span>
                </ContextMenuItem>
                {prop.type === 'url' && (
                  <ContextMenuItem
                    onClick={() => openUrls(prop.id)}
                    className="flex items-center gap-2"
                  >
                    <Icons.ExternalLink size={14} />
                    <span>Ouvrir URLs</span>
                  </ContextMenuItem>
                )}
                {onToggleTotalField && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuSub>
                      <ContextMenuSubTrigger className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                        <Icons.Sigma size={14} />
                        <span>Total</span>
                        {totalFields[prop.id] && (
                          <Icons.Check size={14} className="ml-auto text-violet-500 dark:text-violet-400" />
                        )}
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        {getTotalTypesForProperty(prop).map((totalType) => (
                          <ContextMenuItem
                            key={totalType.value}
                            onClick={() => {
                              // Si on clique sur le total déjà actif, on le désactive
                              if (totalFields[prop.id] === totalType.value) {
                                onToggleTotalField(prop.id, null);
                              } else {
                                onToggleTotalField(prop.id, totalType.value);
                              }
                            }}
                            className="flex items-center justify-between gap-2 text-neutral-700 dark:text-neutral-200"
                          >
                            <span>{totalType.label}</span>
                            {totalFields[prop.id] === totalType.value && (
                              <Icons.Check size={14} className="text-violet-500 dark:text-violet-400" />
                            )}
                          </ContextMenuItem>
                        ))}
                        {prop.type === 'checkbox' && numberProperties.length > 0 && (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuLabel className="text-xs">Montant payé / restant</ContextMenuLabel>
                            {numberProperties.map((numProp: any) => {
                              const linkedValue = `linked-progress:${numProp.id}`;
                              return (
                                <ContextMenuItem
                                  key={linkedValue}
                                  onClick={() => {
                                    if (totalFields[prop.id] === linkedValue) {
                                      onToggleTotalField(prop.id, null);
                                    } else {
                                      onToggleTotalField(prop.id, linkedValue);
                                    }
                                  }}
                                  className="flex items-center justify-between gap-2 text-neutral-700 dark:text-neutral-200"
                                >
                                  <span>{numProp.name}</span>
                                  {totalFields[prop.id] === linkedValue && (
                                    <Icons.Check size={14} className="text-violet-500 dark:text-violet-400" />
                                  )}
                                </ContextMenuItem>
                              );
                            })}
                          </>
                        )}
                        {totalFields[prop.id] && (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onClick={() => onToggleTotalField(prop.id, null)}
                              className="flex items-center gap-2 text-red-600 dark:text-red-400"
                            >
                              <Icons.X size={14} />
                              <span>Désactiver</span>
                            </ContextMenuItem>
                          </>
                        )}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  </>
                )}
                {canEdit && (
                  <>
                    <ContextMenuSeparator />
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
                    {prop.id !== 'name' && onDuplicateProperty && (
                      <ContextMenuSub>
                        <ContextMenuSubTrigger className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                          <Icons.CopyPlus size={14} />
                          <span>Dupliquer la colonne</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent>
                          <ContextMenuItem
                            onClick={() => onDuplicateProperty(prop.id, { copyValues: true })}
                            className="flex items-center gap-2"
                          >
                            <Icons.Copy size={14} />
                            <span>Avec les valeurs</span>
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => onDuplicateProperty(prop.id, { copyValues: false })}
                            className="flex items-center gap-2"
                          >
                            <Icons.Eraser size={14} />
                            <span>Avec champs vides</span>
                          </ContextMenuItem>
                        </ContextMenuSubContent>
                      </ContextMenuSub>
                    )}
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
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </tr>
    </thead>
  );
};

export default TableHeader;
