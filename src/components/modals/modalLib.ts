/**
 * modalLib — logique partagée entre toutes les modales.
 * Centralise les re-exports des lib/* et les helpers inline.
 * Les modales n'ont besoin d'importer que depuis ici et ModalWrapper.
 */

// ─── Re-exports lib/* ─────────────────────────────────────────────────────────
export type { TableGroupDisplayMode, TableGroupColumnCount } from '@/lib/types';
export { DATE_GRANULARITIES } from '@/lib/types';
export { MONTH_NAMES, workDayStart, workDayEnd } from '@/lib/calendarUtils';
export { getOrderedProperties } from '@/lib/filterUtils';
export { normalizeRelationIds } from '@/lib/utils/relationUtils';
export { getPluginPropertyTypeOptions } from '@/lib/plugins/propertyTypes';
export { getRoundedNow } from '@/lib/utils/dateUtils';
export { isEmptyValue } from '@/lib/utils/valueUtils';
export { calculateSegmentsClient, formatSegmentDisplay } from '@/lib/calculateSegmentsClient';

// ─── Types de vues ────────────────────────────────────────────────────────────
import { LayoutList, Columns, CalendarDays, LayoutDashboard } from 'lucide-react';

export const VIEW_TYPES = [
  { value: 'table',    label: 'Tableau',     icon: LayoutList },
  { value: 'kanban',   label: 'Kanban',      icon: Columns },
  { value: 'calendar', label: 'Calendrier',  icon: CalendarDays },
  { value: 'layout',   label: 'Multi-vues',  icon: LayoutDashboard },
] as const;

export type ViewTypeValue = typeof VIEW_TYPES[number]['value'];

// ─── Filtres ──────────────────────────────────────────────────────────────────

export const FILTER_OPERATORS = [
  { value: 'equals',       label: 'Est égal à' },
  { value: 'not_equals',   label: 'Est différent de' },
  { value: 'contains',     label: 'Contient' },
  { value: 'greater',      label: 'Supérieur à' },
  { value: 'less',         label: 'Inférieur à' },
  { value: 'is_empty',     label: 'Est vide' },
  { value: 'is_not_empty', label: "N'est pas vide" },
] as const;

export const COMPACT_OPERATOR_LABELS: Record<string, string> = {
  equals:       '=',
  not_equals:   '≠',
  contains:     'contient',
  greater:      '>',
  less:         '<',
  is_empty:     'vide',
  is_not_empty: 'non vide',
};

export const isMultiValueOperator = (operator: string): boolean =>
  ['equals', 'not_equals'].includes(operator);

export const prepareFilterValue = (value: any, operator: string): any => {
  if (!isMultiValueOperator(operator)) return value;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map((part: string) => part.trim()).filter(Boolean);
  }
  return value;
};

export const toDisplayText = (input: any): string => {
  if (input === null || input === undefined) return '';
  if (typeof input === 'string') return input;
  if (typeof input === 'number' || typeof input === 'boolean') return String(input);
  if (Array.isArray(input)) {
    return input.map((v) => toDisplayText(v)).filter(Boolean).join(', ');
  }
  if (typeof input === 'object') {
    const candidate = input.name ?? input.label ?? input.title ?? input.value ?? input.appid ?? input.id;
    if (candidate !== null && candidate !== undefined) return String(candidate);
    try { return JSON.stringify(input); } catch { return ''; }
  }
  return String(input);
};

export const getRelationItemLabel = (item: any, relation: any, targetCollection: any): string => {
  if (!item) return '';
  const configuredDisplayFields = Array.isArray(relation?.displayFieldIds)
    ? relation.displayFieldIds.filter((id: any) => typeof id === 'string' && id.trim() !== '')
    : [];
  if (configuredDisplayFields.length > 0) {
    const chunks = configuredDisplayFields
      .map((fieldId: string) => toDisplayText(item?.[fieldId]).trim())
      .filter(Boolean);
    if (chunks.length > 0) return chunks.join(' · ');
  }
  const nameField = targetCollection?.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');
  const fallback = nameField ? item?.[nameField.id] : item?.name;
  const fallbackText = toDisplayText(fallback).trim();
  if (fallbackText) return fallbackText;
  return String(item?.id || 'Sans titre');
};

export const getValueLabels = (
  selectedProp: any,
  value: any,
  collections: any[],
  normalizeIds: (v: any) => string[]
): string[] => {
  if (!selectedProp) return [];

  if (selectedProp?.type === 'relation') {
    const relation = selectedProp.relation || {};
    const targetCollection = (collections || []).find((c: any) => c.id === relation.targetCollectionId);
    const targetItems = targetCollection?.items || [];
    const values = normalizeIds(value);
    return values.map((id: string) => {
      const item = targetItems.find((ti: any) => ti.id === id);
      return item ? getRelationItemLabel(item, relation, targetCollection) : id;
    });
  }

  if (selectedProp?.type === 'select') {
    const opts = (selectedProp.options || []).map((opt: any) =>
      typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label || opt.value }
    );
    const values = normalizeIds(value);
    return values.map((v: any) => opts.find((o: any) => o.value === v)?.label ?? v);
  }

  if (selectedProp?.type === 'multiselect') {
    const opts = (selectedProp.options || []).map((opt: any) =>
      typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label || opt.value }
    );
    const values = Array.isArray(value) ? value : [];
    return values.map((v: any) => opts.find((o: any) => o.value === v)?.label ?? v);
  }

  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value === null || value === undefined || value === '') return [];
  return [String(value)];
};

