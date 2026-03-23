import React from 'react';
import {
  Sigma,
  ChevronDown,
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
import { Property } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─────────────────────────────────────────────────────────────────────────────
// Méta-données par type de total
// ─────────────────────────────────────────────────────────────────────────────
interface TotalMeta {
  Icon: LucideIcon;
  label: string;
  iconColorClass: string;
  bgClass: string;
  borderClass: string;
  valueColorClass: string;
}

const TOTAL_META: Record<string, TotalMeta> = {
  sum: {
    Icon: Sigma,
    label: 'Somme',
    iconColorClass: 'text-violet-500 dark:text-violet-400',
    bgClass: 'bg-violet-50 dark:bg-violet-950/30',
    borderClass: 'border-violet-200 dark:border-violet-800/60',
    valueColorClass: 'text-violet-700 dark:text-violet-300',
  },
  avg: {
    Icon: BarChart2,
    label: 'Moyenne',
    iconColorClass: 'text-blue-500 dark:text-blue-400',
    bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    borderClass: 'border-blue-200 dark:border-blue-800/60',
    valueColorClass: 'text-blue-700 dark:text-blue-300',
  },
  min: {
    Icon: TrendingDown,
    label: 'Minimum',
    iconColorClass: 'text-emerald-500 dark:text-emerald-400',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderClass: 'border-emerald-200 dark:border-emerald-800/60',
    valueColorClass: 'text-emerald-700 dark:text-emerald-300',
  },
  max: {
    Icon: TrendingUp,
    label: 'Maximum',
    iconColorClass: 'text-orange-500 dark:text-orange-400',
    bgClass: 'bg-orange-50 dark:bg-orange-950/30',
    borderClass: 'border-orange-200 dark:border-orange-800/60',
    valueColorClass: 'text-orange-700 dark:text-orange-300',
  },
  count: {
    Icon: Hash,
    label: 'Nb lignes',
    iconColorClass: 'text-neutral-400 dark:text-neutral-500',
    bgClass: 'bg-neutral-100 dark:bg-neutral-800/40',
    borderClass: 'border-neutral-200 dark:border-neutral-700/60',
    valueColorClass: 'text-neutral-700 dark:text-neutral-300',
  },
  unique: {
    Icon: Fingerprint,
    label: 'Uniques',
    iconColorClass: 'text-teal-500 dark:text-teal-400',
    bgClass: 'bg-teal-50 dark:bg-teal-950/30',
    borderClass: 'border-teal-200 dark:border-teal-800/60',
    valueColorClass: 'text-teal-700 dark:text-teal-300',
  },
  'count-true': {
    Icon: SquareCheck,
    label: 'Cochés',
    iconColorClass: 'text-green-500 dark:text-green-400',
    bgClass: 'bg-green-50 dark:bg-green-950/30',
    borderClass: 'border-green-200 dark:border-green-800/60',
    valueColorClass: 'text-green-700 dark:text-green-300',
  },
  'count-false': {
    Icon: Square,
    label: 'Non cochés',
    iconColorClass: 'text-rose-400 dark:text-rose-400',
    bgClass: 'bg-rose-50 dark:bg-rose-950/30',
    borderClass: 'border-rose-200 dark:border-rose-800/60',
    valueColorClass: 'text-rose-600 dark:text-rose-300',
  },
  'count-linked': {
    Icon: Link2,
    label: 'Liés',
    iconColorClass: 'text-indigo-500 dark:text-indigo-400',
    bgClass: 'bg-indigo-50 dark:bg-indigo-950/30',
    borderClass: 'border-indigo-200 dark:border-indigo-800/60',
    valueColorClass: 'text-indigo-700 dark:text-indigo-300',
  },
};

const LINKED_PROGRESS_META: TotalMeta = {
  Icon: PieChart,
  label: 'Payé / Reste',
  iconColorClass: 'text-violet-500 dark:text-violet-400',
  bgClass: 'bg-violet-50 dark:bg-violet-950/30',
  borderClass: 'border-violet-200 dark:border-violet-800/60',
  valueColorClass: 'text-violet-700 dark:text-violet-300',
};

const DEFAULT_META: TotalMeta = {
  Icon: Hash,
  label: 'Total',
  iconColorClass: 'text-neutral-400 dark:text-neutral-500',
  bgClass: 'bg-neutral-100 dark:bg-neutral-800/40',
  borderClass: 'border-neutral-200 dark:border-neutral-700/60',
  valueColorClass: 'text-neutral-700 dark:text-neutral-300',
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface TotalsBarProps {
  /** Propriétés visibles dans le même ordre que les colonnes */
  displayProperties: Property[];
  /** Éléments sur lesquels calculer les totaux (globaux) */
  items: any[];
  /** Map fieldId → type de total (ex: 'sum', 'avg', 'count-true', …) */
  totalFields: Record<string, string>;
  /** Fonction de calcul (provient de TableView) */
  calculateTotal: (fieldId: string, items: any[], totalType: string) => any;
  /** Fonction de formatage (provient de TableView) */
  formatTotal: (fieldId: string, total: any, totalType: string) => string;
  /**
   * 'inline' : barre compacte dans un conteneur existant (usage dans GroupRenderer)
   * 'section' : bloc visuel dédié au-dessus du tableau avec titre et cartes larges
   */
  variant?: 'inline' | 'section';
  /**
   * Sous-sections par groupe (variant 'section' uniquement).
   * Chaque entrée donne un label + les items du groupe.
   */
  groupedSections?: Array<{ path?: string; label: string; items: any[]; depth: number; propertyName: string }>;
  /** Chemin de groupe racine actif (lié à l’onglet de la vue du bas) */
  activeRootPath?: string;
  /** Chemin de sous-groupe actif (lié au sous-onglet imbriqué de la vue du bas) */
  activeSubPath?: string;
  /** Masquer les sélecteurs d’onglets en haut et suivre la vue du bas */
  hideGroupSelectors?: boolean;
  /** Autoriser l'utilisateur à afficher/masquer les onglets en haut */
  allowGroupSelectorToggle?: boolean;
  /** Clé de persistance pour mémoriser l'état ouvert/fermé */
  persistKey?: string;
  /** Mode visuel pour le rendu inline */
  inlineMode?: 'default' | 'plain';
  /** Classes CSS supplémentaires sur le wrapper */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────
const TotalsBar: React.FC<TotalsBarProps> = ({
  displayProperties,
  items,
  totalFields,
  calculateTotal,
  formatTotal,
  variant = 'inline',
  groupedSections,
  activeRootPath,
  activeSubPath,
  hideGroupSelectors = false,
  allowGroupSelectorToggle = false,
  persistKey,
  inlineMode = 'default',
  className = '',
}) => {
  const activeTotals = displayProperties.filter((p: any) => totalFields[p.id]);

  const normalizeTotalTypeForMeta = React.useCallback((rawType: string) => {
    if (typeof rawType !== 'string') return rawType;
    if (!rawType.startsWith('number-filter:')) return rawType;
    const parts = rawType.split(':');
    return parts[1] || rawType;
  }, []);

  if (activeTotals.length === 0 || items.length === 0) return null;

  const renderCards = (sourceItems: any[]) => (
    activeTotals.map((prop: any) => {
      const totalType = totalFields[prop.id];
      const resolvedTotalType = normalizeTotalTypeForMeta(totalType);
      const isLinkedProgress =
        typeof totalType === 'string' && totalType.startsWith('linked-progress:');

      const meta = isLinkedProgress
        ? LINKED_PROGRESS_META
        : (TOTAL_META[resolvedTotalType] ?? DEFAULT_META);

      const { Icon, label, iconColorClass, bgClass, borderClass, valueColorClass } = meta;

      const total = calculateTotal(prop.id, sourceItems, totalType);
      const formatted = formatTotal(prop.id, total, totalType);

      return (
        <div
          key={prop.id}
          className={`flex items-center gap-2.5 px-1 rounded-sm py-1 border ${borderClass} ${bgClass} min-w-[150px] max-w-[320px]`}
        >
          <div className={`shrink-0 p-1 rounded-md bg-white/70 dark:bg-black/20 border ${borderClass}`}>
            <Icon size={8} className={iconColorClass} />
          </div>

          <div className="min-w-0">
            <span className="block text-[11px] leading-none whitespace-nowrap overflow-hidden text-ellipsis">
              <span className="font-semibold text-neutral-600 dark:text-neutral-300">{prop.name}</span>
              <span className="mx-1 text-neutral-400 dark:text-neutral-500">·</span>
              <span className="mx-1 text-neutral-400 dark:text-neutral-500">·</span>
              <span className={`font-extrabold ${valueColorClass}`}>{formatted || '—'}</span>
            </span>
          </div>
        </div>
      );
    })
  );

  const groupedTree = React.useMemo(() => {
    const raw = groupedSections || [];
    type Node = {
      id: string;
      label: string;
      items: any[];
      depth: number;
      propertyName: string;
      children: Node[];
    };

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

  const [activeRootId, setActiveRootId] = React.useState<string>('');
  const [activeSubId, setActiveSubId] = React.useState<string>('');
  const [isSectionExpanded, setIsSectionExpanded] = React.useState(true);
  const [showGroupSelectors, setShowGroupSelectors] = React.useState(!hideGroupSelectors);

  React.useEffect(() => {
    if (!persistKey) return;
    try {
      const raw = localStorage.getItem(`totalsbar:${persistKey}:expanded`);
      if (raw === '0') setIsSectionExpanded(false);
      if (raw === '1') setIsSectionExpanded(true);

      if (allowGroupSelectorToggle) {
        const showSelectorsRaw = localStorage.getItem(`totalsbar:${persistKey}:show-group-selectors`);
        if (showSelectorsRaw === '0') setShowGroupSelectors(false);
        if (showSelectorsRaw === '1') setShowGroupSelectors(true);
      }
    } catch {
      // no-op
    }
  }, [persistKey, allowGroupSelectorToggle]);

  React.useEffect(() => {
    if (!persistKey) return;
    try {
      localStorage.setItem(`totalsbar:${persistKey}:expanded`, isSectionExpanded ? '1' : '0');

      if (allowGroupSelectorToggle) {
        localStorage.setItem(`totalsbar:${persistKey}:show-group-selectors`, showGroupSelectors ? '1' : '0');
      }
    } catch {
      // no-op
    }
  }, [persistKey, isSectionExpanded, allowGroupSelectorToggle, showGroupSelectors]);

  React.useEffect(() => {
    if (allowGroupSelectorToggle) return;
    setShowGroupSelectors(!hideGroupSelectors);
  }, [allowGroupSelectorToggle, hideGroupSelectors]);

  const effectiveHideGroupSelectors = allowGroupSelectorToggle ? !showGroupSelectors : hideGroupSelectors;

  React.useEffect(() => {
    const firstRoot = groupedTree[0];
    if (!firstRoot) {
      setActiveRootId('');
      setActiveSubId('');
      return;
    }

    if (activeRootPath && groupedTree.some((r) => r.id === activeRootPath)) {
      if (activeRootId !== activeRootPath) setActiveRootId(activeRootPath);
      return;
    }

    if (!groupedTree.some((r) => r.id === activeRootId)) {
      setActiveRootId(firstRoot.id);
    }
  }, [groupedTree, activeRootId, activeRootPath]);

  const activeRoot = React.useMemo(
    () => groupedTree.find((r) => r.id === activeRootId) || groupedTree[0],
    [groupedTree, activeRootId]
  );

  React.useEffect(() => {
    const firstSub = activeRoot?.children?.[0];
    if (!activeRoot) {
      setActiveSubId('');
      return;
    }

    if (!activeRoot.children?.length) {
      setActiveSubId('');
      return;
    }

    if (activeSubPath && activeRoot.children.some((s) => s.id === activeSubPath)) {
      if (activeSubId !== activeSubPath) setActiveSubId(activeSubPath);
      return;
    }

    if (!activeRoot.children.some((s) => s.id === activeSubId)) {
      setActiveSubId(firstSub?.id || '');
    }
  }, [activeRoot, activeSubId, activeSubPath]);

  const collectLeafNodes = React.useCallback((node: any): any[] => {
    if (!node?.children?.length) return node ? [node] : [];
    return node.children.flatMap((child: any) => collectLeafNodes(child));
  }, []);

  // ─── Mode SECTION : bloc dédié au-dessus du tableau ──────────────────────
  if (variant === 'section') {
    const hasGroupedSections = groupedTree.length > 0;
    const activeSub = activeRoot?.children?.find((s) => s.id === activeSubId);
    const lastLevelColumns = activeSub
      ? collectLeafNodes(activeSub)
      : (activeRoot ? collectLeafNodes(activeRoot) : []);

    return (
      <div className={`rounded-xl border border-black/8 dark:border-white/8 bg-white/70 dark:bg-neutral-900/60 shadow-sm overflow-hidden mb-3 ${className}`}>
        {/* En-tête de section */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/6 dark:border-white/6 bg-neutral-50/80 dark:bg-neutral-800/50">
          <Sigma size={13} className="text-neutral-400 dark:text-neutral-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 select-none">
            Totaux
          </span>
          <span className="ml-1 text-[10px] text-neutral-400 dark:text-neutral-500">
            — {items.length} élément{items.length > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => setIsSectionExpanded((v) => !v)}
            className="ml-auto inline-flex items-center justify-center h-6 w-6 rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
            aria-label={isSectionExpanded ? 'Masquer les totaux' : 'Afficher les totaux'}
            title={isSectionExpanded ? 'Masquer les totaux' : 'Afficher les totaux'}
          >
            <ChevronDown
              size={14}
              className={`text-neutral-500 dark:text-neutral-300 transition-transform duration-200 ${isSectionExpanded ? 'rotate-0' : '-rotate-90'}`}
            />
          </button>
          {hasGroupedSections && allowGroupSelectorToggle && (
            <button
              type="button"
              onClick={() => setShowGroupSelectors((v) => !v)}
              className="inline-flex items-center ml-2 px-2 h-6 rounded-md border border-black/10 dark:border-white/10 bg-white/70 dark:bg-neutral-900/70 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors text-[10px] font-semibold text-neutral-600 dark:text-neutral-300"
              aria-label={showGroupSelectors ? 'Masquer les onglets des groupes en haut' : 'Afficher les onglets des groupes en haut'}
              title={showGroupSelectors ? 'Masquer les onglets des groupes en haut' : 'Afficher les onglets des groupes en haut'}
            >
              Onglets haut {showGroupSelectors ? 'ON' : 'OFF'}
            </button>
          )}
        </div>

        {isSectionExpanded && (
        <div className="divide-y divide-black/5 dark:divide-white/5">
          <div className="px-4 py-3">
            {hasGroupedSections && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-2.5 select-none">
                Total général
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {renderCards(items)}
            </div>
          </div>

          {hasGroupedSections && (
            <div className="px-3 py-3">
              <Tabs value={activeRoot?.id} onValueChange={setActiveRootId} className="w-full">
                {!effectiveHideGroupSelectors && (
                  <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                    {groupedTree.map((root) => (
                      <TabsTrigger
                        key={root.id}
                        value={root.id}
                        className="rounded-full border border-black/10 dark:border-white/10 bg-white/60 px-3 py-1.5 text-xs dark:bg-white/5"
                      >
                        {root.label} ({root.items.length})
                      </TabsTrigger>
                    ))}
                  </TabsList>
                )}

                {groupedTree.map((root) => (
                  <TabsContent key={root.id} value={root.id} className="mt-3 border-0 p-0">
                    {root.children.length > 0 && !effectiveHideGroupSelectors && (
                      <Tabs value={activeSubId} onValueChange={setActiveSubId} className="w-full">
                        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                          {root.children.map((sub) => (
                            <TabsTrigger
                              key={sub.id}
                              value={sub.id}
                              className="rounded-full border border-black/10 dark:border-white/10 bg-white/60 px-3 py-1 text-[11px] dark:bg-white/5"
                            >
                              {sub.label} ({sub.items.length})
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </Tabs>
                    )}

                    {root.id === activeRoot?.id && (
                      <div className="mt-3 rounded-xl border border-black/8 dark:border-white/8 bg-white/60 dark:bg-neutral-900/40 p-3">
                        <div className="mb-2 flex items-center gap-1.5">
                          {root.propertyName && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                              {root.propertyName}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 truncate">
                            {root.label}
                          </span>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">({root.items.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {renderCards(root.items)}
                        </div>
                      </div>
                    )}

                    {root.id === activeRoot?.id && activeSub && activeSub.children.length > 0 && (
                      <div className="mt-3 rounded-xl border border-black/8 dark:border-white/8 bg-white/60 dark:bg-neutral-900/40 p-3">
                        <div className="mb-2 flex items-center gap-1.5">
                          {activeSub.propertyName && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                              {activeSub.propertyName}
                            </span>
                          )}
                          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 truncate">
                            {activeSub.label}
                          </span>
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500">({activeSub.items.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {renderCards(activeSub.items)}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 grid gap-3 grid-cols-1">
                      {(root.id === activeRoot?.id ? lastLevelColumns : collectLeafNodes(root)).map((leaf) => (
                        <div
                          key={leaf.id}
                          className="rounded-xl border border-black/8 dark:border-white/8 bg-white/60 dark:bg-neutral-900/40 p-3"
                        >
                          <div className="mb-2 flex items-center gap-1.5">
                            {leaf.propertyName && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                                {leaf.propertyName}
                              </span>
                            )}
                            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 truncate">
                              {leaf.label}
                            </span>
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500">({leaf.items.length})</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {renderCards(leaf.items)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}
        </div>
        )}
      </div>
    );
  }

  // ─── Mode INLINE : barre compacte (usage dans GroupRenderer) ─────────────
  const inlineContainerClass = inlineMode === 'plain'
    ? 'flex flex-wrap items-center gap-2 px-2 py-1.5 bg-transparent border-0'
    : 'flex flex-wrap items-center gap-2 px-4 py-2.5 bg-neutral-50/80 dark:bg-neutral-900/50 border-b border-black/6 dark:border-white/6';

  if (inlineMode === 'plain') {
    return (
      <div className={`${inlineContainerClass} ${className}`}>
        {renderCards(items)}
      </div>
    );
  }

  return (
    <div
      className={`${inlineContainerClass} ${className}`}
    >
      <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-600 mr-1 select-none">
        Totaux
      </span>

      {renderCards(items)}
    </div>
  );
};

export default TotalsBar;
