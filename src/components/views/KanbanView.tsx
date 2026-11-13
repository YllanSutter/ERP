import { TotalsSettings } from './TotalsSettings';
import TotalsBar from '@/components/TableView/TotalsBar';
import { useViewTotals } from '@/lib/hooks/useViewTotals';
import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { Ellipsis, FileText, Clock, Info, Link2, Trash2, GripHorizontal, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OptionTags } from '@/components/inputs/OptionTags';
import EditableProperty from '@/components/fields/EditableProperty';
import ItemContextMenu from '@/components/menus/ItemContextMenu';
import { useCanEdit, useCanEditFields, useCanViewFields } from '@/lib/hooks/useCanEdit';
import { getNameValue } from '@/lib/calendarUtils';
import { compareValues } from '@/lib/utils/sortUtils';
import { shouldShowColumn } from '@/lib/utils/columnFilterUtils';
import { useViewGrouping } from './ViewGrouping';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { SettingsPopoverContent, SettingsTabs, SettingsTabContent, SettingsLabel, SettingsFooter } from '@/components/ui/settings-panel';
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

export type KanbanColumnSettings = {
  totalFields?: Record<string, string>;
  totalsPosition?: string;
  showTotals?: boolean;
  visibleFieldIds?: string[] | null;
  sortFieldId?: string | null;
  sortDirection?: 'asc' | 'desc';
};

