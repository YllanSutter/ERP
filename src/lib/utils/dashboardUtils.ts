/**
 * Utilitaires pour le système de dashboard modulaire.
 * Fonctions pures : filtrage, groupement, agrégation, formatage.
 */

import {
  format,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter,
  startOfYear, endOfYear,
  startOfDay, endOfDay,
  parseISO,
  isWithinInterval,
  getISOWeek,
  getYear,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AggregationType,
  DateGrouping,
  GlobalDatePreset,
  ModuleFilter,
} from '@/lib/dashboardTypes';
import { Property, Item } from '@/lib/types';

// ---------------------------------------------------------------------------
// Plage de dates
// ---------------------------------------------------------------------------

export interface DateRange {
  start: Date;
  end: Date;
}

/** Calcule la plage de dates pour un preset ou une plage custom. */
export function computeDateRange(
  preset: GlobalDatePreset,
  customStart?: string,
  customEnd?: string
): DateRange {
  const now = new Date();
  const weekOpts = { weekStartsOn: 1 as const };

  switch (preset) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'this_week':
      return { start: startOfWeek(now, weekOpts), end: endOfWeek(now, weekOpts) };
    case 'this_month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last_30_days':
      return { start: new Date(now.getTime() - 30 * 86_400_000), end: now };
    case 'this_quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'this_year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'custom':
      return {
        start: customStart ? parseISO(customStart) : startOfMonth(now),
        end: customEnd ? parseISO(customEnd) : endOfMonth(now),
      };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

// ---------------------------------------------------------------------------
// Valeurs
// ---------------------------------------------------------------------------

/** Extrait la valeur brute d'un item pour un champ donné. */
export function getPropertyValue(item: Item, fieldId: string): any {
  return item[fieldId];
}

/** Extrait la valeur numérique d'un item, ou null si non convertible. */
export function getNumericValue(item: Item, fieldId: string): number | null {
  const val = item[fieldId];
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/** Extrait la valeur de date (string ISO) d'un item, compatible date et date_range. */
export function getDateValue(item: Item, fieldId: string): string | null {
  const val = item[fieldId];
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val.start) return val.start;
  return null;
}

// ---------------------------------------------------------------------------
// Agrégation
// ---------------------------------------------------------------------------

/** Agrège un tableau d'items selon une fonction et un champ. */
export function aggregateItems(
  items: Item[],
  fieldId: string,
  aggregation: AggregationType
): number {
  if (aggregation === 'count') return items.length;

  const values = items
    .map((i) => getNumericValue(i, fieldId))
    .filter((v): v is number => v !== null);

  if (values.length === 0) return 0;

  switch (aggregation) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Groupement
// ---------------------------------------------------------------------------

/** Clé interne pour un groupe "vide" */
export const EMPTY_GROUP_KEY = '__empty__';
/** Clé interne pour "sans date" */
export const NO_DATE_KEY = '__no_date__';

/** Calcule la clé de groupe pour une date et un regroupement donné. */
export function getDateGroupKey(dateStr: string, grouping: DateGrouping): string {
  if (!dateStr) return NO_DATE_KEY;
  try {
    const date = parseISO(dateStr);
    switch (grouping) {
      case 'day':     return format(date, 'yyyy-MM-dd');
      case 'week':    return `${getYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`;
      case 'month':   return format(date, 'yyyy-MM');
      case 'quarter': return `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;
      case 'year':    return String(date.getFullYear());
      default:        return format(date, 'yyyy-MM-dd');
    }
  } catch {
    return '__invalid__';
  }
}

/** Calcule le label lisible pour une clé de groupe de dates. */
export function getDateGroupLabel(key: string, grouping: DateGrouping): string {
  if (key === NO_DATE_KEY) return 'Sans date';
  if (key === '__invalid__') return 'Date invalide';

  try {
    switch (grouping) {
      case 'day': {
        const d = parseISO(key);
        return format(d, 'EEEE dd MMMM yyyy', { locale: fr });
      }
      case 'week': {
        // key = "2025-W12"
        const [yearStr, weekStr] = key.split('-W');
        return `Semaine ${weekStr} ${yearStr}`;
      }
      case 'month': {
        const d = parseISO(`${key}-01`);
        return format(d, 'MMMM yyyy', { locale: fr });
      }
      case 'quarter': {
        const [year, q] = key.split('-Q');
        return `T${q} ${year}`;
      }
      case 'year':
        return key;
      default:
        return key;
    }
  } catch {
    return key;
  }
}

/** Groupe les items par valeur d'un champ (supporte select, multiselect, et autres). */
export function groupItemsByField(
  items: Item[],
  fieldId: string,
  properties: Property[]
): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();
  const prop = properties.find((p) => p.id === fieldId);

  for (const item of items) {
    const rawVal = item[fieldId];
    let keys: string[];

    if (prop?.type === 'multiselect' || (prop?.type as string) === 'multi_select') {
      const arr = Array.isArray(rawVal) ? rawVal : rawVal ? [rawVal] : [];
      keys = arr.length > 0 ? arr.map(String) : [EMPTY_GROUP_KEY];
    } else if (rawVal === null || rawVal === undefined || rawVal === '') {
      keys = [EMPTY_GROUP_KEY];
    } else {
      keys = [String(rawVal)];
    }

    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
  }

  return groups;
}

/** Groupe les items par période de date, trié chronologiquement. */
export function groupItemsByDate(
  items: Item[],
  dateField: string,
  grouping: DateGrouping
): Map<string, Item[]> {
  const groups = new Map<string, Item[]>();

  for (const item of items) {
    const dateStr = getDateValue(item, dateField);
    const key = dateStr ? getDateGroupKey(dateStr, grouping) : NO_DATE_KEY;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  // Tri chronologique (les clés sont formatées pour être triables lexicographiquement)
  return new Map([...groups.entries()].sort((a, b) => {
    if (a[0] === NO_DATE_KEY) return 1;
    if (b[0] === NO_DATE_KEY) return -1;
    return a[0].localeCompare(b[0]);
  }));
}

// ---------------------------------------------------------------------------
// Filtres de module
// ---------------------------------------------------------------------------

/** Applique les filtres d'un module sur un tableau d'items. */
export function applyModuleFilters(
  items: Item[],
  filters: ModuleFilter[],
  properties: Property[]
): Item[] {
  if (!filters || filters.length === 0) return items;

  return items.filter((item) =>
    filters.every((filter) => {
      const val = item[filter.fieldId];
      const isEmpty =
        val === null || val === undefined || val === '' ||
        (Array.isArray(val) && val.length === 0);

      switch (filter.operator) {
        case 'is_empty':
          return isEmpty;
        case 'is_not_empty':
          return !isEmpty;
        case 'equals': {
          if (Array.isArray(val)) return val.map(String).includes(String(filter.value));
          return String(val) === String(filter.value);
        }
        case 'not_equals': {
          if (Array.isArray(val)) return !val.map(String).includes(String(filter.value));
          return String(val) !== String(filter.value);
        }
        case 'contains':
          return String(val ?? '').toLowerCase().includes(String(filter.value ?? '').toLowerCase());
        case 'greater':
          return Number(val) > Number(filter.value);
        case 'less':
          return Number(val) < Number(filter.value);
        default:
          return true;
      }
    })
  );
}

/** Filtre les items selon une plage de dates sur un champ donné. */
export function applyDateRangeFilter(
  items: Item[],
  dateFieldId: string,
  range: DateRange
): Item[] {
  return items.filter((item) => {
    const dateStr = getDateValue(item, dateFieldId);
    if (!dateStr) return false;
    try {
      const date = parseISO(dateStr);
      return isWithinInterval(date, { start: range.start, end: range.end });
    } catch {
      return false;
    }
  });
}

// ---------------------------------------------------------------------------
// Formatage
// ---------------------------------------------------------------------------

/** Formate une valeur numérique avec préfixe et suffixe optionnels. */
export function formatMetricValue(
  value: number,
  prefix?: string,
  suffix?: string
): string {
  const formatted =
    value % 1 === 0
      ? value.toLocaleString('fr-FR')
      : value.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return `${prefix ?? ''}${formatted}${suffix ?? ''}`;
}

// ---------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------

/** Palette de couleurs par défaut pour les graphiques. */
export const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7',
  '#10b981', '#f59e0b', '#14b8a6', '#e11d48', '#7c3aed',
];

/** Retourne une couleur de la palette par index (cyclique). */
export function getChartColor(index: number, customColors?: string[]): string {
  const palette = customColors?.length ? customColors : CHART_COLORS;
  return palette[index % palette.length];
}
