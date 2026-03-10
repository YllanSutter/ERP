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
  onBulkDelete,
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
  totalFields = {},
  onSetTotalField,
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
  const displayProperties = visibleProperties.filter((p: any) => !p.showContextMenu);

  // Fonction pour calculer le total d'un champ selon le type de total
  const calculateTotal = useCallback((fieldId: string, itemsToSum: any[], totalType: string) => {
    const property = visibleProperties.find(p => p.id === fieldId);
    if (!property) return null;

    // Totaux pour les nombres (vérifier en premier car ils ont des types spécifiques)
    if (property.type === 'number') {
      const numbers = itemsToSum
        .map(item => {
          const val = item[fieldId];
          const num = Number(val);
          return isNaN(num) ? null : num;
        })
        .filter((val): val is number => val !== null);
      
      if (numbers.length === 0) return 0;
      
      if (totalType === 'sum') {
        return numbers.reduce((acc, val) => acc + val, 0);
      }
      if (totalType === 'avg') {
        const sum = numbers.reduce((acc, val) => acc + val, 0);
        return sum / numbers.length;
      }
      if (totalType === 'min') {
        return Math.min(...numbers);
      }
      if (totalType === 'max') {
        return Math.max(...numbers);
      }
      if (totalType === 'count') {
        return itemsToSum.length;
      }
      if (totalType === 'unique') {
        const uniqueNumbers = new Set(numbers.map(n => String(n)));
        return uniqueNumbers.size;
      }
      // Si le type de total n'est pas reconnu, retourner la somme par défaut
      return numbers.reduce((acc, val) => acc + val, 0);
    }

    // Totaux pour les checkboxes
    if (property.type === 'checkbox') {
      if (totalType === 'count-true') {
        return itemsToSum.filter(item => item[fieldId] === true).length;
      }
      if (totalType === 'count-false') {
        return itemsToSum.filter(item => item[fieldId] === false).length;
      }
      if (totalType === 'count') {
        return itemsToSum.length;
      }
      if (totalType === 'unique') {
        const uniqueValues = new Set(itemsToSum.map(item => String(item[fieldId])));
        return uniqueValues.size;
      }
      return itemsToSum.filter(item => item[fieldId] === true).length;
    }

    // Totaux pour les relations
    if (property.type === 'relation') {
      if (totalType === 'count-linked') {
        return itemsToSum.filter(item => {
          const val = item[fieldId];
          if (Array.isArray(val)) return val.length > 0;
          return val != null;
        }).length;
      }
      if (totalType === 'unique') {
        const allIds = new Set<string>();
        itemsToSum.forEach(item => {
          const val = item[fieldId];
          if (Array.isArray(val)) {
            val.forEach(id => allIds.add(String(id)));
          } else if (val != null) {
            allIds.add(String(val));
          }
        });
        return allIds.size;
      }
      if (totalType === 'count') {
        return itemsToSum.length;
      }
      return itemsToSum.filter(item => {
        const val = item[fieldId];
        if (Array.isArray(val)) return val.length > 0;
        return val != null;
      }).length;
    }

    // Compte simple (nombre de lignes) - pour tous les autres types
    if (totalType === 'count') {
      return itemsToSum.length;
    }

    // Valeurs uniques - pour tous les autres types
    if (totalType === 'unique') {
      const allValues = new Set<string>();
      itemsToSum.forEach(item => {
        const val = item[fieldId];
        if (val == null) return;
        if (Array.isArray(val)) {
          val.forEach(v => allValues.add(String(v)));
        } else {
          allValues.add(String(val));
        }
      });
      return allValues.size;
    }

    return null;
  }, [visibleProperties]);

  // Formater l'affichage du total
  const formatTotal = useCallback((fieldId: string, total: any, totalType: string) => {
    const property = visibleProperties.find(p => p.id === fieldId);
    if (!property || total === null) return '';

    const numberPrefix = property.numberPrefix || '';
    const numberSuffix = property.numberSuffix || '';
    const withAffixes = (formatted: string) => `${numberPrefix}${formatted}${numberSuffix}`;

    // Formater les nombres avec décimales si nécessaire
    if (typeof total === 'number') {
      if (totalType === 'avg') {
        const formatted = total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return property.type === 'number' ? withAffixes(formatted) : formatted;
      }
      if (property.type === 'number') {
        if (totalType === 'count' || totalType === 'unique') {
          return total.toLocaleString('fr-FR');
        }
        return withAffixes(total.toLocaleString('fr-FR'));
      }
    }

    // Formatage selon le type de total
    if (totalType === 'count') {
      return `${total} ligne${total > 1 ? 's' : ''}`;
    }
    if (totalType === 'unique') {
      return `${total} unique${total > 1 ? 's' : ''}`;
    }
    if (totalType === 'count-true') {
      return `${total} coché${total > 1 ? 's' : ''}`;
    }
    if (totalType === 'count-false') {
      return `${total} décoché${total > 1 ? 's' : ''}`;
    }
    if (totalType === 'count-linked') {
      return `${total} lié${total > 1 ? 's' : ''}`;
    }

    return String(total);
  }, [visibleProperties]);

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
    console.log('confirmBulkDelete - idsToDelete:', idsToDelete, 'count:', idsToDelete.length);
    // Vider la sélection et fermer le dialog d'abord
    setSelectedItemIds(new Set());
    setBulkDeleteDialogOpen(false);
    // Utiliser bulkDeleteItems si disponible, sinon fallback à boucle onDelete
    if (onBulkDelete) {
      console.log('confirmBulkDelete - using onBulkDelete');
      onBulkDelete(idsToDelete, collection?.id);
    } else {
      console.log('confirmBulkDelete - fallback to individual onDelete calls');
      idsToDelete.forEach((id, index) => {
        console.log(`confirmBulkDelete - deleting item ${index}:`, id);
        onDelete(id);
      });
    }
    console.log('confirmBulkDelete - all deletes called');
  }, [selectedItemIds, onDelete, onBulkDelete, collection?.id]);

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
                  key={`bulk-${selectedBulkProperty.id}-${selectedBulkProperty.type}`}
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
              totalFields={totalFields}
              onToggleTotalField={onSetTotalField}
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
                    totalFields={totalFields}
                    calculateTotal={calculateTotal}
                    formatTotal={formatTotal}
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
            {Object.keys(totalFields).length > 0 && items.length > 0 && (
              <tfoot className="bg-violet-50/50 dark:bg-violet-900/10 border-t-2 border-violet-200 dark:border-violet-800">
                <tr>
                  {showSelectionColumn && <td className="px-2 py-2"></td>}
                  {displayProperties.map((prop: any) => {
                    const totalType = totalFields[prop.id];
                    if (!totalType) {
                      return <td key={prop.id} className="px-3 py-2"></td>;
                    }
                    const total = calculateTotal(prop.id, items, totalType);
                    return (
                      <td key={prop.id} className="px-4 py-2 text-xs font-semibold text-violet-700 dark:text-violet-300">
                        {formatTotal(prop.id, total, totalType)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
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
