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
  groupedSections?: Array<{ path?: string; label: string; items: any[]; depth: number; propertyName: string }>;
  persistKey?: string;
  className?: string;
  /** Chemin actif du tableau (ex: "2026/2026-03/testbundle") pour pré-sélectionner */
  contextPath?: string;
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

// ─────────────────────────────────────────────────────────────────────────────
// Module types
// ─────────────────────────────────────────────────────────────────────────────
type ModuleKey = 'stats' | 'bar' | 'donut' | 'table';

interface DepthLevel { depth: number; propertyName: string }

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

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────
const TotalsWidget: React.FC<TotalsWidgetProps> = ({
  displayProperties,
  items,
  totalFields,
  calculateTotal,
  formatTotal,
  groupedSections,
  persistKey,
  className = '',
  contextPath,
}) => {
  const activeTotals = displayProperties.filter((p: any) => totalFields[p.id]);

  // ── Groupes aplatis ───────────────────────────────────────────────────────
  const groupedTree = React.useMemo(
    () => buildGroupedTree(groupedSections || []),
    [groupedSections]
  );
  const flatRows = React.useMemo(() => flattenTree(groupedTree), [groupedTree]);
  const hasGroups = flatRows.length > 0;

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
  const [modules, setModules] = React.useState<Record<ModuleKey, boolean>>({
    stats: true, bar: true, donut: hasGroups, table: false,
  });
  const [activeMetricId, setActiveMetricId] = React.useState<string>('');
  const [activeLevelDepth, setActiveLevelDepth] = React.useState<'overview' | number>('overview');
  // Groupe sélectionné par profondeur : { 0: "2026", 1: "2026/2026-03", ... }
  const [selectedByDepth, setSelectedByDepth] = React.useState<Record<number, string | null>>({});
  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => { setCollapsedGroups(new Set(rowsWithChildren)); }, [rowsWithChildren]);
  React.useEffect(() => {
    if (!activeMetricId && activeTotals.length > 0) setActiveMetricId(activeTotals[0].id);
  }, [activeTotals, activeMetricId]);

  // Pré-sélection depuis le chemin actif du tableau
  React.useEffect(() => {
    if (!flatRows.length) return;

    console.log('[TotalsWidget][context-sync] start', {
      contextPath,
      itemsCount: items.length,
      flatRowsCount: flatRows.length,
    });

    if (!contextPath) {
      setSelectedByDepth({});
      setActiveLevelDepth('overview');
      console.log('[TotalsWidget][context-sync] no contextPath -> overview');
      return;
    }

    // 0) Si contextPath est un parent (ex: mois), essayer d'identifier
    //    automatiquement le bon enfant (ex: bundle) via les items affichés.
    const currentItemKeys = new Set(
      (items || []).map((it: any) => String(it?.id ?? it?._id ?? ''))
    );
    const hasStableItemKeys = currentItemKeys.size > 0 && !currentItemKeys.has('');

    const descendantCandidates = flatRows.filter(
      (r) => r.id === contextPath || r.id.startsWith(`${contextPath}/`)
    );

    console.log('[TotalsWidget][context-sync] candidates', {
      descendantCandidates: descendantCandidates.map((r) => ({ id: r.id, depth: r.depth, items: r.items.length })),
      hasStableItemKeys,
    });

    let inferredFromItems: FlatRow | null = null;
    if (descendantCandidates.length > 0 && items.length > 0) {
      inferredFromItems = descendantCandidates
        .filter((r) => {
          if (r.items.length !== items.length) return false;
          if (hasStableItemKeys) {
            return r.items.every((it: any) => currentItemKeys.has(String(it?.id ?? it?._id ?? '')));
          }
          return true;
        })
        .sort((a, b) => b.depth - a.depth || b.id.length - a.id.length)[0] ?? null;
    }

    console.log('[TotalsWidget][context-sync] inferredFromItems', inferredFromItems ? {
      id: inferredFromItems.id,
      depth: inferredFromItems.depth,
      items: inferredFromItems.items.length,
    } : null);

    // 1) Match inféré par les items visibles
    let targetRow = inferredFromItems;

    // 2) Match exact (id === contextPath)
    if (!targetRow) targetRow = flatRows.find((r) => r.id === contextPath) ?? null;

    // 3) Fallback robuste: plus long préfixe de contextPath
    if (!targetRow) {
      targetRow = flatRows
        .filter((r) => contextPath === r.id || contextPath.startsWith(`${r.id}/`))
        .sort((a, b) => b.id.length - a.id.length)[0] ?? null;
    }

    // 4) Dernier fallback historique (construction segmentée)
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
      console.log('[TotalsWidget][context-sync] no targetRow -> overview');
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

    console.log('[TotalsWidget][context-sync] applied', {
      targetRow: { id: targetRow.id, depth: targetRow.depth, items: targetRow.items.length },
      selectedByDepth: newSelected,
      activeLevelDepth: targetRow.depth,
    });
  }, [contextPath, flatRows, parentMap, items]);

  // Restore localStorage
  React.useEffect(() => {
    if (!persistKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`totalswidget2:${persistKey}`) || '{}');
      if (saved.expanded !== undefined) setExpanded(saved.expanded);
      if (saved.modules) setModules((p) => ({ ...p, ...saved.modules }));
      if (saved.activeMetricId) setActiveMetricId(saved.activeMetricId);
      if (saved.activeLevelDepth !== undefined) setActiveLevelDepth(saved.activeLevelDepth);
    } catch { /* no-op */ }
  }, [persistKey]);

  React.useEffect(() => {
    if (!persistKey) return;
    try {
      localStorage.setItem(`totalswidget2:${persistKey}`,
        JSON.stringify({ expanded, modules, activeMetricId, activeLevelDepth }));
    } catch { /* no-op */ }
  }, [persistKey, expanded, modules, activeMetricId, activeLevelDepth]);

  // ── Garde ─────────────────────────────────────────────────────────────────
  if (activeTotals.length === 0 || items.length === 0) return null;

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
  const statCards = activeTotals.map((prop: any) => {
    const totalType = totalFields[prop.id];
    const meta = getMeta(totalType);
    const total = calculateTotal(prop.id, contextItems, totalType);
    const formatted = formatTotal(prop.id, total, totalType);
    const { visible } = splitFilterHint(formatted || '');
    const PropIcon = (Icons as any)[prop.icon] || meta.Icon;
    const accent = prop?.color || meta.accentHex;

    // Sparkbar : distribution des groupes de l'onglet
    const sparkData = hasGroups
      ? contextChildRows.map((r) => {
          const raw = calculateTotal(prop.id, r.items, totalType);
          const numeric = toRawNumber(raw);
          const formattedValue = formatTotal(prop.id, raw, totalType);
          const { visible: visibleValue } = splitFilterHint(formattedValue || '');
          return {
            id: r.id,
            name: r.label,
            numeric,
            visibleValue: visibleValue || String(numeric),
            count: r.items.length,
          };
        })
      : [];
    return { prop, meta, total, visible, PropIcon, accent, sparkData, totalType };
  });

  // ── Données bar chart ─────────────────────────────────────────────────────
  const activeProp = activeTotals.find((p: any) => p.id === activeMetricId) || activeTotals[0];
  const barData = React.useMemo(() => {
    if (!activeProp || !hasGroups) return [];
    const totalType = totalFields[activeProp.id];
    return contextChildRows
      .map((row, i) => {
        const raw = calculateTotal(activeProp.id, row.items, totalType);
        const numVal = toRawNumber(raw);
        const formatted = formatTotal(activeProp.id, raw, totalType);
        const { visible } = splitFilterHint(formatted || '');
        const label = cleanLabel(toDisplayLabel(row.label, `Objet ${i + 1}`)) || `Objet ${i + 1}`;
        return {
          name: label,
          value: numVal,
          displayValue: visible,
          fill: CHART_PALETTE[i % CHART_PALETTE.length],
        };
      })
      .slice(0, 12);
  }, [activeProp, contextChildRows, totalFields, calculateTotal, formatTotal, hasGroups]);

  // ── Données donut (suit la métrique active) ───────────────────────────────
  const donutData = React.useMemo(() => {
    if (!hasGroups || !activeProp) return [];
    const totalType = totalFields[activeProp.id];
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
  }, [contextChildRows, hasGroups, activeProp, totalFields, calculateTotal]);

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

  const activeModuleCount = Object.values(modules).filter(Boolean).length;

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
          {/* Toggles de modules */}
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

      {/* ── Onglet niveau (Vue d'ensemble / Année / Mois / Bundle…) ─────── */}
      {hasGroups && (
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
                  onClick={() => setActiveLevelDepth(id)}
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
                onClick={() => setSelectedByDepth((p) => ({ ...p, [levelDepthNum]: null }))}
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
                    onClick={() => setSelectedByDepth((p) => ({ ...p, [levelDepthNum]: isActive ? null : row.id }))}
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
                  {/* Bande colorée gauche */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[3px]"
                    style={{ backgroundColor: accent }}
                  />

                  <div className="pl-4 pr-3 py-3">
                    {/* Label */}
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

                    {/* Valeur */}
                    <div className="text-xl font-bold tabular-nums text-slate-900 dark:text-white truncate">
                      {visible || '—'}
                    </div>

                    {/* Mini sparkbars */}
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
                                      <button
                                        type="button"
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
                    {activeTotals.map((prop: any) => {
                      const meta = getMeta(totalFields[prop.id]);
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
                        stroke={activeProp?.color || getMeta(totalFields[activeProp?.id]).accentHex}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: activeProp?.color || getMeta(totalFields[activeProp?.id]).accentHex, strokeWidth: 0 }}
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
                          normalizeTotalType(totalFields[activeProp.id])
                        );
                        return donutDataSafe.slice(0, 8).map((entry) => {
                          if (!entry?.name || isObjectLabel(entry.name)) return null;
                          const pct = totalDonutValue > 0 ? Math.round((entry.value / totalDonutValue) * 100) : 0;
                          const displayValue = isNumericMetric
                            ? formatTotal(activeProp!.id, entry.value, totalFields[activeProp!.id])
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
                      {activeTotals.map((prop: any) => {
                        const meta = getMeta(totalFields[prop.id]);
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
                      {activeTotals.map((prop: any) => {
                        const totalType = totalFields[prop.id];
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
                          {activeTotals.map((prop: any) => {
                            const totalType = totalFields[prop.id];
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