export const getValueSummary = (
  selectedProp: any,
  value: any,
  operator: string,
  collections: any[],
  normalizeIds: (v: any) => string[]
): string => {
  const labels = getValueLabels(selectedProp, value, collections, normalizeIds);
  if (['is_empty', 'is_not_empty'].includes(operator)) return 'Aucune valeur attendue';
  if (labels.length === 0) return 'Aucune valeur';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} + ${labels[1]}`;
  return `${labels[0]} +${labels.length - 1}`;
};

// ─── Groupage ─────────────────────────────────────────────────────────────────

import type { TableGroupDisplayMode, TableGroupColumnCount } from '@/lib/types';

export const normalizeGroupMode = (mode?: string): TableGroupDisplayMode => {
  if (mode === 'columns' || mode === 'tabs' || mode === 'select' || mode === 'accordion') return mode;
  return 'accordion';
};

export const normalizeColumnCount = (count?: number): TableGroupColumnCount => {
  if (count === 1 || count === 2 || count === 3) return count;
  return 3;
};

export const GROUP_MODE_OPTIONS = [
  { value: 'accordion', label: 'Type: Chevron (accordéon)' },
  { value: 'columns',   label: 'Type: Colonnes' },
  { value: 'tabs',      label: 'Type: Onglets' },
  { value: 'select',    label: 'Type: Select' },
] as const;

export const GROUP_COLUMN_COUNT_OPTIONS = [
  { value: '1', label: 'Colonnes: 1' },
  { value: '2', label: 'Colonnes: 2' },
  { value: '3', label: 'Colonnes: 3' },
] as const;

// ─── Utilitaires NewItemModal ──────────────────────────────────────────────────

export const areValuesEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

export const extractTextFromTiptap = (doc: any): string => {
  if (!doc || doc.type !== 'doc') return '';
  let text = '';
  const walk = (node: any) => {
    if (!node || text.includes('\n')) return;
    if (typeof node.text === 'string') text += node.text;
    if (Array.isArray(node.content)) node.content.forEach((child: any) => walk(child));
    if (node.type && text && !text.endsWith('\n')) {
      if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem' || node.type === 'taskItem') {
        text += '\n';
      }
    }
  };
  walk(doc);
  return (text.split('\n').find((line) => line.trim() !== '') || '').trim();
};

export const serializeTiptapLines = (doc: any): string => {
  if (!doc || doc.type !== 'doc') return '';
  const lines: string[] = [];
  const extractNodeText = (node: any): string => {
    if (!node) return '';
    if (typeof node.text === 'string') return node.text;
    if (Array.isArray(node.content)) return node.content.map((child: any) => extractNodeText(child)).join('');
    return '';
  };
  const walk = (node: any) => {
    if (!node) return;
    if (node.type === 'taskItem') {
      const checked = node.attrs?.checked ? '[x] ' : '[ ] ';
      lines.push(`${checked}${extractNodeText(node)}`.trimEnd());
      return;
    }
    if (node.type === 'listItem') { lines.push(`- ${extractNodeText(node)}`.trimEnd()); return; }
    if (node.type === 'heading') {
      const level = node.attrs?.level || 1;
      lines.push(`${'#'.repeat(level)} ${extractNodeText(node)}`.trimEnd());
      return;
    }
    if (node.type === 'paragraph') { lines.push(extractNodeText(node).trimEnd()); return; }
    if (Array.isArray(node.content)) node.content.forEach((child: any) => walk(child));
  };
  walk(doc);
  return lines.filter((line) => line.trim() !== '').join('\n');
};

export const isRichTextValue = (val: any): boolean => {
  if (!val) return false;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return false;
    try { const parsed = JSON.parse(trimmed); return parsed && typeof parsed === 'object' && parsed.type === 'doc'; } catch { return false; }
  }
  return typeof val === 'object' && val.type === 'doc';
};

export const diffLines = (before: string, after: string): { type: 'add' | 'remove'; text: string }[] => {
  const a = (before || '').split('\n');
  const b = (after || '').split('\n');
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const result: { type: 'add' | 'remove'; text: string }[] = [];
  let i = m; let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) { i -= 1; j -= 1; }
    else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) { result.push({ type: 'add', text: b[j - 1] }); j -= 1; }
    else if (i > 0) { result.push({ type: 'remove', text: a[i - 1] }); i -= 1; }
  }
  return result.reverse().filter((entry) => entry.text.trim() !== '');
};

export const computePatch = (prev: any, next: any): { set: Record<string, any>; unset: string[] } => {
  const set: Record<string, any> = {};
  const unset: string[] = [];
  const prevObj = prev || {};
  const nextObj = next || {};
  Object.keys(nextObj).forEach((key) => { if (!areValuesEqual(prevObj[key], nextObj[key])) set[key] = nextObj[key]; });
  Object.keys(prevObj).forEach((key) => { if (!(key in nextObj)) unset.push(key); });
  return { set, unset };
};

export const applyPatch = (base: any, patch: { set: Record<string, any>; unset: string[] }): any => {
  const next = { ...(base || {}) } as any;
  Object.entries(patch.set || {}).forEach(([key, value]) => { next[key] = value; });
  (patch.unset || []).forEach((key) => { delete next[key]; });
  return next;
};

export const buildSnapshotAt = (base: any, versions: any[], index: number): any => {
  let snapshot = { ...(base || {}) } as any;
  for (let i = 0; i <= index; i += 1) {
    snapshot = applyPatch(snapshot, versions[i].patch || { set: {}, unset: [] });
  }
  return snapshot;
};
