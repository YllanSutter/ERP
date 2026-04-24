import React from 'react';
import {
  LineChart, Line, CartesianGrid, XAxis, YAxis, Cell, ResponsiveContainer,
  PieChart, Pie, Tooltip as RechartsTooltip,
} from 'recharts';
import {
  Sigma,
  Hash,
  BarChart2,
  TrendingDown,
  TrendingUp,
  SquareCheck,
  Square,
  Link2,
  PieChart as PieIcon,
  Fingerprint,
  BarChart3,
  Donut,
  TableProperties,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { Property } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Palette de couleurs pour les groupes
// ─────────────────────────────────────────────────────────────────────────────
const CHART_PALETTE = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#9333ea', '#65a30d', '#c2410c', '#0f766e',
];

// ─────────────────────────────────────────────────────────────────────────────
// Méta-données par type de total
// ─────────────────────────────────────────────────────────────────────────────
interface TotalMeta {
  Icon: LucideIcon;
  label: string;
  iconColorClass: string;
  valueColorClass: string;
  accentHex: string;
}

const TOTAL_META: Record<string, TotalMeta> = {
  sum:          { Icon: Sigma,        label: 'Somme',      iconColorClass: 'text-violet-400', valueColorClass: 'text-violet-300', accentHex: '#7c3aed' },
  avg:          { Icon: BarChart2,    label: 'Moyenne',    iconColorClass: 'text-blue-400',   valueColorClass: 'text-blue-300',   accentHex: '#2563eb' },
  min:          { Icon: TrendingDown, label: 'Minimum',    iconColorClass: 'text-emerald-400',valueColorClass: 'text-emerald-300',accentHex: '#059669' },
  max:          { Icon: TrendingUp,   label: 'Maximum',    iconColorClass: 'text-orange-400', valueColorClass: 'text-orange-300', accentHex: '#d97706' },
  count:        { Icon: Hash,         label: 'Nb lignes',  iconColorClass: 'text-neutral-500 dark:text-neutral-400',valueColorClass: 'text-neutral-700 dark:text-neutral-300',accentHex: '#6b7280' },
  unique:       { Icon: Fingerprint,  label: 'Uniques',    iconColorClass: 'text-teal-400',   valueColorClass: 'text-teal-300',   accentHex: '#0891b2' },
  'count-true': { Icon: SquareCheck,  label: 'Cochés',     iconColorClass: 'text-green-400',  valueColorClass: 'text-green-300',  accentHex: '#16a34a' },
  'count-false':{ Icon: Square,       label: 'Non cochés', iconColorClass: 'text-rose-400',   valueColorClass: 'text-rose-300',   accentHex: '#dc2626' },
  'count-linked':{ Icon: Link2,       label: 'Liés',       iconColorClass: 'text-indigo-400', valueColorClass: 'text-indigo-300', accentHex: '#4f46e5' },
};

const LINKED_PROGRESS_META: TotalMeta = {
  Icon: PieIcon, label: 'Payé / Reste',
  iconColorClass: 'text-violet-400', valueColorClass: 'text-violet-300', accentHex: '#7c3aed',
};

const DEFAULT_META: TotalMeta = {
  Icon: Hash, label: 'Total',
  iconColorClass: 'text-neutral-500 dark:text-neutral-400', valueColorClass: 'text-neutral-700 dark:text-neutral-300', accentHex: '#6b7280',
};

// ─────────────────────────────────────────────────────────────────────────────
// Props (rétrocompatibles)
// ─────────────────────────────────────────────────────────────────────────────
export interface TotalsWidgetProps {
  displayProperties: Property[];
  items: any[];
  totalFields: Record<string, string>;
  calculateTotal: (fieldId: string, items: any[], totalType: string) => any;
  formatTotal: (fieldId: string, total: any, totalType: string) => string;
  resolveValue?: (item: any, prop: Property) => any;
  groupedSections?: Array<{ path?: string; label: string; items: any[]; depth: number; propertyName: string }>;
  persistKey?: string;
  className?: string;
  /** Chemin actif du tableau (ex: "2026/2026-03/testbundle") pour pré-sélectionner */
  contextPath?: string;
  preferences?: TotalsWidgetPreferences;
  onPreferencesChange?: (preferences: TotalsWidgetPreferences) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
type FlatRow = { id: string; label: string; items: any[]; depth: number };

function flattenTree(nodes: any[], depth = 0): FlatRow[] {
  return nodes.flatMap((n) => [
    { id: n.id, label: n.label, items: n.items, depth },
    ...flattenTree(n.children ?? [], depth + 1),
  ]);
}

function buildGroupedTree(groupedSections: Array<any>) {
  type Node = { id: string; label: string; items: any[]; depth: number; propertyName: string; children: Node[] };
  const roots: Node[] = [];
  const stack: Node[] = [];
  groupedSections.forEach((section, index) => {
    const nodeId = section.path || `section-${index}`;
    const node: Node = {
      id: nodeId,
      label: cleanLabel(toDisplayLabel(section.label, `Groupe ${index + 1}`)) || `Groupe ${index + 1}`,
      items: section.items,
      depth: section.depth,
      propertyName: section.propertyName,
      children: [],
    };
    while (stack.length > section.depth) stack.pop();
    const parent = section.depth > 0 ? stack[section.depth - 1] : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack[section.depth] = node;
  });
  return roots;
}

function normalizeTotalType(rawType: string): string {
  if (typeof rawType !== 'string') return rawType;
  if (!rawType.startsWith('number-filter:')) return rawType;
  return rawType.split(':')[1] || rawType;
}

function splitFilterHint(text: string): { visible: string; hint: string } {
  const match = String(text || '').match(/^(.*)\s\((hors .+)\)$/i);
  if (!match) return { visible: text, hint: '' };
  return { visible: match[1], hint: match[2] };
}

function getMeta(totalType: string): TotalMeta {
  if (typeof totalType === 'string' && totalType.startsWith('linked-progress:')) return LINKED_PROGRESS_META;
  return TOTAL_META[normalizeTotalType(totalType)] ?? DEFAULT_META;
}

function toRawNumber(val: any): number {
  let n: number;
  if (typeof val === 'number') {
    n = val;
  } else if (typeof val === 'string') {
    n = parseFloat(val.replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (isNaN(n)) return 0;
  } else {
    return 0;
  }
  // Arrondi à 2 décimales max
  return Math.round(n * 100) / 100;
}

function toDisplayLabel(value: any, fallback = '', depth = 0): string {
  if (depth > 3) return fallback;
  if (value === null || value === undefined) return fallback;

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    const normalized = text.toLowerCase();
    if (!text || normalized === '[object object]' || normalized === 'object object') return fallback;
    return text;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const candidate = toDisplayLabel(entry, '', depth + 1);
      if (candidate) return candidate;
    }
    return fallback;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, any>;
    const preferredKeys = [
      'title', 'name', 'label', 'displayName', 'text', 'value', 'reference', 'id',
      'steamName', 'steamId',
    ];

    for (const key of preferredKeys) {
      const candidate = toDisplayLabel(obj[key], '', depth + 1);
      if (candidate) return candidate;
    }

    for (const val of Object.values(obj)) {
      const candidate = toDisplayLabel(val, '', depth + 1);
      if (candidate) return candidate;
    }
  }

  return fallback;
}

function isObjectLabel(text: string): boolean {
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (
    !normalized ||
    normalized === '[object object]' ||
    normalized === 'object object' ||
    /\[?object\s*object\]?/i.test(normalized)
  );
}

