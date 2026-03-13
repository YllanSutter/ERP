import React from 'react';
import { Property } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// Symboles courts par type de total (pour la ligne de bas-tableau)
// ─────────────────────────────────────────────────────────────────────────────
const TOTAL_SYMBOLS: Record<string, { sym: string; colorClass: string }> = {
  sum:            { sym: 'Σ',  colorClass: 'text-violet-500 dark:text-violet-400' },
  avg:            { sym: 'Ø',  colorClass: 'text-blue-500 dark:text-blue-400' },
  min:            { sym: '↓',  colorClass: 'text-emerald-500 dark:text-emerald-400' },
  max:            { sym: '↑',  colorClass: 'text-orange-500 dark:text-orange-400' },
  count:          { sym: '#',  colorClass: 'text-slate-400 dark:text-slate-500' },
  unique:         { sym: '◈', colorClass: 'text-teal-500 dark:text-teal-400' },
  'count-true':   { sym: '✓',  colorClass: 'text-green-500 dark:text-green-400' },
  'count-false':  { sym: '✗',  colorClass: 'text-rose-400 dark:text-rose-400' },
  'count-linked': { sym: '⌁',  colorClass: 'text-indigo-500 dark:text-indigo-400' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface TotalsRowProps {
  /** Propriétés visibles (dans l'ordre des colonnes, sans showContextMenu) */
  displayProperties: Property[];
  /** Éléments sur lesquels calculer les totaux */
  items: any[];
  /** Map fieldId → type de total */
  totalFields: Record<string, string>;
  /** Fonction de calcul */
  calculateTotal: (fieldId: string, items: any[], totalType: string) => any;
  /** Fonction de formatage */
  formatTotal: (fieldId: string, total: any, totalType: string) => string;
  /** Présence d'une colonne de drag */
  enableDragReorder?: boolean;
  /** Présence d'une colonne de sélection */
  enableSelection?: boolean;
  /**
   * Padding gauche (px) appliqué à la 1ʳᵉ cellule data — utile pour
   * l'indentation des sous-groupes dans le tbody.
   */
  paddingLeft?: number;
  /**
   * 'group'  → ligne discrète dans un tbody (totaux de groupe)
   * 'footer' → ligne proéminente dans un tfoot (totaux globaux)
   */
  variant?: 'group' | 'footer';
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────
const TotalsRow: React.FC<TotalsRowProps> = ({
  displayProperties,
  items,
  totalFields,
  calculateTotal,
  formatTotal,
  enableDragReorder = false,
  enableSelection = false,
  paddingLeft,
  variant = 'group',
}) => {
  const hasAnyTotal = displayProperties.some((p: any) => totalFields[p.id]);
  if (!hasAnyTotal || items.length === 0) return null;

  const isFooter = variant === 'footer';

  return (
    <tr
      className={
        isFooter
          ? 'bg-violet-50/70 dark:bg-violet-950/25 border-t-2 border-violet-200/80 dark:border-violet-800/50'
          : 'bg-white/40 dark:bg-neutral-900/20 border-t border-black/6 dark:border-white/6'
      }
    >
      {/* Colonne drag */}
      {enableDragReorder && (
        <td className={`px-1 w-8 ${isFooter ? 'py-2.5' : 'py-1.5'}`} />
      )}

      {/* Colonne sélection */}
      {enableSelection && (
        <td className={`px-2 ${isFooter ? 'py-2.5' : 'py-1.5'}`} />
      )}

      {/* Cellules de données */}
      {displayProperties.map((prop: any, index: number) => {
        const totalType = totalFields[prop.id];
        const firstCellStyle =
          index === 0 && paddingLeft ? { paddingLeft: `${paddingLeft}px` } : undefined;

        if (!totalType) {
          return (
            <td
              key={prop.id}
              className={isFooter ? 'px-3 py-2.5' : 'px-3 py-1.5'}
              style={firstCellStyle}
            />
          );
        }

        const isLinkedProgress =
          typeof totalType === 'string' && totalType.startsWith('linked-progress:');

        const symMeta = isLinkedProgress
          ? { sym: '◑', colorClass: 'text-violet-500 dark:text-violet-400' }
          : (TOTAL_SYMBOLS[totalType] ?? { sym: '·', colorClass: 'text-neutral-400' });

        const total = calculateTotal(prop.id, items, totalType);
        const formatted = formatTotal(prop.id, total, totalType);

        if (isFooter) {
          // Footer : symbole au-dessus + valeur en gras en dessous
          return (
            <td
              key={prop.id}
              className="px-3 py-2.5"
              style={firstCellStyle}
            >
              <div className="flex flex-col">
                <span
                  className={`text-[10px] font-bold leading-none mb-[3px] select-none ${symMeta.colorClass}`}
                >
                  {symMeta.sym}
                </span>
                <span className="text-[12px] font-bold leading-none text-violet-700 dark:text-violet-300 truncate max-w-[180px]">
                  {formatted || '—'}
                </span>
              </div>
            </td>
          );
        }

        // Group : symbole inline + valeur, compact
        return (
          <td
            key={prop.id}
            className="px-3 py-1.5"
            style={firstCellStyle}
          >
            <span
              className={`text-[11px] font-semibold leading-none text-neutral-600 dark:text-neutral-300 inline-flex items-baseline gap-0.5 max-w-[180px] truncate`}
            >
              <span className={`text-[10px] ${symMeta.colorClass} select-none`}>
                {symMeta.sym}
              </span>
              {formatted || '—'}
            </span>
          </td>
        );
      })}
    </tr>
  );
};

export default TotalsRow;
