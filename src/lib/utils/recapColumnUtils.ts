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
  color?: string;
  filterChain: { fieldId: string; values: string[] }[];
  displayType: RecapDisplayType;
  aggregationField?: string;
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
// Expansion de l'arbre
// ---------------------------------------------------------------------------

/**
 * Retourne les enfants directs d'un nœud après expansion :
 * - children manuels (priorité)
 * - ou sous-colonnes auto générées depuis autoSubFieldId
 */
export function getExpandedChildren(
  col: RecapColumn,
  properties: Property[]
): RecapColumn[] {
  // Enfants manuels (priorité sur auto)
  if (col.children && col.children.length > 0) return col.children;

  // Sous-colonnes auto
  if (col.autoSubFieldId) {
    const prop = properties.find((p) => p.id === col.autoSubFieldId);
    if (prop) {
      const options = getPropOptions(prop);
      if (options.length > 0) {
        return options.map((opt) => ({
          id: `${col.id}__auto__${opt}`,
          label: opt,
          color: col.color,
          filterFieldId: col.autoSubFieldId,
          filterValues: [opt],
          displayType: col.autoSubDisplayType ?? 'count',
          aggregationField: col.autoSubAggregationField,
        }));
      }
    }
  }

  return [];
}

/** Compte le nombre de feuilles dans le sous-arbre d'un nœud */
export function countRecapLeaves(col: RecapColumn, properties: Property[]): number {
  const children = getExpandedChildren(col, properties);
  if (children.length === 0) return 1;
  return children.reduce((s, c) => s + countRecapLeaves(c, properties), 0);
}

/** Retourne la profondeur max du sous-arbre (0 = feuille) */
export function getRecapTreeDepth(col: RecapColumn, properties: Property[]): number {
  const children = getExpandedChildren(col, properties);
  if (children.length === 0) return 0;
  return 1 + Math.max(...children.map((c) => getRecapTreeDepth(c, properties)));
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
  properties: Property[]
): HeaderCell[][] {
  if (cols.length === 0) return [[]];

  const maxDepth = Math.max(...cols.map((c) => getRecapTreeDepth(c, properties)));
  const numRows = maxDepth + 1;
  const rows: HeaderCell[][] = Array.from({ length: numRows }, () => []);

  function process(col: RecapColumn, rowIdx: number): void {
    const children = getExpandedChildren(col, properties);
    const isLeaf = children.length === 0;
    const colspan = isLeaf ? 1 : countRecapLeaves(col, properties);
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
  parentChain: { fieldId: string; values: string[] }[] = []
): LeafColumn[] {
  return cols.flatMap((col) => flattenNode(col, properties, parentChain));
}

function flattenNode(
  col: RecapColumn,
  properties: Property[],
  parentChain: { fieldId: string; values: string[] }[]
): LeafColumn[] {
  const myChain: { fieldId: string; values: string[] }[] = [
    ...parentChain,
    ...(col.filterFieldId
      ? [{ fieldId: col.filterFieldId, values: col.filterValues ?? [] }]
      : []),
  ];

  const children = getExpandedChildren(col, properties);

  if (children.length === 0) {
    // Résolution du type d'affichage (compat. champ legacy `aggregation`)
    let displayType: RecapDisplayType = col.displayType ?? 'count';
    if (!col.displayType && col.aggregation) {
      displayType = col.aggregation === 'avg' ? 'sum' : (col.aggregation as RecapDisplayType);
    }
    return [{
      id: col.id,
      label: col.label,
      color: col.color,
      filterChain: myChain,
      displayType,
      aggregationField: col.aggregationField,
    }];
  }

  // Récursion
  return children.flatMap((child) => flattenNode(child, properties, myChain));
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

export function computeLeafCell(
  items: Item[],
  leaf: LeafColumn,
  period: PeriodRow,
  dateField: Property | undefined,
  properties: Property[]
): number {
  const filtered = applyFilterChain(items, leaf.filterChain, properties);

  const inRange = filtered.filter((item) => {
    const d = getItemDate(item, dateField);
    return d !== null && d >= period.start && d <= period.end;
  });

  if (leaf.displayType === 'count') return inRange.length;

  const fid = leaf.aggregationField;
  if (!fid) return inRange.length; // fallback count si pas de champ

  const nums = inRange
    .map((it) => Number((it as any)[fid]))
    .filter((n) => !isNaN(n) && isFinite(n));

  return nums.reduce((a, b) => a + b, 0);
}

// ---------------------------------------------------------------------------
// Formatage des valeurs
// ---------------------------------------------------------------------------

export function formatRecapValue(val: number, displayType: RecapDisplayType): string {
  if (val <= 0) return '–';
  if (displayType === 'duration') {
    const totalMins = Math.round(val);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
  }
  // count ou sum : affichage brut (on arrondit les décimaux parasites)
  return Number.isInteger(val) ? String(val) : val.toFixed(2);
}
