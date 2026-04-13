/**
 * Hook pour calculer les données d'un module de dashboard.
 * Applique le filtre date global puis les filtres propres au module.
 */

import { useMemo } from 'react';
import { parseISO, isWithinInterval } from 'date-fns';
import { DashboardModuleConfig, GlobalDatePreset } from '@/lib/dashboardTypes';
import { Property, Item, Collection } from '@/lib/types';
import { applyModuleFilters, computeDateRange, getDateValue } from '@/lib/utils/dashboardUtils';

export interface GlobalDateFilter {
  preset?: GlobalDatePreset;
  start?: string;
  end?: string;
  /** ID du champ date ciblé (sinon, premier champ date de la collection) */
  field?: string;
}

export interface DashboardItemData {
  collection: Collection | null;
  allItems: Item[];
  /** Items après application des filtres (global date + filtres module) */
  filteredItems: Item[];
  properties: Property[];
  /** Champs de type date/date_range de la collection */
  dateFields: Property[];
  hasDateField: boolean;
  /** Champs numériques */
  numericFields: Property[];
  /** Champs select / multiselect */
  selectFields: Property[];
  /** Champs texte */
  textFields: Property[];
}

export function useDashboardItemData(
  module: DashboardModuleConfig,
  collections: Collection[],
  globalFilter?: GlobalDateFilter
): DashboardItemData {
  const collection = useMemo(
    () => collections.find((c) => c.id === module.collectionId) ?? null,
    [collections, module.collectionId]
  );

  const properties: Property[] = useMemo(
    () => collection?.properties ?? [],
    [collection]
  );

  const dateFields = useMemo(
    () => properties.filter((p) => p.type === 'date' || (p.type as string) === 'date_range'),
    [properties]
  );

  const numericFields = useMemo(
    () => properties.filter((p) => p.type === 'number'),
    [properties]
  );

  const selectFields = useMemo(
    () => properties.filter(
      (p) => p.type === 'select' || p.type === 'multiselect' || (p.type as string) === 'multi_select'
    ),
    [properties]
  );

  const textFields = useMemo(
    () => properties.filter((p) => p.type === 'text'),
    [properties]
  );

  const allItems: Item[] = useMemo(
    () => collection?.items ?? [],
    [collection]
  );

  const filteredItems: Item[] = useMemo(() => {
    let items = [...allItems];

    // 1) Filtre date global (ignoré pour recap — il gère sa propre plage via navigation)
    const hasGlobalDate = globalFilter?.preset || globalFilter?.start || globalFilter?.end;
    if (hasGlobalDate && module.type !== 'recap') {
      const dateFieldId = globalFilter?.field ?? module.dateField ?? dateFields[0]?.id;
      if (dateFieldId) {
        const range = computeDateRange(
          globalFilter!.preset ?? 'custom',
          globalFilter?.start,
          globalFilter?.end
        );
        items = items.filter((item) => {
          const dateStr = getDateValue(item, dateFieldId);
          if (!dateStr) return false;
          try {
            const date = parseISO(dateStr);
            return isWithinInterval(date, { start: range.start, end: range.end });
          } catch {
            return false;
          }
        });
      }
    }

    // 2) Filtres propres au module
    if (module.filters && module.filters.length > 0) {
      items = applyModuleFilters(items, module.filters, properties);
    }

    return items;
  }, [allItems, module.filters, module.dateField, globalFilter, properties, dateFields]);

  return {
    collection,
    allItems,
    filteredItems,
    properties,
    dateFields,
    hasDateField: dateFields.length > 0,
    numericFields,
    selectFields,
    textFields,
  };
}
