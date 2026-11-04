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
  startOfYear,
  startOfWeek,
  endOfYear,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  format,
  getISOWeek,
  getDay,
  isWeekend,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarRange } from 'lucide-react';
import { DashboardModuleConfig, RecapAssignments } from '@/lib/dashboardTypes';
import { DashboardItemData, GlobalDateFilter } from '@/lib/hooks/useDashboardItemData';
import { Collection, Item, Property } from '@/lib/types';
import { applyModuleFilters, computeDateRange } from '@/lib/utils/dashboardUtils';
import { formatAssignmentPeriod, getAssignmentOptions, getAssignmentKey, getAssignedDate } from '@/lib/utils/recapAssignments';
import {
  PeriodRow,
  LeafColumn,
  HeaderCell,
  buildRecapHeaderRows,
  flattenRecapToLeaves,
  RecapPropertyResolver,
  computeLeafCell,
  getLeafCellItems,
  getItemIntervalsForDateField,
  getItemCanonicalStartMs,
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
  rangeLabel: string;
  days: DayRow[];
}

interface TooltipState {
  items: Item[];
  leaf: LeafColumn;
  rect: DOMRect;
}

const NO_HIDDEN_DAYS: number[] = [];
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

function computeTotalsByIndices(values: number[], leaves: LeafColumn[], indices: number[]): TotalsByType {
  return indices.reduce((acc, idx) => {
    const leaf = leaves[idx];
    if (!leaf) return acc;
    return accumulateLeafTotal(acc, leaf, values[idx] ?? 0);
  }, { ...EMPTY_TOTALS });
}

function formatTotalCount(value: number): string {
  return value > 0 ? String(value) : '–';
}

function formatTotalDuration(minutes: number): string {
  return minutes > 0 ? formatRecapValue(minutes, 'duration', 'minutes') : '–';
}

const TOTAL_METRICS = [
  { key: 'count', label: 'Nombre', format: formatTotalCount },
  { key: 'durationMinutes', label: 'Durée', format: formatTotalDuration },
] as const;

function totalGroupClass(isGrandTotal: boolean) {
  return isGrandTotal ? 'bg-brand-600/10 dark:bg-brand-400/15' : 'bg-muted/40';
}

