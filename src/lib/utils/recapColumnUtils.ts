/**
 * Utilitaires pour le système de colonnes hiérarchiques du module Recap.
 *
 * Fonctions pures gérant :
 * - l'expansion des nœuds (auto sous-colonnes depuis un champ select)
 * - l'aplatissement vers des feuilles avec leur chaîne de filtres
 * - la construction du header multi-niveaux (colspan / rowspan)
 * - le calcul de chaque cellule
 * - le formatage des valeurs (durée, nombre)
 */

import { Property, Item } from '@/lib/types';
import { RecapColumn, RecapDisplayType } from '@/lib/dashboardTypes';

// ---------------------------------------------------------------------------
// Types exportés
// ---------------------------------------------------------------------------

/** Ligne de période (semaine ou mois) */
export interface PeriodRow {
  key: string;
  label: string;
  sublabel: string;
  start: Date;
  end: Date;
}

/** Colonne feuille après expansion — contient la chaîne complète de filtres */
export interface LeafColumn {
  id: string;
  label: string;
  collectionId?: string;
  color?: string;
  filterChain: { fieldId: string; values: string[] }[];
  displayType: RecapDisplayType;
  aggregationField?: string;
  durationField?: string;
  /** Unité pour les colonnes duration ('minutes' par défaut) */
  durationUnit?: 'minutes' | 'hours';
}

/** Cellule de l'en-tête multi-niveaux */
export interface HeaderCell {
  id: string;
  label: string;
  color?: string;
  colspan: number;
  rowspan: number;
  isLeaf: boolean;
}

// ---------------------------------------------------------------------------
// Options d'un champ
// ---------------------------------------------------------------------------

/** Extrait les valeurs string des options d'une propriété (string ou {value,label,...}) */
export function getPropOptions(prop: Property): string[] {
  if (!prop.options?.length) return [];
  return (prop.options as any[]).map((o) =>
    typeof o === 'string' ? o : (o.value ?? o.label ?? String(o))
  );
}

// ---------------------------------------------------------------------------
// Defaults module
// ---------------------------------------------------------------------------

/** Defaults hérités depuis la configuration du module */
export interface ModuleRecapDefaults {
  /**
   * Types d'affichage actifs. Si plusieurs → sous-colonne par type pour chaque feuille.
   * Si un seul → type appliqué directement à la feuille.
   */
  displayTypes?: RecapDisplayType[];
  aggregationField?: string;
  durationField?: string;
  /** Unité par défaut pour les colonnes duration */
  durationUnit?: 'minutes' | 'hours';
}

/** Labels courts affichés dans les sous-colonnes auto-générées par type */
const DISPLAY_TYPE_SHORT: Record<RecapDisplayType, string> = {
  count:    'Nb',
  sum:      'Somme',
  duration: 'Durée',
};

// ---------------------------------------------------------------------------
// Expansion de l'arbre
// ---------------------------------------------------------------------------

/**
 * Retourne les enfants directs d'un nœud après expansion :
 * 1. children manuels (priorité absolue)
 * 2. sous-colonnes auto depuis autoSubFieldId
 * 3. sous-colonnes virtuelles par type d'affichage (si moduleDefaults.displayTypes > 1)
 */
