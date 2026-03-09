import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Plus, Zap } from 'lucide-react';
import { useGrouping } from '@/lib/hooks/useGrouping';
import { TableViewProps } from '@/lib/types';
import GroupRenderer from '@/components/TableView/GroupRenderer';
import TableItemRow from '@/components/TableView/TableItemRow';
import TableHeader from '@/components/TableView/TableHeader';
import EditableProperty from '@/components/fields/EditableProperty';
import { useCanEdit } from '@/lib/hooks/useCanEdit';
import { useAuth } from '@/auth/AuthProvider';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const ROW_SELECTION_FIELD_ID = '__rowSelection';

const TableView: React.FC<TableViewProps> = ({
  collection,
  items,
  onEdit,
  onDelete,
  hiddenFields,
  orderedProperties,
  onReorderItems,
  onToggleField,
  onDeleteProperty,
  onEditProperty,
  onViewDetail,
  collections,
  onRelationChange,
  onNavigateToCollection,
  groups = [],
  onShowNewItemModal,
  onQuickCreateItem,
  initialSortState,
  onSortStateChange,
  initialExpandedGroups,
  onExpandedGroupsChange,
}) => {
  // Guard: si pas de collection, ne rien afficher
  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        <p>Collection non accessible</p>
      </div>
    );
  }

  const onSortStateChangeRef = useRef(onSortStateChange);
  const lastSortSerializedRef = useRef<string | null>(null);

  useEffect(() => {
    onSortStateChangeRef.current = onSortStateChange;
  }, [onSortStateChange]);

  const { itemsMap, groupedStructure, expandedGroups, toggleGroup } = useGrouping(
    items,
    groups,
    collection.properties,
    initialExpandedGroups,
    onExpandedGroupsChange
  );

  // Tri par colonne
  const [sortState, setSortState] = useState<{ column: string | null; direction: 'asc' | 'desc' }>(
    initialSortState || { column: null, direction: 'asc' }
  );

  useEffect(() => {
    setSortState(initialSortState || { column: null, direction: 'asc' });
  }, [initialSortState?.column, initialSortState?.direction, collection?.id]);

  useEffect(() => {
    const cb = onSortStateChangeRef.current;
    if (!cb) return;
    const serialized = JSON.stringify(sortState);
    if (serialized === lastSortSerializedRef.current) return;
    lastSortSerializedRef.current = serialized;
    cb(sortState);
  }, [sortState]);

  const handleSort = useCallback((columnId: string) => {
    setSortState((prev) => {
      if (prev.column === columnId) {
        return { column: columnId, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column: columnId, direction: 'asc' };
    });
  }, []);

  // Fonction de tri générique
  const sortItems = useCallback((arr: any[]) => {
    if (!sortState.column) return arr;
    const col = sortState.column;
    return [...arr].sort((a, b) => {
      const aVal = a && col in a ? a[col] : undefined;
      const bVal = b && col in b ? b[col] : undefined;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortState.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortState.direction === 'asc'
        ? String(aVal).localeCompare(String(bVal), 'fr', { numeric: true })
        : String(bVal).localeCompare(String(aVal), 'fr', { numeric: true });
    });
  }, [sortState]);
  
  // Hooks de permissions
  const canEdit = useCanEdit(collection?.id);
  const { isAdmin, isEditor, permissions } = useAuth();
  const canEditFieldFn = useCallback((fieldId: string) => {
    if (isAdmin || isEditor) return true;
    const perms = permissions || [];
    if (fieldId) {
      const fieldPerm = perms.find(
        (p: any) =>
          (p.field_id || null) === fieldId &&
          (p.collection_id || null) === (collection?.id || null) &&
          (p.item_id || null) === null
      );
      if (fieldPerm) return Boolean(fieldPerm.can_write);
    }
    const collectionPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === (collection?.id || null) &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (collectionPerm) return Boolean(collectionPerm.can_write);
    const globalPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === null &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (globalPerm) return Boolean(globalPerm.can_write);
    return false;
  }, [isAdmin, isEditor, permissions, collection?.id]);

  const canViewFieldFn = useCallback((fieldId: string) => {
    if (isAdmin || isEditor) return true;
    const perms = permissions || [];
    if (fieldId) {
      const fieldPerm = perms.find(
        (p: any) =>
          (p.field_id || null) === fieldId &&
          (p.collection_id || null) === (collection?.id || null) &&
          (p.item_id || null) === null
      );
      if (fieldPerm) return Boolean(fieldPerm.can_read);
    }
    const collectionPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === (collection?.id || null) &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (collectionPerm) return Boolean(collectionPerm.can_read);
    const globalPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === null &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (globalPerm) return Boolean(globalPerm.can_read);
    return false;
  }, [isAdmin, isEditor, permissions, collection?.id]);
  const hasContextActions = Boolean(onShowNewItemModal || onQuickCreateItem);
  const newItemLabel = collection?.name ? `Nouveau ${collection.name}` : 'Nouvel élément';

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkFieldId, setBulkFieldId] = useState('');
  const [bulkValue, setBulkValue] = useState<any>('');
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-700 dark:text-neutral-500">
        <p>Collection non accessible</p>
      </div>
    );
  }

  // Filtrer les propriétés selon les permissions de vue
  const visibleProperties = orderedProperties.filter(p => 
    !hiddenFields.includes(p.id) && canViewFieldFn(p.id)
  );

  const showSelectionColumn = canEdit && !hiddenFields.includes(ROW_SELECTION_FIELD_ID);

  const bulkEditableProperties = useMemo(
    () => visibleProperties.filter((p: any) => !p.showContextMenu && canEditFieldFn(p.id)),
    [visibleProperties]
  );

  const selectedBulkProperty = useMemo(
    () => bulkEditableProperties.find((p) => p.id === bulkFieldId),
    [bulkEditableProperties, bulkFieldId]
  );

  const getDefaultBulkValue = useCallback((prop?: any) => {
    if (!prop) return '';
    if (prop.type === 'checkbox') return false;
    if (prop.type === 'multiselect' || prop.type === 'multi_select') return [];
    if (prop.type === 'relation') return prop.relation?.type === 'one_to_one' ? null : [];
    return '';
  }, []);

  useEffect(() => {
    if (!bulkEditableProperties.length) {
      setBulkFieldId('');
      return;
    }
    if (!bulkEditableProperties.some((p) => p.id === bulkFieldId)) {
      setBulkFieldId(bulkEditableProperties[0].id);
    }
  }, [bulkEditableProperties, bulkFieldId]);

  useEffect(() => {
    const currentIds = new Set(items.map((item) => item.id));
    setSelectedItemIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (currentIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [items]);

  const selectableItems = canEdit ? items : [];
  const allSelected = selectableItems.length > 0 && selectableItems.every((item) => selectedItemIds.has(item.id));
  const partiallySelected = !allSelected && selectedItemIds.size > 0;

  useEffect(() => {
    if (showSelectionColumn) return;
    setSelectedItemIds(new Set());
  }, [showSelectionColumn]);

  const canReorderRows = canEdit && !sortState.column;

  const reorderItemsById = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const nextItems = [...items];
    const from = nextItems.findIndex((it) => it.id === sourceId);
    const to = nextItems.findIndex((it) => it.id === targetId);
    if (from === -1 || to === -1 || from === to) return;
    const [moved] = nextItems.splice(from, 1);
    nextItems.splice(to, 0, moved);
    onReorderItems(nextItems);
  }, [items, onReorderItems]);

  const handleRowDragStart = useCallback((itemId: string) => {
    if (!canReorderRows) return;
    setDragItemId(itemId);
  }, [canReorderRows]);

  const handleRowDragEnter = useCallback((itemId: string) => {
    if (!canReorderRows || !dragItemId) return;
    setDragOverItemId(itemId);
  }, [canReorderRows, dragItemId]);

  const handleRowDrop = useCallback((targetItemId: string, e: React.DragEvent<HTMLTableRowElement>) => {
    if (!canReorderRows || !dragItemId) return;
    e.preventDefault();
    reorderItemsById(dragItemId, targetItemId);
    setDragItemId(null);
    setDragOverItemId(null);
  }, [canReorderRows, dragItemId, reorderItemsById]);

  const handleRowDragEnd = useCallback(() => {
    setDragItemId(null);
    setDragOverItemId(null);
  }, []);

  const handleToggleSelectAll = useCallback((checked: boolean) => {
    if (!checked) {
      setSelectedItemIds(new Set());
      return;
    }
    setSelectedItemIds(new Set(selectableItems.map((item) => item.id)));
  }, [selectableItems]);

  const handleSelectionChange = useCallback((itemId: string, checked: boolean) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const selectedCount = selectedItemIds.size;

  const handleBulkFieldChange = useCallback((nextFieldId: string) => {
    setBulkFieldId(nextFieldId);
    const prop = bulkEditableProperties.find((p) => p.id === nextFieldId);
    setBulkValue(getDefaultBulkValue(prop));
  }, [bulkEditableProperties, getDefaultBulkValue]);

  const handleBulkApply = useCallback(() => {
    if (!canEdit || !bulkFieldId || selectedItemIds.size === 0) return;

    const property = collection.properties.find((p) => p.id === bulkFieldId);
    if (!property) return;

    let parsedValue: any = bulkValue;
    if (property.type === 'number' && typeof bulkValue === 'string') {
      const n = Number(bulkValue);
      if (Number.isNaN(n)) return;
      parsedValue = n;
    }

    const cloneForItem = (val: any) => {
      if (val === null || typeof val !== 'object') return val;
      try {
        return structuredClone(val);
      } catch {
        return JSON.parse(JSON.stringify(val));
      }
    };

    items.forEach((item) => {
      if (!selectedItemIds.has(item.id)) return;
      onEdit({ ...item, [bulkFieldId]: cloneForItem(parsedValue) });
    });
  }, [canEdit, bulkFieldId, bulkValue, selectedItemIds, collection, items, onEdit]);

  const handleBulkDelete = useCallback(() => {
    if (!canEdit || selectedItemIds.size === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [canEdit, selectedItemIds]);

  const confirmBulkDelete = useCallback(() => {
    const idsToDelete = Array.from(selectedItemIds);
    idsToDelete.forEach((id) => onDelete(id));
    setSelectedItemIds(new Set());
    setBulkDeleteDialogOpen(false);
  }, [selectedItemIds, onDelete]);

  const content = (
    <>
      <div className=" border border-black/10 dark:border-white/5 rounded-lg overflow-hidden backdrop-blur">
        {showSelectionColumn && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20">
            <span className="text-xs text-neutral-600 dark:text-neutral-300">
              {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
            </span>
            <select
              className="text-xs px-2 py-1 rounded border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900"
              value={bulkFieldId}
              onChange={(e) => handleBulkFieldChange(e.target.value)}
              disabled={!bulkEditableProperties.length}
            >
              {bulkEditableProperties.map((prop) => (
                <option key={prop.id} value={prop.id}>
                  {prop.name}
                </option>
              ))}
            </select>
            <div className="min-w-[220px]">
              {selectedBulkProperty ? (
                <EditableProperty
                  property={selectedBulkProperty}
                  value={bulkValue}
                  onChange={setBulkValue}
                  size="sm"
                  readOnly={!bulkFieldId}
                  collections={collections}
                  collection={collection}
                  currentItem={{ id: 'bulk-editor', [selectedBulkProperty.id]: bulkValue }}
                  onRelationChange={(prop, _item, val) => {
                    if (prop.id === selectedBulkProperty.id) setBulkValue(val);
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={String(bulkValue ?? '')}
                  onChange={(e) => setBulkValue(e.target.value)}
                  placeholder="Valeur à appliquer"
                  className="text-xs px-2 py-1 rounded border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900"
                  disabled
                />
              )}
            </div>
            <button
              type="button"
              onClick={handleBulkApply}
              disabled={!bulkFieldId || selectedCount === 0}
              className="text-xs px-2 py-1 rounded bg-violet-600 text-white disabled:opacity-50"
            >
              Appliquer
            </button>
            <button
              type="button"
              onClick={() => setSelectedItemIds(new Set())}
              disabled={selectedCount === 0}
              className="text-xs px-2 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-50"
            >
              Désélectionner
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedCount === 0}
              className="text-xs px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50"
            >
              Supprimer la sélection
            </button>
            {canReorderRows && (
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 ml-auto">
                Astuce : glisser-déposer une ligne pour réordonner
              </span>
            )}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableHeader
              visibleProperties={visibleProperties}
              items={items}
              onEditProperty={onEditProperty}
              onToggleField={onToggleField}
              onDeleteProperty={onDeleteProperty}
              collectionId={collection?.id}
              sortState={sortState}
              onSort={handleSort}
              enableSelection={showSelectionColumn}
              allSelected={allSelected}
              partiallySelected={partiallySelected}
              onToggleSelectAll={handleToggleSelectAll}
            />
            <tbody className="divide-y divide-white/5">
              {groupedStructure ? (
                // Rendu des groupes avec la nouvelle logique
                groupedStructure.rootGroups.map(rootGroup => (
                  <GroupRenderer
                    key={rootGroup}
                    groupPath={rootGroup}
                    depth={0}
                    groups={groups}
                    groupedStructure={groupedStructure}
                    collection={collection}
                    collections={collections}
                    expandedGroups={expandedGroups}
                    toggleGroup={toggleGroup}
                    itemsMap={itemsMap}
                    visibleProperties={visibleProperties}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onViewDetail={onViewDetail}
                    onRelationChange={onRelationChange}
                    onNavigateToCollection={onNavigateToCollection}
                    canEdit={canEdit}
                    canEditField={canEditFieldFn}
                    sortItems={sortItems}
                    enableSelection={showSelectionColumn}
                    selectedItemIds={selectedItemIds}
                    onSelectionChange={handleSelectionChange}
                    draggableRows={canReorderRows}
                    dragItemId={dragItemId}
                    dragOverItemId={dragOverItemId}
                    onRowDragStart={handleRowDragStart}
                    onRowDragEnter={handleRowDragEnter}
                    onRowDrop={handleRowDrop}
                    onRowDragEnd={handleRowDragEnd}
                  />
                ))
              ) : (
                // Sans groupes : affichage normal
                sortItems(items).map(item => (
                  <TableItemRow
                    key={item.id}
                    item={item}
                    visibleProperties={visibleProperties}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onViewDetail={onViewDetail}
                    collections={collections}
                    onRelationChange={onRelationChange}
                    onNavigateToCollection={onNavigateToCollection}
                    canEdit={canEdit}
                    canEditField={canEditFieldFn}
                    animate={false}
                    collection = {collection}
                    enableSelection={showSelectionColumn}
                    isSelected={selectedItemIds.has(item.id)}
                    onSelectionChange={handleSelectionChange}
                    draggableRow={canReorderRows}
                    isDragging={dragItemId === item.id}
                    isDragOver={dragOverItemId === item.id && dragItemId !== item.id}
                    onRowDragStart={() => handleRowDragStart(item.id)}
                    onRowDragEnter={() => handleRowDragEnter(item.id)}
                    onRowDragOver={(e) => {
                      if (!canReorderRows) return;
                      e.preventDefault();
                    }}
                    onRowDrop={(e) => handleRowDrop(item.id, e)}
                    onRowDragEnd={handleRowDragEnd}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la sélection ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera définitivement {selectedCount} élément{selectedCount > 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmBulkDelete}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (!hasContextActions) {
    return content;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>{content}</div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[200px]">
        <ContextMenuItem
          onSelect={() => {
            if (!canEdit || !onShowNewItemModal) return;
            onShowNewItemModal();
          }}
          className={!canEdit || !onShowNewItemModal ? 'opacity-60 pointer-events-none' : ''}
        >
          <Plus size={14} className="mr-2 text-emerald-400" />
          <span>{newItemLabel}</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => {
            if (!canEdit || !onQuickCreateItem) return;
            onQuickCreateItem();
          }}
          className={!canEdit || !onQuickCreateItem ? 'opacity-60 pointer-events-none' : ''}
        >
          <Zap size={14} className="mr-2 text-amber-400" />
          <span>Création rapide</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default TableView;
