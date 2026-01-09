import React, { useEffect, useMemo, useState } from 'react';
import { DashboardColumnNode, MonthlyDashboardConfig } from '@/lib/dashboardTypes';
import ShinyButton from '../ShinyButton';

interface DashboardShellProps {
  dashboard: MonthlyDashboardConfig | null;
  collections: any[];
  onUpdate: (patch: Partial<MonthlyDashboardConfig>) => void;
}

const months = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre'
];

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

    const resolveRangeAndDuration = (
      item: any,
      leaf?: DashboardColumnNode
    ): { start: Date; end: Date; durationHours: number; startTime?: Date; endTime?: Date } | null => {
      const pickField = () => {
        const override = leaf?.dateFieldOverride || {};
        if (override.single) return { kind: 'single', fieldId: override.single } as const;
        if (override.start || override.end) return { kind: 'range', startField: override.start, endField: override.end } as const;
        if (dashboard.globalDateRange?.startField && dashboard.globalDateRange?.endField)
          return { kind: 'range', startField: dashboard.globalDateRange.startField, endField: dashboard.globalDateRange.endField } as const;
        if (dashboard.globalDateField) return { kind: 'single', fieldId: dashboard.globalDateField } as const;
        return null;
      };

      const candidate = pickField();
      const getProp = (id?: string | null) => (id ? properties.find((p: any) => p.id === id) : null);
      const hoursPerDay = 7;

      const distributeFromSingle = (fieldId: string) => {
        const prop = getProp(fieldId);
        const val = item[fieldId];
        let start = toDate(val);
        if (!start) return null;

        // Recherche d'un champ heure de début
        let heureDebut = item[`${fieldId}_heure`] || item[`${fieldId}_start_time`] || item["heure_debut"] || item["start_time"] || null;
        let h = 9, m = 0;
        if (typeof heureDebut === "string" && /^\d{2}:\d{2}$/.test(heureDebut)) {
          [h, m] = heureDebut.split(":").map(Number);
        }
        start.setHours(h, m, 0, 0);

        // Recherche d'une durée
        let durationHours =
          typeof item?.[`${fieldId}_duration`] === 'number'
            ? item[`${fieldId}_duration`]
            : typeof prop?.defaultDuration === 'number'
            ? prop.defaultDuration
            : (typeof item["duree"] === 'number' ? item["duree"] : hoursPerDay);

        // Découpage sur plusieurs jours ouvrés (7h max/jour)
        const maxPerDay = 7;
        let remaining = durationHours;
        let current = new Date(start);
        let end = new Date(start);
        let lastDayHours = 0;
        let firstDay = true;
        let startHour = h;
        while (remaining > 0.01) {
          // Créneaux de travail : matin 9h-12h (3h), après-midi 13h-17h (4h)
          let slots = [
            { from: 9, to: 12 },
            { from: 13, to: 17 }
          ];
          let todayHours = 0;
          for (let i = 0; i < slots.length && remaining > 0.01; i++) {
            let slot = slots[i];
            let slotStart = firstDay && slot.from < startHour ? startHour : slot.from;
            if (slotStart >= slot.to) continue;
            let slotDuration = slot.to - slotStart;
            let hours = Math.min(slotDuration, remaining);
            todayHours += hours;
            remaining -= hours;
            firstDay = false;
            startHour = 9; // pour les jours suivants
          }
          lastDayHours = todayHours;
          if (remaining > 0.01) {
            // Passe au jour ouvré suivant
            do {
              current.setDate(current.getDate() + 1);
            } while (current.getDay() === 0 || current.getDay() === 6); // saute week-end
          }
        }
        // Calcule la date/heure de fin
        end = new Date(current);
        // Heure de fin = 9h + lastDayHours, en respectant les créneaux
        let hoursLeft = lastDayHours;
        let endHour = 9;
        for (let slot of [ { from: 9, to: 12 }, { from: 13, to: 17 } ]) {
          let slotDuration = slot.to - slot.from;
          if (hoursLeft > 0) {
            if (hoursLeft <= slotDuration) {
              endHour = slot.from + hoursLeft;
              break;
            } else {
              hoursLeft -= slotDuration;
            }
          }
        }
        end.setHours(Math.floor(endHour), m, 0, 0);

        return { start, end, durationHours, startTime: start, endTime: end };
      };

      const distributeFromRange = (startField?: string, endField?: string): { start: Date; end: Date; durationHours: number; startTime?: Date; endTime?: Date } | null => {
        const sVal = startField ? item[startField] : null;
        const eVal = endField ? item[endField] : null;
        // Preserve time if available
        const s = toDate(sVal, true);
        const e = toDate(eVal, true);
        if (s && e) {
          // Check if times are present (not just date at midnight/noon)
          const hasStartTime = s.getHours() !== 0 && s.getHours() !== 12;
          const hasEndTime = e.getHours() !== 0 && e.getHours() !== 12;
          
          if (hasStartTime && hasEndTime) {
            // Calculate actual hours between timestamps
            const millisDiff = e.getTime() - s.getTime();
            const totalHours = millisDiff / (1000 * 60 * 60);
            // Remove breaks: 1h break per full day
            const fullDays = Math.floor(totalHours / 24);
            const durationHours = Math.max(0, totalHours - fullDays);
            
            // Normalize dates for day iteration (but keep original times)
            const startDay = new Date(s);
            startDay.setHours(12, 0, 0, 0);
            const endDay = new Date(e);
            endDay.setHours(12, 0, 0, 0);
            
            return { start: startDay, end: endDay, durationHours, startTime: s, endTime: e };
          } else {
            // Fallback to day-based calculation
            const startDay = toDate(sVal, false);
            const endDay = toDate(eVal, false);
            if (!startDay || !endDay) return null;
            const days = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / 86400000) + 1);
            const durationHours = days * hoursPerDay;
            return { start: startDay, end: endDay, durationHours };
          }
        }
        return null;
      };

      if (candidate) {
        if (candidate.kind === 'single') {
          const prop = getProp(candidate.fieldId);
          if (prop?.type === 'date_range') {
            const val = item[prop.id];
            if (val?.start && val?.end) {
              const s = toDate(val.start, true);
              const e = toDate(val.end, true);
              if (s && e) {
                const hasStartTime = s.getHours() !== 0 && s.getHours() !== 12;
                const hasEndTime = e.getHours() !== 0 && e.getHours() !== 12;
                
                if (hasStartTime && hasEndTime) {
                  const millisDiff = e.getTime() - s.getTime();
                  const totalHours = millisDiff / (1000 * 60 * 60);
                  const fullDays = Math.floor(totalHours / 24);
                  const durationHours = Math.max(0, totalHours - fullDays);
                  const startDay = new Date(s);
                  startDay.setHours(12, 0, 0, 0);
                  const endDay = new Date(e);
                  endDay.setHours(12, 0, 0, 0);
                  return { start: startDay, end: endDay, durationHours, startTime: s, endTime: e };
                } else {
                  const startDay = toDate(val.start, false);
                  const endDay = toDate(val.end, false);
                  if (startDay && endDay) {
                    const days = Math.max(1, Math.round((endDay.getTime() - startDay.getTime()) / 86400000) + 1);
                    const durationHours = days * hoursPerDay;
                    return { start: startDay, end: endDay, durationHours };
                  }
                }
              }
            }
          }
          const single = distributeFromSingle(candidate.fieldId);
          if (single) return single;
        }
        if (candidate.kind === 'range') {
          const ranged = distributeFromRange(candidate.startField, candidate.endField);
          if (ranged) return ranged;
        }
      }

      // Heuristic: detect common start/end fields on the item when no config is set
      const startCandidates = ['start', 'startDate', 'dateStart', 'date_start', 'debut', 'dateDebut', 'date_debut'];
      const endCandidates = ['end', 'endDate', 'dateEnd', 'date_end', 'fin', 'dateFin', 'date_fin'];
      let sAuto: Date | null = null;
      let eAuto: Date | null = null;
      for (const key of startCandidates) {
        const maybe = toDate(item[key]);
        if (maybe) {
          sAuto = maybe;
          break;
        }
      }
      for (const key of endCandidates) {
        const maybe = toDate(item[key]);
        if (maybe) {
          eAuto = maybe;
          break;
        }
      }
      if (sAuto && eAuto) {
        const days = Math.max(1, Math.round((eAuto.getTime() - sAuto.getTime()) / 86400000) + 1);
        return { start: sAuto, end: eAuto, durationHours: days * hoursPerDay };
      }

      // Fallback: infer range from any date-like fields on the item
      const inferredDates: Date[] = [];
      Object.entries(item || {}).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        if (typeof value === 'string' && /\d{4}-\d{2}-\d{2}/.test(value)) {
          const maybe = toDate(value);
          if (maybe) inferredDates.push(maybe);
          return;
        }
        if (value instanceof Date) {
          const maybe = toDate(value as any);
          if (maybe) inferredDates.push(maybe);
          return;
        }
      });
      if (inferredDates.length >= 2) {
        const sorted = inferredDates.sort((a, b) => a.getTime() - b.getTime());
        const days = Math.max(1, Math.round((sorted[sorted.length - 1].getTime() - sorted[0].getTime()) / 86400000) + 1);
        return { start: sorted[0], end: sorted[sorted.length - 1], durationHours: days * hoursPerDay };
      }
      if (inferredDates.length === 1) {
        return { start: inferredDates[0], end: inferredDates[0], durationHours: hoursPerDay };
      }
      return null;
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

    items.forEach((item: any) => {
      leafColumns.forEach((leaf) => {
        if (!matchesLeaf(leaf, item)) return;
        
        // Debug: log raw item data to see how times are stored
        const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;
        if (isDev && (item.name === "Alsace debosselage" || item.title === "Alsace debosselage")) {
          console.log('RAW ITEM DATA:', {
            name: item.name || item.title,
            allFields: Object.keys(item),
            dateFields: Object.fromEntries(
              Object.entries(item).filter(([k, v]) => 
                k.toLowerCase().includes('date') || 
                k.toLowerCase().includes('start') || 
                k.toLowerCase().includes('end') ||
                k.toLowerCase().includes('time') ||
                k.toLowerCase().includes('debut') ||
                k.toLowerCase().includes('fin')
              )
            )
          });
        }
        
        const resolved = resolveRangeAndDuration(item, leaf);
        if (!resolved) return;
        const { start: rangeStart, end: rangeEnd, durationHours, startTime, endTime } = resolved;
        const start = normalizeDay(rangeStart);
        const end = normalizeDay(rangeEnd);
        const days: Date[] = [];
        const cursor = new Date(start);
        while (cursor <= end) {
          if (
            cursor.getFullYear() === dashboard.year &&
            cursor.getMonth() + 1 === dashboard.month &&
            (dashboard.includeWeekends || (cursor.getDay() !== 0 && cursor.getDay() !== 6))
          ) {
            days.push(new Date(cursor));
          }
          cursor.setDate(cursor.getDate() + 1);
        }
        if (days.length === 0) return;

        const overrides = extractDailyOverrides(item);

        // Calculate per-day durations based on actual times if available
        const perDayMap: Record<string, number> = {};
        if (startTime && endTime && days.length >= 1) {
          const workStart = 9; // 8h
          const workEnd = 17;   // 17h (5pm)
          const breakDuration = 1; // 1h break
          const maxHoursPerDay = workEnd - workStart - breakDuration; // 8h

          days.forEach((day, idx) => {
            const key = dayKey(day);
            
            // Create work boundaries for this specific day
            const dayWorkStart = new Date(day);
            dayWorkStart.setHours(workStart, 0, 0, 0);
            const dayWorkEnd = new Date(day);
            dayWorkEnd.setHours(workEnd, 0, 0, 0);

            let effectiveStart: Date;
            let effectiveEnd: Date;

            if (idx === 0) {
              // First day: from startTime to end of work day (or endTime if same day conceptually)
              effectiveStart = new Date(Math.max(startTime.getTime(), dayWorkStart.getTime()));
              effectiveEnd = new Date(Math.min(dayWorkEnd.getTime(), endTime.getTime()));
            } else if (idx === days.length - 1) {
              // Last day: from start of work day to endTime
              effectiveStart = dayWorkStart;
              effectiveEnd = new Date(Math.min(endTime.getTime(), dayWorkEnd.getTime()));
            } else {
              // Middle days: full work day
              effectiveStart = dayWorkStart;
              effectiveEnd = dayWorkEnd;
            }

            const millisWorked = Math.max(0, effectiveEnd.getTime() - effectiveStart.getTime());
            let hoursWorked = millisWorked / (1000 * 60 * 60);
            
            // Subtract break if this is a full or near-full day
            if (hoursWorked >= maxHoursPerDay - 0.5) {
              hoursWorked = Math.min(hoursWorked - breakDuration, maxHoursPerDay);
            }
            
            perDayMap[key] = Math.max(0, hoursWorked);
          });
        }

        let sumOverrides = 0;
        let missingDaysCount = 0;
        if (overrides) {
          days.forEach((d) => {
            const key = dayKey(d);
            const val = overrides[key];
            if (val !== undefined) {
              sumOverrides += val;
            } else {
              missingDaysCount += 1;
            }
          });
        }
        
        // Use time-based distribution if available, otherwise fallback
        const hasTimeBasedDistribution = Object.keys(perDayMap).length > 0;
        const remaining = Math.max(0, durationHours - sumOverrides);
        const fallbackPerDay = overrides && missingDaysCount > 0 ? remaining / missingDaysCount : days.length ? durationHours / days.length : 0;

        days.forEach((d) => {
          const key = dayKey(d);
          const overrideVal = overrides ? overrides[key] : undefined;
          let perDayDuration: number;
          
          if (overrideVal !== undefined) {
            perDayDuration = overrideVal;
          } else if (hasTimeBasedDistribution && perDayMap[key] !== undefined) {
            perDayDuration = perDayMap[key];
          } else {
            perDayDuration = fallbackPerDay;
          }

          daily[key] = daily[key] || {};
          daily[key][leaf.id] = daily[key][leaf.id] || { count: 0, duration: 0 };
          daily[key][leaf.id].count += 1;
          daily[key][leaf.id].duration += perDayDuration;
        });

        debugEntries.push({
          item: item.name || item.title || item.id,
          leaf: leaf.label,
          range: { start: dayKey(start), end: dayKey(end) },
          startTime: startTime ? startTime.toISOString() : null,
          endTime: endTime ? endTime.toISOString() : null,
          days: days.map(dayKey),
          overrides,
          durationHours,
          sumOverrides,
          missingDaysCount,
          fallbackPerDay,
          perDayMap: hasTimeBasedDistribution ? perDayMap : null,
          perDay: days.map((d) => {
            const key = dayKey(d);
            const override = overrides ? overrides[key] : undefined;
            const timeBased = hasTimeBasedDistribution && perDayMap[key] !== undefined ? perDayMap[key] : null;
            return {
              day: key,
              duration: override !== undefined ? override : (timeBased !== null ? timeBased : fallbackPerDay)
            };
          })
        });

        if (days.length === 1 && overrides === null) {
          debugMissingRange.push({
            item: item.name || item.title || item.id,
            leaf: leaf.label,
            rawKeys: Object.keys(item),
            rawDates: Object.fromEntries(
              Object.entries(item).filter(([k, v]) => typeof v === 'string' && /\d{4}-\d{2}-\d{2}/.test(String(v)))
            ),
            rangeStart: dayKey(start),
            rangeEnd: dayKey(end)
          });
        }

        const spanStartKey = dayKey(days[0]);
        const spanEndKey = dayKey(days[days.length - 1]);
        spansByLeaf[leaf.id] = spansByLeaf[leaf.id] || [];
        spansByLeaf[leaf.id].push({ startKey: spanStartKey, endKey: spanEndKey, label: item.name || item.title || 'Élément' });

        spansByLeafDay[leaf.id] = spansByLeafDay[leaf.id] || {};
        days.forEach((d, dayIdx) => {
          const key = dayKey(d);
          spansByLeafDay[leaf.id][key] = {
            label: item.name || item.title || 'Élément',
            isStart: dayIdx === 0,
            isEnd: dayIdx === days.length - 1
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
                      ? 'px-3 py-2 text-right text-white border-l border-blue-300/40 bg-blue-500/5'
                      : 'px-3 py-2 text-right text-white border-l border-white/10 bg-neutral-900/30';
                    const durationClasses = span
                      ? `px-3 py-2 text-right text-white border-l ${span.isEnd ? '' : ''} ${
                          span.isStart ? 'rounded-l-md' : ''
                        } border-blue-300/40 bg-blue-500/5`
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

            <div className="border border-white/10 rounded-lg p-4 bg-neutral-900/60 mt-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Configuration</h3>
            <p className="text-sm text-neutral-500">Sélectionne les champs date, type et durée, puis mappe les colonnes.</p>
          </div>
          <ShinyButton onClick={handleAddLeaf} className="px-4 py-2">
            Ajouter une colonne
          </ShinyButton>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <span className="text-neutral-400">Champ type</span>
            <select
              value={dashboard.typeField || ''}
              onChange={(e) => onUpdate({ typeField: e.target.value || null })}
              className="bg-neutral-900 border border-white/10 rounded px-3 py-2"
            >
              <option value="">À définir</option>
              {collections
                .find((c) => c.id === dashboard.sourceCollectionId)?.properties?.map((prop: any) => (
                  <option key={prop.id} value={prop.id}>
                    {prop.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-neutral-400">Champ date (simple)</span>
            <select
              value={dashboard.globalDateField || ''}
              onChange={(e) => onUpdate({ globalDateField: e.target.value || null })}
              className="bg-neutral-900 border border-white/10 rounded px-3 py-2"
            >
              <option value="">Non utilisé</option>
              {collections
                .find((c) => c.id === dashboard.sourceCollectionId)?.properties?.map((prop: any) => (
                  <option key={prop.id} value={prop.id}>
                    {prop.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {leafColumns.length === 0 && (
            <div className="text-sm text-neutral-500">Ajoute une colonne pour mapper les valeurs du champ type.</div>
          )}
          {leafColumns.map((leaf) => {
            const typeValuesText = typeValuesInput[leaf.id] ?? (leaf.typeValues || []).join(', ');
            return (
              <div key={leaf.id} className="border border-white/10 rounded-lg p-3 bg-neutral-800/40">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    value={leaf.label}
                    onChange={(e) => handleUpdateLeaf(leaf.id, { label: e.target.value })}
                    className="flex-1 bg-neutral-900 border border-white/10 rounded px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => handleRemoveLeaf(leaf.id)}
                    className="text-red-300 hover:text-white hover:bg-red-500/20 rounded px-2 py-1 text-sm"
                  >
                    Supprimer
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-400">Valeurs du champ type (séparées par virgule)</span>
                    <input
                      value={typeValuesText}
                      onChange={(e) => {
                        setTypeValuesInput((prev) => ({ ...prev, [leaf.id]: e.target.value }));
                        const arr = e.target.value
                          .split(',')
                          .map((v) => v.trim())
                          .filter(Boolean);
                        handleUpdateLeaf(leaf.id, { typeValues: arr });
                      }}
                      className="bg-neutral-900 border border-white/10 rounded px-3 py-2"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-400">Date unique (override)</span>
                    <select
                      value={leaf.dateFieldOverride?.single || ''}
                      onChange={(e) =>
                        handleUpdateLeaf(leaf.id, {
                          dateFieldOverride: { ...leaf.dateFieldOverride, single: e.target.value || undefined, start: undefined, end: undefined }
                        })
                      }
                      className="bg-neutral-900 border border-white/10 rounded px-3 py-2"
                    >
                      <option value="">Non utilisé</option>
                      {properties.map((prop: any) => (
                        <option key={prop.id} value={prop.id}>
                          {prop.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-400">Date début (override)</span>
                    <select
                      value={leaf.dateFieldOverride?.start || ''}
                      onChange={(e) =>
                        handleUpdateLeaf(leaf.id, {
                          dateFieldOverride: { ...leaf.dateFieldOverride, start: e.target.value || undefined, single: undefined }
                        })
                      }
                      className="bg-neutral-900 border border-white/10 rounded px-3 py-2"
                    >
                      <option value="">Non utilisé</option>
                      {properties.map((prop: any) => (
                        <option key={prop.id} value={prop.id}>
                          {prop.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-neutral-400">Date fin (override)</span>
                    <select
                      value={leaf.dateFieldOverride?.end || ''}
                      onChange={(e) =>
                        handleUpdateLeaf(leaf.id, {
                          dateFieldOverride: { ...leaf.dateFieldOverride, end: e.target.value || undefined, single: undefined }
                        })
                      }
                      className="bg-neutral-900 border border-white/10 rounded px-3 py-2"
                    >
                      <option value="">Non utilisé</option>
                      {properties.map((prop: any) => (
                        <option key={prop.id} value={prop.id}>
                          {prop.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardShell;