interface KanbanViewProps {
  collection: any;
  items: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onViewDetail: (item: any) => void;
  groupBy?: string | null;
  totalFields?: Record<string, string>;
  totalsPosition?: string;
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
  totalFields = {},
  totalsPosition = 'none',
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
  const { calculateTotal, formatTotal } = useViewTotals(orderedProperties || collection?.properties || [], collection, collections);
  // Hooks de permissions
  const canEdit = useCanEdit(collection?.id);
  const canEditFieldFn = useCanEditFields(collection?.id);
  const canViewFieldFn = useCanViewFields(collection?.id);
  const sharedGrouping = useViewGrouping(
    items,
    groupBy ? [groupBy] : [],
    orderedProperties || collection.properties,
    collections,
  );

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
  if (groupBy === undefined && !groupByProp && selectProps.length > 0) {
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
    
    const sharedGroups = sharedGrouping.groupedStructure?.rootGroups || [];
    if (sharedGroups.length > 0) {
      sharedGroups.forEach((path) => {
        groupedItems[path] = sharedGrouping.getItemsForGroup(path);
      });
    } else {
      items.forEach(item => {
        const key = item[groupByProp.id];
        if (key && groupedItems[key]) groupedItems[key].push(item);
      });
    }
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
          <Select
            value={groupByProp?.id || '__none'}
            onValueChange={(value) => onUpdateViewConfig ? onUpdateViewConfig({ groupBy: value === '__none' ? null : value }) : onChangeGroupBy?.(value)}
          >
            <SelectTrigger className="w-48"><SelectValue placeholder="Choisir un champ" /></SelectTrigger>
            <SelectContent><SelectItem value="__none">Aucun</SelectItem>{selectProps.map((prop: any) => <SelectItem key={prop.id} value={prop.id}>{prop.name}</SelectItem>)}</SelectContent>
          </Select>
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

          const settings = getColumnSettings(column);
          const position = settings.totalsPosition || totalsPosition;
          const columnTotalFields = settings.totalFields ?? totalFields;
          const renderTotals = (placement: 'top' | 'bottom') => settings.showTotals !== false && sortedColumnItems.length > 0 && allDisplayableProps.some((prop: any) => columnTotalFields[prop.id]) && (position === placement || position === 'both') && (
            <div className="my-2 rounded-lg border border-border" data-kanban-total-position={placement}>
              <TotalsBar displayProperties={allDisplayableProps} items={sortedColumnItems}
                totalFields={columnTotalFields} calculateTotal={calculateTotal} formatTotal={formatTotal}
                variant="inline" inlineMode="plain" />
            </div>
          );
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
              <Popover>
                <PopoverTrigger asChild><Button variant="ghost" size="sm" className="float-right" aria-label={`Totaux de ${column}`}><Icons.Sigma size={14} /></Button></PopoverTrigger>
                <SettingsPopoverContent title={`Totaux · ${column}`} className="max-h-[80vh] overflow-y-auto">
                  <TotalsSettings properties={allDisplayableProps} totalFields={settings.totalFields ?? totalFields} position={position}
                    onChange={(patch) => updateColumnSettings(column, patch)} />
                  <Button variant="ghost" size="sm" onClick={() => updateColumnSettings(column, { totalFields: undefined, totalsPosition: undefined })}>Reprendre les réglages de la vue</Button>
                </SettingsPopoverContent>
              </Popover>
              <h3 className="font-semibold text-neutral-700 dark:text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: columnColors[column] }} />
                  <span>{column}</span>
                </div>
                <span className="text-xs bg-white/10 px-2 py-1 rounded-full">{groupedItems[column].length}</span>
              </h3>
            </div>

            {renderTotals('top')}
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
                    key={item.id}
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
                      draggable={canEdit}
                      onDragStart={canEdit ? () => setDraggedItem(item) : undefined}
                      onDragEnd={canEdit ? () => setDraggedItem(null) : undefined}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={canEdit ? { scale: 1.02 } : {}}
                      className={cn(
                        "group relative min-w-0 rounded-lg border border-black/10 dark:border-white/10 p-3 hover:border-white/20 transition-all space-y-2",
                        "bg-gradient-to-br from-white/80 to-neutral-100/80 dark:from-neutral-800/50 dark:to-neutral-900/50",
                        canEdit && "cursor-move",
                        showFieldsOnHover && "space-y-2 p-3 pb-1",
                        draggedItem?.id === item.id ? 'opacity-50 border-brand-500/50' : ''
                      )}
                    >
                    <div className="flex min-w-0 items-center gap-1.5">
                      {canEdit && <GripHorizontal size={12} className="shrink-0 text-muted-foreground" />}
                      <Button type="button" onClick={() => onViewDetail(item)} variant="ghost"
                        className="h-auto min-w-0 flex-1 justify-start p-0 text-left text-sm font-semibold hover:bg-transparent">
                        <span className="truncate">{getNameValue(item, collection)}</span>
                      </Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" draggable={false} aria-label={`Champs de ${getNameValue(item, collection)}`}
                            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground">
                            <Ellipsis size={14} />
                          </button>
                        </PopoverTrigger>
                        <SettingsPopoverContent align="start" title={getNameValue(item, collection)}>
                          {(() => {
                            const tabs = [
                              { id: 'infos', label: 'Infos', Icon: Info, accepts: (type: string) => !['relation', 'date', 'date_range', 'rich_text'].includes(type) },
                              { id: 'relations', label: 'Relations', Icon: Link2, accepts: (type: string) => type === 'relation' },
                              { id: 'temps', label: 'Temps', Icon: Clock, accepts: (type: string) => ['date', 'date_range'].includes(type) },
                              { id: 'notes', label: 'Notes', Icon: FileText, accepts: (type: string) => type === 'rich_text' },
                            ].map((tab) => ({ ...tab, fields: cardProps.filter((prop: any) => tab.accepts(prop.type)) }))
                              .filter((tab) => tab.fields.length);
                            return tabs.length > 0 ? <SettingsTabs defaultValue={tabs[0].id} label="Champs de la carte"
                              items={tabs.map(({ id, label, Icon }) => ({ id, label, icon: Icon }))}>
                              {tabs.map(({ id, fields }) => <SettingsTabContent scrollable key={id} value={id} className="max-h-[min(50vh,20rem)] divide-y divide-border">
                                {fields.map((prop: any) => <div key={prop.id} className="settings-field-row min-w-0">
                                  <SettingsLabel>{prop.name}</SettingsLabel>
                                  <EditableProperty property={prop} value={item[prop.id]} size="sm"
                                    onChange={(value) => onEdit({ ...item, [prop.id]: value })}
                                    collections={collections} currentItem={item} onRelationChange={onRelationChange}
                                    onNavigateToCollection={onNavigateToCollection} forceRichEditor={prop.type === 'rich_text'}
                                    readOnly={!canEdit || !canEditFieldFn(prop.id)} />
                                </div>)}
                              </SettingsTabContent>)}
                            </SettingsTabs> : <p className="text-xs text-muted-foreground">Aucun champ visible.</p>;
                          })()}
                          <SettingsFooter>
                            <button type="button" onClick={() => onViewDetail(item)} className="text-xs font-medium text-primary hover:underline">Ouvrir la fiche</button>
                          </SettingsFooter>
                        </SettingsPopoverContent>
                      </Popover>
                      {canEdit && <button type="button" draggable={false} aria-label="Supprimer l’élément" title="Supprimer l’élément"
                        onClick={() => onDelete(item.id)}
                        className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
                        <Trash2 size={13} />
                      </button>}
                    </div>
                    <div className={cn("min-w-0 divide-y divide-border overflow-hidden",
                      showFieldsOnHover && "max-h-0 opacity-0 pointer-events-none transition-all duration-200 group-hover:max-h-[420px] group-hover:opacity-100 group-hover:pointer-events-auto focus-within:max-h-[420px] focus-within:opacity-100"
                    )}>
                      {cardProps.map((prop: any) => {
                        const Icon = (Icons as any)[prop.icon] || Icons.Tag;
                        return <div key={prop.id} title={prop.name} className="flex min-w-0 items-center gap-1.5 py-1 text-xs">
                          <Icon size={12} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1 overflow-hidden">
                            {['select', 'multiselect', 'multi_select'].includes(prop.type) ? (
                              <OptionTags options={prop.options || []} value={item[prop.id]} compact borderless />
                            ) : prop.type === 'number' ? (
                              <span className="block truncate tabular-nums">{item[prop.id] == null || item[prop.id] === '' ? '—' : `${prop.numberPrefix || ''}${Number(item[prop.id]).toLocaleString('fr-FR')}${prop.numberSuffix || ''}`}</span>
                            ) : <EditableProperty property={prop} value={item[prop.id]} onChange={() => {}} readOnly
                              size="xs" compactDate richTextPreviewLimit={80} collections={collections} currentItem={item}
                              onNavigateToCollection={onNavigateToCollection}
                              maxVisible={2} />}
                          </div>
                        </div>;
                      })}
                    </div>
                    </motion.div>
                  </ItemContextMenu>
                ))
              )}
            </div>

            {renderTotals('bottom')}
            {canEdit && onShowNewItemModal && groupByProp && column !== 'Toutes les données' && (
              <Button
                type="button"
                onClick={() => onShowNewItemModal(column !== 'Sans valeur' ? { [groupByProp.id]: column } : {})}
                variant="outline"
                size="sm"
                className="mt-2 w-full border-dashed border-white/10 text-neutral-500 hover:border-white/20 hover:bg-white/5 hover:text-neutral-300"
              >
                <Plus size={13} />
                Ajouter
              </Button>
            )}
              </motion.div>
            </ContextMenuTrigger>
            <ContextMenuContent className="min-w-[230px]">
              <ContextMenuLabel>{column}</ContextMenuLabel>
              <ContextMenuSeparator />
              <ContextMenuCheckboxItem checked={settings.showTotals !== false && position !== 'none'}
                onCheckedChange={(checked) => updateColumnSettings(column, {
                  showTotals: Boolean(checked),
                  ...(checked && position === 'none' ? { totalsPosition: 'bottom' } : {}),
                })}>
                Afficher les totaux
              </ContextMenuCheckboxItem>
              <ContextMenuSeparator />

              <ContextMenuSub>
                <ContextMenuSubTrigger>Champs affichés</ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-72 overflow-y-auto">
                  <ContextMenuItem onSelect={() => updateColumnSettings(column, { visibleFieldIds: null })}>
                    Réinitialiser les champs affichés
                  </ContextMenuItem>
                  <ContextMenuSeparator />
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
