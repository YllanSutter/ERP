  // Affiche une durée en heures et minutes (ex: 7h00, 3h30)
  function formatDurationHeureMinute(duree: number): string {
    if (typeof duree !== 'number' || isNaN(duree)) return '';
    const heures = Math.floor(duree);
    const minutes = Math.round((duree - heures) * 60);
    return `${heures}h${minutes.toString().padStart(2, '0')}`;
  }
  // Récupérer toutes les feuilles (sous-colonnes finales) sans le chemin (pour usages simples)
  const getLeaves = (nodes: any[]): any[] => {
    return nodes.flatMap((n) =>
      n.children && n.children.length ? getLeaves(n.children) : [n]
    );
  };
import React, { useEffect, useMemo, useState } from 'react';
import { DashboardColumnNode, MonthlyDashboardConfig } from '@/lib/dashboardTypes';
import DashboardColumnConfig from './DashboardColumnConfig';

interface DashboardShellProps {
  dashboard: MonthlyDashboardConfig | null;
  collections: any[];
  onUpdate: (patch: Partial<MonthlyDashboardConfig>) => void;
}

import {
  getMonday,
  MONTH_NAMES,
  getItemsForDate as getItemsForDateUtil,
  getNameValue as getNameValueUtil,
  getPreviousPeriod,
  getNextPeriod,
  getEventStyle,
  workDayStart,
  workDayEnd,
} from '@/lib/calendarUtils';

const months = MONTH_NAMES;

