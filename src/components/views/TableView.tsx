import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Plus, Zap } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useGrouping } from '@/lib/hooks/useGrouping';
import { TableViewProps } from '@/lib/types';
import GroupRenderer from '@/components/TableView/GroupRenderer';
import TableItemRow from '@/components/TableView/TableItemRow';
import TableHeader from '@/components/TableView/TableHeader';
import TotalsBar from '@/components/TableView/TotalsBar';
import EditableProperty from '@/components/fields/EditableProperty';
import { useCanEdit } from '@/lib/hooks/useCanEdit';
import { useAuth } from '@/auth/AuthProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { countItemsInGroup, getGroupLabel, resolveGroupVisualStyle } from '@/lib/groupingUtils';
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
  onBulkUpdate,
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
  groupTabStyleFieldIds = {},
  groupTotalsByGroupId = {},
  totalFields = {},
  onSetTotalField,
  onBulkImportItad,
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
  const [performanceMode, setPerformanceMode] = useState<boolean>(items.length >= 600);
  const [rowsPerPage, setRowsPerPage] = useState<number>(50);
  const [page, setPage] = useState<number>(1);
  const [activeSubGroupPathByRoot, setActiveSubGroupPathByRoot] = useState<Record<string, string>>({});

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
  const [activeGroupSelectByDepth, setActiveGroupSelectByDepth] = useState<Record<number, string>>({});
  const rootTabsStorageKey = useMemo(
    () => `erp:table:root-tabs:${collection?.id || 'unknown'}:${groups.join('|')}`,
    [collection?.id, groups]
  );
  const rootSelectStorageKey = useMemo(
    () => `erp:table:root-select:${collection?.id || 'unknown'}:${groups.join('|')}`,
    [collection?.id, groups]
  );

  useEffect(() => {
    if (groupDisplayMode !== 'tabs' || rootGroups.length === 0) {
      setActiveGroupTab('');
      return;
    }
    if (!activeGroupTab || !rootGroups.includes(activeGroupTab)) {
      let storedTab = '';
      if (typeof window !== 'undefined') {
        try {
          storedTab = localStorage.getItem(rootTabsStorageKey) || '';
        } catch {
          storedTab = '';
        }
      }
      const nextTab = storedTab && rootGroups.includes(storedTab) ? storedTab : rootGroups[0];
      setActiveGroupTab(nextTab);
    }
  }, [groupDisplayMode, rootGroups, activeGroupTab, rootTabsStorageKey]);

  useEffect(() => {
    if (groupDisplayMode !== 'tabs' || !activeGroupTab) return;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(rootTabsStorageKey, activeGroupTab);
    } catch {
      // ignore storage errors
    }
  }, [groupDisplayMode, activeGroupTab, rootTabsStorageKey]);

  useEffect(() => {
    const rootGroupMode: 'accordion' | 'columns' | 'tabs' | 'select' =
      (groups[0] && (groupDisplayModes as any)?.[groups[0]]) || groupDisplayMode || 'accordion';
    if (rootGroupMode !== 'select') {
      setActiveGroupSelectByDepth({});
      return;
    }
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(rootSelectStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      const next: Record<number, string> = {};
      Object.entries(parsed).forEach(([k, v]) => {
        const depth = Number(k);
        if (Number.isInteger(depth) && typeof v === 'string' && v) {
          next[depth] = v;
        }
      });
      setActiveGroupSelectByDepth(next);
    } catch {
      // ignore storage errors
    }
  }, [groupDisplayMode, groupDisplayModes, groups, rootSelectStorageKey]);

  useEffect(() => {
    const rootGroupMode: 'accordion' | 'columns' | 'tabs' | 'select' =
      (groups[0] && (groupDisplayModes as any)?.[groups[0]]) || groupDisplayMode || 'accordion';
    if (rootGroupMode !== 'select') return;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(rootSelectStorageKey, JSON.stringify(activeGroupSelectByDepth || {}));
    } catch {
      // ignore storage errors
    }
  }, [groupDisplayMode, groupDisplayModes, groups, activeGroupSelectByDepth, rootSelectStorageKey]);

  // Fonction pour calculer le total d'un champ selon le type de total
  const calculateTotal = useCallback((fieldId: string, itemsToSum: any[], totalType: string) => {
    const property = visibleProperties.find(p => p.id === fieldId);
    if (!property) return null;

    const parseNumberFilteredTotalType = (rawType: string) => {
      if (typeof rawType !== 'string' || !rawType.startsWith('number-filter:')) return null;
      const parts = rawType.split(':');
      if (parts.length < 4) return null;
      const baseType = parts[1];
      const filterFieldId = parts[2];
      const encodedValue = parts.slice(3).join(':');
      if (!['sum', 'avg', 'min', 'max', 'count', 'unique'].includes(baseType)) return null;
      try {
        return { baseType, filterFieldId, filterValue: decodeURIComponent(encodedValue) };
      } catch {
        return { baseType, filterFieldId, filterValue: encodedValue };
      }
    };

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
      const parsedNumberFilter = parseNumberFilteredTotalType(totalType);
      const resolvedTotalType = parsedNumberFilter?.baseType || totalType;

      const filteredItems = parsedNumberFilter
        ? itemsToSum.filter((item) => {
            const raw = item?.[parsedNumberFilter.filterFieldId];
            if (Array.isArray(raw)) {
              return !raw.some((entry) => String(entry) === parsedNumberFilter.filterValue);
            }
            if (raw && typeof raw === 'object') {
              if (raw.value !== undefined && raw.value !== null) {
                return String(raw.value) !== parsedNumberFilter.filterValue;
              }
              if (raw.url !== undefined && raw.url !== null) {
                return String(raw.url) !== parsedNumberFilter.filterValue;
              }
              return JSON.stringify(raw) !== parsedNumberFilter.filterValue;
            }
            return String(raw) !== parsedNumberFilter.filterValue;
          })
        : itemsToSum;

      const numbers = filteredItems
        .map(item => {
          const val = item[fieldId];
          const num = Number(val);
          return isNaN(num) ? null : num;
        })
        .filter((val): val is number => val !== null);
      
      if (numbers.length === 0) return 0;
      
      if (resolvedTotalType === 'sum') {
        return numbers.reduce((acc, val) => acc + val, 0);
      }
      if (resolvedTotalType === 'avg') {
        const sum = numbers.reduce((acc, val) => acc + val, 0);
        return sum / numbers.length;
      }
      if (resolvedTotalType === 'min') {
        return Math.min(...numbers);
      }
      if (resolvedTotalType === 'max') {
        return Math.max(...numbers);
      }
      if (resolvedTotalType === 'count') {
        return filteredItems.length;
      }
      if (resolvedTotalType === 'unique') {
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

    const parseNumberFilteredTotalType = (rawType: string) => {
      if (typeof rawType !== 'string' || !rawType.startsWith('number-filter:')) return null;
      const parts = rawType.split(':');
      if (parts.length < 4) return null;
      const baseType = parts[1];
      if (!['sum', 'avg', 'min', 'max', 'count', 'unique'].includes(baseType)) return null;
      const filterFieldId = parts[2];
      const encodedValue = parts.slice(3).join(':');
      let filterValue = encodedValue;
      try {
        filterValue = decodeURIComponent(encodedValue);
      } catch {
        filterValue = encodedValue;
      }
      return { baseType, filterFieldId, filterValue };
    };

    const parsedNumberFilter = parseNumberFilteredTotalType(totalType);
    const resolvedTotalType = parsedNumberFilter?.baseType || totalType;

    const formatFilterLabel = () => {
      if (!parsedNumberFilter) return '';
      const filterProp = (collection?.properties || []).find((p: any) => p.id === parsedNumberFilter.filterFieldId) as any;
      const fieldLabel = filterProp?.name || parsedNumberFilter.filterFieldId;
      const raw = parsedNumberFilter.filterValue;

      let valueLabel = raw;
      if (filterProp?.type === 'checkbox') {
        if (raw === 'true') valueLabel = 'Oui';
        else if (raw === 'false') valueLabel = 'Non';
      } else if (filterProp?.type === 'select' || filterProp?.type === 'multi_select' || filterProp?.type === 'multiselect') {
        const matched = ((filterProp.options || []) as any[]).find((opt: any) => {
          const optValue = typeof opt === 'string' ? opt : opt?.value;
          return String(optValue) === raw;
        });
        if (matched) {
          valueLabel = typeof matched === 'string' ? matched : (matched.label || matched.value || raw);
        }
      } else if (filterProp?.type === 'relation' && filterProp?.relation?.targetCollectionId) {
        const targetCollection = (collections || []).find((c: any) => c.id === filterProp?.relation?.targetCollectionId);
        const targetItem = (targetCollection?.items || []).find((it: any) => String(it?.id) === raw);
        if (targetItem) {
          const displayFieldIds = Array.isArray(filterProp?.relation?.displayFieldIds) && filterProp.relation.displayFieldIds.length > 0
            ? filterProp.relation.displayFieldIds
            : ['name'];
          const chunks = displayFieldIds
            .map((fid: string) => targetItem?.[fid])
            .filter((v: any) => v !== undefined && v !== null && v !== '')
            .map((v: any) => String(v));
          valueLabel = chunks.length > 0 ? chunks.join(' · ') : String(targetItem?.name || targetItem?.title || raw);
        }
      }

      return ` (hors ${fieldLabel} = ${valueLabel})`;
    };

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
      if (resolvedTotalType === 'avg') {
        const formatted = total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const base = property.type === 'number' ? withAffixes(formatted) : formatted;
        return `${base}${formatFilterLabel()}`;
      }
      if (property.type === 'number') {
        if (resolvedTotalType === 'count' || resolvedTotalType === 'unique') {
          return `${total.toLocaleString('fr-FR')}${formatFilterLabel()}`;
        }
        return `${withAffixes(total.toLocaleString('fr-FR'))}${formatFilterLabel()}`;
      }
    }

    // Formatage selon le type de total
    if (resolvedTotalType === 'count') {
      return `${total} ligne${total > 1 ? 's' : ''}${formatFilterLabel()}`;
    }
    if (resolvedTotalType === 'unique') {
      return `${total} unique${total > 1 ? 's' : ''}${formatFilterLabel()}`;
    }
    if (resolvedTotalType === 'count-true') {
      return `${total} coché${total > 1 ? 's' : ''}`;
    }
    if (resolvedTotalType === 'count-false') {
      return `${total} décoché${total > 1 ? 's' : ''}`;
    }
    if (resolvedTotalType === 'count-linked') {
      return `${total} lié${total > 1 ? 's' : ''}`;
    }

    return String(total);
  }, [visibleProperties, collection?.properties, collections]);

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

  const canReorderRows = canEdit && !sortState.column && !performanceMode;

  const sortedFlatItems = useMemo(() => sortItems(items), [items, sortItems]);
  const totalPages = Math.max(1, Math.ceil(sortedFlatItems.length / rowsPerPage));
  const effectivePage = Math.min(page, totalPages);
  const paginatedFlatItems = useMemo(() => {
    const start = (effectivePage - 1) * rowsPerPage;
    return sortedFlatItems.slice(start, start + rowsPerPage);
  }, [sortedFlatItems, effectivePage, rowsPerPage]);


  useEffect(() => {
    setPage(1);
  }, [collection?.id, rowsPerPage, sortState.column, sortState.direction]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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

      groupData.itemIds.forEach((id: string) => itemIds.add(id));
      groupData.subGroups.forEach((subPath: string) => collectIds(subPath));
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

    // Collecter tous les items à mettre à jour
    const itemsToUpdate = items
      .filter((item) => selectedItemIds.has(item.id))
      .map((item) => ({ ...item, [bulkFieldId]: cloneForItem(parsedValue) }));

    // Utiliser onBulkUpdate si disponible (plus efficace - une seule action d'état)
    // Sinon fallback à l'ancienne méthode (appel onEdit pour chaque item)
    if (onBulkUpdate) {
      console.log('handleBulkApply - using onBulkUpdate for', itemsToUpdate.length, 'items');
      onBulkUpdate(itemsToUpdate);
    } else {
      console.log('handleBulkApply - fallback to onEdit for', itemsToUpdate.length, 'items');
      itemsToUpdate.forEach((item) => {
        onEdit(item);
      });
    }
  }, [canEdit, bulkFieldId, bulkValue, selectedItemIds, collection, items, onEdit, onBulkUpdate]);

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
      {/* ─── Section totaux (globaux + par groupe) ────────────────────────── */}
      {Object.keys(totalFields).length > 0 && items.length > 0 && (() => {
        const rootGroupId = groups[0];
        const rootGroupTotalConfig = rootGroupId ? (groupTotalsByGroupId[rootGroupId] ?? {}) : {};
        const topRootGroupMode: 'accordion' | 'columns' | 'tabs' | 'select' =
          (groups[0] && (groupDisplayModes as any)?.[groups[0]]) || groupDisplayMode || 'accordion';
        const topActiveRootPath =
          topRootGroupMode === 'select'
            ? (activeGroupSelectByDepth[0] || rootGroups[0] || '')
            : (activeGroupTab || rootGroups[0] || '');
        const topActiveSubPath =
          topRootGroupMode === 'select'
            ? (activeGroupSelectByDepth[1] || '')
            : (activeSubGroupPathByRoot[topActiveRootPath] || '');
        const shouldShowTopTotalsSection =
          groups.length === 0
            ? true
            : rootGroupTotalConfig.enabled !== false && rootGroupTotalConfig.position !== 'bottom';

        if (!shouldShowTopTotalsSection) return null;

        // Traverser récursivement tous les niveaux de groupes
        const buildGroupedSections = () => {
          if (!groupedStructure || groups.length === 0) return undefined;

          const sections: Array<{ path: string; label: string; items: any[]; depth: number; propertyName: string }> = [];

          const traverse = (path: string, depth: number) => {
            const node = groupedStructure.structure[path];
            if (!node) return;
            const groupPropertyId = groups[depth];
            const groupProp = orderedProperties.find((p: any) => p.id === groupPropertyId);
            const groupTotalConfig = groupPropertyId ? (groupTotalsByGroupId[groupPropertyId] ?? {}) : {};
            const shouldShowThisLevelInTop =
              groupTotalConfig.enabled !== false && groupTotalConfig.position !== 'bottom';
            const rawValue = path.split('/').pop() || path;
            const label = groupProp
              ? String(getGroupLabel(groupProp, rawValue === '(vide)' ? undefined : rawValue, collections))
              : rawValue;
            const groupItems = getItemsForGroupPath(path);
            if (groupItems.length > 0 && shouldShowThisLevelInTop) {
              sections.push({ path, label, items: groupItems, depth, propertyName: groupProp?.name ?? '' });
            }
            node.subGroups.forEach((subPath: string) => traverse(subPath, depth + 1));
          };

          groupedStructure.rootGroups.forEach((rootGroup: string) => traverse(rootGroup, 0));
          return sections.length > 0 ? sections : undefined;
        };

        return (
          <TotalsBar
            displayProperties={displayProperties}
            items={items}
            totalFields={totalFields}
            calculateTotal={calculateTotal}
            formatTotal={formatTotal}
            variant="section"
            groupedSections={buildGroupedSections()}
            activeRootPath={topActiveRootPath}
            activeSubPath={topActiveSubPath}
            hideGroupSelectors={groups.length > 0}
            allowGroupSelectorToggle={groups.length > 0}
            persistKey={`table-view:${collection?.id || 'unknown'}`}
          />
        );
      })()}

      <div className=" border border-black/10 dark:border-white/5 rounded-lg overflow-hidden backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/20 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
            <span>{items.length} ligne{items.length > 1 ? 's' : ''}</span>
            {groups.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white/70 dark:bg-white/10">
                Groupes actifs: {groups.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`px-2 py-1 rounded text-xs border ${performanceMode ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white dark:bg-neutral-900 border-black/10 dark:border-white/10'}`}
              onClick={() => setPerformanceMode((prev) => !prev)}
              title="Réduit les coûts d'affichage sur les gros datasets (pagination + rendu simplifié)"
            >
              {performanceMode ? 'Mode performance ON' : 'Mode performance OFF'}
            </button>

            <label className="text-xs text-neutral-600 dark:text-neutral-300">Lignes/page</label>
            <select
              className="text-xs px-2 py-1 rounded border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900"
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
            >
              {[10, 25, 50, 100, 200, 500].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>

            <button
              type="button"
              className="px-2 py-1 rounded text-xs border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={effectivePage <= 1}
            >
              ◀
            </button>
            <span className="text-xs min-w-[70px] text-center">{effectivePage}/{totalPages}</span>
            <button
              type="button"
              className="px-2 py-1 rounded text-xs border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={effectivePage >= totalPages}
            >
              ▶
            </button>
          </div>
        </div>

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
            {onBulkImportItad && (
              <button
                type="button"
                onClick={() => onBulkImportItad(Array.from(selectedItemIds))}
                disabled={selectedCount === 0}
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 border border-white/10 hover:bg-white/20 transition cursor-pointer group"
              >
                ⬇️ Importer ITAD ({selectedCount})
              </button>
            )}
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
            topTotalRenderMode: 'normal' | 'only' | 'skip' = 'normal',
            depthOverride = 0
          ) => (
            <GroupRenderer
              key={rootGroup}
              groupPath={rootGroup}
              depth={depthOverride}
              groups={groups}
              groupProperties={orderedProperties}
              groupDisplayModes={groupDisplayModes}
              defaultGroupDisplayMode={groupDisplayMode}
              groupDisplayColumnCounts={groupDisplayColumnCounts}
              groupTabStyleFieldIds={groupTabStyleFieldIds}
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
              onEditProperty={onEditProperty}
              onToggleField={onToggleField}
              onDeleteProperty={onDeleteProperty}
              onDuplicateProperty={onDuplicateProperty}
              onToggleTotalField={onSetTotalField}
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
              groupRowLimit={groups.length > 0 ? rowsPerPage : undefined}
              onActiveSubGroupTabChange={(path, tabDepth) => {
                if (tabDepth !== 1) return;
                setActiveSubGroupPathByRoot((prev) => {
                  if (prev[rootGroup] === path) return prev;
                  return { ...prev, [rootGroup]: path };
                });
              }}
            />
          );

          const renderFlatRows = (sourceItems: any[] = items) =>
            sourceItems.map(item => (
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

            const showBottomTotalsByDefault = groups.length === 0;

            return (
            <div className="flex flex-col max-h-[calc(100vh-280px)]">
              <div className="overflow-auto flex-1">
                <table className="w-full">
                <TableHeader
                  visibleProperties={visibleProperties}
                  allProperties={collection.properties}
                  collections={collections}
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
                {showBottomTotalsByDefault && Object.keys(totalFields).length > 0 && (footerItems || items).length > 0 && (
                  <tfoot>
                    <tr>
                      {canReorderRows && <td className="px-1 py-2 w-8" />}
                      {showSelectionColumn && <td className="px-2 py-2 w-10" />}
                      {displayProperties.map((prop: any) => {
                        const totalType = totalFields[prop.id];
                        if (!totalType) return <td key={prop.id} className="px-2 py-2" />;

                        return (
                          <td key={prop.id} className="px-2 py-2 align-top">
                            <TotalsBar
                              displayProperties={[prop]}
                              items={footerItems || items}
                              totalFields={{ [prop.id]: totalType }}
                              calculateTotal={calculateTotal}
                              formatTotal={formatTotal}
                              variant="inline"
                              inlineMode="plain"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
              </div>
            </div>
            );
          };

          const renderBodyOnlyShell = (body: React.ReactNode) => (
            <div className="overflow-auto max-h-[calc(100vh-280px)]">
              <table className="w-full">
                <tbody className="divide-y divide-white/5">{body}</tbody>
              </table>
            </div>
          );

          const displayRootGroups = rootGroups;

          const rootGroupCards = displayRootGroups.map((rootGroup: string) => {
            const rootValue = rootGroup.split('/').pop() || rootGroup;
            const label = rootGroupProperty
              ? getGroupLabel(rootGroupProperty, rootValue === '(vide)' ? undefined : rootValue, collections)
              : rootValue;
            const itemCount = groupedStructure
              ? countItemsInGroup(rootGroup, groupedStructure.structure)
              : 0;
            const visualStyle = rootGroupProperty
              ? resolveGroupVisualStyle(
                  rootGroupProperty,
                  rootValue === '(vide)' ? undefined : rootValue,
                  collections,
                  groups[0] ? groupTabStyleFieldIds[groups[0]] : undefined
                )
              : null;

            return {
              id: rootGroup,
              label,
              itemCount,
              color: visualStyle?.color,
              icon: visualStyle?.icon,
            };
          });

          const rootGroupMode: 'accordion' | 'columns' | 'tabs' | 'select' =
            (groups[0] && (groupDisplayModes as any)?.[groups[0]]) || groupDisplayMode || 'accordion';
          const rootGroupColumnCount = normalizeGroupColumnCount(
            (groups[0] && (groupDisplayColumnCounts as any)?.[groups[0]]) || groupDisplayColumnCount
          );
          const rootGroupColumnsClassName = getGroupColumnsClassName(rootGroupColumnCount);

          if (!groupedStructure || (performanceMode && groups.length === 0)) {
            return renderTableShell(
              renderFlatRows(paginatedFlatItems),
              paginatedFlatItems,
              paginatedFlatItems
            );
          }

          if (rootGroupMode === 'columns' && displayRootGroups.length > 0) {
            const hasNestedGroups = groups.length > 1;
            return (
              <div className="overflow-auto max-h-[calc(100vh-280px)]">
                <div
                  className={`grid gap-4 p-5 ${rootGroupColumnsClassName}`}
                >
                  {rootGroupCards.map((group: any) => (
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
              </div>
            );
          }

          if (rootGroupMode === 'tabs' && displayRootGroups.length > 0) {
            const hasNestedGroups = groups.length > 1;
            const safeActiveGroupTab = displayRootGroups.includes(activeGroupTab)
              ? activeGroupTab
              : displayRootGroups[0];
            return (
              <div className="max-h-[calc(100vh-280px)] overflow-auto flex flex-col">
                <Tabs value={safeActiveGroupTab} onValueChange={setActiveGroupTab} className="w-full flex flex-col">
                  <TabsList className="m-2 mt-3 h-auto flex-wrap justify-start gap-1 bg-transparent p-0 shrink-0">
                    {rootGroupCards.map((group: any) => (
                      (() => {
                        const GroupIcon = group.icon ? (LucideIcons as any)[group.icon] : null;
                        const isActive = safeActiveGroupTab === group.id;
                        return (
                          <TabsTrigger
                            key={group.id}
                            value={group.id}
                            className="rounded-full border border-black/10 dark:border-white/10 bg-white/60 px-3 py-1.5 text-xs dark:bg-white/5"
                            style={group.color ? {
                              borderColor: `${group.color}55`,
                              backgroundColor: isActive ? `${group.color}30` : `${group.color}1a`,
                              color: isActive ? group.color : undefined,
                            } : undefined}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              {GroupIcon ? <GroupIcon size={12} style={{ color: group.color || undefined }} /> : null}
                              <span>{group.label} ({group.itemCount})</span>
                            </span>
                          </TabsTrigger>
                        );
                      })()
                    ))}
                  </TabsList>

                  <div className="overflow-auto flex-1">
                    {rootGroupCards.map((group: any) => (
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
                  </div>
                </Tabs>
              </div>
            );
          }

          if (rootGroupMode === 'select' && displayRootGroups.length > 0) {
            type SelectLevel = {
              depth: number;
              groupId: string;
              property: any;
              options: Array<{ id: string; label: string; itemCount: number }>;
              selectedId: string;
            };

            const selectLevels: SelectLevel[] = [];
            let currentOptions = displayRootGroups;
            let parentPath: string | null = null;

            for (let depth = 0; depth < groups.length; depth++) {
              const groupId = groups[depth];
              const mode = (groupDisplayModes as any)?.[groupId] || (depth === 0 ? rootGroupMode : 'accordion');
              if (mode !== 'select') break;
              if (!currentOptions.length) break;

              const property = orderedProperties.find((p: any) => p.id === groupId);
              if (!property) break;

              const options = currentOptions.map((pathId: string) => {
                const rawValue = pathId.split('/').pop() || pathId;
                const label = getGroupLabel(property, rawValue === '(vide)' ? undefined : rawValue, collections);
                const itemCount = groupedStructure
                  ? countItemsInGroup(pathId, groupedStructure.structure)
                  : 0;
                return { id: pathId, label, itemCount };
              });

              const persisted = activeGroupSelectByDepth[depth];
              const selectedId = options.some((o) => o.id === persisted)
                ? persisted
                : options[0].id;

              selectLevels.push({ depth, groupId, property, options, selectedId });

              parentPath = selectedId;
              const node = groupedStructure?.structure?.[selectedId];
              currentOptions = node?.subGroups || [];
            }

            const finalSelectedPath = selectLevels.length > 0
              ? selectLevels[selectLevels.length - 1].selectedId
              : displayRootGroups[0];
            const selectedDepth = Math.max(0, finalSelectedPath.split('/').length - 1);

            return (
              <div className="max-h-[calc(100vh-280px)] overflow-auto flex flex-col gap-2">
                <div className="px-3 pt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(selectLevels.length, 1)}, minmax(180px, 1fr))` }}>
                  {selectLevels.map((level) => (
                    <div key={`group-select-${level.depth}`} className="min-w-0">
                      <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1 truncate">
                        {level.property?.name || `Niveau ${level.depth + 1}`}
                      </label>
                      <Select
                        value={level.selectedId}
                        onValueChange={(nextId) => {
                          setActiveGroupSelectByDepth((prev) => {
                            const next: Record<number, string> = { ...prev, [level.depth]: nextId };
                            Object.keys(next).forEach((k) => {
                              const d = Number(k);
                              if (d > level.depth) delete next[d];
                            });
                            return next;
                          });
                        }}
                      >
                        <SelectTrigger className="w-full rounded-lg border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {level.options.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>{opt.label} ({opt.itemCount})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="overflow-auto flex-1">
                  {groups.length > selectedDepth + 1
                    ? renderBodyOnlyShell(
                        <GroupRenderer
                          key={finalSelectedPath}
                          groupPath={finalSelectedPath}
                          depth={selectedDepth}
                          groups={groups}
                          groupProperties={orderedProperties}
                          groupDisplayModes={groupDisplayModes}
                          defaultGroupDisplayMode={groupDisplayMode as any}
                          groupDisplayColumnCounts={groupDisplayColumnCounts}
                          groupTabStyleFieldIds={groupTabStyleFieldIds}
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
                          onEditProperty={onEditProperty}
                          onToggleField={onToggleField}
                          onDeleteProperty={onDeleteProperty}
                          onDuplicateProperty={onDuplicateProperty}
                          onToggleTotalField={onSetTotalField}
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
                          hideCurrentHeader
                          topTotalRenderMode="skip"
                        />
                      )
                    : renderTableShell(
                        renderRootGroupRows(finalSelectedPath, true, 'skip', selectedDepth),
                        undefined,
                        getItemsForGroupPath(finalSelectedPath)
                      )}
                </div>
              </div>
            );
          }

          return renderTableShell(displayRootGroups.map((rootGroup: string) => renderRootGroupRows(rootGroup)));
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
