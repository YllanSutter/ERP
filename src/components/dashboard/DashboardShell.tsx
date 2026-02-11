import React, { useEffect, useMemo, useState, Suspense } from 'react';
const FilterModal = React.lazy(() => import('@/components/modals/FilterModal'));
import ItemContextMenu from '@/components/menus/ItemContextMenu';
import { DashboardColumnNode, MonthlyDashboardConfig } from '@/lib/dashboardTypes';
import DashboardColumnConfig from './DashboardColumnConfig';
import {
  getMonday,
  MONTH_NAMES,
  getNameValue as getNameValueUtil,
  getEventStyle,
} from '@/lib/calendarUtils';
import { getFilteredItems } from '@/lib/filterUtils';

interface DashboardShellProps {
  dashboard: MonthlyDashboardConfig | null;
  collections: any[];
  onUpdate: (patch: Partial<MonthlyDashboardConfig>) => void;
  onViewDetail: (item: any) => void;
  onDelete: (id: string) => void;
  dashboardFilters: Record<string, any[]>;
  setDashboardFilters: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
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


const DashboardShell: React.FC<DashboardShellProps> = ({ dashboard, collections, onUpdate, onViewDetail, onDelete, dashboardFilters, setDashboardFilters }) => {
      if (!dashboard) {
        return (
          <div className="flex items-center justify-center h-full text-neutral-500">
            <p>Dashboard non accessible</p>
          </div>
        );
      }
      const [showFilterModal, setShowFilterModal] = useState(false);

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

  const buildHeaderRows = (nodes: any[], depth: number, maxDepth: number, rows: any[][]) => {
    rows[depth] = rows[depth] || [];
    nodes.forEach((node) => {
      const isLeaf = !node.children || node.children.length === 0;
      if (isLeaf) {
        rows[depth].push({
          label: node.label,
          colSpan: 2,
          rowSpan: maxDepth - depth,
          isLeaf: true,
          node,
        });
      } else {
        const colSpan = getLeaves([node]).length * 2;
        rows[depth].push({
          label: node.label,
          colSpan,
          rowSpan: 1,
          isLeaf: false,
          node,
        });
        buildHeaderRows(node.children, depth + 1, maxDepth, rows);
      }
    });
  };

  const getTableHeaderRows = () => {
    const rows: any[][] = [];
    buildHeaderRows(dashboard?.columnTree || [], 0, maxDepth, rows);
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

    const year = dashboard.year;
    const month = dashboard.month - 1; // JS: 0 = janvier
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
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
          if (eventStyle && eventStyle.workdayDates) {
            const firstDayKey = eventStyle.workdayDates[0].toLocaleDateString('fr-CA');
            if (key === firstDayKey) {
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
  }, [dashboard, collection, collections, properties, filteredItems, leafColumns, resolvedTypeField]);

  if (!dashboard) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400">
        Aucun dashboard sélectionné
      </div>
    );
  }