const DashboardShell: React.FC<DashboardShellProps> = ({ dashboard, collections, onUpdate }) => {
    useEffect(() => {
      if (dashboard) {
        console.log('[DASHBOARD] Champ date sélectionné (globalDateField) :', dashboard.globalDateField);
      }
    }, [dashboard]);
   
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  const collection = useMemo(
    () => collections.find((c) => c.id === dashboard?.sourceCollectionId),
    [collections, dashboard?.sourceCollectionId]
  );
 // LOG toutes les données des grandes collections
    useEffect(() => {
      // Log collections entières (attention à la taille en console)
      // console.log('[DASHBOARD] collections:', collections);
      if (collection) {
        console.log('[DASHBOARD] collection sélectionnée:', collection);
        console.log('[DASHBOARD] properties:', collection.properties);
        // console.log('[DASHBOARD] items:', collection.items);
      }
      // if (dashboard) {
      //   console.log('[DASHBOARD] dashboard:', dashboard);
      // }
    }, [collections, collection, dashboard]);
  const properties = collection?.properties || [];
  const items = collection?.items || [];

  const [typeValuesInput, setTypeValuesInput] = useState<Record<string, string>>({});

  const dayKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };



  // Récupérer la profondeur max de l'arbre
  const getMaxDepth = (nodes: any[], depth = 1): number => {
    if (!nodes || nodes.length === 0) return depth;
    return Math.max(
      ...nodes.map((n) => (n.children && n.children.length ? getMaxDepth(n.children, depth + 1) : depth))
    );
  };
  const maxDepth = getMaxDepth(dashboard?.columnTree || []);

  // Récupérer toutes les feuilles (sous-colonnes finales) et leur chemin de parents
  const getLeavesWithPath = (nodes: any[], path: any[] = []): any[] => {
    return nodes.flatMap((n) =>
      n.children && n.children.length
        ? getLeavesWithPath(n.children, [...path, n])
        : [{ ...n, _parentPath: path }]
    );
  };
  const leafColumns = useMemo(() => getLeavesWithPath(dashboard?.columnTree || []), [dashboard?.columnTree]);

  // Générer les lignes d'en-tête récursivement
  const buildHeaderRows = (nodes: any[], depth: number, maxDepth: number, rows: any[][]) => {
    rows[depth] = rows[depth] || [];
    nodes.forEach((node) => {
      const isLeaf = !node.children || node.children.length === 0;
      if (isLeaf) {
        rows[depth].push({
          label: node.label,
          colSpan: 2,
          rowSpan: maxDepth - depth,
          isLeaf: true,
          node,
        });
      } else {
        const colSpan = getLeaves([node]).length * 2;
        rows[depth].push({
          label: node.label,
          colSpan,
          rowSpan: 1,
          isLeaf: false,
          node,
        });
        buildHeaderRows(node.children, depth + 1, maxDepth, rows);
      }
    });
  };

  // UI pour choisir la collection et le champ date pour chaque groupe racine
  const handleRootGroupChange = (groupIdx: number, patch: any) => {
    if (!dashboard || !dashboard.columnTree) return;
    const newTree = dashboard.columnTree.map((g: any, idx: number) => idx === groupIdx ? { ...g, ...patch } : g);
    onUpdate({ columnTree: newTree });
  };

  const getTableHeaderRows = () => {
    const rows: any[][] = [];
    buildHeaderRows(dashboard?.columnTree || [], 0, maxDepth, rows);
    return rows;
  };

  // Détermination dynamique du typeField à utiliser (multi_select)
  const resolvedTypeField = useMemo(() => {
    // Si dashboard.typeField pointe sur une propriété multi_select, on l'utilise
    if (dashboard?.typeField) {
      const prop = properties.find((p: any) => p.id === dashboard.typeField && p.type === 'multi_select');
      if (prop) return dashboard.typeField;
    }
    // Sinon, on prend la première propriété multi_select
    const firstMulti = properties.find((p: any) => p.type === 'multi_select');
    return firstMulti ? firstMulti.id : null;
  }, [dashboard?.typeField, properties]);

  const typeOptions = useMemo(() => {
    if (!resolvedTypeField) return [] as { value: string; label: string }[];
    const prop = properties.find((p: any) => p.id === resolvedTypeField);
    const opts = prop?.options || [];
    return (opts as any[]).map((opt, idx) => {
      if (typeof opt === 'string') return { value: opt, label: opt };
      const value = opt?.value ?? opt?.label ?? `option-${idx + 1}`;
      const label = opt?.label ?? value;
      return { value, label };
    });
  }, [resolvedTypeField, properties]);

  useEffect(() => {
    if (!dashboard) return;
    // Correction : forcer typeField à 'type' si la propriété existe (même si une autre valeur est déjà présente)
    if (properties.some((p: any) => p.id === 'type') && dashboard.typeField !== 'type') {
      onUpdate({ typeField: 'type' });
    }
    const hasColumns = (dashboard.columnTree || []).length > 0;
    if (hasColumns) return;
    if (typeOptions.length === 0) return;
    const autoColumns: DashboardColumnNode[] = typeOptions.map((opt, idx) => ({
      id: `auto-${idx}-${opt.value}`,
      label: opt.label,
      typeValues: [opt.value],
      dateFieldOverride: {}
    }));
    onUpdate({ columnTree: autoColumns });
  }, [dashboard, typeOptions, onUpdate, properties]);

  const handleAddLeaf = () => {
    if (!dashboard) return;
    const newLeaf: DashboardColumnNode = {
      id: Date.now().toString(),
      label: `Colonne ${leafColumns.length + 1}`,
      typeValues: [],
      dateFieldOverride: {}
    };
    onUpdate({ columnTree: [...(dashboard.columnTree || []), newLeaf] });
  };

  // Agrégation des données (daily, spans, etc.)
  const aggregates = useMemo(() => {
    const daily: Record<string, Record<string, { count: number; duration: number }>> = {};
    // Pour afficher la durée par jour et par objet (id)
    const dailyObjectDurations: Record<string, Record<string, Record<string, number>>> = {}; // dailyObjectDurations[dateKey][leafId][itemId] = durée ce jour-là
    const spansByLeaf: Record<string, any[]> = {};
    const spansByLeafDay: Record<string, Record<string, any>> = {};

    if (!dashboard || !leafColumns.length) return { daily, spansByLeaf, spansByLeafDay, dailyObjectDurations };

    // Générer tous les jours ouvrés (lundi-vendredi) du mois affiché
    const year = dashboard.year;
    const month = dashboard.month - 1; // JS: 0 = janvier
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysOfMonth: Date[] = [];
    let d = new Date(firstDay);
    while (d <= lastDay) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        daysOfMonth.push(new Date(d));
      }
      d.setDate(d.getDate() + 1);
    }

    // Pour chaque feuille (colonne finale)
    leafColumns.forEach((leaf: any) => {
      // Trouver le groupe racine parent (niveau 1)
      const rootGroup = leaf._parentPath && leaf._parentPath.length > 0 ? leaf._parentPath[0] : null;
      // Déterminer la collection à utiliser pour ce groupe racine
      const groupCollectionId = rootGroup?.collectionId || dashboard.sourceCollectionId;
      const groupCollection = collections.find((c: any) => c.id === groupCollectionId) || collection;
      const groupProperties = groupCollection?.properties || [];
      const groupItems = groupCollection?.items || [];
      // Déterminer le champ date à utiliser pour ce groupe racine
      let dateFieldId = rootGroup?.dateFieldId || dashboard.globalDateField;
      if (leaf.dateFieldOverride && leaf.dateFieldOverride.single) {
        dateFieldId = leaf.dateFieldOverride.single;
      }
      // Si rien n'est défini, prendre le premier champ date de la collection
      if (!dateFieldId && groupProperties.length > 0) {
        const firstDate = groupProperties.find((p: any) => p.type === 'date' || p.type === 'date_range');
        if (firstDate) dateFieldId = firstDate.id;
      }
      // Trouver le champ date dans les propriétés
      const dateField = groupProperties.find((p: any) => p.id === dateFieldId);
      if (!dateField) return;
      // Déterminer les valeurs de type à filtrer (typeValues hiérarchiques)
      let typeValues: string[] = [];
      if (leaf._parentPath) {
        typeValues = [
          ...leaf._parentPath.flatMap((p: any) => Array.isArray(p.typeValues) ? p.typeValues.filter((v: any) => !!v) : []),
          ...(Array.isArray(leaf.typeValues) ? leaf.typeValues.filter((v: any) => !!v) : [])
        ];
      } else {
        typeValues = Array.isArray(leaf.typeValues) ? leaf.typeValues.filter((v: any) => !!v) : [];
      }

      // Pour chaque jour du mois
      daysOfMonth.forEach((day) => {
        const key = day.toLocaleDateString('fr-CA'); // format YYYY-MM-DD
        if (!daily[key]) daily[key] = {};
        if (!dailyObjectDurations[key]) dailyObjectDurations[key] = {};
        if (!dailyObjectDurations[key][leaf.id]) dailyObjectDurations[key][leaf.id] = {};

        // Pour chaque item, on utilise la logique de getEventStyle pour savoir s'il couvre ce jour et quelle part de durée afficher
        groupItems.forEach((item: any) => {
          // Filtrage par type hiérarchique si applicable
          const typeField = resolvedTypeField;
          if (typeValues.length > 0 && typeField) {
            const itemType = item[typeField];
            let match = true;
            if (Array.isArray(itemType)) {
              match = typeValues.every((v: any) => itemType.includes(v));
            } else {
              match = typeValues.every((v: any) => itemType === v);
            }
            if (!match) return;
          }
          // Utiliser getEventStyle pour obtenir la répartition par jour (workdayDates)
          let eventStyle = null;
          try {
            eventStyle = getEventStyle(item, dateField, 1, 17); // 1h par défaut, mais getEventStyle gère la vraie durée
          } catch (e) {}
          if (eventStyle && eventStyle.workdayDates) {
            // Si ce jour fait partie des workdayDates de l'événement
            const isOnThisDay = eventStyle.workdayDates.some((wd: Date) => wd.toLocaleDateString('fr-CA') === key);
            if (isOnThisDay) {
              // Pour les multi-jours, on répartit la durée, sinon on prend la durée entière
              let part = 0;
              if (eventStyle.workdayDates.length > 1) {
                part = eventStyle.durationHours / eventStyle.workdayDates.length;
              } else {
                part = eventStyle.durationHours;
              }
              dailyObjectDurations[key][leaf.id][item.id] = part;
            }
          }
        });

        // Compter et sommer la durée (total pour la cellule)
        const itemsForDay = Object.keys(dailyObjectDurations[key][leaf.id]);
        // Pour le count, ne compter qu'une seule fois un événement multi-jours (seulement le premier jour)
        let count = 0;
        itemsForDay.forEach((itemId) => {
          // Retrouver l'eventStyle pour cet item
          const item = groupItems.find((it: any) => it.id === itemId);
          let eventStyle = null;
          try {
            eventStyle = getEventStyle(item, dateField, 1, 17);
          } catch (e) {}
          if (eventStyle && eventStyle.workdayDates) {
            // Si ce jour est le premier jour de l'événement, on compte
            const firstDayKey = eventStyle.workdayDates[0].toLocaleDateString('fr-CA');
            if (key === firstDayKey) {
              count++;
            }
          }
        });
        daily[key][leaf.id] = {
          count,
          duration: itemsForDay.reduce((acc: number, itemId: string) => {
            const part = dailyObjectDurations[key][leaf.id][itemId];
            return acc + (typeof part === 'number' ? part : 0);
          }, 0),
        };
      });
    });

    // (Optionnel) Spans pour les événements couvrant plusieurs jours (date_range)
    // Ici, on ne gère que les spans si le champ date est de type 'date_range'
    leafColumns.forEach((leaf: any) => {
      // Trouver le groupe racine parent (niveau 1)
      const rootGroup = leaf._parentPath && leaf._parentPath.length > 0 ? leaf._parentPath[0] : null;
      const groupCollectionId = rootGroup?.collectionId || dashboard.sourceCollectionId;
      const groupCollection = collections.find((c: any) => c.id === groupCollectionId) || collection;
      const groupProperties = groupCollection?.properties || [];
      let dateFieldId = rootGroup?.dateFieldId || dashboard.globalDateField;
      if (leaf.dateFieldOverride && leaf.dateFieldOverride.single) {
        dateFieldId = leaf.dateFieldOverride.single;
      }
      const dateField = groupProperties.find((p: any) => p.id === dateFieldId);
      if (!dateField || dateField.type !== 'date_range') return;
      const typeValues = leaf.typeValues && leaf.typeValues.length > 0 ? leaf.typeValues : null;
      const spans: any[] = [];
      const groupItems = groupCollection?.items || [];
      groupItems.forEach((item: any) => {
        if (typeValues && resolvedTypeField) {
          if (!typeValues.includes(item[resolvedTypeField])) return;
        }
        const value = item[dateField.id];
        if (value && value.start && value.end) {
          const start = new Date(value.start);
          const end = new Date(value.end);
          spans.push({
            item,
            start,
            end,
            label: getNameValueUtil(item, groupCollection),
          });
        }
      });
      spansByLeaf[leaf.id] = spans;
      // Indexer par jour
      spansByLeafDay[leaf.id] = {};
      daysOfMonth.forEach((day) => {
        const key = dayKey(day);
        const found = spans.find((span) => day >= span.start && day <= span.end);
        if (found) {
          spansByLeafDay[leaf.id][key] = {
            ...found,
            isStart: dayKey(found.start) === key,
            isEnd: dayKey(found.end) === key,
          };
        }
      });
    });

    return { daily, spansByLeaf, spansByLeafDay, dailyObjectDurations };
  }, [dashboard, collection, collections, properties, items, leafColumns, resolvedTypeField]);

  if (!dashboard) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400">
        Aucun dashboard sélectionné
      </div>
    );
  }


  // Génération des colonnes pour le tableau (groupes et sous-colonnes)
  const getTableColumns = () => {
    // [{ group, leaves: [...] }]
    return (dashboard?.columnTree || []).map((g: any) => ({
      group: g,
      leaves: (g.children || []),
    }));
  };


  const renderWeekTable = (week: { week: number; days: Date[] }) => {
    if (!aggregates) return null;
    const spanForDay = (leafId: string, key: string) => aggregates.spansByLeafDay?.[leafId]?.[key];
    const tableColumns = getTableColumns();

    return (
      <div key={week.week} className="overflow-auto border border-white/15 rounded-lg shadow-inner shadow-black/40">
        <table className="min-w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '120px' }} />
            {leafColumns.map((leaf: any) => (
              <React.Fragment key={leaf.id}>
                <col style={{ width: '100px' }} />
                <col style={{ width: '100px' }} />
              </React.Fragment>
            ))}
          </colgroup>
          <thead className="bg-neutral-900/90">
            {(() => {
              const headerRows = getTableHeaderRows();
              return (
                <>
                  {headerRows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {rowIdx === 0 && (
                        <th
                          className="px-3 py-2 text-left border-b border-white/15"
                          rowSpan={headerRows.length + 1 - rowIdx}
                        >
                          Semaine {week.week}
                          {week.days.length > 0 && (
                            <span className="ml-2 text-xs text-neutral-400 font-normal">
                              du {week.days[0].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                              {' '}au {week.days[week.days.length - 1].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                            </span>
                          )}
                        </th>
                      )}
                      {row.map((cell: any, i: number) => (
                        <th
                          key={i}
                          colSpan={cell.colSpan}
                          rowSpan={cell.rowSpan}
                          className={`px-3 py-2 text-center border-b border-l border-white/10 ${cell.isLeaf ? 'bg-neutral-900/60' : 'bg-neutral-900/80'}`}
                        >
                          {cell.label}
                        </th>
                      ))}
                    </tr>
                  ))}
                  {/* Ligne des métriques (Nb/Durée) pour chaque feuille profonde */}
                  <tr className="bg-neutral-900/60 text-neutral-400">
                    {leafColumns.map((leaf: any) => (
                      <React.Fragment key={leaf.id + '-metrics'}>
                        <th className="px-3 py-1 text-left border-b border-l border-white/10">Nombre</th>
                        <th className="px-3 py-1 text-left border-b border-l border-white/10">Durée</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </>
              );
            })()}
          </thead>
          <tbody>
            {week.days.map((day) => {
              const key = dayKey(day);
              return (
                <tr key={`${week.week}-${key}`} className="border-b border-white/10 odd:bg-neutral-900/40">
                  <td className="px-3 py-2 text-neutral-200 font-medium border-r border-white/10">
                    {day.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </td>
                  {leafColumns.map((leaf: any) => {
                      const cell = aggregates.daily[key]?.[leaf.id] || { count: 0, duration: 0 };
                      const span = spanForDay(leaf.id, key);
                      const countClasses = span
                        ? 'px-3 py-2 text-right text-white border-l border-white/30 bg-white/10'
                        : 'px-3 py-2 text-right text-white border-l border-white/30 bg-neutral-900/30';
                      const durationClasses = span
                        ? `px-3 py-2 text-right text-white border-l ${span.isEnd ? '' : ''} ${
                            span.isStart ? 'rounded-l-md' : ''
                          } border-white/30 bg-white/10`
                        : 'px-3 py-2 text-right text-white border-l border-white/10 bg-neutral-900/20';

                      // Correction : afficher le nombre pour les dates simples (pas de span)
                      let countValue = '';
                      if (span && span.isStart) {
                        countValue = '1';
                      } else if (!span && cell.count > 0) {
                        countValue = cell.count.toString();
                      }

                      // Log systématique pour chaque cellule, même vide
                      console.log('[DASHBOARD][TD]', {
                        semaine: week.week,
                        jour: key,
                        feuille: leaf.label,
                        count: countValue,
                        duration: cell.duration,
                      });

                      return (
                        <React.Fragment key={`${week.week}-${key}-${leaf.id}`}>
                          <td className={countClasses}>{countValue}</td>
                          <td className={durationClasses}>
                                {cell.duration ? formatDurationHeureMinute(cell.duration) : ''}
                                {span && (
                                  <div className="text-[11px] text-white truncate">{span.label}</div>
                                )}
                              </td>
                        </React.Fragment>
                      );
                    })}
                </tr>
              );
            })}
            {/* Total semaine */}
            <tr className="bg-white/5">
              <td className="px-3 py-2 font-semibold text-white border-r border-white/10">Total Semaine {week.week}</td>
              {leafColumns.map((leaf: any) => {
                  let count = 0;
                  let duration = 0;
                  week.days.forEach((day) => {
                    const key = dayKey(day);
                    const cell = aggregates.daily[key]?.[leaf.id];
                    const span = spanForDay(leaf.id, key);
                    if (span && span.isStart) {
                      count += 1;
                    } else if (!span && cell && cell.count) {
                      count += cell.count;
                    }
                    if (cell) {
                      duration += cell.duration;
                    }
                  });
                  return (
                    <React.Fragment key={`week-total-${week.week}-${leaf.id}`}>
                      <td className="px-3 py-2 text-right text-white border-l border-white/10">{count || ''}</td>
                      <td className="px-3 py-2 text-right text-white border-l border-white/10">
                        {duration ? duration.toFixed(1) : ''}
                      </td>
                    </React.Fragment>
                  );
                })}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderMonthTotals = () => {
    if (!aggregates) return null;
    return (
      <div className="overflow-auto border border-white/15 rounded-lg shadow-inner shadow-black/40">
        <table className="min-w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '120px' }} />
            {leafColumns.map((_, i) => (
              <col key={i} style={{ width: '80px' }} />
            ))}
            {leafColumns.map((_, i) => (
              <col key={i + leafColumns.length} style={{ width: '100px' }} />
            ))}
          </colgroup>
          <thead className="bg-neutral-900/90">
            <tr>
              <th className="px-3 py-2 text-left border-b border-white/15">Total Mois</th>
              {leafColumns.map((leaf) => (
                <th
                  key={leaf.id}
                  colSpan={2}
                  className="px-3 py-2 text-left border-b border-l border-white/10 bg-neutral-900/70"
                >
                  {leaf.label}
                </th>
              ))}
            </tr>
            <tr className="bg-neutral-900/60 text-neutral-400">
              <th className="px-3 py-1 text-left border-b border-white/15">Mois</th>
              {leafColumns.map((leaf) => (
                <React.Fragment key={`${leaf.id}-month-metrics`}>
                  <th className="px-3 py-1 text-left border-b border-l border-white/10">Nombre</th>
                  <th className="px-3 py-1 text-left border-b border-l border-white/10">Durée</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white/10">
              <td className="px-3 py-2 font-semibold text-white border-r border-white/10">Total Mois</td>
              {leafColumns.map((leaf) => {
                // Pour le total mensuel, on compte 1 uniquement sur le premier jour de chaque événement (span.isStart)
                let count = 0;
                let duration = 0;
                Object.keys(aggregates.daily).forEach((key) => {
                  const cell = aggregates.daily[key]?.[leaf.id];
                  const span = aggregates.spansByLeafDay?.[leaf.id]?.[key];
                  if (span && span.isStart) {
                    count += 1;
                  }
                  if (cell) {
                    duration += cell.duration;
                  }
                });
                return (
                  <React.Fragment key={`month-total-${leaf.id}`}>
                    <td className="px-3 py-2 text-right text-white border-l border-white/10">{count || ''}</td>
                    <td className="px-3 py-2 text-right text-white border-l border-white/10">
                      {duration ? formatDurationHeureMinute(duration) : ''}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // Génération des semaines du mois sélectionné (lundi-vendredi, week-ends exclus)
  const groupedWeeks = useMemo(() => {
    if (!dashboard?.month || !dashboard?.year) return [];
    const year = dashboard.year;
    const month = dashboard.month - 1; // JS: 0 = janvier
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const weeks: { week: number; days: Date[] }[] = [];
    let current = getMonday(firstDay);
    let weekNum = 1;
    while (current <= lastDay) {
      const days: Date[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(current);
        d.setDate(current.getDate() + i);
        if (d.getMonth() === month && d <= lastDay) {
          const dayOfWeek = d.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            days.push(d);
          }
        }
      }
      if (days.length > 0) {
        weeks.push({ week: weekNum, days });
      }
      current.setDate(current.getDate() + 7);
      weekNum++;
    }
    return weeks;
  }, [dashboard?.month, dashboard?.year]);
  const handleUpdateLeaf = () => {};
  const handleRemoveLeaf = () => {};

  // Liste des champs date disponibles pour la collection sélectionnée
  const dateFields = useMemo(() => {
    return properties.filter((p: any) => p.type === 'date' || p.type === 'date_range');
  }, [properties]);

  return (
    <div className="flex-1 flex flex-col gap-4 p-6 overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <input
            value={dashboard.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="bg-transparent border border-white/10 rounded px-3 py-2 text-lg font-semibold focus:outline-none focus:border-blue-500/60"
          />
          <div className="text-xs text-neutral-500 border border-white/10 px-2 py-1 rounded">
            Mensuel • week-ends exclus
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dashboard.month}
            onChange={(e) => onUpdate({ month: Number(e.target.value) })}
            className="bg-neutral-900 border border-white/10 rounded px-3 py-2 text-sm"
          >
            {months.map((label, idx) => (
              <option key={idx} value={idx + 1}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={dashboard.year}
            onChange={(e) => onUpdate({ year: Number(e.target.value) })}
            className="bg-neutral-900 border border-white/10 rounded px-3 py-2 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>



      <div className="flex-1  text-neutral-200 p-10">
        <div className="space-y-6">
          {groupedWeeks.map((week) => renderWeekTable(week))}
          {renderMonthTotals()}
        </div>
      </div>

      <DashboardColumnConfig
        dashboard={dashboard}
        collections={collections}
        properties={properties}
        leafColumns={leafColumns}
        typeValuesInput={typeValuesInput}
        setTypeValuesInput={setTypeValuesInput}
        handleAddLeaf={handleAddLeaf}
        handleUpdateLeaf={handleUpdateLeaf}
        handleRemoveLeaf={handleRemoveLeaf}
        onUpdate={onUpdate}
      />
    </div>
  );
};

export default DashboardShell;

