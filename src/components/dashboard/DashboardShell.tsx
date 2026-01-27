import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useErpSync } from '@/lib/useErpSync';
const FilterModal = React.lazy(() => import('@/components/modals/FilterModal'));
import ItemContextMenu from '@/components/menus/ItemContextMenu';
import { DashboardColumnNode, MonthlyDashboardConfig } from '@/lib/dashboardTypes';
import DashboardColumnConfig from './DashboardColumnConfig';
import {
  getMonday,
  MONTH_NAMES,
  getItemsForDate as getItemsForDateUtil,
  getNameValue as getNameValueUtil,
  getEventStyle,
} from '@/lib/calendarUtils';
import { getFilteredItems } from '@/lib/filterUtils';

interface DashboardShellProps {
  dashboard: MonthlyDashboardConfig | null;
  collections: any[];
  onUpdate: (patch: Partial<MonthlyDashboardConfig>) => void;
  onViewDetail: (item: any) => void;
  onDelete: (id: string) => void;
  dashboardFilters: Record<string, any[]>;
  setDashboardFilters: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
}


const months = MONTH_NAMES;

  function itemMatchesTypeValues(itemValue: any, typeValues: string[], fieldType?: string): boolean {
    if (!typeValues || typeValues.length === 0) return true;
    // Logique OU pour les champs multi_select et select
    if (fieldType === 'multi_select' || fieldType === 'select') {
      if (Array.isArray(itemValue)) {
        // Au moins une des valeurs doit être présente
        return typeValues.some(v => itemValue.includes(v));
      }
      // Pour select simple
      return typeValues.includes(itemValue);
    }
    // Pour les autres types, on garde le comportement actuel (ET)
    if (Array.isArray(itemValue)) {
      return typeValues.every(v => itemValue.includes(v));
    }
    if ((fieldType === 'text' || fieldType === 'url') && typeof itemValue === 'string') {
      return typeValues.every(v =>
        typeof v === 'string' && v.trim() !== '' && itemValue.toLowerCase().includes(v.toLowerCase())
      );
    }
    return typeValues.every(v => v === itemValue);
  }
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


