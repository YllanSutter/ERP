/**
 * RecapModule – tableau croisé Période × Colonnes hiérarchiques.
 *
 * Mode mois  : lignes = jours, groupées par semaine (week label en rowspan)
 * Mode année : lignes = mois de l'année
 */

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  eachWeekOfInterval,
  eachDayOfInterval,
  endOfWeek,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  format,
  getISOWeek,
  getDay,
  isWeekend,
  parseISO,
  isWithinInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DashboardModuleConfig } from '@/lib/dashboardTypes';
import { DashboardItemData, GlobalDateFilter } from '@/lib/hooks/useDashboardItemData';
import { Collection, Item, Property } from '@/lib/types';
import { applyModuleFilters, computeDateRange, getDateValue } from '@/lib/utils/dashboardUtils';
import {
  PeriodRow,
  LeafColumn,
  HeaderCell,
  buildRecapHeaderRows,
  flattenRecapToLeaves,
  RecapPropertyResolver,
  computeLeafCell,
  getLeafCellItems,
  formatRecapValue,
} from '@/lib/utils/recapColumnUtils';

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface DayRow {
  key: string;
  dayLabel: string;  // "Lun", "Mar"…
  dateLabel: string; // "01/03"
  start: Date;
  end: Date;
  isWeekend: boolean;
}

interface WeekGroup {
  weekKey: string;
  weekLabel: string; // "Sem. 12"
  days: DayRow[];
}

interface TooltipState {
  items: Item[];
  rect: DOMRect;
}

const MONTH_TOTAL_WEEK_KEY = '__month_total__';

interface TotalsByType {
  count: number;
  durationMinutes: number;
  sum: number;
}

const EMPTY_TOTALS: TotalsByType = {
  count: 0,
  durationMinutes: 0,
  sum: 0,
};

function accumulateLeafTotal(current: TotalsByType, leaf: LeafColumn, rawValue: number): TotalsByType {
  if (!rawValue || rawValue <= 0) return current;

  if (leaf.displayType === 'count') {
    return { ...current, count: current.count + rawValue };
  }

  if (leaf.displayType === 'duration') {
    const mins = leaf.durationUnit === 'hours' ? rawValue * 60 : rawValue;
    return { ...current, durationMinutes: current.durationMinutes + mins };
  }

  return { ...current, sum: current.sum + rawValue };
}

function computeTotalsByType(values: number[], leaves: LeafColumn[]): TotalsByType {
  return values.reduce((acc, val, idx) => accumulateLeafTotal(acc, leaves[idx], val ?? 0), { ...EMPTY_TOTALS });
}

function formatTotalCount(value: number): string {
  return value > 0 ? String(value) : '–';
}

function formatTotalDuration(minutes: number): string {
  return minutes > 0 ? formatRecapValue(minutes, 'duration', 'minutes') : '–';
}

// ---------------------------------------------------------------------------
// Noms courts des jours (getDay → 0=dim, 1=lun…)
// ---------------------------------------------------------------------------

const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// ---------------------------------------------------------------------------
// Calcul des périodes – mode mois → groupes de semaines avec jours
// ---------------------------------------------------------------------------

function getWeekGroups(
  year: number,
  month: number,
  includeWeekends: boolean,
  hiddenWeekDays: number[] = []
): WeekGroup[] {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd   = endOfMonth(monthStart);
  const weekOpts   = { weekStartsOn: 1 as const };

  const weekStarts = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    weekOpts
  );

  return weekStarts
    .map((ws) => {
      const we         = endOfWeek(ws, weekOpts);
      const rangeStart = ws < monthStart ? monthStart : ws;
      const rangeEnd   = we > monthEnd   ? monthEnd   : we;
      const isoWeek    = getISOWeek(ws);

      const allDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      const days: DayRow[] = allDays
        .filter((d) => includeWeekends || !isWeekend(d))
        .filter((d) => !hiddenWeekDays.includes(d.getDay()))
        .map((d) => ({
          key:       format(d, 'yyyy-MM-dd'),
          dayLabel:  DAY_SHORT[getDay(d)],
          dateLabel: format(d, 'dd/MM', { locale: fr }),
          start:     startOfDay(d),
          end:       endOfDay(d),
          isWeekend: isWeekend(d),
        }));

      return { weekKey: `week-${isoWeek}`, weekLabel: `Sem. ${isoWeek}`, days };
    })
    .filter((wg) => wg.days.length > 0);
}

// ---------------------------------------------------------------------------
// Mode année → lignes = mois
// ---------------------------------------------------------------------------

function getMonthsOfYear(year: number): PeriodRow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const ms = new Date(year, i, 1);
    const me = endOfMonth(ms);
    return {
      key:      `month-${i}`,
      label:    format(ms, 'MMMM', { locale: fr }),
      sublabel: String(year),
      start:    ms,
      end:      me,
    };
  });
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  module: DashboardModuleConfig;
  data: DashboardItemData;
  collections: Collection[];
  globalFilter?: GlobalDateFilter;
  onUpdate?: (patch: Partial<DashboardModuleConfig>) => void;
  onViewDetail?: (item: Item) => void;
  onShowNewItemModal?: (collection: any, item?: any) => void;
}

// ---------------------------------------------------------------------------
// Tooltip flottant
// ---------------------------------------------------------------------------

