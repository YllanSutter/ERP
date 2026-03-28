import React from 'react';
import {
  Sigma,
  Hash,
  BarChart2,
  TrendingDown,
  TrendingUp,
  SquareCheck,
  Square,
  Link2,
  PieChart,
  Fingerprint,
  type LucideIcon,
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { Property } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─────────────────────────────────────────────────────────────────────────────
// Méta-données (identiques à TotalsBar)
// ─────────────────────────────────────────────────────────────────────────────
interface TotalMeta {
  Icon: LucideIcon;
  label: string;
  iconColorClass: string;
  valueColorClass: string;
}

const TOTAL_META: Record<string, TotalMeta> = {
  sum:          { Icon: Sigma,        label: 'Somme',      iconColorClass: 'text-violet-500 dark:text-violet-400', valueColorClass: 'text-violet-700 dark:text-violet-300' },
  avg:          { Icon: BarChart2,    label: 'Moyenne',    iconColorClass: 'text-blue-500 dark:text-blue-400',     valueColorClass: 'text-blue-700 dark:text-blue-300' },
  min:          { Icon: TrendingDown, label: 'Minimum',    iconColorClass: 'text-emerald-500 dark:text-emerald-400', valueColorClass: 'text-emerald-700 dark:text-emerald-300' },
  max:          { Icon: TrendingUp,   label: 'Maximum',    iconColorClass: 'text-orange-500 dark:text-orange-400', valueColorClass: 'text-orange-700 dark:text-orange-300' },
  count:        { Icon: Hash,         label: 'Nb lignes',  iconColorClass: 'text-neutral-400 dark:text-neutral-500', valueColorClass: 'text-neutral-700 dark:text-neutral-300' },
  unique:       { Icon: Fingerprint,  label: 'Uniques',    iconColorClass: 'text-teal-500 dark:text-teal-400',     valueColorClass: 'text-teal-700 dark:text-teal-300' },
  'count-true': { Icon: SquareCheck,  label: 'Cochés',     iconColorClass: 'text-green-500 dark:text-green-400',   valueColorClass: 'text-green-700 dark:text-green-300' },
  'count-false':{ Icon: Square,       label: 'Non cochés', iconColorClass: 'text-rose-400 dark:text-rose-400',     valueColorClass: 'text-rose-600 dark:text-rose-300' },
  'count-linked':{ Icon: Link2,       label: 'Liés',       iconColorClass: 'text-indigo-500 dark:text-indigo-400', valueColorClass: 'text-indigo-700 dark:text-indigo-300' },
};

const LINKED_PROGRESS_META: TotalMeta = {
  Icon: PieChart, label: 'Payé / Reste',
  iconColorClass: 'text-violet-500 dark:text-violet-400',
  valueColorClass: 'text-violet-700 dark:text-violet-300',
};

const DEFAULT_META: TotalMeta = {
  Icon: Hash, label: 'Total',
  iconColorClass: 'text-neutral-400 dark:text-neutral-500',
  valueColorClass: 'text-neutral-700 dark:text-neutral-300',
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface TotalsWidgetProps {
  displayProperties: Property[];
  items: any[];
  totalFields: Record<string, string>;
  calculateTotal: (fieldId: string, items: any[], totalType: string) => any;
  formatTotal: (fieldId: string, total: any, totalType: string) => string;
  groupedSections?: Array<{ path?: string; label: string; items: any[]; depth: number; propertyName: string }>;
  /** Clé de persistance pour expand/collapse */
  persistKey?: string;
  className?: string;
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

// ─────────────────────────────────────────────────────────────────────────────
// Composant
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
}) => {
  const activeTotals = displayProperties.filter((p: any) => totalFields[p.id]);

  const normalizeTotalType = React.useCallback((rawType: string) => {
    if (typeof rawType !== 'string') return rawType;
    if (!rawType.startsWith('number-filter:')) return rawType;
    return rawType.split(':')[1] || rawType;
  }, []);

  const splitFilterHint = React.useCallback((text: string) => {
    const match = String(text || '').match(/^(.*)\s\((hors .+)\)$/i);
    if (!match) return { visible: text, hint: '' };
    return { visible: match[1], hint: match[2] };
  }, []);

  const getMeta = React.useCallback(
    (totalType: string): TotalMeta => {
      if (typeof totalType === 'string' && totalType.startsWith('linked-progress:')) return LINKED_PROGRESS_META;
      return TOTAL_META[normalizeTotalType(totalType)] ?? DEFAULT_META;
    },
    [normalizeTotalType]
  );

  // ── Persist expand/collapse ───────────────────────────────────────────────
  const [expanded, setExpanded] = React.useState(true);

  React.useEffect(() => {
    if (!persistKey) return;
    try {
      const raw = localStorage.getItem(`totalswidget:${persistKey}:expanded`);
      if (raw === '0') setExpanded(false);
      if (raw === '1') setExpanded(true);
    } catch { /* no-op */ }
  }, [persistKey]);

  React.useEffect(() => {
    if (!persistKey) return;
    try {
      localStorage.setItem(`totalswidget:${persistKey}:expanded`, expanded ? '1' : '0');
    } catch { /* no-op */ }
  }, [persistKey, expanded]);

  // ── Arbre de groupes ──────────────────────────────────────────────────────
  const groupedTree = React.useMemo(() => {
    const raw = groupedSections || [];
    type Node = { id: string; label: string; items: any[]; depth: number; propertyName: string; children: Node[] };
    const roots: Node[] = [];
    const stack: Node[] = [];

    raw.forEach((section, index) => {
      const node: Node = {
        id: section.path || `section-${index}`,
        label: section.label,
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
  }, [groupedSections]);

  const flatRows = React.useMemo(() => flattenTree(groupedTree), [groupedTree]);
  const hasGroups = flatRows.length > 0;

  if (activeTotals.length === 0 || items.length === 0) return null;

  // ── Rendu d'une valeur ────────────────────────────────────────────────────
  const renderValue = (prop: any, sourceItems: any[]) => {
    const totalType = totalFields[prop.id];
    const meta = getMeta(totalType);
    const total = calculateTotal(prop.id, sourceItems, totalType);
    const formatted = formatTotal(prop.id, total, totalType);
    const { visible, hint } = splitFilterHint(formatted || '');
    const accentColor = prop?.color;
    const valueStyle = accentColor ? { color: accentColor } : undefined;

    const el = (
      <span className={`font-semibold tabular-nums text-xs ${meta.valueColorClass}`} style={valueStyle}>
        {visible || '—'}
      </span>
    );

    if (!hint) return el;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{el}</TooltipTrigger>
        <TooltipContent side="top">{hint}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div
      className={`rounded-xl border border-black/8 dark:border-white/8 bg-white/70 dark:bg-neutral-900/60 shadow-sm overflow-hidden mb-3 ${className}`}
    >
      {/* En-tête */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-black/6 dark:border-white/6 bg-neutral-50/80 dark:bg-neutral-800/50">
        <Sigma size={12} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 select-none">
          Vue d'ensemble
        </span>
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
          — {items.length} élément{items.length > 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto inline-flex items-center justify-center h-5 w-5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          aria-label={expanded ? 'Réduire' : 'Développer'}
        >
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`text-neutral-400 transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`}
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            {/* En-têtes colonnes */}
            <thead>
              <tr className="border-b border-black/6 dark:border-white/6">
                {hasGroups && (
                  <th className="px-4 py-2 text-left font-medium text-neutral-400 dark:text-neutral-500 w-48 min-w-[130px] bg-neutral-50/80 dark:bg-neutral-800/40">
                    Groupe
                  </th>
                )}
                <TooltipProvider>
                  {activeTotals.map((prop: any) => {
                    const meta = getMeta(totalFields[prop.id]);
                    const { Icon, iconColorClass } = meta;
                    const PropIcon = (Icons as any)[prop.icon] || Icon;
                    const accentStyle = prop?.color ? { color: prop.color } : undefined;
                    return (
                      <th
                        key={prop.id}
                        className="px-3 py-2 text-left font-medium min-w-[90px] bg-neutral-50/80 dark:bg-neutral-800/40"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 cursor-default">
                              <PropIcon size={11} className={iconColorClass} style={accentStyle} />
                              <span className="text-neutral-600 dark:text-neutral-300 truncate max-w-[100px]">
                                {prop.name}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">{meta.label}</TooltipContent>
                        </Tooltip>
                      </th>
                    );
                  })}
                </TooltipProvider>
              </tr>
            </thead>

            <tbody>
              {/* Ligne Total général */}
              <tr className="border-b border-black/6 dark:border-white/6 bg-neutral-50/40 dark:bg-neutral-800/20">
                {hasGroups && (
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Sigma size={9} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                      <span className="font-semibold text-neutral-700 dark:text-neutral-200">Total</span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">({items.length})</span>
                    </div>
                  </td>
                )}
                <TooltipProvider>
                  {activeTotals.map((prop: any) => (
                    <td key={prop.id} className="px-3 py-2.5">
                      {renderValue(prop, items)}
                    </td>
                  ))}
                </TooltipProvider>
              </tr>

              {/* Lignes par groupe */}
              {flatRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-neutral-50/60 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td
                    className="py-2 text-neutral-600 dark:text-neutral-300"
                    style={{ paddingLeft: `${16 + row.depth * 18}px` }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {row.depth > 0 && (
                        <span className="text-neutral-300 dark:text-neutral-600 select-none shrink-0" style={{ fontSize: 10 }}>
                          └
                        </span>
                      )}
                      <span className="truncate max-w-[160px]">{row.label}</span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">
                        ({row.items.length})
                      </span>
                    </div>
                  </td>
                  <TooltipProvider>
                    {activeTotals.map((prop: any) => (
                      <td key={prop.id} className="px-3 py-2">
                        {renderValue(prop, row.items)}
                      </td>
                    ))}
                  </TooltipProvider>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TotalsWidget;