function cleanLabel(text: any): string {
  return String(text || '')
    .replace(/\[?object\s*object\]?/gi, '')
    .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLabelKey(text: string): string {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isChoiceProperty(prop: any): boolean {
  const t = String(prop?.type || '').toLowerCase();
  return t === 'select' || t === 'multi_select' || t === 'multiselect';
}

function resolveChoiceEntry(entry: any): { raw: string; label: string } | null {
  if (entry === null || entry === undefined) return null;

  if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
    const raw = String(entry).trim();
    if (!raw) return null;
    return { raw, label: raw };
  }

  if (typeof entry === 'object') {
    const rawCandidate = entry.value ?? entry.id ?? entry.key ?? entry.name ?? entry.label ?? entry.title;
    const raw = String(rawCandidate ?? '').trim();
    if (!raw) return null;
    const label = cleanLabel(toDisplayLabel(entry.label ?? entry.name ?? entry.title ?? entry.value, raw)) || raw;
    return { raw, label };
  }

  return null;
}

function arraysEqual<T>(left: T[] = [], right: T[] = []): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function moduleMapEqual(
  left: Record<ModuleKey, boolean> | undefined,
  right: Record<ModuleKey, boolean> | undefined
): boolean {
  if (!left || !right) return left === right;
  return (
    left.stats === right.stats &&
    left.bar === right.bar &&
    left.donut === right.donut &&
    left.table === right.table
  );
}

function selectedByDepthEqual(
  left: Record<number, string | null> | undefined,
  right: Record<number, string | null> | undefined
): boolean {
  const leftEntries = Object.entries(left || {}).sort(([a], [b]) => Number(a) - Number(b));
  const rightEntries = Object.entries(right || {}).sort(([a], [b]) => Number(a) - Number(b));
  if (leftEntries.length !== rightEntries.length) return false;
  for (let i = 0; i < leftEntries.length; i += 1) {
    if (leftEntries[i][0] !== rightEntries[i][0]) return false;
    if ((leftEntries[i][1] ?? null) !== (rightEntries[i][1] ?? null)) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module types
// ─────────────────────────────────────────────────────────────────────────────
type ModuleKey = 'stats' | 'bar' | 'donut' | 'table';

interface DepthLevel { depth: number; propertyName: string }

export interface TotalsWidgetPreferences {
  showTotalsWidget?: boolean;
  widgetExpanded?: boolean;
  widgetModules?: Record<ModuleKey, boolean>;
  activeMetricId?: string;
  activeLevelDepth?: 'overview' | number;
  selectedByDepth?: Record<number, string | null>;
  collapsedGroupIds?: string[];
  hiddenFieldIds?: string[];
  fieldOrderIds?: string[];
}

const createDefaultTotalsWidgetPreferences = (hasGroups: boolean): TotalsWidgetPreferences => ({
  showTotalsWidget: false,
  widgetExpanded: true,
  widgetModules: {
    stats: true,
    bar: true,
    donut: hasGroups,
    table: false,
  },
  activeMetricId: '',
  activeLevelDepth: 'overview',
  selectedByDepth: {},
  collapsedGroupIds: [],
  hiddenFieldIds: [],
  fieldOrderIds: [],
});

const MODULE_META: Record<ModuleKey, { Icon: LucideIcon; label: string }> = {
  stats:  { Icon: BarChart3 as LucideIcon,      label: 'Cartes'       },
  bar:    { Icon: BarChart2,       label: 'Barres'       },
  donut:  { Icon: Donut as LucideIcon,           label: 'Répartition'  },
  table:  { Icon: TableProperties, label: 'Tableau'      },
};

// ─────────────────────────────────────────────────────────────────────────────
// Custom Tooltip recharts
// ─────────────────────────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 dark:bg-[#1a1a1f] dark:border-white/[0.08] rounded-lg px-3 py-2 shadow-lg dark:shadow-2xl text-xs">
      <p className="text-slate-700 dark:text-neutral-300 font-medium mb-1 truncate max-w-[180px]">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="tabular-nums" style={{ color: entry.fill || entry.color }}>
          {entry.name}: <span className="font-bold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
};

const normalizeTotalsWidgetPreferences = (
  preferences: TotalsWidgetPreferences | undefined,
  hasGroups: boolean
): TotalsWidgetPreferences => {
  const base = createDefaultTotalsWidgetPreferences(hasGroups);
  const src = preferences && typeof preferences === 'object' ? preferences : {};
  const widgetModules = src.widgetModules && typeof src.widgetModules === 'object' ? src.widgetModules : {};
  const selectedByDepth = src.selectedByDepth && typeof src.selectedByDepth === 'object' ? src.selectedByDepth : {};

  return {
    ...base,
    ...src,
    widgetModules: {
      ...base.widgetModules,
      ...Object.fromEntries(
        Object.entries(widgetModules).map(([key, enabled]) => [key, Boolean(enabled)])
      ),
    } as Record<ModuleKey, boolean>,
    activeMetricId: typeof src.activeMetricId === 'string' ? src.activeMetricId : base.activeMetricId,
    activeLevelDepth: src.activeLevelDepth === 'overview' || Number.isInteger(src.activeLevelDepth)
      ? src.activeLevelDepth
      : base.activeLevelDepth,
    selectedByDepth: Object.fromEntries(
      Object.entries(selectedByDepth).flatMap(([depth, id]) => {
        const parsedDepth = Number(depth);
        if (!Number.isInteger(parsedDepth)) return [];
        return [[parsedDepth, typeof id === 'string' ? id : null]];
      })
    ),
    collapsedGroupIds: Array.isArray(src.collapsedGroupIds)
      ? src.collapsedGroupIds.map((id) => String(id)).filter(Boolean)
      : base.collapsedGroupIds,
    hiddenFieldIds: Array.isArray(src.hiddenFieldIds)
      ? src.hiddenFieldIds.map((id) => String(id)).filter(Boolean)
      : base.hiddenFieldIds,
    fieldOrderIds: Array.isArray(src.fieldOrderIds)
      ? Array.from(new Set(src.fieldOrderIds.map((id) => String(id)).filter(Boolean)))
      : base.fieldOrderIds,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────
const TotalsWidget: React.FC<TotalsWidgetProps> = ({
  displayProperties,
  items,
  totalFields,
  calculateTotal,
  formatTotal,
  resolveValue,
  groupedSections,
  persistKey,
  className = '',
  contextPath,
  preferences,
  onPreferencesChange,
}) => {
  const getTotalTypeForProp = React.useCallback((prop: any): string | null => {
    const explicit = totalFields[prop?.id];
    if (explicit) return explicit;

    const propType = String(prop?.type || '').toLowerCase();
    if (propType === 'select' || propType === 'multi_select' || propType === 'multiselect') {
      return 'unique';
    }

    return null;
  }, [totalFields]);

  const availableTotals = displayProperties.filter((p: any) => !!getTotalTypeForProp(p));

  const getItemPropValue = React.useCallback((item: any, prop: Property) => {
    if (resolveValue) return resolveValue(item, prop);
    return item?.[prop?.id];
  }, [resolveValue]);

  // ── Groupes aplatis ───────────────────────────────────────────────────────
  const groupedTree = React.useMemo(
    () => buildGroupedTree(groupedSections || []),
    [groupedSections]
  );
  const flatRows = React.useMemo(() => flattenTree(groupedTree), [groupedTree]);
  const hasGroups = flatRows.length > 0;
  const normalizedPreferences = React.useMemo(
    () => normalizeTotalsWidgetPreferences(preferences, hasGroups),
    [preferences, hasGroups]
  );
  const [totalFieldOrderIds, setTotalFieldOrderIds] = React.useState<string[]>(
    normalizedPreferences.fieldOrderIds || []
  );
  const orderedTotals = React.useMemo(() => {
    const rankMap = new Map(totalFieldOrderIds.map((id, index) => [id, index]));
    const fallbackIndex = new Map(availableTotals.map((prop: any, index: number) => [prop.id, index]));

    return [...availableTotals].sort((a: any, b: any) => {
      const aRank = rankMap.has(a.id) ? (rankMap.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
      const bRank = rankMap.has(b.id) ? (rankMap.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      return (fallbackIndex.get(a.id) ?? 0) - (fallbackIndex.get(b.id) ?? 0);
    });
  }, [availableTotals, totalFieldOrderIds]);
  const visibleTotals = React.useMemo(
    () => orderedTotals.filter((prop: any) => !(normalizedPreferences.hiddenFieldIds || []).includes(prop.id)),
    [orderedTotals, normalizedPreferences.hiddenFieldIds]
  );

  // ── Relations parent/enfant dans la table ─────────────────────────────────
  const parentMap = React.useMemo(() => {
    const map = new Map<string, string>();
    const depthStack: string[] = [];
    flatRows.forEach((row) => {
      depthStack[row.depth] = row.id;
      if (row.depth > 0 && depthStack[row.depth - 1]) {
        map.set(row.id, depthStack[row.depth - 1]);
      }
    });
    return map;
  }, [flatRows]);

  const rowsWithChildren = React.useMemo(() => {
    const set = new Set<string>();
    parentMap.forEach((parentId) => set.add(parentId));
    return set;
  }, [parentMap]);

  // Map rowId → childIds
  const childrenMap = React.useMemo(() => {
    const map = new Map<string, string[]>();
    parentMap.forEach((parentId, childId) => {
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId)!.push(childId);
    });
    return map;
  }, [parentMap]);

  // ── Niveaux de groupage disponibles ──────────────────────────────────────
  const depthLevels = React.useMemo<DepthLevel[]>(() => {
    if (!groupedSections?.length) return [];
    const seen = new Map<number, string>();
    groupedSections.forEach((s) => {
      if (!seen.has(s.depth)) seen.set(s.depth, s.propertyName);
    });
    return Array.from(seen.entries())
      .sort(([a], [b]) => a - b)
      .map(([depth, propertyName]) => ({ depth, propertyName }));
  }, [groupedSections]);

  // ── État ─────────────────────────────────────────────────────────────────
  const [expanded, setExpanded] = React.useState(true);
  const [modules, setModules] = React.useState<Record<ModuleKey, boolean>>(
    normalizedPreferences.widgetModules || createDefaultTotalsWidgetPreferences(hasGroups).widgetModules!
  );
  const [activeMetricId, setActiveMetricId] = React.useState<string>('');
  const [activeLevelDepth, setActiveLevelDepth] = React.useState<'overview' | number>('overview');
  // Groupe sélectionné par profondeur : { 0: "2026", 1: "2026/2026-03", ... }
  const [selectedByDepth, setSelectedByDepth] = React.useState<Record<number, string | null>>({});
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(() => new Set());
  const [hiddenTotalFieldIds, setHiddenTotalFieldIds] = React.useState<string[]>(
    normalizedPreferences.hiddenFieldIds || []
  );
  const [settingsPanelOpen, setSettingsPanelOpen] = React.useState(false);
  const lastSyncedContextPathRef = React.useRef<string | null>(null);
  const hasSyncedContextRef = React.useRef(false);
  const debugLog = React.useCallback((event: string, payload?: any) => {
    console.log('[TotalsWidget]', event, payload ?? '');
  }, []);
  const preferencesSignature = React.useMemo(() => JSON.stringify(normalizedPreferences), [normalizedPreferences]);
  const lastAppliedPreferencesSignatureRef = React.useRef<string>('');
  const lastEmittedPreferencesSignatureRef = React.useRef<string>('');

  React.useEffect(() => {
    setCollapsedGroups((prev) => {
      if (prev.size === rowsWithChildren.size && Array.from(prev).every((id) => rowsWithChildren.has(id))) {
        return prev;
      }
      return new Set(rowsWithChildren);
    });
  }, [rowsWithChildren]);
  React.useEffect(() => {
    if (preferencesSignature === lastAppliedPreferencesSignatureRef.current) return;
    lastAppliedPreferencesSignatureRef.current = preferencesSignature;

    const nextExpanded = Boolean(normalizedPreferences.widgetExpanded ?? true);
    const nextModules = normalizedPreferences.widgetModules || createDefaultTotalsWidgetPreferences(hasGroups).widgetModules!;
    const nextActiveMetricId = normalizedPreferences.activeMetricId || '';
    const nextSelectedByDepth = normalizedPreferences.selectedByDepth || {};
    const nextHiddenFieldIds = normalizedPreferences.hiddenFieldIds || [];
    const nextFieldOrderIds = normalizedPreferences.fieldOrderIds || [];

    setExpanded((prev) => (prev === nextExpanded ? prev : nextExpanded));
    setModules((prev) => (moduleMapEqual(prev, nextModules) ? prev : nextModules));
    setActiveMetricId((prev) => (prev === nextActiveMetricId ? prev : nextActiveMetricId));
    // Quand contextPath est fourni par la vue parent (onglets du bas),
    // on évite de réinjecter la sélection depuis les préférences pour ne pas créer de ping-pong.
    if (!contextPath) {
      const nextActiveLevelDepth = normalizedPreferences.activeLevelDepth ?? 'overview';
      setActiveLevelDepth((prev) => (prev === nextActiveLevelDepth ? prev : nextActiveLevelDepth));
      setSelectedByDepth((prev) => (selectedByDepthEqual(prev, nextSelectedByDepth) ? prev : nextSelectedByDepth));
    }
    setHiddenTotalFieldIds((prev) => (arraysEqual(prev, nextHiddenFieldIds) ? prev : nextHiddenFieldIds));
    setTotalFieldOrderIds((prev) => (arraysEqual(prev, nextFieldOrderIds) ? prev : nextFieldOrderIds));
  }, [preferencesSignature, normalizedPreferences, hasGroups, contextPath]);

  React.useEffect(() => {
    const availableIds = availableTotals.map((prop: any) => prop.id);
    setTotalFieldOrderIds((prev) => {
      const deduped = Array.from(new Set(prev));
      const kept = deduped.filter((id) => availableIds.includes(id));
      const missing = availableIds.filter((id) => !kept.includes(id));
      const next = [...kept, ...missing];
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) return prev;
      return next;
    });
  }, [availableTotals]);

  React.useEffect(() => {
    if (!activeMetricId && visibleTotals.length > 0) setActiveMetricId(visibleTotals[0].id);
  }, [visibleTotals, activeMetricId]);

  React.useEffect(() => {
    setCollapsedGroups((prev) => {
      const next = new Set<string>();
      const savedCollapsed = new Set(normalizedPreferences.collapsedGroupIds || []);
      rowsWithChildren.forEach((rowId) => {
        if (savedCollapsed.has(rowId)) next.add(rowId);
      });
      if (savedCollapsed.size === 0) {
        rowsWithChildren.forEach((rowId) => next.add(rowId));
      }
      if (prev.size === next.size && Array.from(prev).every((id) => next.has(id))) return prev;
      return next;
    });
  }, [rowsWithChildren, normalizedPreferences.collapsedGroupIds]);

  // Pré-sélection depuis le chemin actif du tableau
  React.useEffect(() => {
    if (!flatRows.length) return;

    const normalizedContextPath = contextPath || '';
    if (hasSyncedContextRef.current && lastSyncedContextPathRef.current === normalizedContextPath) {
      debugLog('sync:skip-same-context', {
        contextPath: normalizedContextPath,
        activeLevelDepth,
        selectedByDepth,
      });
      return;
    }

    debugLog('sync:start', {
      contextPath: normalizedContextPath,
      flatRows: flatRows.length,
      previousContextPath: lastSyncedContextPathRef.current,
      alreadySynced: hasSyncedContextRef.current,
    });

    if (!contextPath) {
      setSelectedByDepth({});
      setActiveLevelDepth('overview');
      lastSyncedContextPathRef.current = normalizedContextPath;
      hasSyncedContextRef.current = true;
      debugLog('sync:reset-overview-no-context', { contextPath: normalizedContextPath });
      return;
    }

    // 1) Match exact (id === contextPath)
    let targetRow = null as FlatRow | null;
    if (!targetRow) targetRow = flatRows.find((r) => r.id === contextPath) ?? null;

    // 2) Fallback robuste: plus long préfixe de contextPath
    if (!targetRow) {
      targetRow = flatRows
        .filter((r) => contextPath === r.id || contextPath.startsWith(`${r.id}/`))
        .sort((a, b) => b.id.length - a.id.length)[0] ?? null;
    }

    // 3) Dernier fallback historique (construction segmentée)
    if (!targetRow) {
      const segments = contextPath.split('/');
      let cumPath = '';
      segments.forEach((seg) => {
        cumPath = cumPath ? `${cumPath}/${seg}` : seg;
        const row = flatRows.find((r) => r.id === cumPath);
        if (row) targetRow = row;
      });
    }

    if (!targetRow) {
      setSelectedByDepth({});
      setActiveLevelDepth('overview');
      lastSyncedContextPathRef.current = normalizedContextPath;
      hasSyncedContextRef.current = true;
      debugLog('sync:target-not-found-reset-overview', { contextPath: normalizedContextPath });
      return;
    }

    // Reconstruit la chaîne parent -> enfant jusqu'au niveau cible
    const newSelected: Record<number, string | null> = {};
    let cursor: FlatRow | null = targetRow;
    while (cursor) {
      newSelected[cursor.depth] = cursor.id;
      const parentId = parentMap.get(cursor.id);
      cursor = parentId ? (flatRows.find((r) => r.id === parentId) ?? null) : null;
    }

    setSelectedByDepth(newSelected);
    setActiveLevelDepth(targetRow.depth);
    lastSyncedContextPathRef.current = normalizedContextPath;
    hasSyncedContextRef.current = true;
    debugLog('sync:applied-target', {
      contextPath: normalizedContextPath,
      targetRowId: targetRow.id,
      targetDepth: targetRow.depth,
      selectedByDepth: newSelected,
    });
  }, [contextPath, flatRows, parentMap, activeLevelDepth, selectedByDepth, debugLog]);

  React.useEffect(() => {
    debugLog('state:active-level-changed', {
      activeLevelDepth,
      contextPath: contextPath || '',
    });
  }, [activeLevelDepth, contextPath, debugLog]);

  React.useEffect(() => {
    debugLog('state:selected-by-depth-changed', {
      selectedByDepth,
      contextPath: contextPath || '',
    });
  }, [selectedByDepth, contextPath, debugLog]);

  React.useEffect(() => {
    const snapshot = {
      showTotalsWidget: normalizedPreferences.showTotalsWidget,
      widgetExpanded: expanded,
      widgetModules: modules,
      hiddenFieldIds: hiddenTotalFieldIds,
      fieldOrderIds: totalFieldOrderIds,
    };
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastEmittedPreferencesSignatureRef.current) return;
    lastEmittedPreferencesSignatureRef.current = serialized;
    onPreferencesChange?.(snapshot);
  }, [
    onPreferencesChange,
    normalizedPreferences.showTotalsWidget,
    expanded,
    modules,
    hiddenTotalFieldIds,
    totalFieldOrderIds,
  ]);

  // ── Garde ─────────────────────────────────────────────────────────────────
  if (availableTotals.length === 0 || items.length === 0) return null;

  // ── Entonnoir : lignes filtrées par la sélection du niveau parent ──────────
  const getFilteredRowsAtDepth = (depth: number): FlatRow[] => {
    const all = flatRows.filter((r) => r.depth === depth);
    if (depth === 0) return all;
    const parentSel = selectedByDepth[depth - 1];
    if (!parentSel) return all;
    return all.filter((r) => parentMap.get(r.id) === parentSel);
  };

  // ── Contexte selon onglet niveau + groupe sélectionné ────────────────────
  const levelDepthNum = activeLevelDepth === 'overview' ? 0 : (activeLevelDepth as number);
  const levelRows = getFilteredRowsAtDepth(levelDepthNum);
  const currentGroupId = activeLevelDepth === 'overview' ? null : (selectedByDepth[levelDepthNum] ?? null);
  const selectedGroupRow = currentGroupId ? (flatRows.find((r) => r.id === currentGroupId) ?? null) : null;

  // Items du contexte :
  //   - groupe sélectionné → ses items
  //   - "Tous" sur un niveau → union des items des levelRows filtrées (entonnoir)
  //   - vue d'ensemble → global
  const contextItems: any[] = React.useMemo(() => {
    if (selectedGroupRow) return selectedGroupRow.items;
    if (activeLevelDepth !== 'overview' && levelRows.length > 0) {
      const seen = new Set<string>();
      const merged: any[] = [];
      levelRows.forEach((row) => {
        row.items.forEach((it: any) => {
          const id = it.id ?? it._id ?? JSON.stringify(it);
          if (!seen.has(id)) { seen.add(id); merged.push(it); }
        });
      });
      return merged;
    }
    return items;
  }, [selectedGroupRow, activeLevelDepth, levelRows, items]);

  // Lignes pour les graphiques :
  // - groupe sélectionné avec sous-groupes -> sous-groupes
  // - groupe sélectionné feuille -> items du groupe
  // - sinon -> groupes du niveau
  const contextChildRows: FlatRow[] = React.useMemo(() => {
    if (!selectedGroupRow) return levelRows;

    const kids = (childrenMap.get(selectedGroupRow.id) || [])
      .map((id) => flatRows.find((r) => r.id === id)!)
      .filter(Boolean);

    if (kids.length > 0) return kids;

    return selectedGroupRow.items.map((item: any, i: number) => {
      const itemId = String(item?.id ?? item?._id ?? `${selectedGroupRow.id}-item-${i}`);
      const itemLabel = cleanLabel(toDisplayLabel(
        item?.title ?? item?.name ?? item?.label ?? item?.reference,
        toDisplayLabel(item, itemId),
      )) || itemId;
      return {
        id: `${selectedGroupRow.id}::${itemId}`,
        label: itemLabel,
        items: [item],
        depth: selectedGroupRow.depth + 1,
      };
    });
  }, [selectedGroupRow, levelRows, childrenMap, flatRows]);

  // ── Visibilité des rangées (respect du collapse) ───────────────────────
  const isRowVisible = (rowId: string): boolean => {
    let currentId = rowId;
    while (true) {
      const parentId = parentMap.get(currentId);
      if (!parentId) return true;
      if (collapsedGroups.has(parentId)) return false;
      currentId = parentId;
    }
  };

  const toggleCollapse = (rowId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  // ── Données cartes ─────────────────────────────────────────────────────
  const statCards = visibleTotals.map((prop: any) => {
    const totalType = getTotalTypeForProp(prop) || 'count';
    const meta = getMeta(totalType);
    const total = calculateTotal(prop.id, contextItems, totalType);
    const formatted = formatTotal(prop.id, total, totalType);
    const { visible } = splitFilterHint(formatted || '');
    const PropIcon = (Icons as any)[prop.icon] || meta.Icon;
    const accent = prop?.color || meta.accentHex;
    const normalizedType = normalizeTotalType(totalType);
    const isNumericMetric = ['sum', 'avg', 'min', 'max'].includes(normalizedType);

    // Sparkbar : distribution des groupes de l'onglet
    const sparkData = hasGroups
      ? contextChildRows.map((r) => {
          const raw = calculateTotal(prop.id, r.items, totalType);
          const numeric = isNumericMetric ? toRawNumber(raw) : r.items.length;
          const formattedValue = formatTotal(prop.id, raw, totalType);
          const { visible: visibleValue } = splitFilterHint(formattedValue || '');
          return {
            id: r.id,
            name: r.label,
            numeric,
            visibleValue: isNumericMetric ? (visibleValue || String(numeric)) : String(numeric),
            count: r.items.length,
          };
        })
      : [];
    return { prop, meta, total, visible, PropIcon, accent, sparkData, totalType };
  });

  // ── Données bar chart ─────────────────────────────────────────────────────
  const activeProp = visibleTotals.find((p: any) => p.id === activeMetricId) || visibleTotals[0];
  const barData = React.useMemo(() => {
    if (!activeProp || !hasGroups) return [];

    if (isChoiceProperty(activeProp)) {
      const optionLabelByRaw = new Map<string, string>();
      (activeProp?.options || []).forEach((opt: any) => {
        const resolved = resolveChoiceEntry(opt);
        if (!resolved) return;
        optionLabelByRaw.set(resolved.raw, resolved.label || resolved.raw);
      });

      const countsByLabel = new Map<string, number>();
      const addLabel = (label: string) => {
        const safe = cleanLabel(label);
        if (!safe || isObjectLabel(safe)) return;
        countsByLabel.set(safe, (countsByLabel.get(safe) || 0) + 1);
      };

      (contextItems || []).forEach((item: any) => {
        const raw = getItemPropValue(item, activeProp as Property);
        const values = Array.isArray(raw) ? raw : (raw === null || raw === undefined || raw === '' ? [] : [raw]);
        values.forEach((entry: any) => {
          const resolved = resolveChoiceEntry(entry);
          if (!resolved) return;
          const label = optionLabelByRaw.get(resolved.raw) || resolved.label || resolved.raw;
          addLabel(label);
        });
      });

      return Array.from(countsByLabel.entries())
        .map(([name, value], i) => ({
          name,
          value,
          displayValue: String(value),
          fill: CHART_PALETTE[i % CHART_PALETTE.length],
        }))
        .slice(0, 12);
    }

    const totalType = getTotalTypeForProp(activeProp) || 'count';
    const isNumericMetric = ['sum', 'avg', 'min', 'max'].includes(normalizeTotalType(totalType));
    return contextChildRows
      .map((row, i) => {
        const raw = calculateTotal(activeProp.id, row.items, totalType);
        const numVal = isNumericMetric ? toRawNumber(raw) : row.items.length;
        const formatted = formatTotal(activeProp.id, raw, totalType);
        const { visible } = splitFilterHint(formatted || '');
        const label = cleanLabel(toDisplayLabel(row.label, `Objet ${i + 1}`)) || `Objet ${i + 1}`;
        return {
          name: label,
          value: numVal,
          displayValue: isNumericMetric ? visible : String(numVal),
          fill: CHART_PALETTE[i % CHART_PALETTE.length],
        };
      })
      .slice(0, 12);
  }, [activeProp, contextChildRows, contextItems, calculateTotal, formatTotal, hasGroups, getTotalTypeForProp, getItemPropValue]);

  // ── Données donut (suit la métrique active) ───────────────────────────────
  const donutData = React.useMemo(() => {
    if (!hasGroups || !activeProp) return [];

    if (isChoiceProperty(activeProp)) {
      const optionLabelByRaw = new Map<string, string>();
      (activeProp?.options || []).forEach((opt: any) => {
        const resolved = resolveChoiceEntry(opt);
        if (!resolved) return;
        optionLabelByRaw.set(resolved.raw, resolved.label || resolved.raw);
      });

      const countsByLabel = new Map<string, number>();
      const addLabel = (label: string) => {
        const safe = cleanLabel(label);
        if (!safe || isObjectLabel(safe)) return;
        countsByLabel.set(safe, (countsByLabel.get(safe) || 0) + 1);
      };

      (contextItems || []).forEach((item: any) => {
        const raw = getItemPropValue(item, activeProp as Property);
        const values = Array.isArray(raw) ? raw : (raw === null || raw === undefined || raw === '' ? [] : [raw]);
        values.forEach((entry: any) => {
          const resolved = resolveChoiceEntry(entry);
          if (!resolved) return;
          const label = optionLabelByRaw.get(resolved.raw) || resolved.label || resolved.raw;
          addLabel(label);
        });
      });

      return Array.from(countsByLabel.entries())
        .map(([name, value], i) => ({
          name,
          value,
          fill: CHART_PALETTE[i % CHART_PALETTE.length],
        }))
        .filter((d) => d.value > 0)
        .slice(0, 10);
    }

    const totalType = getTotalTypeForProp(activeProp) || 'count';
    const isNumericMetric = ['sum', 'avg', 'min', 'max'].includes(normalizeTotalType(totalType));
    const rows = contextChildRows
      .map((row, i) => {
        const value = isNumericMetric
          ? toRawNumber(calculateTotal(activeProp.id, row.items, totalType))
          : row.items.length;

        const fromRow = cleanLabel(toDisplayLabel(row.label, ''));
        const fromItem = cleanLabel(toDisplayLabel(row.items?.[0], `Objet ${i + 1}`));
        const name = (!fromRow || isObjectLabel(fromRow)) ? fromItem : fromRow;

        return {
          name,
          value,
          fill: CHART_PALETTE[i % CHART_PALETTE.length],
        };
      })
      .filter((d) => d.value > 0 && !!d.name && !isObjectLabel(d.name));

    // Agrège les doublons d'intitulé pour éviter les entrées répétées en légende.
    const aggregatedMap = new Map<string, { name: string; value: number; fill: string }>();
    rows.forEach((row) => {
      const key = normalizeLabelKey(cleanLabel(row.name));
      if (!key || isObjectLabel(key)) return;

      const existing = aggregatedMap.get(key);
      if (existing) {
        existing.value += row.value;
      } else {
        aggregatedMap.set(key, { ...row, name: cleanLabel(row.name) });
      }
    });

    return Array.from(aggregatedMap.values()).slice(0, 10);
  }, [contextChildRows, contextItems, hasGroups, activeProp, calculateTotal, getTotalTypeForProp, getItemPropValue]);

  // Sécurisation finale spécifique au camembert (répartition)
  const donutDataSafe = React.useMemo(() => {
    const out = new Map<string, { name: string; value: number; fill: string }>();
    donutData.forEach((entry, i) => {
      const rawName = cleanLabel(entry?.name);
      if (!rawName || isObjectLabel(rawName)) return;
      const key = normalizeLabelKey(rawName);
      if (!key || isObjectLabel(key)) return;

      const existing = out.get(key);
      if (existing) {
        existing.value += Number(entry?.value || 0);
      } else {
        out.set(key, {
          name: rawName,
          value: Number(entry?.value || 0),
          fill: entry?.fill || CHART_PALETTE[i % CHART_PALETTE.length],
        });
      }
    });
    return Array.from(out.values()).filter((e) => e.value > 0).slice(0, 10);
  }, [donutData]);

  // ── Toggle module ─────────────────────────────────────────────────────────
  const toggleModule = (key: ModuleKey) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleHiddenField = (fieldId: string) => {
    setHiddenTotalFieldIds((prev) => {
      if (prev.includes(fieldId)) return prev.filter((id) => id !== fieldId);
      return [...prev, fieldId];
    });
  };

  const resetHiddenFields = () => {
    setHiddenTotalFieldIds([]);
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    setTotalFieldOrderIds((prev) => {
      const index = prev.indexOf(fieldId);
      if (index < 0) return prev;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const activeModuleCount = Object.values(modules).filter(Boolean).length;

  React.useEffect(() => {
    if (!expanded && settingsPanelOpen) {
      setSettingsPanelOpen(false);
    }
  }, [expanded, settingsPanelOpen]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={cn('rounded-xl overflow-hidden mb-3 border border-slate-200 bg-white shadow-sm dark:border-white/[0.07] dark:bg-[#0d0d10] dark:shadow-2xl', className)}>

      {/* ── En-tête ligne 1 : titre + toggles modules + collapse ──────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-white/[0.04]">
        <Sigma size={12} className="text-violet-400 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 dark:text-neutral-400 select-none">
          Totaux
        </span>
        <span className="text-[10px] text-slate-500 dark:text-neutral-600">
          · {contextItems.length} ligne{contextItems.length > 1 ? 's' : ''}
        </span>

        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => setSettingsPanelOpen((v) => !v)}
            className={cn(
              'p-1.5 rounded-md transition-all',
              settingsPanelOpen
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-600/30 dark:text-violet-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-neutral-600 dark:hover:text-neutral-400'
            )}
            title={settingsPanelOpen ? 'Fermer les réglages des totaux' : 'Réglages des totaux'}
          >
            <Settings2 size={12} />
          </button>
          {expanded && (
            <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-white/[0.04] rounded-lg p-0.5 mr-1">
              {(Object.entries(MODULE_META) as [ModuleKey, typeof MODULE_META[ModuleKey]][]).map(([key, { Icon, label }]) => {
                if ((key === 'bar' || key === 'donut') && !hasGroups) return null;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleModule(key)}
                    title={label}
                    className={cn(
                      'p-1.5 rounded-md transition-all',
                      modules[key]
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-600/30 dark:text-violet-300'
                        : 'text-slate-500 hover:text-slate-700 dark:text-neutral-600 dark:hover:text-neutral-400'
                    )}
                  >
                    <Icon size={12} />
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-neutral-600 dark:hover:text-neutral-300 dark:hover:bg-white/[0.05] transition-all"
          >
            <ChevronDown
              size={13}
              className={cn('transition-transform duration-200', expanded ? '' : '-rotate-90')}
            />
          </button>
        </div>
      </div>

      {expanded && settingsPanelOpen && (
        <div className="border-b border-slate-200 dark:border-white/[0.05] bg-slate-50/80 dark:bg-white/[0.02] px-4 py-3">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-neutral-500">
                Champs visibles
              </p>
              <p className="text-[11px] text-slate-500 dark:text-neutral-600 mt-0.5">
                Affiche, masque et réorganise les totaux sans toucher aux données.
              </p>
            </div>
            <button
              type="button"
              onClick={resetHiddenFields}
              className="px-2 py-1 rounded-md border border-slate-300 text-[11px] text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-white/[0.08] dark:text-neutral-400 dark:hover:border-violet-500/30 dark:hover:text-violet-300 transition-colors"
              disabled={hiddenTotalFieldIds.length === 0}
            >
              Tout afficher
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {orderedTotals.map((prop: any, index: number) => {
              const isHidden = hiddenTotalFieldIds.includes(prop.id);
              return (
                <div
                  key={prop.id}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-1 py-1 transition-all',
                    isHidden
                      ? 'bg-slate-100 border-slate-300 dark:bg-white/[0.03] dark:border-white/[0.08]'
                      : 'bg-white border-violet-200 shadow-sm dark:bg-white/[0.04] dark:border-violet-500/30'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => moveField(prop.id, 'up')}
                    disabled={index === 0}
                    className="h-6 w-6 inline-flex items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed dark:text-neutral-500 dark:hover:text-neutral-300 dark:hover:bg-white/[0.06]"
                    title="Monter"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(prop.id, 'down')}
                    disabled={index === orderedTotals.length - 1}
                    className="h-6 w-6 inline-flex items-center justify-center rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed dark:text-neutral-500 dark:hover:text-neutral-300 dark:hover:bg-white/[0.06]"
                    title="Descendre"
                  >
                    <ChevronDown size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleHiddenField(prop.id)}
                    className={cn(
                      'inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] transition-all',
                      isHidden
                        ? 'bg-slate-100 border-slate-300 text-slate-500 line-through dark:bg-white/[0.03] dark:border-white/[0.08] dark:text-neutral-600'
                        : 'bg-white border-violet-200 text-slate-700 dark:bg-white/[0.04] dark:border-violet-500/30 dark:text-white'
                    )}
                  >
                    <span className="font-semibold">{prop.name}</span>
                    <span className="text-[10px] uppercase tracking-wider opacity-60">
                      {isHidden ? 'Masqué' : 'Visible'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Onglet niveau (Vue d'ensemble / Année / Mois / Bundle…) ─────── */}
      {expanded && hasGroups && (
        <div className="border-b border-slate-200 dark:border-white/[0.05]">
          {/* Rangée 1 : onglets de niveau */}
          <div className="flex items-center gap-0 px-3 overflow-x-auto bg-slate-50 dark:bg-white/[0.01]">
            {/* Onglet Vue d'ensemble */}
            {[{ id: 'overview' as const, label: "Vue d'ensemble" }, ...depthLevels.map(({ depth, propertyName }) => ({ id: depth as 'overview' | number, label: propertyName || `Niveau ${depth + 1}` }))].map(({ id, label }) => {
              const isActive = activeLevelDepth === id;
              return (
                <button
                  key={String(id)}
                  type="button"
                  onClick={() => {
                    debugLog('ui:level-tab-click', { id, label });
                    setActiveLevelDepth(id);
                  }}
                  className={cn(
                    'relative px-3 py-2 text-[11px] font-medium whitespace-nowrap transition-colors shrink-0',
                    isActive ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-neutral-500 dark:hover:text-neutral-300'
                  )}
                >
                  {label}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-t-full bg-violet-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Rangée 2 : groupes du niveau sélectionné (sauf Vue d'ensemble) */}
          {activeLevelDepth !== 'overview' && levelRows.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto bg-slate-100/70 dark:bg-black/10 border-t border-slate-200 dark:border-white/[0.03]">
              {/* Bouton "Tous" */}
              <button
                type="button"
                onClick={() => {
                  debugLog('ui:level-group-click-all', { levelDepthNum });
                  setSelectedByDepth((p) => ({ ...p, [levelDepthNum]: null }));
                }}
                className={cn(
                  'shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-all whitespace-nowrap',
                  currentGroupId === null
                    ? 'bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-600/25 dark:border-violet-500/30 dark:text-violet-300'
                    : 'border-slate-300 text-slate-600 hover:text-slate-800 hover:border-slate-400 dark:border-white/[0.07] dark:text-neutral-500 dark:hover:text-neutral-300 dark:hover:border-white/10'
                )}
              >
                Tous
              </button>
              {levelRows.map((row, i) => {
                const isActive = currentGroupId === row.id;
                const color = CHART_PALETTE[i % CHART_PALETTE.length];
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => {
                      const nextValue = isActive ? null : row.id;
                      debugLog('ui:level-group-click', {
                        levelDepthNum,
                        rowId: row.id,
                        isActive,
                        nextValue,
                      });
                      setSelectedByDepth((p) => ({ ...p, [levelDepthNum]: nextValue }));
                    }}
                    className={cn(
                      'shrink-0 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-all whitespace-nowrap',
                      isActive
                        ? 'text-slate-900 dark:text-white border-transparent'
                        : 'border-slate-300 text-slate-600 hover:text-slate-800 hover:border-slate-400 dark:border-white/[0.07] dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:border-white/10'
                    )}
                    style={isActive ? { backgroundColor: color + '33', borderColor: color + '66', color } : undefined}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color, opacity: isActive ? 1 : 0.5 }} />
                    {row.label}
                    <span className="text-[9px] opacity-60 tabular-nums">({row.items.length})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="p-4 space-y-4">

          {/* ── Module 1 : Cartes de stats ─────────────────────────────── */}
          {modules.stats && (
            visibleTotals.length > 0 ? (
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(190px, 1fr))` }}>
                {statCards.map(({ prop, meta, visible, PropIcon, accent, sparkData }) => (
                  <button
                    key={prop.id}
                    type="button"
                    onClick={() => setActiveMetricId(prop.id)}
                    className={cn(
                      'relative overflow-hidden rounded-xl border text-left transition-all group',
                      activeMetricId === prop.id
                        ? 'border-violet-300 bg-violet-50 ring-1 ring-violet-400/40 dark:border-white/[0.12] dark:bg-white/[0.05] dark:ring-violet-500/30'
                        : 'border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/[0.1] dark:hover:bg-white/[0.04]'
                    )}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: accent }} />

                    <div className="pl-4 pr-3 py-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <PropIcon size={11} style={{ color: accent }} />
                        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-600 dark:text-neutral-500 truncate">
                          {prop.name}
                        </span>
                        <span
                          className="ml-auto text-[9px] uppercase tracking-widest shrink-0"
                          style={{ color: accent + 'aa' }}
                        >
                          {meta.label}
                        </span>
                      </div>

                      <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white truncate">
                        {visible || '—'}
                      </div>

                      {sparkData.length > 1 && (
                        <>
                          <p className="mt-2 text-[9px] uppercase tracking-wider text-slate-400 dark:text-neutral-600">
                            Tendance groupes (survol)
                          </p>
                          <div className="relative mt-1.5 h-8 w-full">
                            {(() => {
                              const series = sparkData.slice(0, 12);
                              const minVal = Math.min(...series.map((s) => s.numeric));
                              const maxVal = Math.max(...series.map((s) => s.numeric));
                              const range = Math.max(0.0001, maxVal - minVal);
                              const points = series.map((s, i) => {
                                const x = series.length <= 1 ? 0 : (i / (series.length - 1)) * 100;
                                const y = maxVal === minVal
                                  ? 50
                                  : 100 - (((s.numeric - minVal) / range) * 100);
                                return { ...s, x, y };
                              });
                              const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
                              const areaPath = points.length
                                ? `M 0,100 L ${points.map((p) => `${p.x},${p.y}`).join(' L ')} L 100,100 Z`
                                : '';

                              return (
                                <>
                                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
                                    <defs>
                                      <linearGradient id={`spark-grad-${prop.id}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={accent} stopOpacity={activeMetricId === prop.id ? 0.35 : 0.2} />
                                        <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
                                      </linearGradient>
                                    </defs>
                                    <path d={areaPath} fill={`url(#spark-grad-${prop.id})`} />
                                    <polyline
                                      points={linePoints}
                                      fill="none"
                                      stroke={accent}
                                      strokeWidth={2.2}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      opacity={activeMetricId === prop.id ? 0.95 : 0.65}
                                    />
                                  </svg>

                                  {points.map((spark) => (
                                    <Tooltip key={spark.id}>
                                      <TooltipTrigger asChild>
                                        <span
                                          className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border border-white dark:border-black/40 shadow-sm"
                                          style={{
                                            left: `${spark.x}%`,
                                            top: `${spark.y}%`,
                                            backgroundColor: accent,
                                            opacity: activeMetricId === prop.id ? 1 : 0.8,
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-[220px]">
                                        <div className="text-[11px] leading-tight">
                                          <p className="font-medium truncate">{spark.name}</p>
                                          <p className="text-slate-500 dark:text-neutral-400 mt-0.5">
                                            {meta.label}: <span className="font-semibold">{spark.visibleValue}</span>
                                          </p>
                                          <p className="text-slate-400 dark:text-neutral-500 text-[10px]">
                                            {spark.count} ligne{spark.count > 1 ? 's' : ''}
                                          </p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </>
                              );
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-500 dark:text-neutral-500">
                Aucun champ de total visible. Ouvre les réglages pour en réafficher.
              </div>
            )
          )}

          {/* ── Modules graphiques (si groupes) ───────────────────────── */}
          {hasGroups && (modules.bar || modules.donut) && (
            <div className={cn('grid gap-4', modules.bar && modules.donut ? 'grid-cols-1 xl:grid-cols-[2fr_1fr]' : 'grid-cols-1')}>

              {/* Graphique métrique (ligne) */}
              {modules.bar && barData.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 dark:border-white/[0.06] dark:bg-white/[0.02] p-4">
                  {/* Sélecteur de métrique */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-neutral-600">Métrique :</span>
                    {visibleTotals.map((prop: any) => {
                      const meta = getMeta(getTotalTypeForProp(prop) || 'count');
                      const accent = prop?.color || meta.accentHex;
                      return (
                        <button
                          key={prop.id}
                          type="button"
                          onClick={() => setActiveMetricId(prop.id)}
                          className={cn(
                            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all',
                            activeMetricId === prop.id
                              ? 'border-violet-300 text-violet-700 dark:border-white/10 dark:text-white'
                              : 'border-slate-300 text-slate-600 hover:text-slate-800 dark:border-white/[0.05] dark:text-neutral-500 dark:hover:text-neutral-300'
                          )}
                          style={activeMetricId === prop.id ? { backgroundColor: accent + '22', borderColor: accent + '55', color: accent } : undefined}
                        >
                          {prop.name}
                        </button>
                      );
                    })}
                  </div>

                  <ResponsiveContainer width="100%" height={Math.min(240, Math.max(120, barData.length * 28))}>
                    <LineChart
                      data={barData}
                      margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        opacity={0.45}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 10) + '…' : v}
                      />
                      <YAxis
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={44}
                      />
                      <RechartsTooltip
                        content={<DarkTooltip />}
                        cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '3 3' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name={activeProp?.name || 'Valeur'}
                        stroke={activeProp?.color || getMeta(getTotalTypeForProp(activeProp) || 'count').accentHex}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: activeProp?.color || getMeta(getTotalTypeForProp(activeProp) || 'count').accentHex, strokeWidth: 0 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Donut */}
              {modules.donut && donutDataSafe.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 dark:border-white/[0.06] dark:bg-white/[0.02] p-4">
                  <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-3">
                    Répartition
                    {activeProp && (
                      <span className="ml-1.5 normal-case tracking-normal text-slate-500 dark:text-neutral-700">
                        — {activeProp.name}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-col xl:flex-row items-center gap-4">
                    <ResponsiveContainer width={140} height={140}>
                      <PieChart>
                        <Pie
                          data={donutDataSafe}
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={65}
                          paddingAngle={2}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {donutDataSafe.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} fillOpacity={0.85} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          content={<DarkTooltip />}
                          cursor={false}
                        />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Légende */}
                    <div className="flex-1 space-y-1.5 min-w-0 w-full xl:w-auto">
                      {(() => {
                        const totalDonutValue = donutDataSafe.reduce((acc, d) => acc + d.value, 0);
                        const isNumericMetric = activeProp && ['sum', 'avg', 'min', 'max'].includes(
                          normalizeTotalType(getTotalTypeForProp(activeProp) || 'count')
                        );
                        return donutDataSafe.slice(0, 8).map((entry) => {
                          if (!entry?.name || isObjectLabel(entry.name)) return null;
                          const pct = totalDonutValue > 0 ? Math.round((entry.value / totalDonutValue) * 100) : 0;
                          const displayValue = isNumericMetric
                            ? formatTotal(activeProp!.id, entry.value, getTotalTypeForProp(activeProp) || 'count')
                            : String(entry.value);
                          const { visible: visibleVal } = splitFilterHint(displayValue || '');
                          return (
                            <div key={entry.name} className="flex items-center gap-2 text-[11px]">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                              <span className="text-slate-600 dark:text-neutral-400 truncate flex-1 min-w-0">{entry.name}</span>
                              <span className="text-slate-500 dark:text-neutral-500 tabular-nums shrink-0">{visibleVal}</span>
                              <span className="text-slate-400 dark:text-neutral-600 tabular-nums shrink-0 w-8 text-right">{pct}%</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Module 4 : Tableau ─────────────────────────────────────── */}
          {modules.table && (
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-hidden">
              <TooltipProvider>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 dark:border-white/[0.06] dark:bg-white/[0.02]">
                      {hasGroups && (
                        <th className="px-4 py-2.5 text-left font-medium text-slate-600 dark:text-neutral-500 w-40 min-w-[120px]">
                          Groupe
                        </th>
                      )}
                      {visibleTotals.map((prop: any) => {
                        const meta = getMeta(getTotalTypeForProp(prop) || 'count');
                        const PropIcon = (Icons as any)[prop.icon] || meta.Icon;
                        const accentStyle = prop?.color ? { color: prop.color } : undefined;
                        return (
                          <th key={prop.id} className="px-3 py-2.5 text-left font-medium min-w-[90px]">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 cursor-default">
                                  <PropIcon size={11} className={meta.iconColorClass} style={accentStyle} />
                                  <span className="text-slate-600 dark:text-neutral-400 truncate max-w-[90px]">{prop.name}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top">{meta.label}</TooltipContent>
                            </Tooltip>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {/* Ligne Total */}
                    <tr className="border-b border-slate-200 bg-slate-50/70 dark:border-white/[0.04] dark:bg-white/[0.015]">
                      {hasGroups && (
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Sigma size={9} className="text-slate-500 dark:text-neutral-500 shrink-0" />
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">Total</span>
                            <span className="text-[10px] text-slate-500 dark:text-neutral-600">({contextItems.length})</span>
                          </div>
                        </td>
                      )}
                      {visibleTotals.map((prop: any) => {
                        const totalType = getTotalTypeForProp(prop) || 'count';
                        const meta = getMeta(totalType);
                        const total = calculateTotal(prop.id, contextItems, totalType);
                        const formatted = formatTotal(prop.id, total, totalType);
                        const { visible, hint } = splitFilterHint(formatted || '');
                        const accentColor = prop?.color;
                        const valStyle = accentColor ? { color: accentColor } : undefined;
                        const el = (
                          <span className={cn('font-semibold tabular-nums', meta.valueColorClass)} style={valStyle}>
                            {visible || '—'}
                          </span>
                        );
                        return (
                          <td key={prop.id} className="px-3 py-2.5">
                            {hint ? (
                              <Tooltip>
                                <TooltipTrigger asChild>{el}</TooltipTrigger>
                                <TooltipContent side="top">{hint}</TooltipContent>
                              </Tooltip>
                            ) : el}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Lignes par groupe */}
                    {flatRows.map((row) => {
                      if (!isRowVisible(row.id)) return null;

                      const isActiveDepth = row.depth === levelDepthNum;
                      const hasKids = rowsWithChildren.has(row.id);
                      const isCollapsed = collapsedGroups.has(row.id);
                      const depthColors = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626'];
                      const depthColor = depthColors[row.depth % depthColors.length];

                      return (
                        <tr
                          key={row.id}
                          className={cn(
                            'border-b transition-colors',
                            row.depth === 0
                              ? 'border-slate-200 hover:bg-slate-50 dark:border-white/[0.06] dark:hover:bg-white/[0.025]'
                              : 'border-slate-100 hover:bg-slate-50/60 dark:border-white/[0.025] dark:hover:bg-white/[0.015]',
                            isActiveDepth && 'bg-violet-50/60 dark:bg-white/[0.02]',
                          )}
                        >
                          <td
                            className="py-2 pr-2"
                            style={{ paddingLeft: `${12 + row.depth * 20}px` }}
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              {/* Chevron collapse/expand */}
                              {hasKids ? (
                                <button
                                  type="button"
                                  onClick={() => toggleCollapse(row.id)}
                                  className="shrink-0 text-slate-500 hover:text-slate-700 dark:text-neutral-500 dark:hover:text-neutral-200 transition-colors p-0.5 -ml-0.5 rounded"
                                >
                                  <ChevronRight
                                    size={12}
                                    className={cn(
                                      'transition-transform duration-150',
                                      !isCollapsed && 'rotate-90',
                                    )}
                                  />
                                </button>
                              ) : (
                                /* Enfant sans sous-groupes : tiret d'indentation */
                                <span className="shrink-0 w-4 flex justify-center text-slate-400 dark:text-neutral-700 text-[10px]">
                                  ╴
                                </span>
                              )}

                              {/* Pastille colorée par niveau */}
                              <div
                                className="shrink-0 rounded-sm"
                                style={{
                                  width: 3,
                                  height: row.depth === 0 ? 14 : 10,
                                  backgroundColor: depthColor,
                                  opacity: isActiveDepth ? 1 : 0.4,
                                }}
                              />

                              <span
                                className={cn(
                                  'truncate max-w-[160px] ml-0.5',
                                  row.depth === 0 ? 'text-slate-800 dark:text-neutral-200 font-medium text-xs' : 'text-slate-600 dark:text-neutral-400 text-[11px]',
                                )}
                              >
                                {row.label}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-neutral-600 shrink-0 tabular-nums ml-1">
                                {row.items.length}
                              </span>
                            </div>
                          </td>
                          {visibleTotals.map((prop: any) => {
                            const totalType = getTotalTypeForProp(prop) || 'count';
                            const meta = getMeta(totalType);
                            const total = calculateTotal(prop.id, row.items, totalType);
                            const formatted = formatTotal(prop.id, total, totalType);
                            const { visible, hint } = splitFilterHint(formatted || '');
                            const accentColor = prop?.color;
                            const valStyle = accentColor ? { color: accentColor } : undefined;
                            const el = (
                              <span
                                className={cn(
                                  'tabular-nums',
                                  row.depth === 0 ? 'text-xs font-medium' : 'text-[11px]',
                                  meta.valueColorClass,
                                )}
                                style={valStyle}
                              >
                                {visible || '—'}
                              </span>
                            );
                            return (
                              <td key={prop.id} className="px-3 py-2">
                                {hint ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>{el}</TooltipTrigger>
                                    <TooltipContent side="top">{hint}</TooltipContent>
                                  </Tooltip>
                                ) : el}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TooltipProvider>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default TotalsWidget;
