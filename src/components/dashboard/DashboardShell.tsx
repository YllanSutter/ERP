import React, { useEffect, useMemo, useState } from 'react';
import { DashboardColumnNode, MonthlyDashboardConfig } from '@/lib/dashboardTypes';
import DashboardColumnConfig from './DashboardColumnConfig';

interface DashboardShellProps {
  dashboard: MonthlyDashboardConfig | null;
  collections: any[];
  onUpdate: (patch: Partial<MonthlyDashboardConfig>) => void;
}

import {
  getMonday,
  MONTH_NAMES,
  getItemsForDate as getItemsForDateUtil,
  getNameValue as getNameValueUtil,
  getPreviousPeriod,
  getNextPeriod,
  getEventStyle,
  workDayStart,
  workDayEnd,
} from '@/lib/calendarUtils';

const months = MONTH_NAMES;

const DashboardShell: React.FC<DashboardShellProps> = ({ dashboard, collections, onUpdate }) => {
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  const collection = useMemo(
    () => collections.find((c) => c.id === dashboard?.sourceCollectionId),
    [collections, dashboard?.sourceCollectionId]
  );

  const properties = collection?.properties || [];
  const items = collection?.items || [];

  const [typeValuesInput, setTypeValuesInput] = useState<Record<string, string>>({});

  const dayKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const leafColumns = useMemo(() => {
    const flatten = (nodes: DashboardColumnNode[]): DashboardColumnNode[] =>
      nodes.flatMap((n) => (n.children && n.children.length ? flatten(n.children) : [n]));
    return dashboard?.columnTree ? flatten(dashboard.columnTree) : [];
  }, [dashboard?.columnTree]);

  const typeOptions = useMemo(() => {
    if (!dashboard?.typeField) return [] as { value: string; label: string }[];
    const prop = properties.find((p: any) => p.id === dashboard.typeField);
    const opts = prop?.options || [];
    return (opts as any[]).map((opt, idx) => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      const value = opt?.value ?? opt?.label ?? `option-${idx + 1}`;
      const label = opt?.label ?? value;
      return { value, label };
    });
  }, [dashboard?.typeField, properties]);

  useEffect(() => {
    if (!dashboard) return;
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
  }, [dashboard, typeOptions, onUpdate]);

  const handleAddLeaf = () => {
    if (!dashboard) return;
    const newLeaf: DashboardColumnNode = {
      id: Date.now().toString(),
      label: `Colonne ${leafColumns.length + 1}`,
      typeValues: [],
      dateFieldOverride: {}
    };
    onUpdate({ columnTree: [...(dashboard.columnTree || []), newLeaf] });
  };

  const handleUpdateLeaf = (id: string, patch: Partial<DashboardColumnNode>) => {
    if (!dashboard) return;
    const next = (dashboard.columnTree || []).map((node) => (node.id === id ? { ...node, ...patch } : node));
    onUpdate({ columnTree: next });
  };

  const handleRemoveLeaf = (id: string) => {
    if (!dashboard) return;
    const next = (dashboard.columnTree || []).filter((n) => n.id !== id);
    onUpdate({ columnTree: next });
  };

  const daysOfMonth = useMemo(() => {
    if (!dashboard) return [] as Date[];
    const first = new Date(dashboard.year, dashboard.month - 1, 1);
    const days: Date[] = [];
    let d = new Date(first);
    while (d.getMonth() === first.getMonth()) {
      if (dashboard.includeWeekends || (d.getDay() !== 0 && d.getDay() !== 6)) {
        days.push(new Date(d));
      }
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [dashboard]);

  const groupedWeeks = useMemo(() => {
    const weeks: { week: number; days: Date[] }[] = [];
    daysOfMonth.forEach((date) => {
      const tmp = new Date(date);
      // ISO week number
      const dayNum = (tmp.getDay() + 6) % 7;
      tmp.setDate(tmp.getDate() - dayNum + 3);
      const firstThursday = new Date(tmp.getFullYear(), 0, 4);
      const week = 1 + Math.round(((tmp.getTime() - firstThursday.getTime()) / 86400000 - 3) / 7);
      const bucket = weeks.find((w) => w.week === week);
      if (bucket) {
        bucket.days.push(date);
      } else {
        weeks.push({ week, days: [date] });
      }
    });
    return weeks.sort((a, b) => a.week - b.week);
  }, [daysOfMonth]);

  const aggregates = useMemo(() => {
    if (!dashboard || !collection) return null;
    const typeField = dashboard.typeField || null;
    const typeProp = typeField ? properties.find((p: any) => p.id === typeField) : null;

    const matchesLeaf = (leaf: DashboardColumnNode, item: any) => {
      if (!typeField || !leaf.typeValues || leaf.typeValues.length === 0) return true;
      const val = item[typeField];
      if (Array.isArray(val)) {
        return val.some((v) => leaf.typeValues!.includes(v));
      }
      return leaf.typeValues.includes(val);
    };

    const toDate = (raw: any, preserveTime = false) => {
      if (!raw) return null;
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const [y, m, d] = raw.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        return dt;
      }
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return null;
      // shift to noon to avoid DST/UTC rollover issues when iterating days, unless we need the time
      if (!preserveTime) {
        d.setHours(12, 0, 0, 0);
      }
      return d;
    };

    // Nouvelle version : utilise getEventStyle pour obtenir la logique de découpage et de durée
    const resolveRangeAndDuration = (
      item: any,
      leaf?: DashboardColumnNode
    ): { start: Date; end: Date; durationHours: number; startTime?: Date; endTime?: Date } | null => {
      // Détermination du champ date à utiliser
      let dateFieldId: string | undefined = undefined;
      let dateField: any = undefined;
      if (leaf?.dateFieldOverride?.single) {
        dateFieldId = leaf.dateFieldOverride.single;
      } else if (dashboard.globalDateField) {
        dateFieldId = dashboard.globalDateField;
      }
      if (dateFieldId) {
        dateField = properties.find((p: any) => p.id === dateFieldId);
      } else if (properties.length > 0) {
        // fallback: premier champ de type date/date_range
        dateField = properties.find((p: any) => p.type === 'date' || p.type === 'date_range');
      }
      if (!dateField) return null;

      // Utilisation de getEventStyle pour obtenir la logique de découpage
      const style = getEventStyle(
        item,
        dateField,
        dateField.defaultDuration || 7,
        workDayEnd
      );
      console.log(style);
      if (!style) return null;
      return {
        start: style.startDate,
        end: style.endDate,
        durationHours: style.durationHours,
        startTime: style.startDate,
        endTime: style.endDate,
      };
    };

    const leafIds = leafColumns.map((l) => l.id);
    const daily: Record<string, Record<string, { count: number; duration: number }>> = {};
    const spansByLeaf: Record<string, { startKey: string; endKey: string; label: string }[]> = {};
    const spansByLeafDay: Record<string, Record<string, { label: string; isStart: boolean; isEnd: boolean }>> = {};
    const debugEntries: any[] = [];
    const debugMissingRange: any[] = [];

    const extractDailyOverrides = (item: any) => {
      const candidate = item?.dailyDurations || item?.durationByDay;
      if (!candidate || typeof candidate !== 'object') return null;
      const normalized: Record<string, number> = {};
      Object.entries(candidate).forEach(([key, value]) => {
        const num = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(num)) {
          normalized[key] = num;
        }
      });
      return Object.keys(normalized).length ? normalized : null;
    };

    const normalizeDay = (d: Date) => {
      const nd = new Date(d);
      nd.setHours(12, 0, 0, 0);
      return nd;
    };

    // Nouvelle version : utiliser getItemsForDate pour filtrer les items par jour
    daysOfMonth.forEach((date) => {
      leafColumns.forEach((leaf) => {
        // Détermination du champ date à utiliser
        let dateFieldId: string | undefined = undefined;
        let dateField: any = undefined;
        if (leaf?.dateFieldOverride?.single) {
          dateFieldId = leaf.dateFieldOverride.single;
        } else if (dashboard.globalDateField) {
          dateFieldId = dashboard.globalDateField;
        }
        if (dateFieldId) {
          dateField = properties.find((p: any) => p.id === dateFieldId);
        } else if (properties.length > 0) {
          // fallback: premier champ de type date/date_range
          dateField = properties.find((p: any) => p.type === 'date' || p.type === 'date_range');
        }
        if (!dateField) return;

        // Filtrage par date ET par type (matchesLeaf)
        const itemsForDay = getItemsForDateUtil(date, items, dateField).filter((item) => matchesLeaf(leaf, item));
        itemsForDay.forEach((item) => {
          const resolved = resolveRangeAndDuration(item, leaf);
          if (!resolved) return;
          const { durationHours } = resolved;
          const key = dayKey(date);
          daily[key] = daily[key] || {};
          daily[key][leaf.id] = daily[key][leaf.id] || { count: 0, duration: 0 };
          daily[key][leaf.id].count += 1;
          daily[key][leaf.id].duration += durationHours;

          // Pour les spans (affichage multi-jours)
          spansByLeaf[leaf.id] = spansByLeaf[leaf.id] || [];
          spansByLeaf[leaf.id].push({ startKey: key, endKey: key, label: item.name || item.title || 'Élément' });
          spansByLeafDay[leaf.id] = spansByLeafDay[leaf.id] || {};
          spansByLeafDay[leaf.id][key] = {
            label: item.name || item.title || 'Élément',
            isStart: true,
            isEnd: true
          };
        });
      });
    });
    const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;

    if (typeof window !== 'undefined' && isDev) {
      console.log('Dashboard monthly debug', {
        month: dashboard.month,
        year: dashboard.year,
        dailyKeys: Object.keys(daily).length,
        entries: debugEntries,
        missingRange: debugMissingRange
      });
    }

    return { leafIds, daily, spansByLeaf, spansByLeafDay };
  }, [dashboard, collection, properties, items, leafColumns]);

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

    return (
      <div key={week.week} className="overflow-auto border border-white/15 rounded-lg shadow-inner shadow-black/40">
        <table className="min-w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '120px' }} />
            {leafColumns.map((_, i) => (
              <col key={i} style={{ width: '80px' }} />
            ))}
            {leafColumns.map((_, i) => (
              <col key={i + leafColumns.length} style={{ width: '100px' }} />
            ))}
          </colgroup>
          <thead className="bg-neutral-900/90">
            <tr>
              <th className="px-3 py-2 text-left border-b border-white/15">
                Semaine {week.week}
                {week.days.length > 0 && (
                  <span className="ml-2 text-xs text-neutral-400 font-normal">
                    du {week.days[0].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    {' '}au {week.days[week.days.length - 1].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                )}
              </th>
              {leafColumns.map((leaf) => (
                <th
                  key={leaf.id}
                  colSpan={2}
                  className="px-3 py-2 text-left border-b border-l border-white/10"
                >
                  {leaf.label}
                </th>
              ))}
            </tr>
            <tr className="bg-neutral-900/60 text-neutral-400">
              <th className="px-3 py-1 text-left border-b border-white/15">Jour</th>
              {leafColumns.map((leaf) => (
                <React.Fragment key={`${leaf.id}-metrics-${week.week}`}>
                  <th className="px-3 py-1 text-left border-b border-l border-white/10">Nombre</th>
                  <th className="px-3 py-1 text-left border-b border-l border-white/10">Durée</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.days.map((day) => {
              const key = dayKey(day);
              return (
                <tr key={`${week.week}-${key}`} className="border-b border-white/10 odd:bg-neutral-900/40">
                  <td className="px-3 py-2 text-neutral-200 font-medium border-r border-white/10">
                    {day.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </td>
                  {leafColumns.map((leaf) => {
                    const cell = aggregates.daily[key]?.[leaf.id] || { count: 0, duration: 0 };
                    const span = spanForDay(leaf.id, key);
                    const countClasses = span
                      ? 'px-3 py-2 text-right text-white border-l border-white/30 bg-white/10'
                      : 'px-3 py-2 text-right text-white border-l border-white/30 bg-neutral-900/30';
                    const durationClasses = span
                      ? `px-3 py-2 text-right text-white border-l ${span.isEnd ? '' : ''} ${
                          span.isStart ? 'rounded-l-md' : ''
                        } border-white/30 bg-white/10`
                      : 'px-3 py-2 text-right text-white border-l border-white/10 bg-neutral-900/20';

                    // Afficher le nombre uniquement sur le premier jour de l'événement (isStart)
                    let countValue = '';
                    if (span && span.isStart) {
                      countValue = '1';
                    }

                    return (
                      <React.Fragment key={`${week.week}-${key}-${leaf.id}`}>
                        <td className={countClasses}>{countValue}</td>
                        <td className={durationClasses}>
                          {cell.duration ? cell.duration.toFixed(1) : ''}
                          {span && (
                            <div className="text-[11px] text-white truncate">{span.label}</div>
                          )}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="bg-white/5">
              <td className="px-3 py-2 font-semibold text-white border-r border-white/10">Total Semaine {week.week}</td>
              {leafColumns.map((leaf) => {
                // Pour le total, on compte 1 uniquement sur le premier jour de chaque événement (span.isStart)
                let count = 0;
                let duration = 0;
                week.days.forEach((day) => {
                  const key = dayKey(day);
                  const cell = aggregates.daily[key]?.[leaf.id];
                  const span = spanForDay(leaf.id, key);
                  if (span && span.isStart) {
                    count += 1;
                  }
                  if (cell) {
                    duration += cell.duration;
                  }
                });
                return (
                  <React.Fragment key={`week-total-${week.week}-${leaf.id}`}>
                    <td className="px-3 py-2 text-right text-white border-l border-white/10">{count || ''}</td>
                    <td className="px-3 py-2 text-right text-white border-l border-white/10">
                      {duration ? duration.toFixed(1) : ''}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderMonthTotals = () => {
    if (!aggregates) return null;
    return (
      <div className="overflow-auto border border-white/15 rounded-lg shadow-inner shadow-black/40">
        <table className="min-w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '120px' }} />
            {leafColumns.map((_, i) => (
              <col key={i} style={{ width: '80px' }} />
            ))}
            {leafColumns.map((_, i) => (
              <col key={i + leafColumns.length} style={{ width: '100px' }} />
            ))}
          </colgroup>
          <thead className="bg-neutral-900/90">
            <tr>
              <th className="px-3 py-2 text-left border-b border-white/15">Total Mois</th>
              {leafColumns.map((leaf) => (
                <th
                  key={leaf.id}
                  colSpan={2}
                  className="px-3 py-2 text-left border-b border-l border-white/10 bg-neutral-900/70"
                >
                  {leaf.label}
                </th>
              ))}
            </tr>
            <tr className="bg-neutral-900/60 text-neutral-400">
              <th className="px-3 py-1 text-left border-b border-white/15">Mois</th>
              {leafColumns.map((leaf) => (
                <React.Fragment key={`${leaf.id}-month-metrics`}>
                  <th className="px-3 py-1 text-left border-b border-l border-white/10">Nombre</th>
                  <th className="px-3 py-1 text-left border-b border-l border-white/10">Durée</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white/10">
              <td className="px-3 py-2 font-semibold text-white border-r border-white/10">Total Mois</td>
              {leafColumns.map((leaf) => {
                // Pour le total mensuel, on compte 1 uniquement sur le premier jour de chaque événement (span.isStart)
                let count = 0;
                let duration = 0;
                Object.keys(aggregates.daily).forEach((key) => {
                  const cell = aggregates.daily[key]?.[leaf.id];
                  const span = aggregates.spansByLeafDay?.[leaf.id]?.[key];
                  if (span && span.isStart) {
                    count += 1;
                  }
                  if (cell) {
                    duration += cell.duration;
                  }
                });
                return (
                  <React.Fragment key={`month-total-${leaf.id}`}>
                    <td className="px-3 py-2 text-right text-white border-l border-white/10">{count || ''}</td>
                    <td className="px-3 py-2 text-right text-white border-l border-white/10">
                      {duration ? duration.toFixed(1) : ''}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-4 p-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            value={dashboard.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="bg-transparent border border-white/10 rounded px-3 py-2 text-lg font-semibold focus:outline-none focus:border-blue-500/60"
          />
          <div className="text-xs text-neutral-500 border border-white/10 px-2 py-1 rounded">
            Mensuel • week-ends exclus
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dashboard.month}
            onChange={(e) => onUpdate({ month: Number(e.target.value) })}
            className="bg-neutral-900 border border-white/10 rounded px-3 py-2 text-sm"
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
            className="bg-neutral-900 border border-white/10 rounded px-3 py-2 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            value={dashboard.sourceCollectionId || ''}
            onChange={(e) => onUpdate({ sourceCollectionId: e.target.value || null })}
            className="bg-neutral-900 border border-white/10 rounded px-3 py-2 text-sm"
          >
            <option value="">Choisir une collection</option>
            {collections.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>
        </div>
      </div>



      <div className="flex-1  text-neutral-200 p-10">
        <div className="space-y-6">
          {groupedWeeks.map((week) => renderWeekTable(week))}
          {renderMonthTotals()}
        </div>
      </div>

      <DashboardColumnConfig
        dashboard={dashboard}
        collections={collections}
        properties={properties}
        leafColumns={leafColumns}
        typeValuesInput={typeValuesInput}
        setTypeValuesInput={setTypeValuesInput}
        handleAddLeaf={handleAddLeaf}
        handleUpdateLeaf={handleUpdateLeaf}
        handleRemoveLeaf={handleRemoveLeaf}
      />
    </div>
  );
};

export default DashboardShell;