export function getExpandedChildren(
  col: RecapColumn,
  properties: Property[],
  moduleDefaults?: ModuleRecapDefaults
): RecapColumn[] {
  // 1. Enfants manuels
  if (col.children && col.children.length > 0) return col.children;

  // 2. Sous-colonnes auto depuis un champ select
  if (col.autoSubFieldId) {
    const prop = properties.find((p) => p.id === col.autoSubFieldId);
    if (prop) {
      const allOptions = getPropOptions(prop);
      const filteredOptions = (col.autoSubFilterValues && col.autoSubFilterValues.length > 0)
        ? allOptions.filter((opt) => col.autoSubFilterValues!.includes(opt))
        : allOptions;
      const options = filteredOptions;
      if (options.length > 0) {
        // Priorité : autoSubDisplayTypes colonne > autoSubDisplayType (legacy) > défauts module > count
        const colAutoTypes = col.autoSubDisplayTypes ?? [];
        const dtypes: RecapDisplayType[] = colAutoTypes.length > 0
          ? colAutoTypes
          : col.autoSubDisplayType
            ? [col.autoSubDisplayType]
            : (moduleDefaults?.displayTypes ?? ['count']);

        // Si plusieurs types → chaque option génère d'abord ses options, puis ses types
        if (dtypes.length > 1) {
          return options.map((opt) => ({
            id:    `${col.id}__auto__${opt}`,
            label: opt,
            collectionId: col.collectionId,
            color: col.color,
            filterFieldId: col.autoSubFieldId,
            filterValues:  [opt],
            // Pas de displayType → les sous-enfants par type seront générés au niveau suivant
            children: dtypes.map((dt) => ({
              id:               `${col.id}__auto__${opt}__dt__${dt}`,
              label:            DISPLAY_TYPE_SHORT[dt],
              collectionId:     col.collectionId,
              color:            col.color,
              displayType:      dt,
              aggregationField: col.autoSubAggregationField ?? moduleDefaults?.aggregationField,
              durationField:    col.durationField ?? moduleDefaults?.durationField,
              durationUnit:     col.durationUnit,
            })),
          }));
        }

        return options.map((opt) => ({
          id:               `${col.id}__auto__${opt}`,
          label:            opt,
          collectionId:     col.collectionId,
          color:            col.color,
          filterFieldId:    col.autoSubFieldId,
          filterValues:     [opt],
          displayType:      dtypes[0],
          aggregationField: col.autoSubAggregationField ?? moduleDefaults?.aggregationField,
          durationField:    col.durationField ?? moduleDefaults?.durationField,
          durationUnit:     col.durationUnit,
        }));
      }
    }
  }

  // 3. Sous-colonnes virtuelles par type (si ≥ 2 types actifs et pas de sub explicite)
  // Ne pas appliquer si la colonne a déjà un displayType explicite (elle est déjà une feuille virtuelle)
  if (col.displayType) return [];

  // Priorité : displayTypes de la colonne, sinon défauts module
  const colTypes = col.displayTypes ?? [];
  const dtypes = colTypes.length > 0 ? colTypes : (moduleDefaults?.displayTypes ?? []);
  if (dtypes.length > 1) {
    return dtypes.map((dt) => ({
      id:               `${col.id}__dt__${dt}`,
      label:            DISPLAY_TYPE_SHORT[dt],
      collectionId:     col.collectionId,
      color:            col.color,
      displayType:      dt,
      aggregationField: col.aggregationField ?? moduleDefaults?.aggregationField,
      durationField:    col.durationField ?? moduleDefaults?.durationField,
    }));
  }

  return [];
}

/** Compte le nombre de feuilles dans le sous-arbre d'un nœud */
export function countRecapLeaves(
  col: RecapColumn,
  properties: Property[],
  moduleDefaults?: ModuleRecapDefaults
): number {
  const children = getExpandedChildren(col, properties, moduleDefaults);
  if (children.length === 0) return 1;
  return children.reduce((s, c) => s + countRecapLeaves(c, properties, moduleDefaults), 0);
}

/** Retourne la profondeur max du sous-arbre (0 = feuille) */
export function getRecapTreeDepth(
  col: RecapColumn,
  properties: Property[],
  moduleDefaults?: ModuleRecapDefaults
): number {
  const children = getExpandedChildren(col, properties, moduleDefaults);
  if (children.length === 0) return 0;
  return 1 + Math.max(...children.map((c) => getRecapTreeDepth(c, properties, moduleDefaults)));
}

// ---------------------------------------------------------------------------
// Construction des lignes de header
// ---------------------------------------------------------------------------

/**
 * Construit les lignes de l'en-tête multi-niveaux.
 *
 * Chaque ligne contient les cellules qui commencent à ce niveau.
 * colspan = nombre de feuilles descendantes.
 * rowspan = (numRows - profondeur) si feuille, sinon 1.
 */