const DashboardShell: React.FC<DashboardShellProps> = ({ dashboard, collections, onUpdate, onViewDetail, onDelete, dashboardFilters, setDashboardFilters }) => {
  // Exemple d'utilisation si besoin de synchronisation ERP dans le dashboard :
  // useErpSync({ collections, ...autresProps, useStringifyDeps: false });
      // Early return pour garantir l'ordre des hooks
      if (!dashboard) {
        return (
          <div className="flex items-center justify-center h-full text-neutral-500">
            <p>Dashboard non accessible</p>
          </div>
        );
      }
      const [showFilterModal, setShowFilterModal] = useState(false);

      // Ajout d'un filtre (via props)
      const handleAddFilter = (property: string, operator: string, value: any) => {
        if (!dashboard || !dashboardFilters || !setDashboardFilters) return;
        setDashboardFilters((prev: any) => ({
          ...prev,
          [dashboard.id]: [...(prev[dashboard.id] || []), { property, operator, value }]
        }));
        setShowFilterModal(false);
      };
      // Suppression d'un filtre (via props)
      const handleRemoveFilter = (idx: number) => {
        if (!dashboard || !dashboardFilters || !setDashboardFilters) return;
        setDashboardFilters((prev: any) => ({
          ...prev,
          [dashboard.id]: (prev[dashboard.id] || []).filter((_: any, i: number) => i !== idx)
        }));
      };

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  const collection = useMemo(
    () => collections.find((c) => c.id === dashboard?.sourceCollectionId),
    [collections, dashboard?.sourceCollectionId]
  );

  const properties = collection?.properties || [];
  // Utilise la logique avancée de filterUtils pour filtrer les items
  const filteredItems = useMemo(() => {
    if (!dashboard || !collection?.items) return [];
    const filters = dashboardFilters?.[dashboard.id] || [];
    // On simule une config de vue pour getFilteredItems
    const fakeViewConfig = { filters };
    return getFilteredItems(collection, fakeViewConfig, { collectionId: null, ids: [] }, collection.id, collections);
  }, [dashboard, collection, dashboardFilters, collections]);

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
    // Si dashboard.typeField pointe sur une propriété existante, on l'utilise
    if (dashboard?.typeField) {
      const prop = properties.find((p: any) => p.id === dashboard.typeField);
      if (prop) return dashboard.typeField;
    }
    // Sinon, on prend la première propriété disponible (hors "id")
    const first = properties.find((p: any) => p.id !== 'id');
    return first ? first.id : null;
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
      // Utiliser les items filtrés si c'est la collection principale, sinon filtrer aussi la collection liée
      let groupItems = [];
      if (groupCollection.id === collection?.id) {
        groupItems = filteredItems;
      } else {
        // Appliquer les mêmes filtres globaux du dashboard à la collection liée
        const filters = dashboardFilters?.[dashboard.id] || [];
        const fakeViewConfig = { filters };
        groupItems = getFilteredItems(groupCollection, fakeViewConfig, { collectionId: null, ids: [] }, groupCollection.id, collections);
      }
      // Nouveau : filtrage hiérarchique par champ, chaque niveau filtre sur son propre champ si défini
      let filteredGroupItems = groupItems;
      // On construit la liste des filtres hiérarchiques [{field, values}]
      let filterHierarchy: { field: string, values: string[] }[] = [];
      if (leaf._parentPath && Array.isArray(leaf._parentPath)) {
        leaf._parentPath.forEach((parent: any) => {
          if (parent.filterField && Array.isArray(parent.typeValues) && parent.typeValues.length > 0) {
            filterHierarchy.push({ field: parent.filterField, values: parent.typeValues.filter((v: any) => !!v) });
          }
        });
      }
      if (leaf.filterField && Array.isArray(leaf.typeValues) && leaf.typeValues.length > 0) {
        filterHierarchy.push({ field: leaf.filterField, values: leaf.typeValues.filter((v: any) => !!v) });
      }
      // On applique chaque filtre dans l'ordre, en préfiltrant à chaque étape
      filterHierarchy.forEach(({ field, values }) => {
        const prop = groupProperties.find((p: any) => p.id === field);
        if (values.length > 0 && prop) {
          filteredGroupItems = filteredGroupItems.filter((item: any) =>
            itemMatchesTypeValues(item[field], values, prop.type)
          );
        }
      });
      groupItems = filteredGroupItems;
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
      // console.log(dateField);
      if (!dateField) return;

      // (plus besoin de gérer filterField hérité ici, la logique de filtrage hiérarchique le gère déjà)

      // Pour chaque jour du mois
      daysOfMonth.forEach((day) => {
        const key = day.toLocaleDateString('fr-CA'); // format YYYY-MM-DD
        if (!daily[key]) daily[key] = {};
        if (!dailyObjectDurations[key]) dailyObjectDurations[key] = {};
        if (!dailyObjectDurations[key][leaf.id]) dailyObjectDurations[key][leaf.id] = {};

        // Pour chaque item filtré strictement, on utilise les _eventSegments pour savoir s'il y a une plage ce jour-là
        groupItems.forEach((item: any) => {
          const segments = Array.isArray(item._eventSegments) ? item._eventSegments : [];
          // On filtre par label : uniquement les segments dont le label correspond exactement à la colonne (leaf.label)
          const segmentsForDay = segments.filter((seg: any) => {
            if (typeof seg.label !== 'string' || seg.label.trim() === '' || !dateField || seg.label !== dateField.name) return false;
            const segStart = new Date(seg.start);
            const segEnd = new Date(seg.end);
            // On ne prend en compte que les segments dont le start ET le end sont le même jour (donc pas de multi-jour)
            return segStart.toLocaleDateString('fr-CA') === key && segEnd.toLocaleDateString('fr-CA') === key;
          });
          let totalHours = 0;
          segmentsForDay.forEach((seg: any) => {
            const segStart = new Date(seg.start);
            const segEnd = new Date(seg.end);
            const hours = (segEnd.getTime() - segStart.getTime()) / (1000 * 60 * 60);
            totalHours += Math.max(0, hours);
          });
          if (totalHours > 0) {
            dailyObjectDurations[key][leaf.id][item.id] = totalHours;
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
          // On cherche le type du champ pour filtrer correctement
          const propType = groupProperties.find((p: any) => p.id === resolvedTypeField)?.type;
          if (!itemMatchesTypeValues(item[resolvedTypeField], typeValues, propType)) return;
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
  }, [dashboard, collection, collections, properties, filteredItems, leafColumns, resolvedTypeField]);

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
      <div key={week.week} className="overflow-auto rounded-sm shadow-inner text-neutral-700 dark:text-white shadow-black/10 dark:shadow-black/40">
        <table className="min-w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: "30px" }} />
            <col style={{ width: "120px" }} />
            {leafColumns.map((leaf) => (
              <col key={leaf.id + "-count"} style={{ width: "100px" }} />
            ))}
            {leafColumns.map((leaf) => (
              <col key={leaf.id + "-duration"} style={{ width: "100px" }} />
            ))}
          </colgroup>
          <thead className="bg-gray-300 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-400">
            {(() => {
              const headerRows = getTableHeaderRows();
              return (
                <>
                  {/* Ligne d'entête principale : Total durée + Semaine + colonnes dynamiques */}
                  <tr>
                    <th
                      className="px-3 py-2 text-left border-b border-black/15 dark:border-white/15 whitespace-nowrap"
                      rowSpan={headerRows.length}
                    >
                      Total durée
                    </th>
                    <th
                      className="px-3 py-2 text-left border-b border-black/15 dark:border-white/15 whitespace-nowrap"
                      rowSpan={headerRows.length}
                    >
                      Semaine {week.week}
                      {week.days.length > 0 && (
                        <span className="ml-2 text-xs text-neutral-600 dark:text-neutral-400 font-normal">
                          du {week.days[0].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          {' '}au {week.days[week.days.length - 1].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      )}
                    </th>
                    {headerRows[0].map((cell: any, i: number) => (
                      <th
                        key={i}
                        colSpan={cell.colSpan}
                        rowSpan={cell.rowSpan}
                        className={`px-3 py-2 text-center border-b border-l border-black/10 dark:border-white/10 ${cell.isLeaf ? 'bg-gray-200 dark:bg-neutral-900/60' : 'bg-gray-300 dark:bg-neutral-900/80'}`}
                      >
                        {cell.label}
                      </th>
                    ))}
                  </tr>
                  {/* Les autres lignes d'entête dynamiques (hors première) */}
                  {headerRows.slice(1).map((row, rowIdx) => (
                    <tr key={rowIdx + 1}>
                      {/* On saute les deux premières colonnes (Total durée + Semaine) */}
                      {row.map((cell: any, i: number) => (
                        <th
                          key={i}
                          colSpan={cell.colSpan}
                          rowSpan={cell.rowSpan}
                          className={`px-3 py-2 text-center border-b border-l border-black/10 dark:border-white/10 ${cell.isLeaf ? 'bg-gray-200 dark:bg-neutral-900/60' : 'bg-gray-300 dark:bg-neutral-900/80'}`}
                        >
                          {cell.label}
                        </th>
                      ))}
                    </tr>
                  ))}
                  {/* Ligne des métriques (Nb/Durée) pour chaque feuille profonde */}
                  <tr className="bg-gray-300 text-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-400">
                    <th className="px-3 py-1 text-left border-b border-l border-black/10 dark:border-white/10 max-w-[50px]">Durée totale</th>
                    <th className="px-3 py-1 text-left border-b border-l border-black/10 dark:border-white/10">Jour</th>
                    {leafColumns.map((leaf: any) => (
                      <React.Fragment key={leaf.id + '-metrics'}>
                        <th className="px-3 py-1 text-left border-b border-l border-black/10 dark:border-white/10">Nombre</th>
                        <th className="px-3 py-1 text-left border-b border-l border-black/10 dark:border-white/10">Durée</th>
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
              // Calculer la durée totale pour ce jour (somme de toutes les feuilles)
              const totalDuration = leafColumns.reduce((acc, leaf) => {
                const cell = aggregates.daily[key]?.[leaf.id];
                return acc + (cell && cell.duration ? cell.duration : 0);
              }, 0);
              return (
                <tr key={`${week.week}-${key}`} className="border-b border-black/10 dark:border-white/10 odd:bg-gray-200 dark:odd:bg-neutral-900/40">
                  <td className="px-3 py-2 text-right text-neutral-700 dark:text-white border-r border-black/10 dark:border-white/10 font-bold max-w-[50px]">
                    {totalDuration ? formatDurationHeureMinute(totalDuration) : ''}
                  </td>
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-200 font-medium border-r border-black/10 dark:border-white/10">
                    {day.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </td>
                  {leafColumns.map((leaf: any) => {
                      const cell = aggregates.daily[key]?.[leaf.id] || { count: 0, duration: 0 };
                      const span = spanForDay(leaf.id, key);
                      // Correction : afficher le nombre pour les dates simples (pas de span)
                      let countValue = '';
                      if (span && span.isStart) {
                        countValue = '1';
                      } else if (!span && cell.count > 0) {
                        countValue = cell.count.toString();
                      }
                      // ...existing code...
                      // Ajout du menu contextuel sur la cellule d'item si un item unique est présent ce jour-là
                      const itemIds = Object.keys(aggregates.dailyObjectDurations[key]?.[leaf.id] || {});
                      // Pour chaque item, retrouver la bonne collection (par item.collectionId)
                      const itemsInCell = itemIds
                        .map((itemId) => {
                          // Cherche dans toutes les collections
                          for (const coll of collections) {
                            const found = coll.items?.find((it: any) => it.id === itemId);
                            if (found) return { ...found, _collection: coll };
                          }
                          return null;
                        })
                        .filter(Boolean);
                      const cellContent = (
                        <>
                          {cell.duration ? formatDurationHeureMinute(cell.duration) : ''}
                          {itemsInCell.length > 0 && (
                            <div className="flex flex-col gap-0.5 mt-1">
                              {itemsInCell.map((item, idx) => (
                                <ItemContextMenu
                                  key={item.id}
                                  item={item}
                                  onViewDetail={() => onViewDetail({ ...item, _collection: item._collection })}
                                  onDelete={() => onDelete(item?.id)}
                                  canEdit={false}
                                  quickEditProperties={[]}
                                >
                                  <div className="text-[11px] text-neutral-500 dark:text-neutral-600 truncate cursor-pointer hover:underline" style={{width: '100%'}}>
                                    {getNameValueUtil(item, item._collection)}
                                  </div>
                                </ItemContextMenu>
                              ))}
                            </div>
                          )}
                          {span && (
                            <div className="text-[11px] text-neutral-700 dark:text-white truncate">{span.label}</div>
                          )}
                        </>
                      );
                      const hasObject = itemsInCell.length > 0;
                      const countClasses = span
                        ? `px-3 py-2 text-right text-neutral-700 dark:text-white border-l border-white/30  max-w-[130px] overflow-hidden bg-white/10${hasObject ? ' bg-white/5' : ''}`
                        : `px-3 py-2 text-right text-neutral-700 dark:text-white border-l border-white/30 max-w-[130px] overflow-hidden bg-gray-300 dark:bg-neutral-900/30${hasObject ? ' bg-white/10' : ''}`;
                      const durationClasses = span
                        ? `px-3 py-2 text-right text-neutral-700 dark:text-white border-l ${span.isEnd ? '' : ''} ${
                            span.isStart ? 'rounded-l-md' : ''
                          } border-white/30 bg-white/10${hasObject ? ' bg-white/5' : ''}`
                        : `px-3 py-2 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 max-w-[130px] overflow-hidden bg-gray-200 dark:bg-neutral-900/20${hasObject ? ' bg-white/10' : ''}`;
                      // Afficher tous les items avec leur menu contextuel
                      return (
                        <React.Fragment key={`${week.week}-${key}-${leaf.id}`}>
                          <td className={countClasses}>{countValue}</td>
                          <td className={durationClasses}>{cellContent}</td>
                        </React.Fragment>
                      );
                    })}
                </tr>
              );
            })}
            {/* Total général de la semaine (tous les projets et durée cumulée) */}
            <tr className="bg-gray-300 dark:bg-neutral-900/40">
              <td className="px-3 py-2 font-bold text-neutral-700 dark:text-white border-r border-black/10 dark:border-white/10">Total général</td>
              {(() => {
                let totalCount = 0;
                let totalDuration = 0;
                leafColumns.forEach((leaf: any) => {
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
                  totalCount += count;
                  totalDuration += duration;
                });
                return [
                  <td key="total-count" className="px-3 py-2 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 font-bold">{totalCount || 0} projet(s) - {totalDuration ? formatDurationHeureMinute(totalDuration) : '0h00'}</td>
                ];
              })()}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  const renderMonthTotals = () => {
    if (!aggregates) return null;
    return (
      <div className="overflow-auto rounded-sm shadow-inner shadow-black/40">
        <table className="min-w-full text-sm table-fixed">
          <colgroup>
            <col style={{ width: '120px' }} />
            {leafColumns.map((_, i) => (
              <col key={i + '-count'} style={{ width: '80px' }} />
            ))}
            {leafColumns.map((_, i) => (
              <col key={i + '-duration'} style={{ width: '100px' }} />
            ))}
          </colgroup>
          <thead className="bg-gray-300 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-400">
            <tr>
              <th className="px-3 py-2 text-left border-b border-black/15 dark:border-white/15">Total Mois</th>
              {leafColumns.map((leaf) => (
                <th
                  key={leaf.id}
                  colSpan={2}
                  className="px-3 py-2 text-left border-b border-l border-black/10 dark:border-white/10 bg-gray-300 dark:bg-neutral-900/70"
                >
                  {leaf.label}
                </th>
              ))}
            </tr>
            <tr className="bg-gray-300 dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-400">
              <th className="px-3 py-1 text-left border-b border-black/15 dark:border-white/15">Mois</th>
              {leafColumns.map((leaf) => (
                <React.Fragment key={`${leaf.id}-month-metrics`}>
                  <th className="px-3 py-1 text-left border-b border-l border-black/10 dark:border-white/10">Nombre</th>
                  <th className="px-3 py-1 text-left border-b border-l border-black/10 dark:border-white/10">Durée</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white/10">
              <td className="px-3 py-2 font-semibold text-neutral-700 dark:text-white border-r border-black/10 dark:border-white/10">Total Mois</td>
              {leafColumns.map((leaf) => {
                // Nouveau calcul : additionner tous les items du mois (tous les jours)
                let count = 0;
                let duration = 0;
                Object.keys(aggregates.daily).forEach((key) => {
                  const cell = aggregates.daily[key]?.[leaf.id];
                  if (cell) {
                    count += cell.count;
                    duration += cell.duration;
                  }
                });
                return (
                  <React.Fragment key={`month-total-${leaf.id}`}>
                    <td className="px-3 py-2 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10">{count || ''}</td>
                    <td className="px-3 py-2 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10">
                      {duration ? formatDurationHeureMinute(duration) : ''}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
            {/* Total général du mois (tous les projets et durée cumulée) */}
            <tr className="bg-gray-300 dark:bg-neutral-900/40">
              <td className="px-3 py-2 font-bold text-neutral-700 dark:text-white border-r border-black/10 dark:border-white/10">Total général</td>
              {(() => {
                let totalCount = 0;
                let totalDuration = 0;
                leafColumns.forEach((leaf: any) => {
                  let count = 0;
                  let duration = 0;
                  Object.keys(aggregates.daily).forEach((key) => {
                    const cell = aggregates.daily[key]?.[leaf.id];
                    if (cell) {
                      count += cell.count;
                      duration += cell.duration;
                    }
                  });
                  totalCount += count;
                  totalDuration += duration;
                });
                return [
                  <td key="total-count-label" className="px-3 py-2 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 font-bold">Nombre</td>,
                  <td key="total-count" className="px-3 py-2 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 font-bold">{totalCount || ''}</td>,
                  <td key="total-duration-label" className="px-3 py-2 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 font-bold">Heures</td>,
                  <td key="total-duration" className="px-3 py-2 text-right text-neutral-700 dark:text-white border-l border-black/10 dark:border-white/10 font-bold">{totalDuration ? formatDurationHeureMinute(totalDuration) : ''}</td>
                ];
              })()}
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
      {/* Filtres globaux dashboard déplacés dans l'entête */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            value={dashboard.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="bg-transparent border border-black/10 dark:border-white/10 rounded px-3 py-2 text-lg font-semibold focus:outline-none focus:border-blue-500/60"
          />
          <div className="flex flex-wrap gap-2">
            {(dashboard && dashboardFilters?.[dashboard.id] ? dashboardFilters[dashboard.id] : []).map((filter: any, idx: number) => {
              const prop = properties.find((p: any) => p.id === filter.property);
              return (
                <span key={idx} className="flex items-center gap-1 px-3 py-1.5 bg-violet-500/20 text-violet-200 rounded-lg text-sm border border-violet-500/30">
                  <span>{prop?.name || filter.property} {filter.operator} {Array.isArray(filter.value) ? filter.value.join(', ') : String(filter.value)}</span>
                  <button onClick={() => handleRemoveFilter(idx)} className="hover:bg-violet-500/30 rounded p-0.5"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                </span>
              );
            })}
          </div>
          {showFilterModal && (
            <Suspense fallback={<div className="text-neutral-700 dark:text-white">Chargement…</div>}>
              <FilterModal
                properties={properties}
                collections={collections}
                onClose={() => setShowFilterModal(false)}
                onAdd={handleAddFilter}
              />
            </Suspense>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={dashboard.month}
            onChange={(e) => onUpdate({ month: Number(e.target.value) })}
            className="bg-gray-200 dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded px-3 py-2 text-sm"
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
            className="bg-gray-200 dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded px-3 py-2 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>



      <div className="flex-1  text-neutral-600 dark:text-neutral-200 p-10">
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