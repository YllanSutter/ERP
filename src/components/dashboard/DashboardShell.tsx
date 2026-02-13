import React, { useEffect, useMemo, useState, Suspense } from 'react';
const FilterModal = React.lazy(() => import('@/components/modals/FilterModal'));
import ItemContextMenu from '@/components/menus/ItemContextMenu';
import { DashboardColumnNode, MonthlyDashboardConfig } from '@/lib/dashboardTypes';
import DashboardColumnConfig from './DashboardColumnConfig';
import DashboardTableView from './DashboardTableView';
import DashboardRecapView from './DashboardRecapView';
import {
  getMonday,
  MONTH_NAMES,
  getNameValue as getNameValueUtil,
  getEventStyle,
  workDayEnd,
  workDayStart,
} from '@/lib/calendarUtils';
import { getFilteredItems, getOrderedProperties } from '@/lib/filterUtils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface DashboardShellProps {
  dashboard: MonthlyDashboardConfig | null;
  collections: any[];
  onUpdate: (patch: Partial<MonthlyDashboardConfig>) => void;
  onEdit?: (item: any) => void;
  onViewDetail: (item: any) => void;
  onDelete: (id: string) => void;
  dashboardFilters: Record<string, any[]>;
  setDashboardFilters: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
  onShowNewItemModalForCollection?: (collection: any, item?: any) => void;
}


const months = MONTH_NAMES;

const classNames = {
  headerWrap:
    'flex items-center justify-between mb-2 flex-wrap gap-3 bg-white/70 dark:bg-neutral-900/60 border border-black/5 dark:border-white/10 rounded-xl p-3 shadow-sm backdrop-blur',
  titleInput:
    'bg-white/80 dark:bg-neutral-950/40 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40',
  select:
    'bg-white/80 dark:bg-neutral-950/40 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30',
  filterChip:
    'flex items-center gap-1 px-3 py-1.5 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 rounded-full text-sm border border-indigo-500/20',
  filterRemove: 'hover:bg-indigo-500/20 rounded-full p-0.5',
};

function itemMatchesTypeValues(itemValue: any, typeValues: string[], fieldType?: string): boolean {
    if (!typeValues || typeValues.length === 0) return true;
    if (fieldType === 'multi_select' || fieldType === 'select') {
      if (Array.isArray(itemValue)) {
        return typeValues.some(v => itemValue.includes(v));
      }
      return typeValues.includes(itemValue);
    }
    if (Array.isArray(itemValue)) {
      return typeValues.every(v => itemValue.includes(v));
    }
    if ((fieldType === 'text' || fieldType === 'url') && typeof itemValue === 'string') {
      return typeValues.every(v =>
        typeof v === 'string' && v.trim() !== '' && itemValue.toLowerCase().includes(v.toLowerCase())
      );
    }
    return typeValues.every(v => v === itemValue);
  }
  function formatDurationHeureMinute(duree: number): string {
    if (typeof duree !== 'number' || isNaN(duree)) return '';
    const heures = Math.floor(duree);
    const minutes = Math.round((duree - heures) * 60);
    return `${heures}h${minutes.toString().padStart(2, '0')}`;
  }
  const getLeaves = (nodes: any[]): any[] => {
    return nodes.flatMap((n) => (n.children && n.children.length ? getLeaves(n.children) : [n]));
  };


