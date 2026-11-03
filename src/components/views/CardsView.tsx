import { buildGroupPrefill } from '@/lib/utils/groupPrefillUtils';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Zap } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import ViewShell from './ViewShell';
import ViewGrouping from './ViewGrouping';
import CardsGrid from './CardsGrid';
import type { TableViewProps } from '@/lib/types';
import { useCanEdit } from '@/lib/hooks/useCanEdit';
import { useViewPagination } from '@/lib/hooks/useViewPagination';
import type { FieldGroup } from '@/lib/types';
import { BulkSelectionToolbar } from './BulkSelectionToolbar';
import { ViewTotals } from './ViewTotals';

type CardsViewProps = Omit<TableViewProps, 'displayAsCards'> & {
  cardStyle?: 'default' | 'steamFullArt';
  cardDensity?: 'compact' | 'comfortable' | 'spacious';
  cardIconFieldId?: string | null;
  cardColorFieldId?: string | null;
  fieldGroups?: FieldGroup[];
  cardGroupPlacements?: Record<string, string>;
};

const CardsView: React.FC<CardsViewProps> = ({
  collection,
  items,
  orderedProperties,
  hiddenFields,
  collections,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkUpdate,
  onBulkImportItad,
  onGroupContextChange,
  onReorderItems,
  onViewDetail,
  onRelationChange,
  onNavigateToCollection,
  groups = [],
  onShowNewItemModal,
  onQuickCreateItem,
  initialExpandedGroups,
  onExpandedGroupsChange,
  groupDisplayMode = 'accordion',
  groupDisplayModes = {},
  groupDisplayColumnCount = 3,
  groupDisplayColumnCounts = {},
  cardStyle = 'default',
  cardDensity = 'comfortable',
  cardIconFieldId,
  cardColorFieldId,
  fieldGroups = [],
  cardGroupPlacements = {},
  cardColumns = 'auto',
  totalFields = {},
}) => {
  const lastGroupContext = useRef('');
  const groupCallbackRef = useRef(onGroupContextChange);
  useEffect(() => { groupCallbackRef.current = onGroupContextChange; }, [onGroupContextChange]);
  const canEdit = useCanEdit(collection.id);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkFieldId, setBulkFieldId] = useState('');
  const [bulkValue, setBulkValue] = useState<any>('');
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [activeGroupPath, setActiveGroupPath] = useState<string | undefined>();
  useEffect(() => {
    const prefill = activeGroupPath ? buildGroupPrefill(activeGroupPath, groups, orderedProperties) : null;
    const serialized = JSON.stringify([prefill, activeGroupPath]);
    if (lastGroupContext.current === serialized) return;
    lastGroupContext.current = serialized;
    groupCallbackRef.current?.(prefill, activeGroupPath || undefined);
  }, [activeGroupPath, groups, orderedProperties]);
  const steamProperty = useMemo(
    () => orderedProperties.find((property) => property.type === 'steam'),
    [orderedProperties],
  );
  const iconProperty = useMemo(
    () => collection.properties?.find((property) => property.id === cardIconFieldId),
    [cardIconFieldId, collection.properties],
  );
  const colorProperty = useMemo(
    () => collection.properties?.find((property) => property.id === cardColorFieldId),
    [cardColorFieldId, collection.properties],
  );
  const visibleProperties = useMemo(
    () => orderedProperties
      .filter((property) => property.id !== steamProperty?.id && !hiddenFields.includes(property.id))
      .map((property) => ({
        ...(collection.properties?.find((candidate) => candidate.id === property.id) || {}),
        ...property,
        options: property.options || collection.properties?.find((candidate) => candidate.id === property.id)?.options || [],
      })),
    [collection.properties, hiddenFields, orderedProperties, steamProperty?.id],
  );
  const fieldPlacements = useMemo(() => {
    const groupedIds = new Set(fieldGroups.flatMap((group) => group.fieldIds));
    return Object.fromEntries([
      ...fieldGroups.flatMap((group) => group.fieldIds.map((fieldId) => [fieldId, cardGroupPlacements[group.id] || 'description'])),
      ...visibleProperties.filter((property) => !groupedIds.has(property.id)).map((property) => [property.id, cardGroupPlacements.__ungrouped__ || 'description']),
    ]) as Record<string, string>;
  }, [cardGroupPlacements, fieldGroups, visibleProperties]);
  const canEditField = useCallback(() => canEdit, [canEdit]);
  const bulkEditableProperties = useMemo(() => visibleProperties.filter((property: any) => !property.showContextMenu && !property.isCalculated), [visibleProperties]);
  const selectedBulkProperty = useMemo(() => bulkEditableProperties.find((property) => property.id === bulkFieldId), [bulkEditableProperties, bulkFieldId]);
  const getDefaultBulkValue = useCallback((property?: any) => {
    if (!property) return '';
    if (property.type === 'checkbox') return false;
    if (property.type === 'multiselect' || property.type === 'multi_select') return [];
    if (property.type === 'relation') return property.relation?.type === 'one_to_one' ? null : [];
    return '';
  }, []);
  useEffect(() => {
    const currentIds = new Set(items.map((item) => item.id));
    setSelectedItemIds((previous) => new Set([...previous].filter((id) => currentIds.has(id))));
  }, [items]);
  useEffect(() => {
    if (!bulkEditableProperties.length) return setBulkFieldId('');
    if (!bulkEditableProperties.some((property) => property.id === bulkFieldId)) {
      setBulkFieldId(bulkEditableProperties[0].id);
      setBulkValue(getDefaultBulkValue(bulkEditableProperties[0]));
    }
  }, [bulkEditableProperties, bulkFieldId, getDefaultBulkValue]);
  const handleSelectionChange = useCallback((itemId: string, checked: boolean) => {
    setSelectedItemIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(itemId); else next.delete(itemId);
      return next;
    });
  }, []);
  const handleBulkApply = useCallback(() => {
    if (!canEdit || !selectedBulkProperty || selectedItemIds.size === 0) return;
    const nextItems = items.filter((item) => selectedItemIds.has(item.id)).map((item) => ({ ...item, [selectedBulkProperty.id]: bulkValue }));
    if (onBulkUpdate) onBulkUpdate(nextItems, collection.id); else nextItems.forEach(onEdit);
  }, [bulkValue, canEdit, collection.id, items, onBulkUpdate, onEdit, selectedBulkProperty, selectedItemIds]);
  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedItemIds);
    if (!canEdit || !ids.length) return;
    setBulkDeleteDialogOpen(true);
  }, [canEdit, selectedItemIds]);
  const confirmBulkDelete = useCallback(() => {
    const ids = Array.from(selectedItemIds);
    if (!ids.length) return;
    if (onBulkDelete) onBulkDelete(ids, collection.id); else ids.forEach(onDelete);
    setSelectedItemIds(new Set());
    setBulkDeleteDialogOpen(false);
  }, [collection.id, onBulkDelete, onDelete, selectedItemIds]);
  const reorderItemsById = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const nextItems = [...items];
    const sourceIndex = nextItems.findIndex((item) => item.id === sourceId);
    const targetIndex = nextItems.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = nextItems.splice(sourceIndex, 1);
    nextItems.splice(targetIndex, 0, moved);
    onReorderItems(nextItems);
  }, [items, onReorderItems]);
  const { rowsPerPage, page } = useViewPagination({
    items,
    groupedItemCount: items.length,
    hasGroups: groups.length > 0,
    resetKey: `${collection.id}|${groups.join(',')}`,
  });
  const paginateItems = useCallback((groupItems: typeof items) => {
    const start = (page - 1) * rowsPerPage;
    return groupItems.slice(start, start + rowsPerPage);
  }, [page, rowsPerPage]);
  const renderCards = useCallback((groupItems: typeof items) => (
    <CardsGrid
      items={groupItems}
      cardColumns={cardColumns}
      steamProperty={steamProperty}
      cardStyle={cardStyle}
      cardDensity={cardDensity}
      iconProperty={iconProperty}
      colorProperty={colorProperty}
      fieldPlacements={fieldPlacements}
      properties={visibleProperties}
      collection={collection}
      collections={collections}
      canEdit={canEdit}
      canEditField={canEditField}
      onViewDetail={onViewDetail}
      onEdit={onEdit}
      onRelationChange={onRelationChange}
      onNavigateToCollection={onNavigateToCollection}
      selectedItemIds={selectedItemIds}
      onSelectionChange={handleSelectionChange}
      canReorder={canEdit}
      dragItemId={dragItemId}
      onDragStart={setDragItemId}
      onDragEnd={() => setDragItemId(null)}
      onDropOnItem={(targetId) => { if (dragItemId) reorderItemsById(dragItemId, targetId); setDragItemId(null); }}
    />
  ), [
    canEdit,
    canEditField,
    cardColumns,
    collection,
    collections,
    onEdit,
    onNavigateToCollection,
    onRelationChange,
    onViewDetail,
    steamProperty,
    cardDensity,
    cardStyle,
    colorProperty,
    iconProperty,
    fieldPlacements,
    visibleProperties,
    selectedItemIds,
    handleSelectionChange,
    dragItemId,
    reorderItemsById,
  ]);

  const content = (
    <ViewGrouping
      items={items}
      groups={groups}
      properties={orderedProperties}
      collections={collections}
      initialExpandedGroups={initialExpandedGroups}
      onExpandedGroupsChange={onExpandedGroupsChange}
      groupDisplayMode={groupDisplayMode}
      groupDisplayModes={groupDisplayModes}
      groupDisplayColumnCount={groupDisplayColumnCount}
      groupDisplayColumnCounts={groupDisplayColumnCounts}
      paginateItems={paginateItems}
      renderItems={renderCards}
      className="min-h-0 mt-4 flex-1 overflow-auto"
      onActiveGroupPathChange={setActiveGroupPath}
      collectionId={collection.id}
    />
  );
  const wrappedContent = <ViewShell>
    <ViewTotals collection={collection} collections={collections} properties={orderedProperties} items={items} totalFields={totalFields} groups={groups} contextPath={activeGroupPath} className="px-3 pt-3" />
    {canEdit && <BulkSelectionToolbar count={selectedItemIds.size} properties={bulkEditableProperties} fieldId={bulkFieldId} value={bulkValue} collection={collection} collections={collections} onFieldChange={(value) => { setBulkFieldId(value); setBulkValue(getDefaultBulkValue(bulkEditableProperties.find((property) => property.id === value))); }} onValueChange={setBulkValue} onApply={handleBulkApply} onClear={() => setSelectedItemIds(new Set())} onDelete={handleBulkDelete} onConfirmDelete={confirmBulkDelete} deleteDialogOpen={bulkDeleteDialogOpen} onDeleteDialogOpenChange={setBulkDeleteDialogOpen} onBulkImportItad={onBulkImportItad ? () => onBulkImportItad(Array.from(selectedItemIds)) : undefined} onSelectAll={(checked) => setSelectedItemIds(checked ? new Set(items.map((item) => item.id)) : new Set())} allSelected={items.length > 0 && items.every((item) => selectedItemIds.has(item.id))} selectionTotal={items.length} />}
    {content}
  </ViewShell>;

  if (!onShowNewItemModal && !onQuickCreateItem) return wrappedContent;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild><div className="flex min-h-0 flex-1">{wrappedContent}</div></ContextMenuTrigger>
      <ContextMenuContent className="min-w-[200px]">
        <ContextMenuItem disabled={!canEdit || !onShowNewItemModal} onSelect={() => onShowNewItemModal?.()}>
          <Plus size={14} className="mr-2 text-emerald-400" /> Nouveau {collection.name}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!canEdit || !onQuickCreateItem} onSelect={() => onQuickCreateItem?.()}>
          <Zap size={14} className="mr-2 text-amber-400" /> Création rapide
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default CardsView;
