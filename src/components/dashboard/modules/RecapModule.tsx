/**
 * RecapModule – tableau croisé Période × Colonnes hiérarchiques.
 *
 * Mode mois  : lignes = jours, groupées par semaine (week label en rowspan)
 * Mode année : lignes = mois de l'année
 */

import React, { useMemo, useState, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  eachWeekOfInterval,
  eachDayOfInterval,
  endOfWeek,
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
import { DashboardModuleConfig } from '@/lib/dashboardTypes';
import { DashboardItemData } from '@/lib/hooks/useDashboardItemData';
import { Item } from '@/lib/types';
import {
  PeriodRow,
  LeafColumn,
  HeaderCell,
  buildRecapHeaderRows,
  flattenRecapToLeaves,
  computeLeafCell,
  getLeafCellItems,
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
  days: DayRow[];
}

interface TooltipState {
  items: Item[];
  rect: DOMRect;
}

// ---------------------------------------------------------------------------
// Noms courts des jours (getDay → 0=dim, 1=lun…)
// ---------------------------------------------------------------------------

const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// ---------------------------------------------------------------------------
// Calcul des périodes – mode mois → groupes de semaines avec jours
// ---------------------------------------------------------------------------

function getWeekGroups(
  year: number,
  month: number,
  includeWeekends: boolean
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
        .map((d) => ({
          key:       format(d, 'yyyy-MM-dd'),
          dayLabel:  DAY_SHORT[getDay(d)],
          dateLabel: format(d, 'dd/MM', { locale: fr }),
          start:     startOfDay(d),
          end:       endOfDay(d),
          isWeekend: isWeekend(d),
        }));

      return { weekKey: `week-${isoWeek}`, weekLabel: `Sem. ${isoWeek}`, days };
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
  onUpdate?: (patch: Partial<DashboardModuleConfig>) => void;
  onViewDetail?: (item: Item) => void;
}

// ---------------------------------------------------------------------------
// Tooltip flottant
// ---------------------------------------------------------------------------

const CellTooltip: React.FC<{
  tooltip: TooltipState;
  onItemClick?: (item: Item) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}> = ({ tooltip, onItemClick, onMouseEnter, onMouseLeave }) => {
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
      {rest > 0 && (
        <div className="px-3 py-1 text-[10px] text-muted-foreground italic">
          +{rest} autre{rest > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

const RecapModule: React.FC<Props> = ({ module, data, onUpdate, onViewDetail }) => {
  const now = new Date();

  const [localYear,  setLocalYear]  = useState(module.recapYear  ?? now.getFullYear());
  const [localMonth, setLocalMonth] = useState(module.recapMonth ?? (now.getMonth() + 1));
  const [tooltip, setTooltip]       = useState<TooltipState | null>(null);
  const hideTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mode             = module.recapMode ?? 'month';
  const columns          = module.recapColumns ?? [];
  const includeWeekends  = module.recapIncludeWeekends ?? true;
  const { filteredItems, properties, dateFields, collection } = data;

  const dateField = useMemo(
    () =>
      properties.find((p) => p.id === module.recapDateField) ??
      dateFields[0] ??
      undefined,
    [properties, module.recapDateField, dateFields]
  );

  const moduleDefaults = useMemo(() => ({
    displayTypes:     module.recapDefaultDisplayTypes,
    aggregationField: module.recapDefaultAggregationField,
    durationUnit:     module.recapDefaultDurationUnit,
  }), [module.recapDefaultDisplayTypes, module.recapDefaultAggregationField, module.recapDefaultDurationUnit]);

  // Feuilles après expansion de l'arbre
  const leaves = useMemo<LeafColumn[]>(
    () => flattenRecapToLeaves(columns, properties, [], moduleDefaults),
    [columns, properties, moduleDefaults]
  );

  // Lignes d'en-tête multi-niveaux
  const headerRows = useMemo<HeaderCell[][]>(
    () => buildRecapHeaderRows(columns, properties, moduleDefaults),
    [columns, properties, moduleDefaults]
  );

  // ── Données mode MOIS ──────────────────────────────────────────────────

  const weekGroups = useMemo<WeekGroup[]>(() => {
    if (mode !== 'month') return [];
    return getWeekGroups(localYear, localMonth, includeWeekends);
  }, [mode, localYear, localMonth, includeWeekends]);

  // cells[wgIdx][dayIdx][leafIdx]
  const dayCells = useMemo(() => {
    if (mode !== 'month') return [];
    return weekGroups.map((wg) =>
      wg.days.map((day) =>
        leaves.map((leaf) =>
          computeLeafCell(
            filteredItems, leaf,
            { key: day.key, label: day.dayLabel, sublabel: day.dateLabel, start: day.start, end: day.end },
            dateField, properties
          )
        )
      )
    );
  }, [mode, weekGroups, leaves, filteredItems, dateField, properties]);

  const dayRowTotals = useMemo(
    () => dayCells.map((wg) => wg.map((row) => row.reduce((a, b) => a + b, 0))),
    [dayCells]
  );

  // ── Données mode ANNÉE ─────────────────────────────────────────────────

  const yearPeriods = useMemo<PeriodRow[]>(() => {
    if (mode !== 'year') return [];
    return getMonthsOfYear(localYear);
  }, [mode, localYear]);

  const yearCells = useMemo(() => {
    if (mode !== 'year') return [];
    return yearPeriods.map((period) =>
      leaves.map((leaf) => computeLeafCell(filteredItems, leaf, period, dateField, properties))
    );
  }, [mode, yearPeriods, leaves, filteredItems, dateField, properties]);

  const yearRowTotals = useMemo(
    () => yearCells.map((row) => row.reduce((a, b) => a + b, 0)),
    [yearCells]
  );

  // ── Totaux par feuille + grand total ──────────────────────────────────

  const leafTotals = useMemo(() => {
    if (mode === 'month') {
      return leaves.map((_, li) =>
        dayCells.reduce((s, wg) => s + wg.reduce((s2, day) => s2 + day[li], 0), 0)
      );
    }
    return leaves.map((_, li) =>
      yearCells.reduce((s, row) => s + row[li], 0)
    );
  }, [mode, dayCells, yearCells, leaves]);

  const grandTotal = useMemo(
    () => leafTotals.reduce((a, b) => a + b, 0),
    [leafTotals]
  );

  // ── Navigation ────────────────────────────────────────────────────────

  const navigatePrev = () => {
    if (mode === 'year') {
      setLocalYear((y) => y - 1);
    } else {
      if (localMonth === 1) { setLocalYear((y) => y - 1); setLocalMonth(12); }
      else setLocalMonth((m) => m - 1);
    }
  };
  const navigateNext = () => {
    if (mode === 'year') {
      setLocalYear((y) => y + 1);
    } else {
      if (localMonth === 12) { setLocalYear((y) => y + 1); setLocalMonth(1); }
      else setLocalMonth((m) => m + 1);
    }
  };

  const periodTitle =
    mode === 'year'
      ? String(localYear)
      : `${MONTH_NAMES_FR[localMonth - 1]} ${localYear}`;

  // ── Tooltip ──────────────────────────────────────────────────────────

  const scheduleHide = useCallback(() => {
    hideTimerRef.current = setTimeout(() => setTooltip(null), 200);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  const handleCellEnter = useCallback((
    e: React.MouseEvent<HTMLTableCellElement>,
    leaf: LeafColumn,
    period: PeriodRow
  ) => {
    cancelHide();
    const items = getLeafCellItems(filteredItems, leaf, period, dateField, properties);
    if (items.length === 0) { setTooltip(null); return; }
    setTooltip({ items, rect: e.currentTarget.getBoundingClientRect() });
  }, [filteredItems, dateField, properties, cancelHide]);

  const handleCellClick = useCallback((
    leaf: LeafColumn,
    period: PeriodRow
  ) => {
    if (!onViewDetail) return;
    const items = getLeafCellItems(filteredItems, leaf, period, dateField, properties);
    if (items.length === 1) {
      onViewDetail(items[0]);
      setTooltip(null);
    }
    // si plusieurs items, le tooltip est déjà visible avec la liste cliquable
  }, [filteredItems, dateField, properties, onViewDetail]);

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

  // ── Nombre de colonnes période (pour tfoot colspan) ───────────────────
  const periodColCount = mode === 'month' ? 2 : 1;

  // ── Rendu ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" onMouseLeave={scheduleHide}>

      {/* Tooltip flottant */}
      {tooltip && (
        <CellTooltip
          tooltip={tooltip}
          onItemClick={(item) => { onViewDetail?.(item); setTooltip(null); }}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}

      {/* ── Barre de navigation ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card/60 flex-shrink-0">
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          <button
            onClick={() => onUpdate?.({ recapMode: 'month' })}
            className={`px-2.5 py-1 ${mode === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
          >
            Mois
          </button>
          <button
            onClick={() => onUpdate?.({ recapMode: 'year' })}
            className={`px-2.5 py-1 ${mode === 'year' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-muted-foreground'}`}
          >
            Année
          </button>
        </div>

        <button onClick={navigatePrev} className="p-1 rounded hover:bg-accent text-muted-foreground">
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-medium text-foreground min-w-[140px] text-center">
          {periodTitle}
        </span>
        <button onClick={navigateNext} className="p-1 rounded hover:bg-accent text-muted-foreground">
          <ChevronRight size={14} />
        </button>

        <div className="flex-1" />

        <span className="text-xs text-muted-foreground">
          Total : <span className="font-semibold text-foreground">{grandTotal}</span>
        </span>
      </div>

      {/* ── Tableau ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">

          {/* En-tête multi-niveaux */}
          <thead className="sticky top-0 z-10 bg-card">
            {headerRows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {/* Colonnes période — seulement sur la première ligne de header */}
                {rowIdx === 0 && mode === 'month' && (
                  <>
                    <th
                      rowSpan={headerRows.length}
                      className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground border-b border-border whitespace-nowrap w-14 align-bottom"
                    >
                      Sem.
                    </th>
                    <th
                      rowSpan={headerRows.length}
                      className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border whitespace-nowrap min-w-[90px] align-bottom"
                    >
                      Jour
                    </th>
                  </>
                )}
                {rowIdx === 0 && mode === 'year' && (
                  <th
                    rowSpan={headerRows.length}
                    className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border whitespace-nowrap min-w-[110px] align-bottom"
                  >
                    Mois
                  </th>
                )}

                {/* Cellules données */}
                {row.map((cell) => (
                  <th
                    key={cell.id}
                    colSpan={cell.colspan}
                    rowSpan={cell.rowspan}
                    className="text-center px-2 py-2 text-xs font-semibold border-b border-border whitespace-nowrap"
                    style={{ color: cell.color ?? 'hsl(var(--foreground))' }}
                  >
                    {cell.label}
                  </th>
                ))}

                {/* Colonne Total */}
                {rowIdx === 0 && (
                  <th
                    rowSpan={headerRows.length}
                    className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border align-bottom"
                  >
                    Total
                  </th>
                )}
              </tr>
            ))}
          </thead>

          {/* Corps */}
          <tbody>
            {/* ── Mode MOIS : jours groupés par semaine ── */}
            {mode === 'month' && weekGroups.map((wg, wgIdx) =>
              wg.days.map((day, dayIdx) => {
                const period: PeriodRow = {
                  key: day.key, label: day.dayLabel, sublabel: day.dateLabel,
                  start: day.start, end: day.end,
                };
                return (
                  <tr
                    key={day.key}
                    className={`transition-colors hover:bg-accent/30 ${day.isWeekend ? 'bg-muted/30' : ''}`}
                  >
                    {/* Cellule semaine – rowspan sur tous les jours de la semaine */}
                    {dayIdx === 0 && (
                      <td
                        rowSpan={wg.days.length}
                        className="px-1 py-1 border-b border-r border-border/20 text-center align-middle bg-accent/10"
                      >
                        <div className="text-[11px] font-semibold text-muted-foreground leading-tight">
                          {wg.weekLabel}
                        </div>
                      </td>
                    )}

                    {/* Cellule jour */}
                    <td className="px-3 py-1.5 border-b border-border/50 whitespace-nowrap">
                      <span className={`text-xs font-semibold ${day.isWeekend ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {day.dayLabel}
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-1.5">
                        {day.dateLabel}
                      </span>
                    </td>

                    {/* Données */}
                    {leaves.map((leaf, li) => {
                      const val = dayCells[wgIdx]?.[dayIdx]?.[li] ?? 0;
                      return (
                        <td
                          key={leaf.id}
                          className={`text-center px-2 py-1.5 border-b border-border/50 tabular-nums ${onViewDetail ? 'cursor-pointer' : ''}`}
                          onMouseEnter={(e) => handleCellEnter(e, leaf, period)}
                          onMouseLeave={scheduleHide}
                          onClick={() => handleCellClick(leaf, period)}
                        >
                          {val > 0 ? (
                            <span
                              className="inline-flex items-center justify-center min-w-[28px] h-5 rounded px-1 text-xs font-semibold"
                              style={{
                                background: leaf.color ? `${leaf.color}18` : 'hsl(var(--accent))',
                                color:      leaf.color ?? 'hsl(var(--foreground))',
                              }}
                            >
                              {formatRecapValue(val, leaf.displayType, leaf.durationUnit)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">–</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Total ligne */}
                    <td className="text-center px-3 py-1.5 border-b border-border/50 tabular-nums">
                      {(dayRowTotals[wgIdx]?.[dayIdx] ?? 0) > 0 ? (
                        <span className="text-xs font-semibold text-foreground">
                          {dayRowTotals[wgIdx][dayIdx]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30 text-xs">–</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}

            {/* ── Mode ANNÉE : une ligne par mois ── */}
            {mode === 'year' && yearPeriods.map((period, ri) => (
              <tr key={period.key} className="hover:bg-accent/30 transition-colors">
                <td className="px-3 py-2 border-b border-border/50">
                  <div className="font-medium text-foreground text-xs capitalize">{period.label}</div>
                </td>
                {leaves.map((leaf, li) => {
                  const val = yearCells[ri]?.[li] ?? 0;
                  return (
                    <td
                      key={leaf.id}
                      className={`text-center px-2 py-2 border-b border-border/50 tabular-nums ${onViewDetail ? 'cursor-pointer' : ''}`}
                      onMouseEnter={(e) => handleCellEnter(e, leaf, period)}
                      onMouseLeave={scheduleHide}
                      onClick={() => handleCellClick(leaf, period)}
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
                <td className="text-center px-3 py-2 border-b border-border/50 tabular-nums">
                  {yearRowTotals[ri] > 0 ? (
                    <span className="text-xs font-semibold text-foreground">{yearRowTotals[ri]}</span>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>

          {/* Totaux */}
          <tfoot className="sticky bottom-0 bg-card border-t-2 border-border">
            <tr>
              <td
                colSpan={periodColCount}
                className="px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                Total
              </td>
              {leaves.map((leaf, li) => (
                <td key={leaf.id} className="text-center px-2 py-2 tabular-nums">
                  <span
                    className="text-xs font-bold"
                    style={{ color: leaf.color ?? 'hsl(var(--foreground))' }}
                  >
                    {leafTotals[li] > 0
                      ? formatRecapValue(leafTotals[li], leaf.displayType, leaf.durationUnit)
                      : '–'}
                  </span>
                </td>
              ))}
              <td className="text-center px-3 py-2 tabular-nums">
                <span className="text-xs font-bold text-foreground">{grandTotal}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default RecapModule;