export function buildRecapHeaderRows(
  cols: RecapColumn[],
  properties: Property[],
  moduleDefaults?: ModuleRecapDefaults
): HeaderCell[][] {
  if (cols.length === 0) return [[]];

  const maxDepth = Math.max(...cols.map((c) => getRecapTreeDepth(c, properties, moduleDefaults)));
  const numRows = maxDepth + 1;
  const rows: HeaderCell[][] = Array.from({ length: numRows }, () => []);

  function process(col: RecapColumn, rowIdx: number): void {
    const children = getExpandedChildren(col, properties, moduleDefaults);
    const isLeaf = children.length === 0;
    const colspan = isLeaf ? 1 : countRecapLeaves(col, properties, moduleDefaults);
    const rowspan = isLeaf ? numRows - rowIdx : 1;

    rows[rowIdx].push({
      id: col.id,
      label: col.label,
      color: col.color,
      colspan,
      rowspan,
      isLeaf,
    });

    if (!isLeaf) {
      for (const child of children) {
        process(child, rowIdx + 1);
      }
    }
  }

  for (const col of cols) {
    process(col, 0);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Aplatissement vers les feuilles
// ---------------------------------------------------------------------------

/**
 * Aplatit l'arbre de colonnes en feuilles, chacune portant sa chaîne complète
 * de filtres (depuis la racine).
 */
export function flattenRecapToLeaves(
  cols: RecapColumn[],
  properties: Property[],
  parentChain: { fieldId: string; values: string[] }[] = [],
  moduleDefaults?: ModuleRecapDefaults
): LeafColumn[] {
  return cols.flatMap((col) => flattenNode(col, properties, parentChain, moduleDefaults, moduleDefaults?.durationUnit));
}

function flattenNode(
  col: RecapColumn,
  properties: Property[],
  parentChain: { fieldId: string; values: string[] }[],
  moduleDefaults?: ModuleRecapDefaults,
  parentDurationUnit?: 'minutes' | 'hours'
): LeafColumn[] {
  const myDurationUnit = col.durationUnit ?? parentDurationUnit;

  const myChain: { fieldId: string; values: string[] }[] = [
    ...parentChain,
    ...(col.filterFieldId
      ? [{ fieldId: col.filterFieldId, values: col.filterValues ?? [] }]
      : []),
  ];

  const children = getExpandedChildren(col, properties, moduleDefaults);

  if (children.length === 0) {
    // Résolution du type d'affichage :
    // 1. displayType explicite (legacy ou feuille virtuelle)
    // 2. displayTypes[0] de la colonne (si mono-sélection)
    // 3. premier défaut module
    // 4. legacy aggregation
    // 5. count
    const colFirstType = col.displayTypes?.[0];
    const firstDefault = moduleDefaults?.displayTypes?.[0];
    let displayType: RecapDisplayType =
      col.displayType ?? colFirstType ?? firstDefault ?? 'count';
    if (!col.displayType && !colFirstType && !firstDefault && col.aggregation) {
      displayType = col.aggregation === 'avg' ? 'sum' : (col.aggregation as RecapDisplayType);
    }
    return [{
      id:               col.id,
      label:            col.label,
      collectionId:     col.collectionId,
      color:            col.color,
      filterChain:      myChain,
      displayType,
      aggregationField: col.aggregationField ?? moduleDefaults?.aggregationField,
      durationField:    col.durationField ?? moduleDefaults?.durationField,
      durationUnit:     myDurationUnit,
    }];
  }

  // Récursion — les enfants virtuels (type dt) n'ont pas de filterFieldId
  // donc myChain n'est pas ré-augmenté par eux
  return children.flatMap((child) => flattenNode(child, properties, myChain, moduleDefaults, myDurationUnit));
}

// ---------------------------------------------------------------------------
// Filtrage par chaîne
// ---------------------------------------------------------------------------

export function applyFilterChain(
  items: Item[],
  chain: { fieldId: string; values: string[] }[],
  properties: Property[]
): Item[] {
  let result = items;
  for (const f of chain) {
    if (!f.fieldId || f.values.length === 0) continue;
    const prop = properties.find((p) => p.id === f.fieldId);
    result = result.filter((item) => {
      const val = item[f.fieldId];
      if (val === null || val === undefined || val === '') return false;
      if (Array.isArray(val)) {
        return f.values.some((fv) => val.map(String).includes(fv));
      }
      if (prop?.type === 'text' || prop?.type === 'url') {
        return f.values.some((fv) =>
          String(val).toLowerCase().includes(fv.toLowerCase())
        );
      }
      return f.values.includes(String(val));
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Extraction de date depuis un item
// ---------------------------------------------------------------------------

export function getItemDate(item: Item, dateField: Property | undefined): Date | null {
  if (!dateField) return null;

  // Segments d'événements multi-jours
  const segments = Array.isArray((item as any)._eventSegments)
    ? (item as any)._eventSegments
    : [];
  const matching = segments.filter(
    (s: any) => typeof s?.label === 'string' && s.label === dateField.name && s.end
  );
  if (matching.length > 0) {
    const dates = matching
      .map((s: any) => new Date(s.end))
      .filter((d: Date) => !isNaN(d.getTime()));
    if (dates.length) return dates.reduce((a: Date, b: Date) => (b > a ? b : a));
  }

  const value = (item as any)[dateField.id];
  if (!value) return null;

  if (dateField.type === 'date') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if ((dateField.type as string) === 'date_range') {
    const raw = value?.end ?? value?.start ?? value;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Calcul d'une cellule
// ---------------------------------------------------------------------------

/** Retourne les items qui correspondent à une feuille + période (avant agrégation). */
export function getLeafCellItems(
  items: Item[],
  leaf: LeafColumn,
  period: PeriodRow,
  dateField: Property | undefined,
  properties: Property[]
): Item[] {
  const filtered = applyFilterChain(items, leaf.filterChain, properties);

  const periodStart = period.start.getTime();
  const periodEnd = period.end.getTime();

  const getItemIntervals = (item: Item): { start: number; end: number }[] => {
    if (!dateField) return [];

    // 1) Segments calendrier (source la plus fiable pour multi-jours)
    const segments: any[] = Array.isArray((item as any)._eventSegments)
      ? (item as any)._eventSegments
      : [];
    const segIntervals = segments
      .filter((s) => s?.label === dateField.name && (s.start || s.__eventStart) && (s.end || s.__eventEnd))
      .map((s) => {
        const start = new Date(s.start || s.__eventStart).getTime();
        const end = new Date(s.end || s.__eventEnd).getTime();
        return { start, end };
      })
      .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end >= r.start);
    if (segIntervals.length > 0) return segIntervals;

    // 2) date_range brut
    if ((dateField.type as string) === 'date_range') {
      const value = (item as any)[dateField.id];
      const ranges: { start?: string; end?: string }[] = Array.isArray(value)
        ? value
        : value?.start && value?.end ? [value] : [];
      return ranges
        .map((r) => ({
          start: new Date(r.start ?? '').getTime(),
          end: new Date(r.end ?? '').getTime(),
        }))
        .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end >= r.start);
    }

    // 3) date simple + éventuelle durée dédiée (<dateField>_duration)
    if (dateField.type === 'date') {
      const start = new Date((item as any)[dateField.id]).getTime();
      if (!Number.isFinite(start)) return [];
      const rawDurationHours = Number((item as any)[`${dateField.id}_duration`]);
      const end = Number.isFinite(rawDurationHours) && rawDurationHours > 0
        ? start + rawDurationHours * 3600000
        : start;
      return [{ start, end }];
    }

    return [];
  };

  return filtered.filter((item) => {
    const intervals = getItemIntervals(item);
    return intervals.some((r) => r.end >= periodStart && r.start <= periodEnd);
  });
}

export function computeLeafCell(
  items: Item[],
  leaf: LeafColumn,
  period: PeriodRow,
  dateField: Property | undefined,
  properties: Property[]
): number {
  const inRange = getLeafCellItems(items, leaf, period, dateField, properties);

  if (leaf.displayType === 'count') return inRange.length;

  const fid = leaf.aggregationField;

  const toLeafUnit = (mins: number): number =>
    (leaf.durationUnit === 'hours' ? mins / 60 : mins);

  const periodStartMs = period.start.getTime();
  const periodEndMs = period.end.getTime();

  const getIntervalsForDuration = (item: Item): { start: number; end: number }[] => {
    if (!dateField) return [];

    const segments: any[] = Array.isArray((item as any)._eventSegments)
      ? (item as any)._eventSegments
      : [];
    const segIntervals = segments
      .filter((s) => s?.label === dateField.name && (s.start || s.__eventStart) && (s.end || s.__eventEnd))
      .map((s) => ({
        start: new Date(s.start || s.__eventStart).getTime(),
        end: new Date(s.end || s.__eventEnd).getTime(),
      }))
      .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end >= r.start);
    if (segIntervals.length > 0) return segIntervals;

    if ((dateField.type as string) === 'date_range') {
      const value = (item as any)[dateField.id];
      const ranges: { start?: string; end?: string }[] = Array.isArray(value)
        ? value
        : value?.start && value?.end ? [value] : [];
      return ranges
        .map((r) => ({
          start: new Date(r.start ?? '').getTime(),
          end: new Date(r.end ?? '').getTime(),
        }))
        .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end >= r.start);
    }

    if (dateField.type === 'date') {
      const start = new Date((item as any)[dateField.id]).getTime();
      if (!Number.isFinite(start)) return [];
      const rawDurationHours = Number((item as any)[`${dateField.id}_duration`]);
      const end = Number.isFinite(rawDurationHours) && rawDurationHours > 0
        ? start + rawDurationHours * 3600000
        : start;
      return [{ start, end }];
    }

    return [];
  };

  // Durée depuis la source principale du champ date sélectionné
  // Répartie par période via chevauchement réel des intervalles.
  const getDateFieldDurationForItem = (item: Item): number => {
    const durationFieldId = leaf.durationField ?? fid;
    if (durationFieldId) {
      const rawDuration = Number((item as any)[durationFieldId]);
      if (Number.isFinite(rawDuration) && rawDuration > 0) {
        return leaf.durationUnit === 'hours' ? rawDuration : rawDuration * 60;
      }
    }

    const intervals = getIntervalsForDuration(item);
    if (intervals.length > 0) {
      const totalMins = intervals.reduce((sum, r) => {
        const overlapStart = Math.max(r.start, periodStartMs);
        const overlapEnd = Math.min(r.end, periodEndMs);
        const mins = (overlapEnd - overlapStart) / 60000;
        return sum + (Number.isFinite(mins) && mins > 0 ? mins : 0);
      }, 0);
      return toLeafUnit(totalMins);
    }

    // Fallback minimal si on a seulement une durée sans intervalle exploitable
    if (dateField) {
      const rawDuration = Number((item as any)[`${dateField.id}_duration`]);
      if (Number.isFinite(rawDuration) && rawDuration > 0) {
        return leaf.durationUnit === 'hours' ? rawDuration : rawDuration * 60;
      }
    }

    return 0;
  };

  // Duration calculée depuis le champ date sélectionné
  if (leaf.displayType === 'duration' && !fid && dateField) {
    return inRange.reduce((total, item) => total + getDateFieldDurationForItem(item), 0);
  }

  if (!fid) return inRange.length; // fallback count si pas de champ

  const nums = inRange
    .map((it) => Number((it as any)[fid]))
    .filter((n) => !isNaN(n) && isFinite(n));

  return nums.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// Formatage des valeurs
// ---------------------------------------------------------------------------

export function formatRecapValue(
  val: number,
  displayType: RecapDisplayType,
  durationUnit?: 'minutes' | 'hours'
): string {
  if (val <= 0) return '–';
  if (displayType === 'duration') {
    // durationUnit='hours' → val est en heures décimales (ex: 1.5 = 1h30)
    // durationUnit='minutes' (défaut) → val est en minutes entières
    const totalMins = durationUnit === 'hours'
      ? Math.round(val * 60)
      : Math.round(val);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
  }
  // count ou sum : affichage brut (on arrondit les décimaux parasites)
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}
