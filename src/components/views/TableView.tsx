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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { countItemsInGroup, getGroupLabel } from '@/lib/groupingUtils';
import { isCalculatedNumberProperty } from '@/lib/calculatedFields';
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
  favoriteItemIds = [],
  onEdit,
  onDelete,
  onToggleFavoriteItem,
  onBulkDelete,
  hiddenFields,
  orderedProperties,
  onReorderItems,
  onToggleField,
  onDeleteProperty,
  onDuplicateProperty,
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
  groupDisplayMode = 'accordion',
  groupDisplayModes = {},
  groupDisplayColumnCount = 3,
  groupDisplayColumnCounts = {},
  groupTotalsByGroupId = {},
  totalFields = {},
  onSetTotalField,
}) => {
    const normalizeGroupColumnCount = useCallback((count: any): 1 | 2 | 3 => {
      return count === 1 || count === 2 || count === 3 ? count : 3;
    }, []);

    const getGroupColumnsClassName = useCallback((count: 1 | 2 | 3) => {
      if (count === 1) return 'grid-cols-1';
      if (count === 2) return 'grid-cols-1 lg:grid-cols-2';
      return 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3';
    }, []);

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
    orderedProperties,
    collections,
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

  const resolveProjectedValue = useCallback((row: any, prop: any) => {
    if (!prop?.isRelationLinkedColumn || !prop?.sourceRelationPropertyId || !prop?.sourceDisplayFieldId) {
      return row?.[prop?.id];
    }

    const sourceRelationValue = row?.[prop.sourceRelationPropertyId];
    const relatedIds = Array.isArray(sourceRelationValue)
      ? sourceRelationValue
      : sourceRelationValue
        ? [sourceRelationValue]
        : [];
    if (!relatedIds.length) return null;

    const sourceRelationProp = (collection?.properties || []).find((p: any) => p.id === prop.sourceRelationPropertyId);
    const targetCollection = collections.find((c: any) => c.id === prop.sourceTargetCollectionId)
      || collections.find((c: any) => c.id === sourceRelationProp?.relation?.targetCollectionId);
    const targetItems = targetCollection?.items || [];

    const values = relatedIds
      .map((id: string) => targetItems.find((it: any) => it.id === id)?.[prop.sourceDisplayFieldId])
      .filter((v: any) => v !== undefined && v !== null && v !== '');

    if (!values.length) return null;
    if (prop.type === 'multi_select') {
      return values.flatMap((v: any) => Array.isArray(v) ? v : [v]).join(', ');
    }
    if (prop.type === 'checkbox') {
      return values.some(Boolean);
    }
    return values[0];
  }, [collection?.properties, collections]);

  // Fonction de tri générique
  const sortItems = useCallback((arr: any[]) => {
    if (!sortState.column) return arr;
    const col = sortState.column;
    const sortProp = orderedProperties.find((p: any) => p.id === col);
    return [...arr].sort((a, b) => {
      const aVal = sortProp ? resolveProjectedValue(a, sortProp) : (a && col in a ? a[col] : undefined);
      const bVal = sortProp ? resolveProjectedValue(b, sortProp) : (b && col in b ? b[col] : undefined);
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortState.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortState.direction === 'asc'
        ? String(aVal).localeCompare(String(bVal), 'fr', { numeric: true })
        : String(bVal).localeCompare(String(aVal), 'fr', { numeric: true });
    });
  }, [sortState, orderedProperties, resolveProjectedValue]);
  
  // Hooks de permissions
  const canEdit = useCanEdit(collection?.id);
  const { isAdmin, isEditor, permissions } = useAuth();
  const canEditFieldFn = useCallback((fieldId: string) => {
    const property = (collection?.properties || []).find((p: any) => p.id === fieldId);
    if (isCalculatedNumberProperty(property)) return false;

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
  }, [isAdmin, isEditor, permissions, collection?.id, collection?.properties]);

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
  const visibleProperties = orderedProperties.filter((p: any) => {
    const permissionFieldId = p?.isRelationLinkedColumn && p?.sourceRelationPropertyId
      ? p.sourceRelationPropertyId
      : p.id;
    const isSourceRelationAutoHidden =
      p?.type === 'relation' &&
      !p?.isRelationLinkedColumn &&
      Array.isArray(p?.relation?.displayFieldIds) &&
      p.relation.displayFieldIds.length > 0 &&
      p?.relation?.autoHideSource !== false;
    return !isSourceRelationAutoHidden && !hiddenFields.includes(p.id) && canViewFieldFn(permissionFieldId);
  });

  const showSelectionColumn = canEdit && !hiddenFields.includes(ROW_SELECTION_FIELD_ID);
  const displayProperties = visibleProperties.filter((p: any) => !p.showContextMenu);
  const rootGroups = groupedStructure?.rootGroups || [];
  const rootGroupProperty = useMemo(
    () => (groups.length > 0 ? orderedProperties.find((p: any) => p.id === groups[0]) || null : null),
    [orderedProperties, groups]
  );
  const [activeGroupTab, setActiveGroupTab] = useState('');

  useEffect(() => {
    if (groupDisplayMode !== 'tabs' || rootGroups.length === 0) {
      setActiveGroupTab('');
      return;
    }
    if (!rootGroups.includes(activeGroupTab)) {
      setActiveGroupTab(rootGroups[0]);
    }
  }, [groupDisplayMode, rootGroups, activeGroupTab]);

  // Fonction pour calculer le total d'un champ selon le type de total
  const calculateTotal = useCallback((fieldId: string, itemsToSum: any[], totalType: string) => {
    const property = visibleProperties.find(p => p.id === fieldId);
    if (!property) return null;

    if (property.type === 'checkbox' && typeof totalType === 'string' && totalType.startsWith('linked-progress:')) {
      const linkedFieldId = totalType.slice('linked-progress:'.length);
      if (!linkedFieldId) return null;

      let paid = 0;
      let remaining = 0;
      let checkedCount = 0;
      let uncheckedCount = 0;

      itemsToSum.forEach((item) => {
        const isChecked = Boolean(item[fieldId]);
        const amount = Number(item[linkedFieldId]);
        const numericAmount = Number.isFinite(amount) ? amount : 0;
        if (isChecked) {
          checkedCount += 1;
          paid += numericAmount;
        } else {
          uncheckedCount += 1;
          remaining += numericAmount;
        }
      });

      return {
        paid,
        remaining,
        total: paid + remaining,
        checkedCount,
        uncheckedCount,
        linkedFieldId,
      };
    }

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

    if (property.type === 'checkbox' && typeof totalType === 'string' && totalType.startsWith('linked-progress:')) {
      const linkedFieldId = totalType.slice('linked-progress:'.length);
      const linkedProperty = collection.properties.find((p: any) => p.id === linkedFieldId);
      const linkedPrefix = linkedProperty?.numberPrefix || '';
      const linkedSuffix = linkedProperty?.numberSuffix || '';
      const fmt = (n: number) => `${linkedPrefix}${Number(n || 0).toLocaleString('fr-FR')}${linkedSuffix}`;
      return `Payé: ${fmt(total.paid)} · Reste: ${fmt(total.remaining)}`;
    }

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
    () => visibleProperties.filter((p: any) => !p.showContextMenu && canEditFieldFn(p.id) && !isCalculatedNumberProperty(p)),
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

  const handleSelectionChange = useCallback((itemId: string, checked: boolean) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const getItemsForGroupPath = useCallback((groupPath: string) => {
    if (!groupedStructure) return [] as any[];

    const itemIds = new Set<string>();

    const collectIds = (path: string) => {
      const groupData = groupedStructure.structure[path];
      if (!groupData) return;

      groupData.itemIds.forEach((id) => itemIds.add(id));
      groupData.subGroups.forEach((subPath) => collectIds(subPath));
    };

    collectIds(groupPath);

    return Array.from(itemIds)
      .map((id) => itemsMap.get(id))
      .filter((item): item is any => Boolean(item));
  }, [groupedStructure, itemsMap]);

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
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 border border-white/10 hover:bg-white/20 transition cursor-pointer group"
            >
              Appliquer
            </button>
            <button
              type="button"
              onClick={() => setSelectedItemIds(new Set())}
              disabled={selectedCount === 0}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-violet-500/10 border border-white/10 hover:bg-white/20 transition cursor-pointer group"
            >
              Désélectionner
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={selectedCount === 0}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/10 border border-white/10 hover:bg-white/20 transition cursor-pointer group"
            >
              Supprimer la sélection
            </button>
          </div>
        )}
        {(() => {
          const renderRootGroupRows = (
            rootGroup: string,
            hideCurrentHeader = false,
            topTotalRenderMode: 'normal' | 'only' | 'skip' = 'normal'
          ) => (
            <GroupRenderer
              key={rootGroup}
              groupPath={rootGroup}
              depth={0}
              groups={groups}
              groupProperties={orderedProperties}
              groupDisplayModes={groupDisplayModes}
              defaultGroupDisplayMode={groupDisplayMode}
              groupDisplayColumnCounts={groupDisplayColumnCounts}
              defaultGroupDisplayColumnCount={normalizeGroupColumnCount(groupDisplayColumnCount)}
              groupTotalsByGroupId={groupTotalsByGroupId}
              groupedStructure={groupedStructure!}
              collection={collection}
              collections={collections}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
              itemsMap={itemsMap}
              visibleProperties={visibleProperties}
              favoriteItemIds={favoriteItemIds}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleFavoriteItem={onToggleFavoriteItem}
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
              hideCurrentHeader={hideCurrentHeader}
              depthOffset={hideCurrentHeader ? -1 : 0}
              topTotalRenderMode={topTotalRenderMode}
            />
          );

          const renderFlatRows = () =>
            sortItems(items).map(item => (
              <TableItemRow
                key={item.id}
                item={item}
                isFavorite={favoriteItemIds.includes(item.id)}
                visibleProperties={visibleProperties}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleFavoriteItem={onToggleFavoriteItem}
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
                enableDragReorder={canReorderRows}
                isDragging={dragItemId === item.id}
                isDragOver={dragOverItemId === item.id && dragItemId !== item.id}
                onDragStart={(itemId, e) => {
                  e.dataTransfer!.effectAllowed = 'move';
                  handleRowDragStart(itemId);
                }}
                onDragEnter={handleRowDragEnter}
                onDragOver={(e) => {
                  if (!canReorderRows) return;
                  e.preventDefault();
                  e.dataTransfer!.dropEffect = 'move';
                }}
                onDrop={handleRowDrop}
                onDragEnd={handleRowDragEnd}
              />
            ));

          const renderTableShell = (body: React.ReactNode, footerItems?: any[], selectionScopeItems?: any[]) => {
            const scopedItems = selectionScopeItems || items;
            const scopedSelectableItems = canEdit ? scopedItems : [];
            const scopedAllSelected =
              scopedSelectableItems.length > 0 &&
              scopedSelectableItems.every((item) => selectedItemIds.has(item.id));
            const scopedPartiallySelected =
              !scopedAllSelected &&
              scopedSelectableItems.some((item) => selectedItemIds.has(item.id));

            const handleScopedToggleSelectAll = (checked: boolean) => {
              setSelectedItemIds((prev) => {
                const next = new Set(prev);
                scopedSelectableItems.forEach((item) => {
                  if (checked) next.add(item.id);
                  else next.delete(item.id);
                });
                return next;
              });
            };

            return (
            <div className="overflow-x-auto">
              <table className="w-full">
                <TableHeader
                  visibleProperties={visibleProperties}
                  allProperties={collection.properties}
                  items={scopedItems}
                  onEditProperty={onEditProperty}
                  onToggleField={onToggleField}
                  onDeleteProperty={onDeleteProperty}
                  onDuplicateProperty={onDuplicateProperty}
                  collectionId={collection?.id}
                  sortState={sortState}
                  onSort={handleSort}
                  enableDragReorder={canReorderRows}
                  enableSelection={showSelectionColumn}
                  allSelected={scopedAllSelected}
                  partiallySelected={scopedPartiallySelected}
                  onToggleSelectAll={handleScopedToggleSelectAll}
                  totalFields={totalFields}
                  onToggleTotalField={onSetTotalField}
                />
                <tbody className="divide-y divide-white/5">{body}</tbody>
                {Object.keys(totalFields).length > 0 && (footerItems || items).length > 0 && (
                  <tfoot className="bg-violet-50/50 dark:bg-violet-900/10 border-t-2 border-violet-200 dark:border-violet-800">
                    <tr>
                      {canReorderRows && <td className="px-1 py-2 w-8"></td>}
                      {showSelectionColumn && <td className="px-2 py-2"></td>}
                      {displayProperties.map((prop: any) => {
                        const totalType = totalFields[prop.id];
                        if (!totalType) {
                          return <td key={prop.id} className="px-3 py-2"></td>;
                        }
                        const total = calculateTotal(prop.id, footerItems || items, totalType);
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
            );
          };

          const renderBodyOnlyShell = (body: React.ReactNode) => (
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody className="divide-y divide-white/5">{body}</tbody>
              </table>
            </div>
          );

          const rootGroupCards = rootGroups.map((rootGroup) => {
            const rootValue = rootGroup.split('/').pop() || rootGroup;
            const label = rootGroupProperty
              ? getGroupLabel(rootGroupProperty, rootValue === '(vide)' ? undefined : rootValue, collections)
              : rootValue;
            const itemCount = groupedStructure
              ? countItemsInGroup(rootGroup, groupedStructure.structure)
              : 0;

            return {
              id: rootGroup,
              label,
              itemCount,
            };
          });

          const rootGroupMode: 'accordion' | 'columns' | 'tabs' =
            (groups[0] && (groupDisplayModes as any)?.[groups[0]]) || groupDisplayMode || 'accordion';
          const rootGroupColumnCount = normalizeGroupColumnCount(
            (groups[0] && (groupDisplayColumnCounts as any)?.[groups[0]]) || groupDisplayColumnCount
          );
          const rootGroupColumnsClassName = getGroupColumnsClassName(rootGroupColumnCount);

          if (!groupedStructure) {
            return renderTableShell(renderFlatRows());
          }

          if (rootGroupMode === 'columns' && rootGroups.length > 0) {
            const hasNestedGroups = groups.length > 1;
            return (
              <div
                className={`grid gap-4 overflow-x-auto p-5 ${rootGroupColumnsClassName}`}
              >
                {rootGroupCards.map((group) => (
                  <div
                    key={group.id}
                    className="min-w-0 rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-neutral-900/30 p-3"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-neutral-800 dark:text-white truncate">
                          {group.label}
                        </div>
                        {rootGroupProperty && (
                          <div className="text-xs text-neutral-500 dark:text-neutral-400">
                            {rootGroupProperty.name}
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-black/5 dark:bg-white/10 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-300">
                        {group.itemCount}
                      </span>
                    </div>
                    {hasNestedGroups
                      ? renderBodyOnlyShell(renderRootGroupRows(group.id, true))
                      : renderTableShell(
                          renderRootGroupRows(group.id, true),
                          undefined,
                          getItemsForGroupPath(group.id)
                        )}
                  </div>
                ))}
              </div>
            );
          }

          if (rootGroupMode === 'tabs' && rootGroups.length > 0) {
            const hasNestedGroups = groups.length > 1;
            const activeRootGroupId = rootGroups.includes(activeGroupTab) ? activeGroupTab : rootGroups[0];
            return (
              <>
                {activeRootGroupId && (
                  hasNestedGroups
                    ? renderBodyOnlyShell(renderRootGroupRows(activeRootGroupId, true, 'only'))
                    : renderTableShell(
                        renderRootGroupRows(activeRootGroupId, true, 'only'),
                        undefined,
                        getItemsForGroupPath(activeRootGroupId)
                      )
                )}

                <Tabs value={activeGroupTab} onValueChange={setActiveGroupTab} className="w-full">
                  <TabsList className="m-2 mt-3 h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                    {rootGroupCards.map((group) => (
                      <TabsTrigger
                        key={group.id}
                        value={group.id}
                        className="rounded-full border border-black/10 dark:border-white/10 bg-white/60 px-3 py-1.5 text-xs dark:bg-white/5"
                      >
                        {group.label} ({group.itemCount})
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {rootGroupCards.map((group) => (
                    <TabsContent key={group.id} value={group.id} className="mt-0 border-0 p-0">
                      {hasNestedGroups
                        ? renderBodyOnlyShell(renderRootGroupRows(group.id, true, 'skip'))
                        : renderTableShell(
                            renderRootGroupRows(group.id, true, 'skip'),
                            undefined,
                            getItemsForGroupPath(group.id)
                          )}
                    </TabsContent>
                  ))}
                </Tabs>
              </>
            );
          }

          return renderTableShell(rootGroups.map((rootGroup) => renderRootGroupRows(rootGroup)));
        })()}
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