const CellTooltip: React.FC<{
  tooltip: TooltipState;
  onItemClick?: (item: Item) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}> = ({ tooltip, onItemClick, onMouseEnter, onMouseLeave }) => {
  const { items, rect } = tooltip;
  const MAX_SHOWN = 8;
  const shown = items.slice(0, MAX_SHOWN);
  const rest  = items.length - MAX_SHOWN;

  // Position : au-dessus si on est dans la moitié basse, en-dessous sinon
  const spaceBelow = window.innerHeight - rect.bottom;
  const top = spaceBelow > 160 ? rect.bottom + 4 : rect.top - 4;
  const translateY = spaceBelow > 160 ? 0 : -100;
  const left = Math.min(rect.left, window.innerWidth - 220);

  return (
    <div
      className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg py-1.5 min-w-[160px] max-w-[260px]"
      style={{ top, left, transform: `translateY(${translateY}%)` }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {shown.map((item) => {
        const name = (item as any).name ?? (item as any).title ?? (item as any).label ?? `Item ${item.id}`;
        return (
          <button
            key={item.id}
            className="w-full text-left px-3 py-1 text-xs hover:bg-accent transition-colors truncate text-foreground"
            onClick={() => onItemClick?.(item)}
          >
            {name}
          </button>
        );
      })}
      {rest > 0 && (
        <div className="px-3 py-1 text-[10px] text-muted-foreground italic">
          +{rest} autre{rest > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

function getItemDisplayLabel(item: Item): string {
  return (item as any).name ?? (item as any).title ?? (item as any).label ?? `Item ${item.id}`;
}

function abbreviateItemLabel(label: string): string {
  const clean = label.trim().replace(/\s+/g, ' ');
  if (!clean) return '…';

  const words = clean.split(/[\s/_-]+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 4).toUpperCase();
  }

  return words
    .slice(0, 3)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

function getVariantChipStyle(baseColor: string | undefined, index: number, total: number): React.CSSProperties {
  const alphaSteps = ['18', '20', '26', '2c', '32'];
  const alpha = alphaSteps[Math.min(index, alphaSteps.length - 1)];
  const opacityBoost = total > 1 ? Math.max(0, 1 - index * 0.08) : 1;

  if (!baseColor) {
    return {
      background: `hsl(var(--accent) / ${Math.max(0.12, opacityBoost).toFixed(2)})`,
      color: 'hsl(var(--foreground))',
      borderColor: 'hsl(var(--border))',
    };
  }

  return {
    background: `${baseColor}${alpha}`,
    color: baseColor,
    borderColor: `${baseColor}${Math.min(42, 24 + index * 8).toString(16).padStart(2, '0')}`,
  };
}

function getLeafColumnTone(index: number, baseColor?: string): React.CSSProperties {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const isEven = index % 2 === 0;
  const alpha = isDark ? (isEven ? '03' : '05') : (isEven ? '14' : '20');
  const borderAlpha = isDark ? (isEven ? '0c' : '14') : (isEven ? '24' : '34');

  if (baseColor) {
    return {
      background: `${baseColor}${alpha}`,
      borderColor: `${baseColor}${borderAlpha}`,
    };
  }

  return {
    background: isDark
      ? (isEven ? 'hsl(var(--muted) / 0.18)' : 'hsl(var(--accent) / 0.12)')
      : (isEven ? 'hsl(var(--muted) / 0.42)' : 'hsl(var(--accent) / 0.24)'),
    borderColor: isDark
      ? (isEven ? 'hsl(var(--border) / 0.55)' : 'hsl(var(--border) / 0.75)')
      : (isEven ? 'hsl(var(--border) / 0.85)' : 'hsl(var(--border) / 1)'),
  };
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

const RecapModule: React.FC<Props> = ({ module, data, collections, globalFilter, onUpdate, onViewDetail, onShowNewItemModal }) => {
  const now = new Date();

  const [tooltip, setTooltip]       = useState<TooltipState | null>(null);
  const hideTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeWeekKey, setActiveWeekKey] = useState<string | null>(MONTH_TOTAL_WEEK_KEY);
  
  // État pour le menu contextuel au clic droit
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: Item[];
    period: PeriodRow;
    leaf: LeafColumn;
  } | null>(null);

  const mode             = module.recapMode ?? 'month';
  const columns          = module.recapColumns ?? [];
  const includeWeekends  = module.recapIncludeWeekends ?? true;
  const hiddenWeekDays   = module.recapHiddenWeekDays ?? [];
  const { filteredItems, properties, dateFields, collection } = data;

  const allCollections = useMemo(() => {
    const map = new Map<string, Collection>();
    if (collection) map.set(collection.id, collection);
    (collections ?? []).forEach((c) => {
      if (c?.id) map.set(c.id, c);
    });
    return Array.from(map.values());
  }, [collection, collections]);

  const allProperties = useMemo<Property[]>(() => {
    const map = new Map<string, Property>();
    allCollections.forEach((c) => {
      (c.properties ?? []).forEach((p) => {
        if (!map.has(p.id)) map.set(p.id, p);
      });
    });
    return Array.from(map.values());
  }, [allCollections]);

  const resolvePropertyForCollection = useCallback<RecapPropertyResolver>((fieldId, collectionId) => {
    if (collectionId) {
      const col = allCollections.find((c) => c.id === collectionId);
      const prop = col?.properties?.find((p) => p.id === fieldId);
      if (prop) return prop;
    }
    for (const col of allCollections) {
      const prop = col.properties?.find((p) => p.id === fieldId);
      if (prop) return prop;
    }
    return allProperties.find((p) => p.id === fieldId);
  }, [allCollections, allProperties]);

  const sharedPeriodDate = useMemo(() => {
    const raw = globalFilter?.start ?? globalFilter?.end ?? null;
    if (!raw) return null;
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [globalFilter?.start, globalFilter?.end]);

  const dateField = useMemo(
    () =>
      properties.find((p) => p.id === module.recapDateField) ??
      dateFields[0] ??
      undefined,
    [properties, module.recapDateField, dateFields]
  );

  const sourceContexts = useMemo(() => {
    const byId = new Map<string, {
      collection: Collection;
      properties: Property[];
      dateField?: Property;
      nameField?: Property;
      items: Item[];
    }>();

    const hasGlobalDate = !!(globalFilter?.preset || globalFilter?.start || globalFilter?.end);
    const globalRange = hasGlobalDate
      ? computeDateRange(globalFilter?.preset ?? 'custom', globalFilter?.start, globalFilter?.end)
      : null;

    allCollections.forEach((srcCollection) => {
      const srcProperties: Property[] = srcCollection.properties ?? [];
      const srcDateFields = srcProperties.filter((p) => p.type === 'date' || (p.type as string) === 'date_range');
      const srcDateField =
        srcProperties.find((p) => p.id === module.recapDateField) ??
        srcProperties.find((p) => p.id === globalFilter?.field) ??
        srcProperties.find((p) => p.id === module.dateField) ??
        srcDateFields[0] ??
        undefined;

      let srcItems: Item[] = [...(srcCollection.items ?? [])];

      if (globalRange && srcDateField) {
        srcItems = srcItems.filter((item) => {
          const dateStr = getDateValue(item, srcDateField.id);
          if (!dateStr) return false;
          try {
            const d = parseISO(dateStr);
            return isWithinInterval(d, { start: globalRange.start, end: globalRange.end });
          } catch {
            return false;
          }
        });
      }

      if (module.filters && module.filters.length > 0) {
        srcItems = applyModuleFilters(srcItems, module.filters, srcProperties);
      }

      const srcNameField = srcProperties.find((p) => p.id === 'name' || p.name === 'Nom') ?? undefined;

      byId.set(srcCollection.id, {
        collection: srcCollection,
        properties: srcProperties,
        dateField: srcDateField,
        nameField: srcNameField,
        items: srcItems,
      });
    });

    return byId;
  }, [allCollections, module.recapDateField, module.dateField, module.filters, globalFilter?.preset, globalFilter?.start, globalFilter?.end, globalFilter?.field]);

  const itemNameField = useMemo(
    () => collection?.properties?.find((p) => p.id === 'name' || p.name === 'Nom') ?? undefined,
    [collection]
  );

  const getLeafSource = useCallback((leaf: LeafColumn) => {
    const sourceCollectionId = leaf.collectionId ?? module.collectionId ?? collection?.id;
    if (sourceCollectionId && sourceContexts.has(sourceCollectionId)) {
      const source = sourceContexts.get(sourceCollectionId)!;
      const columnDateField = leaf.dateFieldId
        ? source.properties.find((p) => p.id === leaf.dateFieldId)
        : undefined;
      return {
        ...source,
        dateField: columnDateField ?? source.dateField,
      };
    }
    return {
      collection: collection as Collection,
      properties,
      dateField: leaf.dateFieldId
        ? properties.find((p) => p.id === leaf.dateFieldId) ?? dateField
        : dateField,
      nameField: itemNameField,
      items: filteredItems,
    };
  }, [sourceContexts, module.collectionId, collection, properties, dateField, itemNameField, filteredItems]);

  const getItemLabel = useCallback((item: Item, leaf?: LeafColumn) => {
    const source = leaf ? getLeafSource(leaf) : null;
    const nameField = source?.nameField ?? itemNameField;
    if (nameField) {
      const raw = (item as any)[nameField.id];
      if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
        return String(raw);
      }
    }
    return getItemDisplayLabel(item);
  }, [itemNameField, getLeafSource]);

  const moduleDefaults = useMemo(() => ({
    displayTypes:     module.recapDefaultDisplayTypes,
    collectionId:     module.collectionId,
    dateFieldId:      module.recapDateField,
    aggregationField: module.recapDefaultAggregationField,
    durationField:    module.recapDefaultDurationField,
    durationUnit:     module.recapDefaultDurationUnit,
  }), [module.recapDefaultDisplayTypes, module.collectionId, module.recapDateField, module.recapDefaultAggregationField, module.recapDefaultDurationField, module.recapDefaultDurationUnit]);

  // Feuilles après expansion de l'arbre
  const leaves = useMemo<LeafColumn[]>(
    () => flattenRecapToLeaves(columns, allProperties, [], moduleDefaults, resolvePropertyForCollection),
    [columns, allProperties, moduleDefaults, resolvePropertyForCollection]
  );

  // Lignes d'en-tête multi-niveaux
  const headerRows = useMemo<HeaderCell[][]>(
    () => buildRecapHeaderRows(columns, allProperties, moduleDefaults, resolvePropertyForCollection),
    [columns, allProperties, moduleDefaults, resolvePropertyForCollection]
  );

  // ── Données mode MOIS ──────────────────────────────────────────────────

  const displayYear = useMemo(
    () => sharedPeriodDate?.getFullYear() ?? now.getFullYear(),
    [sharedPeriodDate, now]
  );
  const displayMonth = useMemo(
    () => (sharedPeriodDate ? sharedPeriodDate.getMonth() + 1 : now.getMonth() + 1),
    [sharedPeriodDate, now]
  );

  const weekGroups = useMemo<WeekGroup[]>(() => {
    if (mode !== 'month') return [];
    return getWeekGroups(displayYear, displayMonth, includeWeekends, hiddenWeekDays);
  }, [mode, displayYear, displayMonth, includeWeekends, hiddenWeekDays]);

  useEffect(() => {
    if (mode !== 'month') return;
    if (weekGroups.length === 0) {
      setActiveWeekKey(null);
      return;
    }
    if (!activeWeekKey || (activeWeekKey !== MONTH_TOTAL_WEEK_KEY && !weekGroups.some((wg) => wg.weekKey === activeWeekKey))) {
      setActiveWeekKey(MONTH_TOTAL_WEEK_KEY);
    }
  }, [mode, weekGroups, activeWeekKey]);

  const visibleWeekGroups = useMemo(() => {
    if (mode !== 'month') return [] as { wg: WeekGroup; sourceIdx: number }[];
    const all = weekGroups.map((wg, sourceIdx) => ({ wg, sourceIdx }));
    if (!activeWeekKey || activeWeekKey === MONTH_TOTAL_WEEK_KEY) return all;
    return all.filter(({ wg }) => wg.weekKey === activeWeekKey);
  }, [mode, weekGroups, activeWeekKey]);

  const visibleMonthCellItems = useMemo(() => {
    if (mode !== 'month') return [] as Item[][][][];
    return visibleWeekGroups.map(({ wg }) =>
      wg.days.map((day) =>
        leaves.map((leaf) => {
          const source = getLeafSource(leaf);
          return getLeafCellItems(
            source.items,
            leaf,
            { key: day.key, label: day.dayLabel, sublabel: day.dateLabel, start: day.start, end: day.end },
            source.dateField,
            source.properties
          );
        })
      )
    );
  }, [mode, visibleWeekGroups, leaves, getLeafSource]);

  const visibleMonthCellLayout = useMemo(() => {
    if (mode !== 'month') return [] as Array<Array<Array<{ rowSpan: number; skip: boolean }>>>;

    const layout = visibleWeekGroups.map(({ wg }) =>
      wg.days.map(() => leaves.map(() => ({ rowSpan: 1, skip: false })))
    );

    const flatPositions: { weekIdx: number; dayIdx: number }[] = [];
    visibleWeekGroups.forEach(({ wg }, weekIdx) => {
      wg.days.forEach((_, dayIdx) => {
        flatPositions.push({ weekIdx, dayIdx });
      });
    });

    for (let flatIdx = 0; flatIdx < flatPositions.length; flatIdx++) {
      const { weekIdx, dayIdx } = flatPositions[flatIdx];

      for (let leafIdx = 0; leafIdx < leaves.length; leafIdx++) {
        const leaf = leaves[leafIdx];
        const currentItems = visibleMonthCellItems[weekIdx]?.[dayIdx]?.[leafIdx] ?? [];
        const currentMeta = layout[weekIdx][dayIdx][leafIdx];

        if (currentMeta.skip || leaf.displayType !== 'count' || currentItems.length !== 1) {
          continue;
        }

        const currentItemId = String(currentItems[0].id);
        let span = 1;

        for (let nextIdx = flatIdx + 1; nextIdx < flatPositions.length; nextIdx++) {
          const { weekIdx: nextWeekIdx, dayIdx: nextDayIdx } = flatPositions[nextIdx];
          const nextItems = visibleMonthCellItems[nextWeekIdx]?.[nextDayIdx]?.[leafIdx] ?? [];
          if (nextItems.length !== 1 || String(nextItems[0].id) !== currentItemId) break;

          span += 1;
          layout[nextWeekIdx][nextDayIdx][leafIdx].skip = true;
        }

        currentMeta.rowSpan = span;
      }
    }

    return layout;
  }, [mode, visibleWeekGroups, visibleMonthCellItems, leaves]);

  // cells[wgIdx][dayIdx][leafIdx]
  const dayCells = useMemo(() => {
    if (mode !== 'month') return [];
    return weekGroups.map((wg) =>
      wg.days.map((day) =>
        leaves.map((leaf) => {
          const source = getLeafSource(leaf);
          return computeLeafCell(
            source.items,
            leaf,
            { key: day.key, label: day.dayLabel, sublabel: day.dateLabel, start: day.start, end: day.end },
            source.dateField,
            source.properties
          );
        })
      )
    );
  }, [mode, weekGroups, leaves, getLeafSource]);

  const dayRowTotals = useMemo(
    () => dayCells.map((wg) => wg.map((row) => computeTotalsByType(row, leaves))),
    [dayCells, leaves]
  );

  const monthPeriods = useMemo(
    () => weekGroups.flatMap((wg) => wg.days.map((day) => ({
      key: day.key,
      label: day.dayLabel,
      sublabel: day.dateLabel,
      start: day.start,
      end: day.end,
    } as PeriodRow))),
    [weekGroups]
  );

  // ── Données mode ANNÉE ─────────────────────────────────────────────────

  const yearPeriods = useMemo<PeriodRow[]>(() => {
    if (mode !== 'year') return [];
    return getMonthsOfYear(displayYear);
  }, [mode, displayYear]);

  const yearCells = useMemo(() => {
    if (mode !== 'year') return [];
    return yearPeriods.map((period) =>
      leaves.map((leaf) => {
        const source = getLeafSource(leaf);
        return computeLeafCell(source.items, leaf, period, source.dateField, source.properties);
      })
    );
  }, [mode, yearPeriods, leaves, getLeafSource]);

  const yearRowTotals = useMemo(
    () => yearCells.map((row) => computeTotalsByType(row, leaves)),
    [yearCells, leaves]
  );

  const countUniqueItemsAcrossPeriods = useCallback(
    (leaf: LeafColumn, periods: PeriodRow[]) => {
      const source = getLeafSource(leaf);
      const seen = new Set<string>();
      for (const period of periods) {
        const items = getLeafCellItems(source.items, leaf, period, source.dateField, source.properties);
        items.forEach((item) => seen.add(String(item.id)));
      }
      return seen.size;
    },
    [getLeafSource]
  );

  // ── Totaux par feuille + grand total ──────────────────────────────────

  const leafTotals = useMemo(() => {
    if (mode === 'month') {
      return leaves.map((leaf, li) => {
        if (leaf.displayType === 'count') {
          return countUniqueItemsAcrossPeriods(leaf, monthPeriods);
        }
        return dayCells.reduce((s, wg) => s + wg.reduce((s2, day) => s2 + day[li], 0), 0);
      });
    }
    return leaves.map((leaf, li) => {
      if (leaf.displayType === 'count') {
        return countUniqueItemsAcrossPeriods(leaf, yearPeriods);
      }
      return yearCells.reduce((s, row) => s + row[li], 0);
    });
  }, [mode, dayCells, yearCells, leaves, monthPeriods, yearPeriods, countUniqueItemsAcrossPeriods]);

  const grandTotalsByType = useMemo(
    () => computeTotalsByType(leafTotals, leaves),
    [leafTotals, leaves]
  );

  const periodTitle =
    mode === 'year'
      ? String(displayYear)
      : `${MONTH_NAMES_FR[displayMonth - 1]} ${displayYear}`;

  // ── Tooltip ──────────────────────────────────────────────────────────

  const scheduleHide = useCallback(() => {
    hideTimerRef.current = setTimeout(() => setTooltip(null), 200);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const handleCellEnter = useCallback((
    e: React.MouseEvent<HTMLTableCellElement>,
    leaf: LeafColumn,
    period: PeriodRow
  ) => {
    cancelHide();
    const source = getLeafSource(leaf);
    const items = getLeafCellItems(source.items, leaf, period, source.dateField, source.properties);
    if (items.length === 0) { setTooltip(null); return; }
    setTooltip({ items, rect: e.currentTarget.getBoundingClientRect() });
  }, [getLeafSource, cancelHide]);

  const handleCellClick = useCallback((
    e: React.MouseEvent<HTMLTableCellElement>,
    leaf: LeafColumn,
    period: PeriodRow
  ) => {
    cancelHide();
    const source = getLeafSource(leaf);
    const items = getLeafCellItems(source.items, leaf, period, source.dateField, source.properties);
    if (items.length === 0) {
      setTooltip(null);
      return;
    }

    if (items.length > 1) {
      setTooltip({ items, rect: e.currentTarget.getBoundingClientRect() });
      return;
    }

    if (!onViewDetail) return;
    if (items.length === 1) {
      onViewDetail(items[0]);
      setTooltip(null);
    }
  }, [getLeafSource, onViewDetail, cancelHide]);

  const handleCellContextMenu = useCallback((
    e: React.MouseEvent<HTMLTableCellElement>,
    leaf: LeafColumn,
    period: PeriodRow
  ) => {
    e.preventDefault();
    cancelHide();
    const source = getLeafSource(leaf);
    const items = getLeafCellItems(source.items, leaf, period, source.dateField, source.properties);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items,
      period,
      leaf,
    });
  }, [getLeafSource, cancelHide]);

  const handleCreateNewItem = useCallback((sourceCollectionId?: string) => {
    if (!onShowNewItemModal || !contextMenu) return;
    
    const leaf = contextMenu.leaf;
    const source = getLeafSource(leaf);
    
    // Déterminer la bonne collection : celle de la feuille si elle en a une, sinon celle par défaut
    const targetCollection = leaf.collectionId
      ? allCollections.find((c) => c.id === leaf.collectionId)
      : collection;
    
    if (!targetCollection) return;

    const contextDateField = source?.dateField || dateField;

    // Créer les valeurs de pré-remplissage basées sur :
    // 1. La date de la période cliquée
    // 2. La chaîne de filtres (parent columns) pour pré-remplir les champs de regroupement
    const prefillValues: Record<string, any> = {};

    // 1. Ajouter la date de début et/ou fin de la période
    if (contextDateField && contextMenu?.period) {
      const dateFieldId = contextDateField.id;
      
      if (contextDateField.type === 'date') {
        prefillValues[dateFieldId] = contextMenu.period.start.toISOString().split('T')[0];
      } else if ((contextDateField.type as string) === 'date_range') {
        // Si c'est un range, on met les deux dates
        prefillValues[dateFieldId] = {
          start: contextMenu.period.start.toISOString().split('T')[0],
          end: contextMenu.period.end.toISOString().split('T')[0],
        };
      }
    }

    // 2. Ajouter les valeurs du filterChain (colonnes parentes de regroupement)
    // Le filterChain contient les filtres qui définissent cette feuille
    // Exemple: [{fieldId: 'type_site', values: ['NB']}, {fieldId: 'plan', values: ['Premium']}]
    // Important: Si plusieurs filtres concernent le même champ, il faut les accumuler !
    console.log('[RecapModule] contextMenu.leaf.filterChain:', leaf.filterChain);
    
    if (leaf.filterChain && leaf.filterChain.length > 0) {
      // Grouper les filtres par fieldId et accumuler les valeurs
      const filtersByField = new Map<string, string[]>();
      leaf.filterChain.forEach((filter) => {
        const existing = filtersByField.get(filter.fieldId) || [];
        filtersByField.set(filter.fieldId, [...existing, ...filter.values]);
      });

      // Pré-remplir avec toutes les valeurs accumulées
      filtersByField.forEach((values, fieldId) => {
        const fieldInTarget = targetCollection.properties?.find((p) => p.id === fieldId);
        console.log(`[RecapModule] filter ${fieldId} = ${values.join(', ')} → found in target: ${!!fieldInTarget}`);
        if (fieldInTarget && values.length > 0) {
          // Si c'est un champ multiselect, ajouter toutes les valeurs; sinon, prendre la première
          if (fieldInTarget.type === 'multiselect' || (fieldInTarget.type as string) === 'multi_select') {
            prefillValues[fieldId] = values;
          } else {
            // Même si c'est un select simple, on met toutes les valeurs (multiselect implicite)
            prefillValues[fieldId] = values;
          }
        }
      });
    }

    console.log('[RecapModule] prefillValues:', prefillValues);
    // Passer les prefillValues comme editingItem (item vide pré-rempli)
    onShowNewItemModal(targetCollection, prefillValues);
    setContextMenu(null);
  }, [collection, allCollections, getLeafSource, contextMenu, dateField, onShowNewItemModal]);

  // ── États vides ───────────────────────────────────────────────────────

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucune collection sélectionnée
      </div>
    );
  }
  if (!dateField) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucun champ date — configurez <span className="mx-1 font-medium">Champ date</span> dans les paramètres
      </div>
    );
  }
  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground text-sm">
        <div>Aucune colonne configurée</div>
        <div className="text-xs">Ouvrez les paramètres du module pour ajouter des colonnes</div>
      </div>
    );
  }

  // ── Nombre de colonnes période (pour tfoot colspan) ───────────────────
  const periodColCount = mode === 'month' ? 2 : 1;

  const activeWeekIdx = useMemo(
    () => weekGroups.findIndex((wg) => wg.weekKey === activeWeekKey),
    [weekGroups, activeWeekKey]
  );
  const activeWeek = activeWeekIdx >= 0 ? weekGroups[activeWeekIdx] : undefined;
  const activeWeekDayCells = activeWeekIdx >= 0 ? dayCells[activeWeekIdx] : [];
  const activeWeekRowTotals = activeWeekIdx >= 0 ? dayRowTotals[activeWeekIdx] : [];

  const activeWeekLeafTotals = useMemo(() => {
    if (mode !== 'month' || activeWeekIdx < 0) return leaves.map(() => 0);
    if (!activeWeek) return leaves.map(() => 0);
    return leaves.map((leaf, li) => {
      if (leaf.displayType === 'count') {
        const activeWeekPeriods = activeWeek.days.map((day) => ({
          key: day.key,
          label: day.dayLabel,
          sublabel: day.dateLabel,
          start: day.start,
          end: day.end,
        } as PeriodRow));
        return countUniqueItemsAcrossPeriods(leaf, activeWeekPeriods);
      }
      return (dayCells[activeWeekIdx] || []).reduce((sum, day) => sum + (day[li] ?? 0), 0);
    });
  }, [mode, activeWeekIdx, activeWeek, dayCells, leaves, countUniqueItemsAcrossPeriods]);

  const activeWeekTotalsByType = useMemo(
    () => computeTotalsByType(activeWeekLeafTotals, leaves),
    [activeWeekLeafTotals, leaves]
  );

  const displayedMonthLeafTotals = activeWeekKey === MONTH_TOTAL_WEEK_KEY ? leafTotals : activeWeekLeafTotals;
  const displayedTotalsByType = activeWeekKey === MONTH_TOTAL_WEEK_KEY ? grandTotalsByType : activeWeekTotalsByType;

  // ── Rendu ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" onMouseLeave={scheduleHide}>

      {/* Tooltip flottant */}
      {tooltip && (
        <CellTooltip
          tooltip={tooltip}
          onItemClick={(item) => { onViewDetail?.(item); setTooltip(null); }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}

      {/* ── Barre de navigation ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card/60 flex-shrink-0">
        <span className="text-sm font-medium text-foreground min-w-[140px] text-center">
          {periodTitle}
        </span>

        <div className="flex-1" />

        <span className="text-xs text-muted-foreground">
          Total — Nb: <span className="font-semibold text-foreground">{formatTotalCount(mode === 'month' ? displayedTotalsByType.count : grandTotalsByType.count)}</span>
          {' · '}Durée: <span className="font-semibold text-foreground">{formatTotalDuration(mode === 'month' ? displayedTotalsByType.durationMinutes : grandTotalsByType.durationMinutes)}</span>
        </span>
      </div>

      {mode === 'month' && weekGroups.length > 0 && (
        <div className="px-3 py-1.5 border-b border-border bg-card/40 flex items-center gap-3 overflow-x-auto">
          <button
            onClick={() => setActiveWeekKey(MONTH_TOTAL_WEEK_KEY)}
            className={`px-2 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
              activeWeekKey === MONTH_TOTAL_WEEK_KEY ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            Total général
          </button>
          {weekGroups.map((wg) => {
            const active = wg.weekKey === activeWeekKey;
            return (
              <button
                key={wg.weekKey}
                onClick={() => setActiveWeekKey(wg.weekKey)}
                className={`px-2 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {wg.weekLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tableau ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">

          {/* En-tête multi-niveaux */}
          <thead className="sticky top-0 z-10 bg-card">
            {headerRows.map((row, rowIdx) => (
              <tr key={rowIdx} className={rowIdx === 0 ? 'bg-muted/20' : 'bg-card'}>
                {/* Colonnes période — seulement sur la première ligne de header */}
                {rowIdx === 0 && mode === 'month' && (
                  <>
                    <th
                      rowSpan={headerRows.length}
                      className="text-center px-2 py-2 text-[11px] font-semibold text-muted-foreground border-b border-r border-border whitespace-nowrap w-14 align-bottom"
                    >
                      Sem.
                    </th>
                    <th
                      rowSpan={headerRows.length}
                      className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground border-b border-r border-border whitespace-nowrap min-w-[90px] align-bottom"
                    >
                      Jour
                    </th>
                  </>
                )}
                {rowIdx === 0 && mode === 'year' && (
                  <th
                    rowSpan={headerRows.length}
                    className="text-left px-3 py-2 text-[11px] font-semibold text-muted-foreground border-b border-r border-border whitespace-nowrap min-w-[110px] align-bottom"
                  >
                    Mois
                  </th>
                )}

                {/* Cellules données */}
                {(() => {
                  let leafHeaderIndex = 0;
                  return row.map((cell) => {
                    const tone = cell.isLeaf ? getLeafColumnTone(leafHeaderIndex++, cell.color) : {};
                    return (
                      <th
                        key={cell.id}
                        colSpan={cell.colspan}
                        rowSpan={cell.rowspan}
                        className={`text-center px-2 py-1.5 border-b border-r border-border whitespace-nowrap ${
                          cell.isLeaf ? 'bg-card text-[11px] font-medium' : 'bg-muted/10 text-xs font-semibold'
                        }`}
                        style={{
                          color: cell.color ?? 'hsl(var(--foreground))',
                          ...tone,
                        }}
                      >
                        <span className="leading-tight">{cell.label}</span>
                      </th>
                    );
                  });
                })()}

                {/* Colonnes Total */}
                {headerRows.length > 1 ? (
                  <>
                    {rowIdx === 0 && (
                      <th
                        colSpan={2}
                        className="text-center px-3 py-1.5 text-[11px] font-semibold text-muted-foreground border-b border-l border-border"
                      >
                        Total
                      </th>
                    )}
                    {rowIdx > 0 && rowIdx < headerRows.length - 1 && (
                      <th
                        colSpan={2}
                        className="border-b border-l border-border bg-card"
                        aria-hidden="true"
                      />
                    )}
                    {rowIdx === headerRows.length - 1 && (
                      <>
                        <th className="text-center px-3 py-2 text-[11px] font-semibold text-muted-foreground border-b border-l border-border align-bottom">
                          Nb
                        </th>
                        <th className="text-center px-3 py-2 text-[11px] font-semibold text-muted-foreground border-b border-l border-border align-bottom">
                          Durée
                        </th>
                      </>
                    )}
                  </>
                ) : (
                  rowIdx === 0 && (
                    <>
                      <th className="text-center px-3 py-2 text-[11px] font-semibold text-muted-foreground border-b border-l border-border align-bottom">
                        <div className="leading-tight">Total</div>
                        <div className="leading-tight">Nb</div>
                      </th>
                      <th className="text-center px-3 py-2 text-[11px] font-semibold text-muted-foreground border-b border-l border-border align-bottom">
                        <div className="leading-tight">Total</div>
                        <div className="leading-tight">Durée</div>
                      </th>
                    </>
                  )
                )}
              </tr>
            ))}
          </thead>

          {/* Corps */}
          <tbody>
            {/* ── Mode MOIS : jours groupés par semaine ── */}
            {mode === 'month' && (activeWeekKey === MONTH_TOTAL_WEEK_KEY ? visibleWeekGroups : visibleWeekGroups.slice(0, 1)).map(({ wg, sourceIdx }, visibleIdx) => (
              <React.Fragment key={wg.weekKey}>
                {activeWeekKey === MONTH_TOTAL_WEEK_KEY && visibleIdx > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={2 + leaves.length + 2} className="h-4 bg-background" />
                  </tr>
                )}

                {wg.days.map((day, dayIdx) => {
              const period: PeriodRow = {
                key: day.key, label: day.dayLabel, sublabel: day.dateLabel,
                start: day.start, end: day.end,
              };
              return (
                <tr
                  key={day.key}
                  className={`transition-colors hover:bg-accent/30 ${day.isWeekend ? 'bg-muted/30' : ''}`}
                >
                  {dayIdx === 0 && (
                    <td
                      rowSpan={wg.days.length}
                      className="px-1 py-1 border-b border-r border-border/20 text-center align-middle bg-accent/10"
                    >
                      <div className="text-[11px] font-semibold text-muted-foreground leading-tight">
                        {wg.weekLabel}
                      </div>
                    </td>
                  )}

                  <td className="px-3 py-1.5 border-b border-border/50 whitespace-nowrap">
                    <span className={`text-xs font-semibold ${day.isWeekend ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {day.dayLabel}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-1.5">
                      {day.dateLabel}
                    </span>
                  </td>

                  {leaves.map((leaf, li) => {
                    const items = visibleMonthCellItems[visibleIdx]?.[dayIdx]?.[li] ?? [];
                    const cellLayout = visibleMonthCellLayout[visibleIdx]?.[dayIdx]?.[li] ?? { rowSpan: 1, skip: false };

                    if (cellLayout.skip) return null;

                    const renderCountContent = () => {
                      if (items.length === 0) {
                        return <span className="text-muted-foreground/30 text-xs">–</span>;
                      }

                      const shownItems = items.slice(0, 2);
                      const rest = items.length - shownItems.length;

                      if (items.length === 1) {
                        const label = getItemLabel(items[0], leaf);
                        const abbr = abbreviateItemLabel(label);
                        return (
                          <div className="flex flex-col items-center gap-0.5 leading-tight">
                            <span
                              className="inline-flex items-center justify-center w-full min-w-[40px] max-w-[120px] rounded border px-1 py-0.5 text-[11px] font-semibold"
                              style={{
                                ...getVariantChipStyle(leaf.color, 0, 1),
                              }}
                              title={label}
                            >
                              {abbr}
                            </span>
                            {cellLayout.rowSpan > 1 && (
                              <span className="text-[10px] text-muted-foreground">
                                {cellLayout.rowSpan} j
                              </span>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div className="flex flex-col gap-1 items-stretch min-w-[56px]">
                          {shownItems.map((item: Item, index: number) => {
                            const label = getItemLabel(item, leaf);
                            const abbr = abbreviateItemLabel(label);
                            return (
                              <span
                                key={item.id}
                                className="inline-flex items-center justify-center rounded border px-1 py-0.5 text-[10px] font-semibold"
                                style={{
                                  ...getVariantChipStyle(leaf.color, index, items.length),
                                }}
                                title={label}
                              >
                                {abbr}
                              </span>
                            );
                          })}
                          {rest > 0 && (
                            <span className="text-[10px] text-muted-foreground text-center">
                              +{rest} autre{rest > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      );
                    };

                    return (
                      <td
                        key={leaf.id}
                        rowSpan={cellLayout.rowSpan}
                        className={`text-center px-2 py-1.5 border-b border-border/50 tabular-nums align-middle ${onViewDetail ? 'cursor-pointer' : ''}`}
                        style={{
                          ...getLeafColumnTone(li, leaf.color),
                        }}
                        onMouseEnter={(e) => handleCellEnter(e, leaf, period)}
                        onMouseLeave={scheduleHide}
                        onClick={(e) => handleCellClick(e, leaf, period)}
                        onContextMenu={(e) => handleCellContextMenu(e, leaf, period)}
                      >
                        {leaf.displayType === 'count' ? (
                          renderCountContent()
                        ) : (
                          <>
                            {(dayCells[sourceIdx]?.[dayIdx]?.[li] ?? 0) > 0 ? (
                              <span
                                className="inline-flex items-center justify-center min-w-[28px] h-5 rounded px-1 text-xs font-semibold"
                                style={{
                                  background: leaf.color ? `${leaf.color}18` : 'hsl(var(--accent))',
                                  color:      leaf.color ?? 'hsl(var(--foreground))',
                                }}
                              >
                                {formatRecapValue(dayCells[sourceIdx][dayIdx][li], leaf.displayType, leaf.durationUnit)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30 text-xs">–</span>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}

                  <td className="text-center px-3 py-1.5 border-b border-border/50 tabular-nums">
                    <span className="text-xs font-semibold text-foreground">
                      {formatTotalCount((dayRowTotals[sourceIdx]?.[dayIdx] ?? EMPTY_TOTALS).count)}
                    </span>
                  </td>
                  <td className="text-center px-3 py-1.5 border-b border-border/50 tabular-nums">
                    <span className="text-xs font-semibold text-foreground">
                      {formatTotalDuration((dayRowTotals[sourceIdx]?.[dayIdx] ?? EMPTY_TOTALS).durationMinutes)}
                    </span>
                  </td>
                </tr>
              );
                })}
              </React.Fragment>
            ))}

            {/* ── Mode ANNÉE : une ligne par mois ── */}
            {mode === 'year' && yearPeriods.map((period, ri) => (
              <tr key={period.key} className="hover:bg-accent/30 transition-colors">
                <td className="px-3 py-2 border-b border-border/50">
                  <div className="font-medium text-foreground text-xs capitalize">{period.label}</div>
                </td>
                {leaves.map((leaf, li) => {
                  const val = yearCells[ri]?.[li] ?? 0;
                  return (
                    <td
                      key={leaf.id}
                      className={`text-center px-2 py-2 border-b border-border/50 tabular-nums ${onViewDetail ? 'cursor-pointer' : ''}`}
                      onMouseEnter={(e) => handleCellEnter(e, leaf, period)}
                      onMouseLeave={scheduleHide}
                      onClick={(e) => handleCellClick(e, leaf, period)}
                      onContextMenu={(e) => handleCellContextMenu(e, leaf, period)}
                    >
                      {val > 0 ? (
                        <span
                          className="inline-flex items-center justify-center min-w-[32px] h-6 rounded-md text-xs font-semibold px-1"
                          style={{
                            background: leaf.color ? `${leaf.color}18` : 'hsl(var(--accent))',
                            color:      leaf.color ?? 'hsl(var(--foreground))',
                          }}
                        >
                          {formatRecapValue(val, leaf.displayType, leaf.durationUnit)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40 text-xs">–</span>
                      )}
                    </td>
                  );
                })}
                <td className="text-center px-3 py-2 border-b border-border/50 tabular-nums">
                  <span className="text-xs font-semibold text-foreground">{formatTotalCount((yearRowTotals[ri] ?? EMPTY_TOTALS).count)}</span>
                </td>
                <td className="text-center px-3 py-2 border-b border-border/50 tabular-nums">
                  <span className="text-xs font-semibold text-foreground">{formatTotalDuration((yearRowTotals[ri] ?? EMPTY_TOTALS).durationMinutes)}</span>
                </td>
              </tr>
            ))}
          </tbody>

          {/* Totaux */}
          <tfoot className="sticky bottom-0 bg-card border-t-2 border-border">
            <tr>
              <td
                colSpan={periodColCount}
                className="px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                Total
              </td>
              {leaves.map((leaf, li) => (
                <td key={leaf.id} className="text-center px-2 py-2 tabular-nums">
                  <span
                    className="text-xs font-bold"
                    style={{ color: leaf.color ?? 'hsl(var(--foreground))' }}
                  >
                    {displayedMonthLeafTotals[li] > 0
                      ? formatRecapValue(displayedMonthLeafTotals[li], leaf.displayType, leaf.durationUnit)
                      : '–'}
                  </span>
                </td>
              ))}
              <td className="text-center px-3 py-2 tabular-nums">
                <span className="text-xs font-bold text-foreground">{formatTotalCount(mode === 'month' ? displayedTotalsByType.count : grandTotalsByType.count)}</span>
              </td>
              <td className="text-center px-3 py-2 tabular-nums">
                <span className="text-xs font-bold text-foreground">{formatTotalDuration(mode === 'month' ? displayedTotalsByType.durationMinutes : grandTotalsByType.durationMinutes)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Menu contextuel au clic droit */}
      {contextMenu && (
        <>
          {/* Backdrop pour fermer le menu */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          />
          {/* Popover du menu contextuel */}
          <div
            className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg p-1"
            style={{
              left: `${Math.min(contextMenu.x, window.innerWidth - 220)}px`,
              top: `${Math.min(contextMenu.y, window.innerHeight - 150)}px`,
            }}
          >
            {contextMenu.items.length > 0 && (
              <>
                <button
                  onClick={() => {
                    if (contextMenu.items.length === 1) {
                      onViewDetail?.(contextMenu.items[0]);
                    } else {
                      // Afficher les items dans un menu si plusieurs
                      setTooltip({
                        items: contextMenu.items,
                        rect: new DOMRect(contextMenu.x, contextMenu.y, 0, 0),
                      });
                    }
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded transition-colors"
                >
                  {contextMenu.items.length === 1
                    ? `Ouvrir: ${getItemLabel(contextMenu.items[0])}`
                    : `Ouvrir (${contextMenu.items.length})`}
                </button>
                <div className="h-px bg-border my-1" />
              </>
            )}
            <button
              onClick={() => handleCreateNewItem()}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded transition-colors"
            >
              Créer un nouvel objet
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default RecapModule;