const DashboardShell: React.FC<DashboardShellProps> = ({ dashboard, collections, onUpdate, onEdit, onViewDetail, onDelete, dashboardFilters, setDashboardFilters, onShowNewItemModalForCollection }) => {
      if (!dashboard) {
        return (
          <div className="flex items-center justify-center h-full text-neutral-500">
            <p>Dashboard non accessible</p>
          </div>
        );
      }
      const [showFilterModal, setShowFilterModal] = useState(false);
      const viewType = dashboard.viewType || 'recap';
      const periodScope = dashboard.periodScope || 'month';
      const activeRecapMetrics = (dashboard.recapMetrics && dashboard.recapMetrics.length > 0)
        ? dashboard.recapMetrics.filter((m) => m === 'count' || m === 'duration')
        : ['count', 'duration'];
      const metricsPerLeaf = Math.max(1, activeRecapMetrics.length);

      const handleAddFilter = (property: string, operator: string, value: any) => {
        if (!dashboard || !dashboardFilters || !setDashboardFilters) return;
        setDashboardFilters((prev: any) => ({
          ...prev,
          [dashboard.id]: [...(prev[dashboard.id] || []), { property, operator, value }]
        }));
        setShowFilterModal(false);
      };
      const handleRemoveFilter = (idx: number) => {
        if (!dashboard || !dashboardFilters || !setDashboardFilters) return;
        setDashboardFilters((prev: any) => ({
          ...prev,
          [dashboard.id]: (prev[dashboard.id] || []).filter((_: any, i: number) => i !== idx)
        }));
      };

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  const collection = useMemo(
    () => collections.find((c) => c.id === dashboard?.sourceCollectionId),
    [collections, dashboard?.sourceCollectionId]
  );

  const properties = collection?.properties || [];
  const filteredItems = useMemo(() => {
    if (!dashboard || !collection?.items) return [];
    const filters = dashboardFilters?.[dashboard.id] || [];
    const fakeViewConfig = { filters };
    return getFilteredItems(collection, fakeViewConfig, { collectionId: null, ids: [] }, collection.id, collections);
  }, [dashboard, collection, dashboardFilters, collections]);

  const itemCollectionMap = useMemo(() => {
    const map = new Map<string, { collectionId: string; collectionName: string }>();
    collections.forEach((coll: any) => {
      (coll.items || []).forEach((it: any) => {
        if (it?.id) {
          map.set(it.id, { collectionId: coll.id, collectionName: coll.name || 'Sans nom' });
        }
      });
    });
    return map;
  }, [collections]);

  const periodStart = useMemo(() => {
    if (!dashboard?.year || !dashboard?.month) return null;
    if (periodScope === 'year') {
      return new Date(dashboard.year, 0, 1, 0, 0, 0, 0);
    }
    return new Date(dashboard.year, dashboard.month - 1, 1, 0, 0, 0, 0);
  }, [dashboard?.year, dashboard?.month, periodScope]);

  const periodEnd = useMemo(() => {
    if (!dashboard?.year || !dashboard?.month) return null;
    if (periodScope === 'year') {
      return new Date(dashboard.year, 11, 31, 23, 59, 59, 999);
    }
    return new Date(dashboard.year, dashboard.month, 0, 23, 59, 59, 999);
  }, [dashboard?.year, dashboard?.month, periodScope]);

  const getCollectionTone = (collectionId?: string) => {
    const palette = [
      { soft: 'bg-neutral-50/90 dark:bg-neutral-950/20', strong: 'bg-neutral-100/90 dark:bg-neutral-950/35' },
      { soft: 'bg-neutral-100/85 dark:bg-neutral-900/20', strong: 'bg-neutral-200/80 dark:bg-neutral-900/35' },
      { soft: 'bg-neutral-200/70 dark:bg-neutral-900/30', strong: 'bg-neutral-300/60 dark:bg-neutral-900/45' },
      { soft: 'bg-white/80 dark:bg-neutral-950/15', strong: 'bg-neutral-100/80 dark:bg-neutral-950/30' },
      { soft: 'bg-neutral-50/70 dark:bg-neutral-900/35', strong: 'bg-neutral-200/70 dark:bg-neutral-900/50' },
    ];
    const idx = Math.max(0, collections.findIndex((c: any) => c.id === collectionId));
    return palette[idx % palette.length];
  };

  const getLeafCollectionId = (leaf: any) => {
    const rootGroup = leaf?._parentPath && leaf._parentPath.length > 0 ? leaf._parentPath[0] : null;
    return rootGroup?.collectionId || dashboard?.sourceCollectionId || null;
  };

  const dayKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const getFirstWorkdayKey = (date: Date) => {
    const d = new Date(date.getFullYear(), date.getMonth(), 1);
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    return dayKey(d);
  };

  const buildPrefillValueForProp = (prop: any, values: string[], target: any) => {
    if (!prop || !Array.isArray(values) || values.length === 0) return;
    const cleaned = values.filter((val) => val !== null && val !== undefined && String(val).trim() !== '');
    if (cleaned.length === 0) return;

    const relationType = prop?.relation?.type || prop?.relation?.relationType || prop?.relationType || 'many_to_many';
    const isRelationMany = relationType === 'one_to_many' || relationType === 'many_to_many';

    if (prop.type === 'multi_select') {
      const existing = Array.isArray(target[prop.id]) ? target[prop.id] : [];
      target[prop.id] = Array.from(new Set([...existing, ...cleaned]));
      return;
    }

    if (prop.type === 'relation') {
      if (isRelationMany) {
        const existing = Array.isArray(target[prop.id]) ? target[prop.id] : [];
        target[prop.id] = Array.from(new Set([...existing, ...cleaned]));
        return;
      }
      if (target[prop.id] === undefined) {
        target[prop.id] = cleaned[0];
      }
      return;
    }

    if (prop.type === 'select') {
      if (target[prop.id] === undefined) {
        target[prop.id] = cleaned[0];
      }
      return;
    }

    if (prop.type === 'number') {
      if (target[prop.id] === undefined) {
        const parsed = Number(cleaned[0]);
        target[prop.id] = Number.isNaN(parsed) ? cleaned[0] : parsed;
      }
      return;
    }

    if (prop.type === 'date' || prop.type === 'date_range') {
      if (target[prop.id] === undefined) {
        target[prop.id] = cleaned[0];
      }
      return;
    }

    if (target[prop.id] === undefined) {
      target[prop.id] = cleaned[0];
    }
  };

  const buildPrefillForCell = (leaf: any, day: Date) => {
    const rootGroup = leaf?._parentPath && leaf._parentPath.length > 0 ? leaf._parentPath[0] : null;
    const targetCollectionId = rootGroup?.collectionId || dashboard?.sourceCollectionId || null;
    const targetCollection = collections.find((c: any) => c.id === targetCollectionId) || collection;
    if (!targetCollection) return null;

    const targetProperties = targetCollection?.properties || [];
    const prefill: any = {};
    const filterHierarchy: { field: string; values: string[] }[] = [];

    if (leaf?._parentPath && Array.isArray(leaf._parentPath)) {
      leaf._parentPath.forEach((parent: any) => {
        if (parent.filterField && Array.isArray(parent.typeValues) && parent.typeValues.length > 0) {
          filterHierarchy.push({ field: parent.filterField, values: parent.typeValues });
        }
      });
    }
    if (leaf?.filterField && Array.isArray(leaf.typeValues) && leaf.typeValues.length > 0) {
      filterHierarchy.push({ field: leaf.filterField, values: leaf.typeValues });
    }

    filterHierarchy.forEach(({ field, values }) => {
      const prop = targetProperties.find((p: any) => p.id === field);
      if (!prop) return;
      buildPrefillValueForProp(prop, values, prefill);
    });

    let dateFieldId = rootGroup?.dateFieldId || dashboard?.globalDateField;
    if (leaf?.dateFieldOverride?.single) {
      dateFieldId = leaf.dateFieldOverride.single;
    }

    const dateField = targetProperties.find((p: any) => p.id === dateFieldId)
      || targetProperties.find((p: any) => p.type === 'date' || p.type === 'date_range');

    if (dateField) {
      const startDate = new Date(day);
      startDate.setHours(workDayStart, 0, 0, 0);
      if (dateField.type === 'date_range') {
        const endDate = new Date(day);
        endDate.setHours(workDayEnd, 0, 0, 0);
        prefill[dateField.id] = {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        };
      } else if (prefill[dateField.id] === undefined) {
        prefill[dateField.id] = startDate.toISOString();
      }
    }

    return {
      collection: targetCollection,
      item: { ...prefill, isNew: true, __collectionId: targetCollection.id },
    };
  };

  const handleCreateItemFromCell = (leaf: any, day: Date) => {
    if (!onShowNewItemModalForCollection) return;
    const payload = buildPrefillForCell(leaf, day);
    if (!payload) return;
    onShowNewItemModalForCollection(payload.collection, payload.item);
  };

  const getMaxDepth = (nodes: any[], depth = 1): number => {
    if (!nodes || nodes.length === 0) return depth;
    return Math.max(
      ...nodes.map((n) => (n.children && n.children.length ? getMaxDepth(n.children, depth + 1) : depth))
    );
  };
  const maxDepth = getMaxDepth(dashboard?.columnTree || []);

  const getLeavesWithPath = (nodes: any[], path: any[] = []): any[] => {
    return nodes.flatMap((n) =>
      n.children && n.children.length
        ? getLeavesWithPath(n.children, [...path, n])
        : [{ ...n, _parentPath: path }]
    );
  };
  const leafColumns = useMemo(() => getLeavesWithPath(dashboard?.columnTree || []), [dashboard?.columnTree]);

  const leafMetaById = useMemo(() => {
    const map = new Map<string, { items: any[]; dateField: any | null }>();
    if (!dashboard || !leafColumns.length) return map;
    leafColumns.forEach((leaf: any) => {
      const rootGroup = leaf._parentPath && leaf._parentPath.length > 0 ? leaf._parentPath[0] : null;
      const groupCollectionId = rootGroup?.collectionId || dashboard.sourceCollectionId;
      const groupCollection = collections.find((c: any) => c.id === groupCollectionId) || collection;
      const groupProperties = groupCollection?.properties || [];
      let groupItems: any[] = [];
      if (groupCollection?.id === collection?.id) {
        groupItems = filteredItems;
      } else if (groupCollection) {
        const filters = dashboardFilters?.[dashboard.id] || [];
        const fakeViewConfig = { filters } as any;
        groupItems = getFilteredItems(groupCollection, fakeViewConfig, { collectionId: null, ids: [] }, groupCollection.id, collections);
      }

      let filteredGroupItems = groupItems;
      const filterHierarchy: { field: string; values: string[] }[] = [];
      if (leaf._parentPath && Array.isArray(leaf._parentPath)) {
        leaf._parentPath.forEach((parent: any) => {
          if (parent.filterField && Array.isArray(parent.typeValues) && parent.typeValues.length > 0) {
            filterHierarchy.push({ field: parent.filterField, values: parent.typeValues.filter((v: any) => !!v) });
          }
        });
      }
      if (leaf.filterField && Array.isArray(leaf.typeValues) && leaf.typeValues.length > 0) {
        filterHierarchy.push({ field: leaf.filterField, values: leaf.typeValues.filter((v: any) => !!v) });
      }
      filterHierarchy.forEach(({ field, values }) => {
        const prop = groupProperties.find((p: any) => p.id === field);
        if (values.length > 0 && prop) {
          filteredGroupItems = filteredGroupItems.filter((item: any) =>
            itemMatchesTypeValues(item[field], values, prop.type)
          );
        }
      });

      let dateFieldId = rootGroup?.dateFieldId || dashboard.globalDateField;
      if (leaf.dateFieldOverride && leaf.dateFieldOverride.single) {
        dateFieldId = leaf.dateFieldOverride.single;
      }
      if (!dateFieldId && groupProperties.length > 0) {
        const firstDate = groupProperties.find((p: any) => p.type === 'date' || p.type === 'date_range');
        if (firstDate) dateFieldId = firstDate.id;
      }
      const dateField = groupProperties.find((p: any) => p.id === dateFieldId) || null;

      map.set(leaf.id, { items: filteredGroupItems, dateField });
    });
    return map;
  }, [dashboard, leafColumns, collections, collection, filteredItems, dashboardFilters]);

  const getItemEndDate = (item: any, dateField: any) => {
    if (!item || !dateField) return null;
    const segments = Array.isArray(item._eventSegments) ? item._eventSegments : [];
    const matchingSegments = segments.filter((seg: any) =>
      typeof seg?.label === 'string' && seg.label === dateField.name && seg.end
    );
    if (matchingSegments.length > 0) {
      let maxEnd: Date | null = null;
      matchingSegments.forEach((seg: any) => {
        const end = new Date(seg.end);
        if (Number.isNaN(end.getTime())) return;
        if (!maxEnd || end > maxEnd) maxEnd = end;
      });
      if (maxEnd) return maxEnd;
    }
    const value = item[dateField.id];
    if (!value) return null;
    if (dateField.type === 'date') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (dateField.type === 'date_range') {
      const endVal = value?.end ?? value;
      const d = new Date(endVal);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  const countUniqueInRange = (leafId: string, start: Date, end: Date) => {
    const meta = leafMetaById.get(leafId);
    if (!meta || !meta.dateField) return 0;
    const ids = new Set<string>();
    meta.items.forEach((item: any) => {
      const endDate = getItemEndDate(item, meta.dateField);
      if (!endDate) return;
      if (endDate >= start && endDate <= end) {
        ids.add(item.id);
      }
    });
    return ids.size;
  };

  const buildHeaderRows = (nodes: any[], depth: number, maxDepth: number, rows: any[][], leafSpan: number) => {
    rows[depth] = rows[depth] || [];
    nodes.forEach((node) => {
      const isLeaf = !node.children || node.children.length === 0;
      if (isLeaf) {
        rows[depth].push({
          label: node.label,
          colSpan: leafSpan,
          rowSpan: maxDepth - depth,
          isLeaf: true,
          node,
        });
      } else {
        const colSpan = getLeaves([node]).length * leafSpan;
        rows[depth].push({
          label: node.label,
          colSpan,
          rowSpan: 1,
          isLeaf: false,
          node,
        });
        buildHeaderRows(node.children, depth + 1, maxDepth, rows, leafSpan);
      }
    });
  };

  const getTableHeaderRows = () => {
    const rows: any[][] = [];
    buildHeaderRows(dashboard?.columnTree || [], 0, maxDepth, rows, metricsPerLeaf);
    return rows;
  };

  const resolvedTypeField = useMemo(() => {
    if (dashboard?.typeField) {
      const prop = properties.find((p: any) => p.id === dashboard.typeField);
      if (prop) return dashboard.typeField;
    }
    const first = properties.find((p: any) => p.id !== 'id');
    return first ? first.id : null;
  }, [dashboard?.typeField, properties]);

  const typeOptions = useMemo(() => {
    if (!resolvedTypeField) return [] as { value: string; label: string }[];
    const prop = properties.find((p: any) => p.id === resolvedTypeField);
    const opts = prop?.options || [];
    return (opts as any[]).map((opt, idx) => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      const value = opt?.value ?? opt?.label ?? `option-${idx + 1}`;
      const label = opt?.label ?? value;
      return { value, label };
    });
  }, [resolvedTypeField, properties]);

  useEffect(() => {
    if (!dashboard) return;
    if (properties.some((p: any) => p.id === 'type') && dashboard.typeField !== 'type') {
      onUpdate({ typeField: 'type' });
    }
    const hasColumns = (dashboard.columnTree || []).length > 0;
    if (hasColumns) return;
    if (typeOptions.length === 0) return;
    const autoColumns: DashboardColumnNode[] = typeOptions.map((opt, idx) => ({
      id: `auto-${idx}-${opt.value}`,
      label: opt.label,
      typeValues: [opt.value],
      dateFieldOverride: {}
    }));
    onUpdate({ columnTree: autoColumns });
  }, [dashboard, typeOptions, onUpdate, properties]);

  const aggregates = useMemo(() => {
    const daily: Record<string, Record<string, { count: number; duration: number }>> = {};
    const dailyObjectDurations: Record<string, Record<string, Record<string, number>>> = {}; // dailyObjectDurations[dateKey][leafId][itemId] = durée ce jour-là
    const spansByLeaf: Record<string, any[]> = {};
    const spansByLeafDay: Record<string, Record<string, any>> = {};

    if (!dashboard || !leafColumns.length) return { daily, spansByLeaf, spansByLeafDay, dailyObjectDurations };

    const firstDay = periodStart ? new Date(periodStart) : null;
    const lastDay = periodEnd ? new Date(periodEnd) : null;
    if (!firstDay || !lastDay) return { daily, spansByLeaf, spansByLeafDay, dailyObjectDurations };
    const daysOfMonth: Date[] = [];
    let d = new Date(firstDay);
    while (d <= lastDay) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysOfMonth.push(new Date(d));
      }
      d.setDate(d.getDate() + 1);
    }

    leafColumns.forEach((leaf: any) => {
      const rootGroup = leaf._parentPath && leaf._parentPath.length > 0 ? leaf._parentPath[0] : null;
      const groupCollectionId = rootGroup?.collectionId || dashboard.sourceCollectionId;
      const groupCollection = collections.find((c: any) => c.id === groupCollectionId) || collection;
      const groupProperties = groupCollection?.properties || [];
      let groupItems = [];
      if (groupCollection.id === collection?.id) {
        groupItems = filteredItems;
      } else {
        const filters = dashboardFilters?.[dashboard.id] || [];
        const fakeViewConfig = { filters };
        groupItems = getFilteredItems(groupCollection, fakeViewConfig, { collectionId: null, ids: [] }, groupCollection.id, collections);
      }
      let filteredGroupItems = groupItems;
      let filterHierarchy: { field: string, values: string[] }[] = [];
      if (leaf._parentPath && Array.isArray(leaf._parentPath)) {
        leaf._parentPath.forEach((parent: any) => {
          if (parent.filterField && Array.isArray(parent.typeValues) && parent.typeValues.length > 0) {
            filterHierarchy.push({ field: parent.filterField, values: parent.typeValues.filter((v: any) => !!v) });
          }
        });
      }
      if (leaf.filterField && Array.isArray(leaf.typeValues) && leaf.typeValues.length > 0) {
        filterHierarchy.push({ field: leaf.filterField, values: leaf.typeValues.filter((v: any) => !!v) });
      }
      filterHierarchy.forEach(({ field, values }) => {
        const prop = groupProperties.find((p: any) => p.id === field);
        if (values.length > 0 && prop) {
          filteredGroupItems = filteredGroupItems.filter((item: any) =>
            itemMatchesTypeValues(item[field], values, prop.type)
          );
        }
      });
      groupItems = filteredGroupItems;
      let dateFieldId = rootGroup?.dateFieldId || dashboard.globalDateField;
      if (leaf.dateFieldOverride && leaf.dateFieldOverride.single) {
        dateFieldId = leaf.dateFieldOverride.single;
      }
      if (!dateFieldId && groupProperties.length > 0) {
        const firstDate = groupProperties.find((p: any) => p.type === 'date' || p.type === 'date_range');
        if (firstDate) dateFieldId = firstDate.id;
      }
      const dateField = groupProperties.find((p: any) => p.id === dateFieldId);
      if (!dateField) return;
      daysOfMonth.forEach((day) => {
        const key = day.toLocaleDateString('fr-CA'); // format YYYY-MM-DD
        if (!daily[key]) daily[key] = {};
        if (!dailyObjectDurations[key]) dailyObjectDurations[key] = {};
        if (!dailyObjectDurations[key][leaf.id]) dailyObjectDurations[key][leaf.id] = {};

        groupItems.forEach((item: any) => {
          const segments = Array.isArray(item._eventSegments) ? item._eventSegments : [];
          const segmentsForDay = segments.filter((seg: any) => {
            if (typeof seg.label !== 'string' || seg.label.trim() === '' || !dateField || seg.label !== dateField.name) return false;
            const segStart = new Date(seg.start);
            const segEnd = new Date(seg.end);
            return segStart.toLocaleDateString('fr-CA') === key && segEnd.toLocaleDateString('fr-CA') === key;
          });
          let totalHours = 0;
          segmentsForDay.forEach((seg: any) => {
            const segStart = new Date(seg.start);
            const segEnd = new Date(seg.end);
            const hours = (segEnd.getTime() - segStart.getTime()) / (1000 * 60 * 60);
            totalHours += Math.max(0, hours);
          });
          if (totalHours > 0) {
            dailyObjectDurations[key][leaf.id][item.id] = totalHours;
          }
        });

        const itemsForDay = Object.keys(dailyObjectDurations[key][leaf.id]);
        let count = 0;
        itemsForDay.forEach((itemId) => {
          const item = groupItems.find((it: any) => it.id === itemId);
          let eventStyle = null;
          try {
            eventStyle = getEventStyle(item, dateField, 1, 17);
          } catch (e) {}
          if (eventStyle && eventStyle.workdayDates && eventStyle.workdayDates.length > 0) {
            const startDate = eventStyle.workdayDates[0];
            const endDate = getItemEndDate(item, dateField) || eventStyle.endDate || startDate;
            const crossesMonth =
              startDate.getFullYear() !== endDate.getFullYear() || startDate.getMonth() !== endDate.getMonth();
            const targetKey = crossesMonth ? getFirstWorkdayKey(endDate) : dayKey(startDate);
            if (key === targetKey) {
              count++;
            }
          }
        });
        daily[key][leaf.id] = {
          count,
          duration: itemsForDay.reduce((acc: number, itemId: string) => {
            const part = dailyObjectDurations[key][leaf.id][itemId];
            return acc + (typeof part === 'number' ? part : 0);
          }, 0),
        };
      });
    });

    leafColumns.forEach((leaf: any) => {
      const rootGroup = leaf._parentPath && leaf._parentPath.length > 0 ? leaf._parentPath[0] : null;
      const groupCollectionId = rootGroup?.collectionId || dashboard.sourceCollectionId;
      const groupCollection = collections.find((c: any) => c.id === groupCollectionId) || collection;
      const groupProperties = groupCollection?.properties || [];
      let dateFieldId = rootGroup?.dateFieldId || dashboard.globalDateField;
      if (leaf.dateFieldOverride && leaf.dateFieldOverride.single) {
        dateFieldId = leaf.dateFieldOverride.single;
      }
      const dateField = groupProperties.find((p: any) => p.id === dateFieldId);
      if (!dateField || dateField.type !== 'date_range') return;
      const typeValues = leaf.typeValues && leaf.typeValues.length > 0 ? leaf.typeValues : null;
      const spans: any[] = [];
      const groupItems = groupCollection?.items || [];
      groupItems.forEach((item: any) => {
        if (typeValues && resolvedTypeField) {
          const propType = groupProperties.find((p: any) => p.id === resolvedTypeField)?.type;
          if (!itemMatchesTypeValues(item[resolvedTypeField], typeValues, propType)) return;
        }
        const value = item[dateField.id];
        if (value && value.start && value.end) {
          const start = new Date(value.start);
          const end = new Date(value.end);
          spans.push({
            item,
            start,
            end,
            label: getNameValueUtil(item, groupCollection),
          });
        }
      });
      spansByLeaf[leaf.id] = spans;
      spansByLeafDay[leaf.id] = {};
      daysOfMonth.forEach((day) => {
        const key = dayKey(day);
        const found = spans.find((span) => day >= span.start && day <= span.end);
        if (found) {
          spansByLeafDay[leaf.id][key] = {
            ...found,
            isStart: dayKey(found.start) === key,
            isEnd: dayKey(found.end) === key,
          };
        }
      });
    });

    return { daily, spansByLeaf, spansByLeafDay, dailyObjectDurations };
  }, [dashboard, collection, collections, properties, filteredItems, leafColumns, resolvedTypeField, periodStart, periodEnd]);


  if (!dashboard) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400">
        Aucun dashboard sélectionné
      </div>
    );
  }

  const getDisplayCountForDay = (leafId: string, key: string) => {
    if (!aggregates) return 0;
    const cell = aggregates.daily[key]?.[leafId];
    const span = aggregates.spansByLeafDay?.[leafId]?.[key];
    if (span) {
      const startDate = span.start ? new Date(span.start) : null;
      const endDate = span.end ? new Date(span.end) : null;
      const crossesMonth =
        startDate && endDate
          ? startDate.getFullYear() !== endDate.getFullYear() || startDate.getMonth() !== endDate.getMonth()
          : false;
      if (crossesMonth && endDate) {
        return key === getFirstWorkdayKey(endDate) ? 1 : 0;
      }
      return span.isStart ? 1 : 0;
    }
    return cell && cell.count ? cell.count : 0;
  };

  const renderWeekTable = (week: { week: number; days: Date[] }) => {
    if (!aggregates) return null;
    const spanForDay = (leafId: string, key: string) => aggregates.spansByLeafDay?.[leafId]?.[key];
    const remainingCols = leafColumns.length * metricsPerLeaf;
    const totalColSpan = Math.max(1, Math.ceil(remainingCols / 2));
    const perCollectionColSpan = Math.max(1, remainingCols - totalColSpan);
    const countForDays = (days: Date[], leafId: string) => {
      let count = 0;
      days.forEach((day) => {
        const key = dayKey(day);
        count += getDisplayCountForDay(leafId, key);
      });
      return count;
    };

    const getWeekCollectionTotals = () => {
      const totals = new Map<string, { name: string; count: number; duration: number }>();
      week.days.forEach((day) => {
        const key = dayKey(day);
        leafColumns.forEach((leaf: any) => {
          const collectionId = getLeafCollectionId(leaf) || dashboard?.sourceCollectionId;
          if (!collectionId) return;
          const collectionName = collections.find((c: any) => c.id === collectionId)?.name || 'Collection';
          if (!totals.has(collectionId)) {
            totals.set(collectionId, { name: collectionName, count: 0, duration: 0 });
          }
          const entry = totals.get(collectionId)!;
          entry.count += getDisplayCountForDay(leaf.id, key);
          const cell = aggregates.daily[key]?.[leaf.id];
          if (cell && cell.duration) {
            entry.duration += cell.duration;
          }
        });
      });
      return Array.from(totals.values());
    };

    return (
      <div key={week.week} className="rounded-xl border border-black/5 dark:border-white/10 shadow-sm bg-white/70 dark:bg-neutral-900/50 backdrop-blur">
        <table className="min-w-full text-xs table-fixed">
          <colgroup>
            <col style={{ width: "30px" }} />
            <col style={{ width: "120px" }} />
            {leafColumns.map((leaf) => (
              <col key={leaf.id + "-count"} style={{ width: "100px" }} />
            ))}
            {leafColumns.map((leaf) => (
              <col key={leaf.id + "-duration"} style={{ width: "100px" }} />
            ))}
          </colgroup>
          <thead className="bg-neutral-100/90 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
            {(() => {
              const headerRows = getTableHeaderRows();
              return (
                <>
                  <tr>
                    <th
                      className="px-2 py-1.5 text-left border-b border-black/15 dark:border-white/15 whitespace-nowrap"
                      rowSpan={headerRows.length}
                    >
                      Total durée
                    </th>
                    <th
                      className="px-2 py-1.5 text-left border-b border-black/15 dark:border-white/15 whitespace-nowrap"
                      rowSpan={headerRows.length}
                    >
                      Semaine {week.week}
                      {week.days.length > 0 && (
                        <span className="ml-2 text-xs text-neutral-600 dark:text-neutral-400 font-normal">
                          du {week.days[0].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          {' '}au {week.days[week.days.length - 1].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      )}
                    </th>
                    {headerRows[0].map((cell: any, i: number) => {
                      const tone = getCollectionTone(cell?.node?.collectionId || dashboard?.sourceCollectionId);
                      return (
                      <th
                        key={i}
                        colSpan={cell.colSpan}
                        rowSpan={cell.rowSpan}
                        className={`px-2 py-1.5 text-center border-b border-l border-black/10 dark:border-white/10 ${cell.isLeaf ? tone.soft : tone.strong}`}
                      >
                        {cell.label}
                      </th>
                    );
                    })}
                  </tr>
                  {headerRows.slice(1).map((row, rowIdx) => (
                    <tr key={rowIdx + 1}>
                      {row.map((cell: any, i: number) => {
                        const tone = getCollectionTone(cell?.node?.collectionId || dashboard?.sourceCollectionId);
                        return (
                        <th
                          key={i}
                          colSpan={cell.colSpan}
                          rowSpan={cell.rowSpan}
                          className={`px-2 py-1.5 text-center border-b border-l border-black/10 dark:border-white/10 ${cell.isLeaf ? tone.soft : tone.strong}`}
                        >
                          {cell.label}
                        </th>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="bg-neutral-100/90 text-neutral-700 dark:bg-neutral-900/70 dark:text-neutral-300">
                    <th className="px-2 py-1 text-left border-b border-l border-black/10 dark:border-white/10 max-w-[50px]">Durée totale</th>
                    <th className="px-2 py-1 text-left border-b border-l border-black/10 dark:border-white/10">Jour</th>
                    {leafColumns.map((leaf: any) => (
                      <React.Fragment key={leaf.id + '-metrics'}>
                        {(() => {
                          const tone = getCollectionTone(getLeafCollectionId(leaf));
                          return (
                            <>
                              {activeRecapMetrics.map((metric) => (
                                <th
                                  key={`${leaf.id}-${metric}`}
                                  className={`px-2 py-1 text-left border-b border-l border-black/10 dark:border-white/10 ${tone.soft}`}
                                >
                                  {metric === 'count' ? 'Nombre' : 'Durée'}
                                </th>
                              ))}
                            </>
                          );
                        })()}
                      </React.Fragment>
                    ))}
                  </tr>
                </>
              );
            })()}
          </thead>
          <tbody>
            {week.days.map((day) => {
              const key = dayKey(day);
              const totalDuration = leafColumns.reduce((acc, leaf) => {
                const cell = aggregates.daily[key]?.[leaf.id];
                return acc + (cell && cell.duration ? cell.duration : 0);
              }, 0);
              return (
                <tr key={`${week.week}-${key}`} className="border-b border-black/10 dark:border-white/10 odd:bg-neutral-50/80 dark:odd:bg-white/5">
                  <td className="px-2 py-1.5 text-right text-neutral-700 dark:text-white border-r border-black/10 dark:border-white/10 font-bold max-w-[50px]">
                    {totalDuration ? formatDurationHeureMinute(totalDuration) : ''}
                  </td>
                  <td className="px-2 py-1.5 text-neutral-600 dark:text-neutral-200 font-medium border-r border-black/10 dark:border-white/10">
                    {day.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </td>
                  {leafColumns.map((leaf: any) => {
                      const cell = aggregates.daily[key]?.[leaf.id] || { count: 0, duration: 0 };
                      const span = spanForDay(leaf.id, key);
                      const displayCount = getDisplayCountForDay(leaf.id, key);
                      const countValue = displayCount > 0 ? displayCount.toString() : '';
                      const itemIds = Object.keys(aggregates.dailyObjectDurations[key]?.[leaf.id] || {});
                      const itemsInCell = itemIds
                        .map((itemId) => {
                          for (const coll of collections) {
                            const found = coll.items?.find((it: any) => it.id === itemId);
                            if (found) return { ...found, _collection: coll };
                          }
                          return null;
                        })
                        .filter(Boolean);
                      const cellContent = (
                        <>
                          {cell.duration ? formatDurationHeureMinute(cell.duration) : ''}
                          {itemsInCell.length > 0 && (
                            <div className="relative inline-block">
                              <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-30 min-w-[180px] max-w-[260px]">
                                <div className="rounded-md border border-black/10 dark:border-white/10 bg-white/95 dark:bg-neutral-900/95 shadow-lg p-2">
                                  <div className="flex flex-col gap-1">
                                    {itemsInCell.map((item) => (
                                      <ItemContextMenu
                                        key={item.id}
                                        item={item}
                                        onViewDetail={() => onViewDetail({ ...item, _collection: item._collection })}
                                        onDelete={() => onDelete(item?.id)}
                                        canEdit={false}
                                        quickEditProperties={[]}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => onViewDetail({ ...item, _collection: item._collection })}
                                          className="w-full text-left text-[11px] text-neutral-700 dark:text-neutral-200 hover:text-indigo-600 dark:hover:text-indigo-400"
                                        >
                                          {getNameValueUtil(item, item._collection)}
                                        </button>
                                      </ItemContextMenu>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {span && (
                            <div className="text-[11px] text-neutral-700 dark:text-white truncate">{span.label}</div>
                          )}
                        </>
                      );
                      const hasObject = itemsInCell.length > 0;
                      const countClasses = span
                        ? `px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 max-w-[130px] overflow-hidden bg-white/60 dark:bg-white/5${hasObject ? ' bg-white/80 dark:bg-white/10' : ''}`
                        : `px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 max-w-[130px] overflow-hidden bg-neutral-100/80 dark:bg-neutral-900/40${hasObject ? ' bg-white/70 dark:bg-white/10' : ''}`;
                      const durationClasses = span
                        ? `group relative overflow-visible px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l ${span.isEnd ? '' : ''} ${
                            span.isStart ? 'rounded-l-md' : ''
                          } border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5${hasObject ? ' bg-white/80 dark:bg-white/10' : ''}`
                        : `group relative overflow-visible px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 max-w-[130px] bg-white/70 dark:bg-neutral-900/30${hasObject ? ' bg-white/80 dark:bg-white/10' : ''}`;
                      // Afficher tous les items avec leur menu contextuel
                      const renderCellWithMenu = (content: React.ReactNode, className: string) => {
                        const hasItems = itemsInCell.length > 0;
                        const shouldWrap = Boolean(onShowNewItemModalForCollection || hasItems);
                        if (!shouldWrap) {
                          return <td className={className}>{content}</td>;
                        }
                        return (
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <td className={className}>{content}</td>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              {hasItems && (
                                <>
                                  {itemsInCell.map((item: any) => (
                                    <ContextMenuItem
                                      key={item.id}
                                      onSelect={() => onViewDetail({ ...item, _collection: item._collection })}
                                    >
                                      {getNameValueUtil(item, item._collection)}
                                    </ContextMenuItem>
                                  ))}
                                </>
                              )}
                              {onShowNewItemModalForCollection && (
                                <>
                                  {hasItems && <div className="my-1 h-px bg-neutral-700" />}
                                  <ContextMenuItem onSelect={() => handleCreateItemFromCell(leaf, day)}>
                                    Créer un objet
                                  </ContextMenuItem>
                                </>
                              )}
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      };
                      return (
                        <React.Fragment key={`${week.week}-${key}-${leaf.id}`}>
                          {activeRecapMetrics.map((metric) => {
                            if (metric === 'count') {
                              return (
                                <React.Fragment key={`${week.week}-${key}-${leaf.id}-count`}>
                                  {renderCellWithMenu(countValue, countClasses)}
                                </React.Fragment>
                              );
                            }
                            return (
                              <React.Fragment key={`${week.week}-${key}-${leaf.id}-duration`}>
                                {renderCellWithMenu(cellContent, durationClasses)}
                              </React.Fragment>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                </tr>
              );
            })}
            <tr className="bg-neutral-100/90 dark:bg-neutral-900/60">
              <td className="px-2 py-1.5 font-bold text-neutral-700 dark:text-white border-r border-black/10 dark:border-white/10" colSpan={2}>Total général</td>
              {(() => {
                let totalCount = 0;
                let totalDuration = 0;
                leafColumns.forEach((leaf: any) => {
                  const count = countForDays(week.days, leaf.id);
                  let duration = 0;
                  week.days.forEach((day) => {
                    const key = dayKey(day);
                    const cell = aggregates.daily[key]?.[leaf.id];
                    const span = spanForDay(leaf.id, key);
                    if (cell) {
                      duration += cell.duration;
                    }
                  });
                  totalCount += count;
                  totalDuration += duration;
                });
                const perCollection = getWeekCollectionTotals();
                const summaryParts = [] as string[];
                if (activeRecapMetrics.includes('count')) {
                  summaryParts.push(`${totalCount || 0} projet(s)`);
                }
                if (activeRecapMetrics.includes('duration')) {
                  summaryParts.push(totalDuration ? formatDurationHeureMinute(totalDuration) : '0h00');
                }
                return [
                  <td key="total-count" className="px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 font-bold" colSpan={totalColSpan}>
                    {summaryParts.join(' - ') || '0'}
                  </td>,
                  <td key="total-by-collection" className="px-2 py-1.5 text-left text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10" colSpan={perCollectionColSpan}>
                    <div className="flex flex-wrap gap-2">
                      {perCollection.length === 0 && (
                        <span className="text-neutral-500">Aucune collection</span>
                      )}
                      {perCollection.map((col) => (
                        <span key={col.name} className="px-2 py-0.5 rounded-full bg-red-500/10 text-neutral-700 dark:text-white text-xs border border-indigo-500/20">
                          {col.name} · {col.count} · {formatDurationHeureMinute(col.duration)}
                        </span>
                      ))}
                    </div>
                  </td>
                ];
              })()}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderMonthTotals = () => {
    if (!aggregates) return null;
    const remainingCols = leafColumns.length * metricsPerLeaf;
    const totalColSpan = Math.max(1, Math.ceil(remainingCols / 2));
    const perCollectionColSpan = Math.max(1, remainingCols - totalColSpan);
    const countForAllDays = (leafId: string) => {
      let count = 0;
      Object.keys(aggregates.daily).forEach((key) => {
        count += getDisplayCountForDay(leafId, key);
      });
      return count;
    };

    const getMonthCollectionTotals = () => {
      const totals = new Map<string, { name: string; count: number; duration: number }>();
      Object.keys(aggregates.daily || {}).forEach((key) => {
        leafColumns.forEach((leaf: any) => {
          const collectionId = getLeafCollectionId(leaf) || dashboard?.sourceCollectionId;
          if (!collectionId) return;
          const collectionName = collections.find((c: any) => c.id === collectionId)?.name || 'Collection';
          if (!totals.has(collectionId)) {
            totals.set(collectionId, { name: collectionName, count: 0, duration: 0 });
          }
          const entry = totals.get(collectionId)!;
          entry.count += getDisplayCountForDay(leaf.id, key);
          const cell = aggregates.daily[key]?.[leaf.id];
          if (cell && cell.duration) {
            entry.duration += cell.duration;
          }
        });
      });
      return Array.from(totals.values());
    };
    return (
      <div className="overflow-auto rounded-xl border border-black/5 dark:border-white/10 shadow-sm bg-white/70 dark:bg-neutral-900/50 backdrop-blur">
        <table className="min-w-full text-xs table-fixed">
          <colgroup>
            <col style={{ width: '120px' }} />
            {leafColumns.map((_, i) => (
              <col key={i + '-count'} style={{ width: '80px' }} />
            ))}
            {leafColumns.map((_, i) => (
              <col key={i + '-duration'} style={{ width: '100px' }} />
            ))}
          </colgroup>
          <thead className="bg-neutral-100/90 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
            <tr>
              <th className="px-2 py-1.5 text-left border-b border-black/15 dark:border-white/15">Total Mois</th>
              {leafColumns.map((leaf) => {
                const tone = getCollectionTone(getLeafCollectionId(leaf));
                return (
                  <th
                    key={leaf.id}
                    colSpan={metricsPerLeaf}
                    className={`px-2 py-1.5 text-left border-b border-l border-black/10 dark:border-white/10 ${tone.strong}`}
                  >
                    {leaf.label}
                  </th>
                );
              })}
            </tr>
            <tr className="bg-neutral-100/90 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
              <th className="px-2 py-1 text-left border-b border-black/15 dark:border-white/15">Mois</th>
              {leafColumns.map((leaf) => (
                <React.Fragment key={`${leaf.id}-month-metrics`}>
                  {(() => {
                    const tone = getCollectionTone(getLeafCollectionId(leaf));
                    return (
                      <>
                        {activeRecapMetrics.map((metric) => (
                          <th
                            key={`${leaf.id}-month-${metric}`}
                            className={`px-2 py-1 text-left border-b border-l border-black/10 dark:border-white/10 ${tone.soft}`}
                          >
                            {metric === 'count' ? 'Nombre' : 'Durée'}
                          </th>
                        ))}
                      </>
                    );
                  })()}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white/70 dark:bg-white/5">
              <td className="px-2 py-1.5 font-semibold text-neutral-700 dark:text-white border-r border-black/10 dark:border-white/10">Total Mois</td>
              {leafColumns.map((leaf) => {
                const count = countForAllDays(leaf.id);
                let duration = 0;
                Object.keys(aggregates.daily).forEach((key) => {
                  const cell = aggregates.daily[key]?.[leaf.id];
                  if (cell) {
                    duration += cell.duration;
                  }
                });
                return (
                  <React.Fragment key={`month-total-${leaf.id}`}>
                    {activeRecapMetrics.map((metric) => (
                      <td
                        key={`month-total-${leaf.id}-${metric}`}
                        className="px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10"
                      >
                        {metric === 'count'
                          ? (count || '')
                          : (duration ? formatDurationHeureMinute(duration) : '')}
                      </td>
                    ))}
                  </React.Fragment>
                );
              })}
            </tr>
            <tr className="bg-neutral-100/90 dark:bg-neutral-900/60">
              <td className="px-2 py-1.5 font-bold text-neutral-700 dark:text-white border-r border-black/10 dark:border-white/10" colSpan={2}>Total général</td>
              {(() => {
                let totalCount = 0;
                let totalDuration = 0;
                leafColumns.forEach((leaf: any) => {
                  const count = countForAllDays(leaf.id);
                  let duration = 0;
                  Object.keys(aggregates.daily).forEach((key) => {
                    const cell = aggregates.daily[key]?.[leaf.id];
                    if (cell) {
                      duration += cell.duration;
                    }
                  });
                  totalCount += count;
                  totalDuration += duration;
                });
                const perCollection = getMonthCollectionTotals();
                const summaryParts = [] as string[];
                if (activeRecapMetrics.includes('count')) {
                  summaryParts.push(`${totalCount || 0} projet(s)`);
                }
                if (activeRecapMetrics.includes('duration')) {
                  summaryParts.push(totalDuration ? formatDurationHeureMinute(totalDuration) : '0h00');
                }
                return [
                  <td key="total-count" className="px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 font-bold" colSpan={totalColSpan}>
                    {summaryParts.join(' - ') || '0'}
                  </td>,
                  <td key="total-by-collection" className="px-2 py-1.5 text-left text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10" colSpan={perCollectionColSpan}>
                    <div className="flex flex-wrap gap-2">
                      {perCollection.length === 0 && (
                        <span className="text-neutral-500">Aucune collection</span>
                      )}
                      {perCollection.map((col) => (
                        <span key={col.name} className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-neutral-700 dark:text-white text-xs border border-indigo-500/20">
                          {col.name} · {col.count} · {formatDurationHeureMinute(col.duration)}
                        </span>
                      ))}
                    </div>
                  </td>
                ];
              })()}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const getCollectionDateField = (targetCollection: any, rootNode?: any) => {
    const targetProps = targetCollection?.properties || [];
    if (rootNode?.dateFieldId) {
      const rootDate = targetProps.find((p: any) => p.id === rootNode.dateFieldId);
      if (rootDate) return rootDate;
    }
    if (dashboard?.globalDateField) {
      const globalProp = targetProps.find((p: any) => p.id === dashboard.globalDateField);
      if (globalProp) return globalProp;
    }
    return targetProps.find((p: any) => p.type === 'date' || p.type === 'date_range') || null;
  };

  const filterItemsByPeriod = (items: any[], dateField: any) => {
    if (!periodStart || !periodEnd) return items;
    if (!dateField) return [];
    return (items || []).filter((item: any) => {
      const endDate = getItemEndDate(item, dateField);
      if (!endDate) return false;
      return endDate >= periodStart && endDate <= periodEnd;
    });
  };

  const buildNodeFilters = (node: any, props: any[]) => {
    const filters: { field: string; values: string[]; type?: string }[] = [];
    if (node?.filterField && Array.isArray(node.typeValues) && node.typeValues.length > 0) {
      const prop = props.find((p: any) => p.id === node.filterField);
      filters.push({ field: node.filterField, values: node.typeValues, type: prop?.type });
    }
    if (node?.groupField && node.groupValue) {
      const prop = props.find((p: any) => p.id === node.groupField);
      filters.push({ field: node.groupField, values: [node.groupValue], type: prop?.type });
    }
    return filters;
  };

  const matchesFilters = (item: any, filters: { field: string; values: string[]; type?: string }[]) => {
    if (!filters.length) return true;
    return filters.every((filter) => itemMatchesTypeValues(item?.[filter.field], filter.values, filter.type));
  };

  const buildRootGroupPredicates = (rootNode: any, props: any[]) => {
    const leaves = getLeavesWithPath([rootNode]);
    if (!leaves.length) return [] as ((item: any) => boolean)[];
    return leaves.map((leaf: any) => {
      const pathNodes = [...(leaf._parentPath || []), leaf];
      const filters = pathNodes.flatMap((node) => buildNodeFilters(node, props));
      return (item: any) => matchesFilters(item, filters);
    });
  };

  const tableSections = useMemo(() => {
    if (!dashboard) return [] as any[];
    const filters = dashboardFilters?.[dashboard.id] || [];
    const fakeViewConfig = { filters } as any;
    return (dashboard.columnTree || [])
      .map((rootNode: any) => {
        const targetCollectionId = rootNode?.collectionId || dashboard.sourceCollectionId;
        const targetCollection = collections.find((c: any) => c.id === targetCollectionId);
        if (!targetCollection) return null;
        const targetProps = targetCollection?.properties || [];
        const dateField = getCollectionDateField(targetCollection, rootNode);
        if (!dateField) return null;
        const baseItems = getFilteredItems(
          targetCollection,
          fakeViewConfig,
          { collectionId: null, ids: [] },
          targetCollection.id,
          collections
        );
        const predicates = buildRootGroupPredicates(rootNode, targetProps);
        const rootFilteredItems = predicates.length
          ? baseItems.filter((item: any) => predicates.some((fn) => fn(item)))
          : baseItems;
        const periodItems = filterItemsByPeriod(rootFilteredItems, dateField);
        if (!periodItems.length) return null;
        const orderedProperties = getOrderedProperties(targetCollection, null);
        const titleParts = [targetCollection.name || 'Sans nom'];
        if (rootNode?.label) titleParts.push(rootNode.label);
        const baseTitle = titleParts.join(' · ');

        if (periodScope === 'year') {
          const byMonth = new Map<number, any[]>();
          periodItems.forEach((item: any) => {
            const endDate = getItemEndDate(item, dateField);
            if (!endDate) return;
            if (endDate.getFullYear() !== dashboard.year) return;
            const monthIndex = endDate.getMonth();
            const list = byMonth.get(monthIndex) || [];
            list.push(item);
            byMonth.set(monthIndex, list);
          });
          const monthBuckets = Array.from(byMonth.entries())
            .sort(([a], [b]) => a - b)
            .map(([monthIndex, items]) => ({
              monthIndex,
              label: MONTH_NAMES[monthIndex],
              items,
            }));
          if (!monthBuckets.length) return null;
          return {
            key: rootNode.id || targetCollection.id,
            title: baseTitle,
            collection: targetCollection,
            items: periodItems,
            orderedProperties,
            dateFieldLabel: dateField?.name,
            monthBuckets,
          };
        }

        return {
          key: rootNode.id || targetCollection.id,
          title: baseTitle,
          collection: targetCollection,
          items: periodItems,
          orderedProperties,
          dateFieldLabel: dateField?.name,
        };
      })
        .filter(Boolean);
  }, [dashboard, collections, dashboardFilters, periodStart, periodEnd, periodScope]);

  const groupedWeeks = useMemo(() => {
    if (!dashboard?.month || !dashboard?.year || periodScope !== 'month') return [];
    const year = dashboard.year;
    const month = dashboard.month - 1; // JS: 0 = janvier
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const weeks: { week: number; days: Date[] }[] = [];
    let current = getMonday(firstDay);
    let weekNum = 1;
    while (current <= lastDay) {
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(current);
        d.setDate(current.getDate() + i);
        if (d.getMonth() === month && d <= lastDay) {
          const dayOfWeek = d.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            days.push(d);
          }
        }
      }
      if (days.length > 0) {
        weeks.push({ week: weekNum, days });
      }
      current.setDate(current.getDate() + 7);
      weekNum++;
    }
    return weeks;
  }, [dashboard?.month, dashboard?.year, periodScope]);

  const groupedMonths = useMemo(() => {
    if (!dashboard?.year || periodScope !== 'year') return [];
    return Array.from({ length: 12 }).map((_, idx) => ({
      month: idx,
      label: MONTH_NAMES[idx],
    }));
  }, [dashboard?.year, periodScope]);

  const renderYearTable = () => {
    if (!aggregates) return null;
    const remainingCols = leafColumns.length * metricsPerLeaf;
    const totalColSpan = Math.max(1, Math.ceil(remainingCols / 2));
    const perCollectionColSpan = Math.max(1, remainingCols - totalColSpan);
    const yearLabel = dashboard.year;
    const rootGroups = (dashboard.columnTree || []).map((rootNode: any) => {
      const leaves = getLeavesWithPath([rootNode]);
      return {
        node: rootNode,
        leafIds: leaves.map((leaf: any) => leaf.id),
        colSpan: Math.max(1, leaves.length * metricsPerLeaf),
      };
    });

    const totalsByMonthAndLeaf = (monthIndex: number, leafId: string) => {
      let count = 0;
      let duration = 0;
      Object.keys(aggregates.daily).forEach((key) => {
        const [y, m] = key.split('-');
        if (Number(y) !== yearLabel) return;
        if (Number(m) !== monthIndex + 1) return;
        const cell = aggregates.daily[key]?.[leafId];
        if (cell) {
          count += getDisplayCountForDay(leafId, key);
          duration += cell.duration;
        }
      });
      return { count, duration };
    };

    const totalsByMonthAndRoot = (monthIndex: number, leafIds: string[]) => {
      let count = 0;
      let duration = 0;
      Object.keys(aggregates.daily).forEach((key) => {
        const [y, m] = key.split('-');
        if (Number(y) !== yearLabel) return;
        if (Number(m) !== monthIndex + 1) return;
        leafIds.forEach((leafId) => {
          const cell = aggregates.daily[key]?.[leafId];
          if (cell) {
            count += getDisplayCountForDay(leafId, key);
            duration += cell.duration;
          }
        });
      });
      return { count, duration };
    };

    const getYearCollectionTotals = () => {
      const totals = new Map<string, { name: string; count: number; duration: number }>();
      Object.keys(aggregates.daily || {}).forEach((key) => {
        leafColumns.forEach((leaf: any) => {
          const collectionId = getLeafCollectionId(leaf) || dashboard?.sourceCollectionId;
          if (!collectionId) return;
          const collectionName = collections.find((c: any) => c.id === collectionId)?.name || 'Collection';
          if (!totals.has(collectionId)) {
            totals.set(collectionId, { name: collectionName, count: 0, duration: 0 });
          }
          const entry = totals.get(collectionId)!;
          entry.count += getDisplayCountForDay(leaf.id, key);
          const cell = aggregates.daily[key]?.[leaf.id];
          if (cell && cell.duration) {
            entry.duration += cell.duration;
          }
        });
      });
      return Array.from(totals.values());
    };

    return (
      <div className="overflow-auto rounded-xl border border-black/5 dark:border-white/10 shadow-sm bg-white/70 dark:bg-neutral-900/50 backdrop-blur">
        <table className="min-w-full text-xs table-fixed">
          <colgroup>
            <col style={{ width: '140px' }} />
            {leafColumns.map((_, i) => (
              <col key={`year-${i}-metric`} style={{ width: '100px' }} />
            ))}
          </colgroup>
          <thead className="bg-neutral-100/90 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
            {(() => {
              const headerRows = getTableHeaderRows();
              return (
                <>
                  <tr>
                    <th
                      className="px-2 py-1.5 text-left border-b border-black/15 dark:border-white/15 whitespace-nowrap"
                      rowSpan={headerRows.length}
                    >
                      Année {yearLabel}
                    </th>
                    {headerRows[0].map((cell: any, i: number) => {
                      const tone = getCollectionTone(cell?.node?.collectionId || dashboard?.sourceCollectionId);
                      return (
                        <th
                          key={i}
                          colSpan={cell.colSpan}
                          rowSpan={cell.rowSpan}
                          className={`px-2 py-1.5 text-center border-b border-l border-black/10 dark:border-white/10 ${cell.isLeaf ? tone.soft : tone.strong}`}
                        >
                          {cell.label}
                        </th>
                      );
                    })}
                  </tr>
                  {headerRows.slice(1).map((row, rowIdx) => (
                    <tr key={rowIdx + 1}>
                      {row.map((cell: any, i: number) => {
                        const tone = getCollectionTone(cell?.node?.collectionId || dashboard?.sourceCollectionId);
                        return (
                          <th
                            key={i}
                            colSpan={cell.colSpan}
                            rowSpan={cell.rowSpan}
                            className={`px-2 py-1.5 text-center border-b border-l border-black/10 dark:border-white/10 ${cell.isLeaf ? tone.soft : tone.strong}`}
                          >
                            {cell.label}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="bg-neutral-100/90 dark:bg-neutral-900/70 text-neutral-700 dark:text-neutral-300">
                    <th className="px-2 py-1 text-left border-b border-black/15 dark:border-white/15">Mois</th>
                    {leafColumns.map((leaf: any) => (
                      <React.Fragment key={leaf.id + '-year-metrics'}>
                        {(() => {
                          const tone = getCollectionTone(getLeafCollectionId(leaf));
                          return (
                            <>
                              {activeRecapMetrics.map((metric) => (
                                <th
                                  key={`${leaf.id}-year-${metric}`}
                                  className={`px-2 py-1 text-left border-b border-l border-black/10 dark:border-white/10 ${tone.soft}`}
                                >
                                  {metric === 'count' ? 'Nombre' : 'Durée'}
                                </th>
                              ))}
                            </>
                          );
                        })()}
                      </React.Fragment>
                    ))}
                  </tr>
                </>
              );
            })()}
          </thead>
          <tbody>
            {groupedMonths.map((month) => (
              <React.Fragment key={`year-row-${month.month}`}>
                <tr className="border-b border-black/10 dark:border-white/10 odd:bg-neutral-50/80 dark:odd:bg-white/5">
                  <td className="px-2 py-1.5 text-neutral-700 dark:text-white border-r border-black/10 dark:border-white/10">
                    {month.label}
                  </td>
                  {leafColumns.map((leaf) => {
                    const totals = totalsByMonthAndLeaf(month.month, leaf.id);
                    return (
                      <React.Fragment key={`year-${month.month}-${leaf.id}`}>
                        {activeRecapMetrics.map((metric) => (
                          <td
                            key={`year-${month.month}-${leaf.id}-${metric}`}
                            className="px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10"
                          >
                            {metric === 'count'
                              ? (totals.count || '')
                              : (totals.duration ? formatDurationHeureMinute(totals.duration) : '')}
                          </td>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tr>
                {rootGroups.length > 0 && (
                  <tr className="bg-neutral-100/70 dark:bg-neutral-900/40">
                    <td className="px-2 py-1.5 text-neutral-600 dark:text-neutral-300 border-r border-black/10 dark:border-white/10 text-xs">
                      Total {month.label}
                    </td>
                    {rootGroups.map((group) => {
                      const groupCollectionId = group.node?.collectionId || dashboard.sourceCollectionId;
                      const groupCollectionName = collections.find((c: any) => c.id === groupCollectionId)?.name || 'Collection';
                      const totals = totalsByMonthAndRoot(month.month, group.leafIds);
                      const summaryParts = [] as string[];
                      if (activeRecapMetrics.includes('count')) {
                        summaryParts.push(`${totals.count || 0} ${groupCollectionName}`);
                      }
                      if (activeRecapMetrics.includes('duration')) {
                        summaryParts.push(totals.duration ? formatDurationHeureMinute(totals.duration) : '0h00');
                      }
                      return (
                        <td
                          key={`year-total-${month.month}-${group.node?.id}`}
                          colSpan={group.colSpan}
                          className="px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 text-xs"
                        >
                          {summaryParts.join(' - ') || '0'}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </React.Fragment>
            ))}
            <tr className="bg-neutral-100/90 dark:bg-neutral-900/60">
              <td className="px-2 py-1.5 font-bold text-neutral-700 dark:text-white border-r border-black/10 dark:border-white/10" colSpan={2}>Total année</td>
              {(() => {
                let totalCount = 0;
                let totalDuration = 0;
                leafColumns.forEach((leaf: any) => {
                  Object.keys(aggregates.daily).forEach((key) => {
                    const cell = aggregates.daily[key]?.[leaf.id];
                    if (cell) {
                      totalDuration += cell.duration;
                      totalCount += getDisplayCountForDay(leaf.id, key);
                    }
                  });
                });
                const perCollection = getYearCollectionTotals();
                const summaryParts = [] as string[];
                if (activeRecapMetrics.includes('count')) {
                  summaryParts.push(`${totalCount || 0} projet(s)`);
                }
                if (activeRecapMetrics.includes('duration')) {
                  summaryParts.push(totalDuration ? formatDurationHeureMinute(totalDuration) : '0h00');
                }
                return [
                  <td key="year-total" className="px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 font-bold" colSpan={totalColSpan}>
                    {summaryParts.join(' - ') || '0'}
                  </td>,
                  <td key="year-by-collection" className="px-2 py-1.5 text-left text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10" colSpan={perCollectionColSpan}>
                    <div className="flex flex-wrap gap-2">
                      {perCollection.length === 0 && (
                        <span className="text-neutral-500">Aucune collection</span>
                      )}
                      {perCollection.map((col) => (
                        <span key={col.name} className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-neutral-700 dark:text-white text-xs border border-indigo-500/20">
                          {col.name} · {col.count} · {formatDurationHeureMinute(col.duration)}
                        </span>
                      ))}
                    </div>
                  </td>
                ];
              })()}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-4 p-4 overflow-auto bg-gradient-to-b from-white/70 via-white/50 to-transparent dark:from-neutral-950/40 dark:via-neutral-950/20">
      <div className={classNames.headerWrap}>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={dashboard.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className={classNames.titleInput}
          />
          <div className="flex flex-wrap gap-2">
            {(dashboard && dashboardFilters?.[dashboard.id] ? dashboardFilters[dashboard.id] : []).map((filter: any, idx: number) => {
              const prop = properties.find((p: any) => p.id === filter.property);
              return (
                <span key={idx} className={classNames.filterChip}>
                  <span>{prop?.name || filter.property} {filter.operator} {Array.isArray(filter.value) ? filter.value.join(', ') : String(filter.value)}</span>
                  <button onClick={() => handleRemoveFilter(idx)} className={classNames.filterRemove}><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </span>
              );
            })}
          </div>
          {showFilterModal && (
            <Suspense fallback={<div className="text-neutral-700 dark:text-white">Chargement…</div>}>
              <FilterModal
                properties={properties}
                collections={collections}
                onClose={() => setShowFilterModal(false)}
                onAdd={handleAddFilter}
              />
            </Suspense>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-full bg-white/60 dark:bg-white/5 p-1 border border-black/10 dark:border-white/10">
            {([
              { key: 'recap', label: 'Récap complet' },
              { key: 'table', label: 'Tableau' },
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onUpdate({ viewType: option.key })}
                className={
                  'px-3 py-1 text-xs rounded-full transition-all ' +
                  (viewType === option.key
                    ? 'bg-violet-500/30 text-violet-700 dark:text-violet-100 border border-violet-400/40 shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5')
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-full bg-white/60 dark:bg-white/5 p-1 border border-black/10 dark:border-white/10">
            {([
              { key: 'month', label: 'Mensuel' },
              { key: 'year', label: 'Annuel' },
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onUpdate({ periodScope: option.key })}
                className={
                  'px-3 py-1 text-xs rounded-full transition-all ' +
                  (periodScope === option.key
                    ? 'bg-violet-500/30 text-violet-700 dark:text-violet-100 border border-violet-400/40 shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5')
                }
              >
                {option.label}
              </button>
            ))}
          </div>
          {viewType === 'recap' && (
            <div className="inline-flex rounded-full bg-white/60 dark:bg-white/5 p-1 border border-black/10 dark:border-white/10">
              {([
                { key: 'count', label: 'Nombre' },
                { key: 'duration', label: 'Durée' },
              ] as const).map((option) => {
                const isActive = activeRecapMetrics.includes(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      if (isActive && activeRecapMetrics.length === 1) return;
                      const next = (isActive
                        ? activeRecapMetrics.filter((m) => m !== option.key)
                        : [...activeRecapMetrics, option.key]) as Array<'count' | 'duration'>;
                      onUpdate({ recapMetrics: next });
                    }}
                    className={
                      'px-3 py-1 text-xs rounded-full transition-all ' +
                      (isActive
                        ? 'bg-violet-500/30 text-violet-700 dark:text-violet-100 border border-violet-400/40 shadow-sm'
                        : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5')
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
          <select
            value={dashboard.month}
            onChange={(e) => onUpdate({ month: Number(e.target.value) })}
            className={classNames.select}
          >
            {months.map((label, idx) => (
              <option key={idx} value={idx + 1}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={dashboard.year}
            onChange={(e) => onUpdate({ year: Number(e.target.value) })}
            className={classNames.select}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>



      <div className="flex-1 text-neutral-700 dark:text-neutral-200">
        <div className="space-y-10 rounded-xl p-4">
          {viewType === 'recap' ? (
            periodScope === 'year' ? (
              renderYearTable()
            ) : (
              <DashboardRecapView
                groupedWeeks={groupedWeeks}
                renderWeekTable={renderWeekTable}
                renderMonthTotals={renderMonthTotals}
              />
            )
          ) : (
            <DashboardTableView
              sections={tableSections}
              collections={collections}
              hiddenBySection={dashboard.tableHiddenFieldsBySection || {}}
              onChangeHiddenBySection={(next) => onUpdate({ tableHiddenFieldsBySection: next })}
              onEdit={onEdit}
              onDelete={onDelete}
              onViewDetail={onViewDetail}
            />
          )}
        </div>
      </div>

      <DashboardColumnConfig
        dashboard={dashboard}
        collections={collections}
        properties={properties}
        leafColumns={leafColumns}
        onUpdate={onUpdate}
      />
    </div>
  );
};

export default DashboardShell;