  const renderWeekTable = (week: { week: number; days: Date[] }) => {
    if (!aggregates) return null;
    const spanForDay = (leafId: string, key: string) => aggregates.spansByLeafDay?.[leafId]?.[key];
    const remainingCols = leafColumns.length * 2;
    const totalColSpan = Math.max(1, Math.ceil(remainingCols / 2));
    const perCollectionColSpan = Math.max(1, remainingCols - totalColSpan);

    const getWeekCollectionTotals = () => {
      const totals = new Map<string, { name: string; count: number; duration: number; ids: Set<string> }>();
      week.days.forEach((day) => {
        const key = dayKey(day);
        const byLeaf = aggregates.dailyObjectDurations?.[key] || {};
        Object.keys(byLeaf).forEach((leafId) => {
          const items = byLeaf[leafId] || {};
          Object.keys(items).forEach((itemId) => {
            const coll = itemCollectionMap.get(itemId);
            if (!coll) return;
            if (!totals.has(coll.collectionId)) {
              totals.set(coll.collectionId, { name: coll.collectionName, count: 0, duration: 0, ids: new Set() });
            }
            const entry = totals.get(coll.collectionId)!;
            entry.duration += items[itemId] || 0;
            if (!entry.ids.has(itemId)) {
              entry.ids.add(itemId);
              entry.count += 1;
            }
          });
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
                              <th className={`px-2 py-1 text-left border-b border-l border-black/10 dark:border-white/10 ${tone.soft}`}>Nombre</th>
                              <th className={`px-2 py-1 text-left border-b border-l border-black/10 dark:border-white/10 ${tone.soft}`}>Durée</th>
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
                      let countValue = '';
                      if (span && span.isStart) {
                        countValue = '1';
                      } else if (!span && cell.count > 0) {
                        countValue = cell.count.toString();
                      }
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
                      return (
                        <React.Fragment key={`${week.week}-${key}-${leaf.id}`}>
                          <td className={countClasses}>{countValue}</td>
                          <td className={durationClasses}>{cellContent}</td>
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
                  let count = 0;
                  let duration = 0;
                  week.days.forEach((day) => {
                    const key = dayKey(day);
                    const cell = aggregates.daily[key]?.[leaf.id];
                    const span = spanForDay(leaf.id, key);
                    if (span && span.isStart) {
                      count += 1;
                    } else if (!span && cell && cell.count) {
                      count += cell.count;
                    }
                    if (cell) {
                      duration += cell.duration;
                    }
                  });
                  totalCount += count;
                  totalDuration += duration;
                });
                const perCollection = getWeekCollectionTotals();
                return [
                  <td key="total-count" className="px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 font-bold" colSpan={totalColSpan}>
                    {totalCount || 0} projet(s) - {totalDuration ? formatDurationHeureMinute(totalDuration) : '0h00'}
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

  const renderMonthTotals = () => {
    if (!aggregates) return null;
    const remainingCols = leafColumns.length * 2;
    const totalColSpan = Math.max(1, Math.ceil(remainingCols / 2));
    const perCollectionColSpan = Math.max(1, remainingCols - totalColSpan);

    const getMonthCollectionTotals = () => {
      const totals = new Map<string, { name: string; count: number; duration: number; ids: Set<string> }>();
      Object.keys(aggregates.dailyObjectDurations || {}).forEach((key) => {
        const byLeaf = aggregates.dailyObjectDurations?.[key] || {};
        Object.keys(byLeaf).forEach((leafId) => {
          const items = byLeaf[leafId] || {};
          Object.keys(items).forEach((itemId) => {
            const coll = itemCollectionMap.get(itemId);
            if (!coll) return;
            if (!totals.has(coll.collectionId)) {
              totals.set(coll.collectionId, { name: coll.collectionName, count: 0, duration: 0, ids: new Set() });
            }
            const entry = totals.get(coll.collectionId)!;
            entry.duration += items[itemId] || 0;
            if (!entry.ids.has(itemId)) {
              entry.ids.add(itemId);
              entry.count += 1;
            }
          });
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
                    colSpan={2}
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
                        <th className={`px-2 py-1 text-left border-b border-l border-black/10 dark:border-white/10 ${tone.soft}`}>Nombre</th>
                        <th className={`px-2 py-1 text-left border-b border-l border-black/10 dark:border-white/10 ${tone.soft}`}>Durée</th>
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
                let count = 0;
                let duration = 0;
                Object.keys(aggregates.daily).forEach((key) => {
                  const cell = aggregates.daily[key]?.[leaf.id];
                  if (cell) {
                    count += cell.count;
                    duration += cell.duration;
                  }
                });
                return (
                  <React.Fragment key={`month-total-${leaf.id}`}>
                    <td className="px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10">{count || ''}</td>
                    <td className="px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10">
                      {duration ? formatDurationHeureMinute(duration) : ''}
                    </td>
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
                  let count = 0;
                  let duration = 0;
                  Object.keys(aggregates.daily).forEach((key) => {
                    const cell = aggregates.daily[key]?.[leaf.id];
                    if (cell) {
                      count += cell.count;
                      duration += cell.duration;
                    }
                  });
                  totalCount += count;
                  totalDuration += duration;
                });
                const perCollection = getMonthCollectionTotals();
                return [
                  <td key="total-count" className="px-2 py-1.5 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 font-bold" colSpan={totalColSpan}>
                    {totalCount || 0} projet(s) - {totalDuration ? formatDurationHeureMinute(totalDuration) : '0h00'}
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

  const groupedWeeks = useMemo(() => {
    if (!dashboard?.month || !dashboard?.year) return [];
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
  }, [dashboard?.month, dashboard?.year]);

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
          {groupedWeeks.map((week) => renderWeekTable(week))}
          {renderMonthTotals()}
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