function TotalCells({ totals, isGrandTotal = false }: { totals: TotalsByType; isGrandTotal?: boolean }) {
  return TOTAL_METRICS.map(({ key, format }, index) => {
    const value = format(totals[key]);
    return (
      <td
        key={key}
        className={`whitespace-nowrap border-b border-border/50 px-3 py-1.5 text-right text-xs tabular-nums
          ${totalGroupClass(isGrandTotal)} ${index === 0 ? 'border-l border-l-border' : ''}
          ${value === '–' ? 'text-muted-foreground' : isGrandTotal ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}
      >
        {value}
      </td>
    );
  });
}

// ---------------------------------------------------------------------------
// Noms courts des jours (getDay → 0=dim, 1=lun…)
// ---------------------------------------------------------------------------

const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// ---------------------------------------------------------------------------
// Calcul des périodes – mode mois → groupes de semaines avec jours
// ---------------------------------------------------------------------------

function formatWeekRange(start: Date, end: Date): string {
  return `${format(start, 'dd/MM')} au ${format(end, 'dd/MM')}`;
}

const WEEK_OPTIONS = { weekStartsOn: 1 as const };

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

      return {
        weekKey: format(ws, 'yyyy-MM-dd'),
        weekLabel: `Semaine ${isoWeek}`,
        rangeLabel: formatWeekRange(ws, we),
        days,
      };
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

function itemOverlapsDateRange(item: Item, dateField: Property | undefined, rangeStart: Date, rangeEnd: Date): boolean {
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();
  const intervals = getItemIntervalsForDateField(item, dateField);
  return intervals.some((r) => r.end >= startMs && r.start <= endMs);
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
  assignments?: RecapAssignments;
  onAssignmentChange?: (key: string, date?: string) => void;
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
  onAssign?: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}> = ({ tooltip, onItemClick, onAssign, onMouseEnter, onMouseLeave }) => {
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
      {onAssign && (
        <button type="button" onClick={onAssign} className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs font-medium hover:bg-accent">
          <CalendarRange size={14} /> Choisir le rattachement
        </button>
      )}
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

const RecapModule: React.FC<Props> = ({ module, data, collections, globalFilter, assignments, onAssignmentChange, onUpdate, onViewDetail, onShowNewItemModal }) => {
  const now = new Date();

  const [assignmentCell, setAssignmentCell] = useState<Pick<TooltipState, 'items' | 'leaf'> | null>(null);
  const [tooltip, setTooltip]       = useState<TooltipState | null>(null);
  const hideTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedTotalKey, setSelectedTotalKey] = useState('grand-total');
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
  const hiddenWeekDays   = module.recapHiddenWeekDays ?? NO_HIDDEN_DAYS;
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
    const yearForMode = sharedPeriodDate?.getFullYear() ?? new Date().getFullYear();
    const forcedYearRange = mode === 'year'
      ? {
          start: startOfYear(new Date(yearForMode, 0, 1)),
          end: endOfYear(new Date(yearForMode, 0, 1)),
        }
      : null;
    const globalRange = forcedYearRange ?? (
      hasGlobalDate
        ? computeDateRange(globalFilter?.preset ?? 'custom', globalFilter?.start, globalFilter?.end)
        : null
    );

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
        srcItems = srcItems.filter((item) =>
          itemOverlapsDateRange(item, srcDateField, globalRange.start, globalRange.end)
        );
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
  }, [allCollections, mode, sharedPeriodDate, module.recapDateField, module.dateField, module.filters, globalFilter?.preset, globalFilter?.start, globalFilter?.end, globalFilter?.field]);

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

  const getLeafAssignmentKey = useCallback((leaf: LeafColumn, item: Item) => {
    const source = getLeafSource(leaf);
    return getAssignmentKey(source.collection?.id, item.id, source.dateField?.id);
  }, [getLeafSource]);

  const getAssignment = useCallback((leaf: LeafColumn) => (item: Item) => {
    const raw = assignments?.[getLeafAssignmentKey(leaf, item)];
    const assigned = getAssignedDate(item, getLeafSource(leaf).dateField, raw);
    if (assigned === undefined) return undefined;
    const date = new Date(assigned);

    if (mode === 'month' && (hiddenWeekDays.includes(date.getDay()) || (!includeWeekends && isWeekend(date)))) {
      const first = new Date(Math.max(startOfMonth(date).getTime(), startOfWeek(date, WEEK_OPTIONS).getTime()));
      const last = new Date(Math.min(endOfMonth(date).getTime(), endOfWeek(date, WEEK_OPTIONS).getTime()));
      const visibleDay = eachDayOfInterval({ start: first, end: last })
        .find((day) => !hiddenWeekDays.includes(day.getDay()) && (includeWeekends || !isWeekend(day)));
      if (visibleDay) return visibleDay.getTime();
    }

    return assigned;
  }, [assignments, getLeafAssignmentKey, getLeafSource, mode, hiddenWeekDays, includeWeekends]);

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

  const columnDividers = useMemo(() => {
    const dividers: React.CSSProperties[] = [];
    headerRows.forEach((row, depth) => {
      row.forEach((cell) => {
        if (depth > 1 && cell.isLeaf) return;
        dividers[cell.lastLeafIndex] ??= {
          borderRight: depth === 0
            ? '2px solid hsl(var(--muted-foreground) / 0.45)'
            : '1px solid hsl(var(--muted-foreground) / 0.20)',
        };
      });
    });
    return dividers;
  }, [headerRows]);

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

        if (currentMeta.skip || leaf.displayType !== 'count' || currentItems.length !== 1 || getAssignment(leaf)(currentItems[0]) !== undefined) {
          continue;
        }

        const currentItemId = String(currentItems[0].id);
        let span = 1;

        for (let nextIdx = flatIdx + 1; nextIdx < flatPositions.length; nextIdx++) {
          const { weekIdx: nextWeekIdx, dayIdx: nextDayIdx } = flatPositions[nextIdx];
          if (nextWeekIdx !== weekIdx) break;
          const nextItems = visibleMonthCellItems[nextWeekIdx]?.[nextDayIdx]?.[leafIdx] ?? [];
          if (nextItems.length !== 1 || String(nextItems[0].id) !== currentItemId) break;

          span += 1;
          layout[nextWeekIdx][nextDayIdx][leafIdx].skip = true;
        }

        currentMeta.rowSpan = span;
      }
    }

    return layout;
  }, [mode, visibleWeekGroups, visibleMonthCellItems, leaves, getAssignment]);

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
            source.properties,
            getAssignment(leaf)
          );
        })
      )
    );
  }, [mode, weekGroups, leaves, getLeafSource, getAssignment]);

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
    const base = yearPeriods.map(() => leaves.map(() => 0));

    leaves.forEach((leaf, li) => {
      const source = getLeafSource(leaf);

      if (leaf.displayType !== 'count') {
        yearPeriods.forEach((period, pi) => {
          base[pi][li] = computeLeafCell(source.items, leaf, period, source.dateField, source.properties, getAssignment(leaf));
        });
        return;
      }

      // Count: attribution stricte au mois de début canonique
      yearPeriods.forEach((period, pi) => {
        const itemsInPeriod = getLeafCellItems(source.items, leaf, period, source.dateField, source.properties, getAssignment(leaf));
        let count = 0;
        itemsInPeriod.forEach((item) => {
          const startMs = getAssignment(leaf)(item) ?? getItemCanonicalStartMs(item, source.dateField);
          if (startMs !== null && startMs >= period.start.getTime() && startMs <= period.end.getTime()) {
            count += 1;
          }
        });
        base[pi][li] = count;
      });
    });

    return base;
  }, [mode, yearPeriods, leaves, getLeafSource, getAssignment]);

  const yearRowTotals = useMemo(
    () => yearCells.map((row) => computeTotalsByType(row, leaves)),
    [yearCells, leaves]
  );

  const countUniqueItemsAcrossPeriods = useCallback(
    (leaf: LeafColumn, periods: PeriodRow[]) => {
      const source = getLeafSource(leaf);
      if (periods.length === 0) return 0;

      const rangeStart = Math.min(...periods.map((p) => p.start.getTime()));
      const rangeEnd = Math.max(...periods.map((p) => p.end.getTime()));
      const seen = new Map<string, Item>();

      for (const period of periods) {
        const items = getLeafCellItems(source.items, leaf, period, source.dateField, source.properties, getAssignment(leaf));
        items.forEach((item) => {
          const key = String(item.id);
          if (!seen.has(key)) seen.set(key, item);
        });
      }

      let count = 0;
      seen.forEach((item) => {
        const startMs = getAssignment(leaf)(item) ?? getItemCanonicalStartMs(item, source.dateField);
        if (startMs !== null && startMs >= rangeStart && startMs <= rangeEnd) {
          count += 1;
        }
      });

      return count;
    },
    [getLeafSource, getAssignment]
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

  const totalsByCollection = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; indices: number[] }>();

    leaves.forEach((leaf, idx) => {
      const key = leaf.collectionId ?? module.collectionId ?? collection?.id ?? '__default__';
      const col = allCollections.find((c) => c.id === key);
      const label = col?.name ?? 'Collection';
      if (!groups.has(key)) {
        groups.set(key, { key, label, indices: [] });
      }
      groups.get(key)!.indices.push(idx);
    });

    return Array.from(groups.values());
  }, [leaves, module.collectionId, collection?.id, allCollections]);

  const selectedSubtotal = totalsByCollection.length > 1
    ? totalsByCollection.find(({ key }) => `subtotal-${key}` === selectedTotalKey)
    : undefined;
  const totalLabel = selectedSubtotal?.label ?? 'Total général';
  const isGrandTotal = !selectedSubtotal;
  const totalIndices = selectedSubtotal?.indices ?? leaves.map((_, index) => index);

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

  const getInteractiveCellItems = useCallback((leaf: LeafColumn, period: PeriodRow) => {
    const source = getLeafSource(leaf);
    return getLeafCellItems(source.items, leaf, period, source.dateField, source.properties);
  }, [getLeafSource]);

  const getAssignableItems = (cell: Pick<TooltipState, 'items' | 'leaf'> | null) => {
    if (!cell || !onAssignmentChange) return [];
    const { dateField } = getLeafSource(cell.leaf);
    return cell.items.filter((item) => getAssignmentOptions(item, dateField).length > 1);
  };

  const handleCellEnter = useCallback((
    e: React.MouseEvent<HTMLTableCellElement>,
    leaf: LeafColumn,
    period: PeriodRow
  ) => {
    cancelHide();
    const items = getInteractiveCellItems(leaf, period);
    if (items.length === 0) { setTooltip(null); return; }
    setTooltip({ items, leaf, rect: e.currentTarget.getBoundingClientRect() });
  }, [getInteractiveCellItems, cancelHide]);

  const handleCellClick = useCallback((
    e: React.MouseEvent<HTMLTableCellElement>,
    leaf: LeafColumn,
    period: PeriodRow
  ) => {
    cancelHide();
    const items = getInteractiveCellItems(leaf, period);
    if (items.length === 0) {
      setTooltip(null);
      return;
    }

    if (items.length > 1 || (onAssignmentChange && getAssignmentOptions(items[0], getLeafSource(leaf).dateField).length > 1)) {
      setTooltip({ items, leaf, rect: e.currentTarget.getBoundingClientRect() });
      return;
    }

    if (!onViewDetail) return;
    if (items.length === 1) {
      onViewDetail(items[0]);
      setTooltip(null);
    }
  }, [getLeafSource, getInteractiveCellItems, onAssignmentChange, onViewDetail, cancelHide]);

  const handleCellContextMenu = useCallback((
    e: React.MouseEvent<HTMLTableCellElement>,
    leaf: LeafColumn,
    period: PeriodRow
  ) => {
    e.preventDefault();
    cancelHide();
    const items = getInteractiveCellItems(leaf, period);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items,
      period,
      leaf,
    });
  }, [getInteractiveCellItems, cancelHide]);

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

  // ── Nombre de colonnes période (pour tfoot colspan) ───────────────────
  const periodColCount = mode === 'month' ? 2 : 1;

  const activeWeekIdx = useMemo(
    () => weekGroups.findIndex((wg) => wg.weekKey === activeWeekKey),
    [weekGroups, activeWeekKey]
  );
  const activeWeek = activeWeekIdx >= 0 ? weekGroups[activeWeekIdx] : undefined;

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

  const displayedMonthLeafTotals = mode === 'year' || activeWeekKey === MONTH_TOTAL_WEEK_KEY ? leafTotals : activeWeekLeafTotals;
  const displayedTotalsByType = activeWeekKey === MONTH_TOTAL_WEEK_KEY ? grandTotalsByType : activeWeekTotalsByType;

  const selectedPeriodTotals = selectedSubtotal
    ? computeTotalsByIndices(displayedMonthLeafTotals, leaves, selectedSubtotal.indices)
    : mode === 'month' ? displayedTotalsByType : grandTotalsByType;

  const computeMonthRowTotalsForIndices = useCallback((
    visibleIdx: number,
    sourceIdx: number,
    dayIdx: number,
    indices: number[]
  ): TotalsByType => {
    return indices.reduce((acc, li) => {
      const leaf = leaves[li];
      if (!leaf) return acc;

      if (leaf.displayType === 'count') {
        const layout = visibleMonthCellLayout[visibleIdx]?.[dayIdx]?.[li] ?? { rowSpan: 1, skip: false };
        if (layout.skip) return acc;
        return accumulateLeafTotal(acc, leaf, dayCells[sourceIdx]?.[dayIdx]?.[li] ?? 0);
      }

      const raw = dayCells[sourceIdx]?.[dayIdx]?.[li] ?? 0;
      return accumulateLeafTotal(acc, leaf, raw);
    }, { ...EMPTY_TOTALS });
  }, [leaves, visibleMonthCellLayout, dayCells]);

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

  const tooltipAssignableItems = getAssignableItems(tooltip);
  const contextAssignableItems = getAssignableItems(contextMenu);

  const renderTotalSelect = (compact: boolean) => (
    <Select value={selectedSubtotal ? selectedTotalKey : 'grand-total'} onValueChange={setSelectedTotalKey}>
      <SelectTrigger
        aria-label={compact ? 'Total à afficher dans le tableau' : 'Total à afficher'}
        className={compact
          ? 'mx-auto h-6 w-fit max-w-[12rem] gap-1 rounded border-transparent px-1.5 py-0 text-xs font-semibold shadow-none hover:bg-brand-600/10 dark:hover:bg-brand-400/15 [&_svg]:size-3'
          : 'h-8 w-auto max-w-full gap-2 text-xs'}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="grand-total">Total général</SelectItem>
        {totalsByCollection.map(({ key, label }) => (
          <SelectItem key={key} value={`subtotal-${key}`}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const totalHeading = totalsByCollection.length > 1 ? renderTotalSelect(true) : totalLabel;

  // ── Rendu ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" onMouseLeave={scheduleHide}>

      {/* Tooltip flottant */}
      {tooltip && (
        <CellTooltip
          tooltip={tooltip}
          onItemClick={(item) => { onViewDetail?.(item); setTooltip(null); }}
          onAssign={tooltipAssignableItems.length > 0 ? () => {
            setAssignmentCell({ leaf: tooltip.leaf, items: tooltipAssignableItems });
            setTooltip(null);
          } : undefined}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}

      {/* ── Barre de navigation ── */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-card flex-shrink-0">
        <span className="text-sm font-semibold text-foreground capitalize">
          {periodTitle}
        </span>

        <div className="flex rounded-md border border-border overflow-hidden text-xs">
          <button
            onClick={() => onUpdate?.({ recapMode: 'month' })}
            className={`px-2 py-1 transition-colors ${mode === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
            disabled={!onUpdate}
          >
            Mois
          </button>
          <button
            onClick={() => onUpdate?.({ recapMode: 'year' })}
            className={`px-2 py-1 transition-colors ${mode === 'year' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
            disabled={!onUpdate}
          >
            Année
          </button>
        </div>

        <div className="flex-1" />

        {totalsByCollection.length > 1 && renderTotalSelect(false)}
        <span className="text-xs text-muted-foreground">
          Nombre total : <span className="font-semibold text-foreground">{formatTotalCount(selectedPeriodTotals.count)}</span>
          {' · '}Durée totale : <span className="font-semibold text-foreground">{formatTotalDuration(selectedPeriodTotals.durationMinutes)}</span>
        </span>
      </div>

      {mode === 'month' && weekGroups.length > 0 && (
        <div className="px-3 py-2 border-b border-border bg-muted/20 flex shrink-0 items-stretch gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveWeekKey(MONTH_TOTAL_WEEK_KEY)}
            className={`px-2 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
              activeWeekKey === MONTH_TOTAL_WEEK_KEY ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            Mois complet
          </button>
          {weekGroups.map((wg) => {
            const active = wg.weekKey === activeWeekKey;
            return (
              <button
                key={wg.weekKey}
                onClick={() => setActiveWeekKey(wg.weekKey)}
                aria-pressed={active}
                className={`shrink-0 rounded-md border border-border px-2.5 py-1 text-left text-xs whitespace-nowrap transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                <span className="block font-semibold">{wg.weekLabel}</span>
                <span className="block text-[11px] opacity-80">{wg.rangeLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Tableau ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">

          {/* En-tête multi-niveaux */}
          <thead className="sticky top-0 z-10 bg-card shadow-sm">
            {headerRows.map((row, rowIdx) => (
              <tr key={rowIdx} className={rowIdx === 0 ? 'bg-muted/20' : 'bg-card'}>
                {/* Colonnes période — seulement sur la première ligne de header */}
                {rowIdx === 0 && mode === 'month' && (
                  <>
                    <th
                      rowSpan={headerRows.length}
                      className="text-center px-2 py-2 text-[11px] font-semibold text-muted-foreground border-b border-r border-border whitespace-nowrap w-14 align-bottom"
                    >
                      Semaine
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
                          ...columnDividers[cell.lastLeafIndex],
                        }}
                      >
                        <span className="leading-tight">{cell.label}</span>
                      </th>
                    );
                  });
                })()}

                {rowIdx === 0 && headerRows.length > 1 && (
                  <th
                    colSpan={TOTAL_METRICS.length}
                    rowSpan={headerRows.length - 1}
                    className={`border-b border-l border-border px-2 py-1 text-center align-middle text-xs font-semibold ${totalGroupClass(isGrandTotal)}`}
                  >
                    {totalHeading}
                  </th>
                )}
                {rowIdx === headerRows.length - 1 && TOTAL_METRICS.map((metric, index) => (
                  <th
                    key={metric.key}
                    scope="col"
                    aria-label={`${totalLabel}, ${metric.label}`}
                    className={`whitespace-nowrap border-b border-border px-3 py-1.5 text-right text-xs ${totalGroupClass(isGrandTotal)} ${index === 0 ? 'border-l' : ''}`}
                  >
                    {headerRows.length === 1 && (
                      <div className="flex h-6 items-center justify-center font-semibold">
                        {index === 0 && totalHeading}
                      </div>
                    )}
                    <span className="font-medium text-muted-foreground">{metric.label}</span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          {/* Corps */}
          <tbody>
            {/* ── Mode MOIS : jours groupés par semaine ── */}
            {mode === 'month' && (activeWeekKey === MONTH_TOTAL_WEEK_KEY ? visibleWeekGroups : visibleWeekGroups.slice(0, 1)).map(({ wg, sourceIdx }, visibleIdx) => (
              <React.Fragment key={wg.weekKey}>
                {wg.days.map((day, dayIdx) => {
              const period: PeriodRow = {
                key: day.key, label: day.dayLabel, sublabel: day.dateLabel,
                start: day.start, end: day.end,
              };
              return (
                <tr
                  key={day.key}
                  className={`transition-colors hover:bg-accent/30 ${dayIdx === 0 ? 'border-t-2 border-border' : ''} ${day.isWeekend ? 'bg-muted/30' : ''} ${activeWeekKey === MONTH_TOTAL_WEEK_KEY ? 'bg-card/30' : ''}`}
                >
                  {dayIdx === 0 && (
                    <td
                      rowSpan={wg.days.length}
                      className="px-2 py-2 border-b border-r border-border/20 text-left align-top bg-muted/30"
                    >
                      <div className="whitespace-nowrap text-xs font-semibold leading-tight">{wg.weekLabel}</div>
                      <div className="mt-0.5 whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">{wg.rangeLabel}</div>
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
                      const assignment = getAssignment(leaf);
                      const renderLabel = (item: Item, abbreviation: string) => {
                        const assigned = assignment(item);
                        if (assigned === undefined) return abbreviation;
                        const counted = assigned >= period.start.getTime() && assigned <= period.end.getTime();
                        return (
                          <span className={counted ? undefined : 'opacity-70'}>
                            {abbreviation}
                            <span className="ml-1 text-[9px] font-normal" aria-label={counted ? 'Compté ce jour' : 'Compté dans une autre période'}>
                              {counted ? '+1' : '·'}
                            </span>
                          </span>
                        );
                      };

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
                              {renderLabel(items[0], abbr)}
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
                                {renderLabel(item, abbr)}
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
                          ...columnDividers[li],
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

                  <TotalCells
                    isGrandTotal={isGrandTotal}
                    totals={computeMonthRowTotalsForIndices(visibleIdx, sourceIdx, dayIdx, totalIndices)}
                  />
                </tr>
              );
                })}
              </React.Fragment>
            ))}

            {/* ── Mode ANNÉE : une ligne par mois ── */}
            {mode === 'year' && yearPeriods.map((period, ri) => (
              <tr key={period.key} className="even:bg-muted/20 hover:bg-accent/30 transition-colors">
                <th scope="row" className="sticky left-0 bg-card px-3 py-2 text-left text-xs font-semibold capitalize border-b border-r border-border/60">{period.label}</th>
                {leaves.map((leaf, li) => {
                  const val = yearCells[ri]?.[li] ?? 0;
                  return (
                    <td
                      key={leaf.id}
                      className={`text-center px-2 py-2 border-b border-border/50 tabular-nums ${onViewDetail ? 'cursor-pointer' : ''}`}
                      style={columnDividers[li]}
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
                <TotalCells
                  isGrandTotal={isGrandTotal}
                  totals={selectedSubtotal
                    ? computeTotalsByIndices(yearCells[ri] ?? [], leaves, selectedSubtotal.indices)
                    : yearRowTotals[ri] ?? EMPTY_TOTALS}
                />
              </tr>
            ))}
          </tbody>

          {/* Totaux */}
          <tfoot className="sticky bottom-0 z-[5] bg-muted border-t-2 border-border">
            <tr>
              <td
                colSpan={periodColCount}
                className="px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                Total
              </td>
              {leaves.map((leaf, li) => (
                <td key={leaf.id} className="text-center px-2 py-2 tabular-nums" style={columnDividers[li]}>
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
              <TotalCells isGrandTotal={isGrandTotal} totals={selectedPeriodTotals} />
            </tr>
          </tfoot>
        </table>
      </div>

      <Dialog open={!!assignmentCell} onOpenChange={(open) => { if (!open) setAssignmentCell(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Période de rattachement</DialogTitle>
            <DialogDescription>
              Choisis la semaine et le mois où l’objet sera compté. Ses dates restent inchangées.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-auto">
            {assignmentCell?.items.map((item) => {
              const { leaf } = assignmentCell;
              const key = getLeafAssignmentKey(leaf, item);
              const source = getLeafSource(leaf);
              const label = getItemLabel(item, leaf);
              const options = getAssignmentOptions(item, source.dateField, includeWeekends ? hiddenWeekDays : [...hiddenWeekDays, 0, 6]);
              const assigned = getAssignedDate(item, source.dateField, assignments?.[key]);
              const assignedLabel = assigned === undefined ? undefined : formatAssignmentPeriod(new Date(assigned));
              const selected = options.find((option) => option.label === assignedLabel)?.date;
              return (
                <div key={key} className="space-y-1.5 border-b border-border pb-3 last:border-b-0">
                  <div className="text-sm font-medium">{label}</div>
                  {options.length > 1 || selected ? (
                    <Select value={selected ?? 'automatic'} onValueChange={(value) => onAssignmentChange?.(key, value === 'automatic' ? undefined : value)}>
                      <SelectTrigger aria-label={`Période de rattachement de ${label}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="automatic">Automatique</SelectItem>
                        {options.map((option) => <SelectItem key={option.date} value={option.date}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-muted-foreground">Cet objet tient dans une seule période.</p>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

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
                        leaf: contextMenu.leaf,
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
                {contextAssignableItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssignmentCell({ leaf: contextMenu.leaf, items: contextAssignableItems });
                      setContextMenu(null);
                      setTooltip(null);
                    }}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <CalendarRange size={14} /> Choisir le rattachement
                  </button>
                )}
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
