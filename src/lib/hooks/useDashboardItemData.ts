/**
 * Hook pour calculer les données d'un module de dashboard.
 * Applique le filtre date global puis les filtres propres au module.
 */

import { useMemo } from 'react';
import { parseISO, isWithinInterval } from 'date-fns';
import { DashboardModuleConfig, GlobalDatePreset } from '@/lib/dashboardTypes';
import { Property, Item, Collection } from '@/lib/types';
import { applyModuleFilters, computeDateRange, getDateValue } from '@/lib/utils/dashboardUtils';
import { normalizeRelationIds } from '@/lib/utils/relationUtils';

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

function buildRelationLinkedProperties(collection: Collection | null, collections: Collection[]): Property[] {
  if (!collection) return [];

  return (collection.properties ?? [])
    .filter((prop) => prop.type === 'relation')
    .flatMap((relationProp) => {
      const displayFieldIds = Array.isArray(relationProp?.relation?.displayFieldIds)
        ? relationProp.relation!.displayFieldIds!.filter((id) => typeof id === 'string' && id.trim() !== '')
        : [];

      if (!displayFieldIds.length) return [];

      const targetCollection = collections.find((c) => c.id === relationProp?.relation?.targetCollectionId);
      const targetProperties = targetCollection?.properties ?? [];

      return displayFieldIds
        .map((fieldId) => {
          const targetField = targetProperties.find((p) => p.id === fieldId);
          if (!targetField || targetField.type === 'relation') return null;

          return {
            ...targetField,
            id: `${relationProp.id}__relcol__${fieldId}`,
            name: `${relationProp.name} · ${targetField.name}`,
            icon: targetField.icon || relationProp.icon,
            color: targetField.color || relationProp.color,
            showContextMenu: false,
            isRelationLinkedColumn: true,
            sourceRelationPropertyId: relationProp.id,
            sourceDisplayFieldId: fieldId,
            sourceTargetCollectionId: relationProp?.relation?.targetCollectionId,
            sourceRelationType: relationProp?.relation?.type || 'many_to_many',
          } as Property;
        })
        .filter((p): p is Property => Boolean(p));
    });
}

function projectLinkedValuesOnItems(
  items: Item[],
  linkedProperties: Property[],
  collection: Collection | null,
  collections: Collection[]
): Item[] {
  if (!items.length || !linkedProperties.length || !collection) return items;

  return items.map((item) => {
    const projected: Item = { ...item };

    linkedProperties.forEach((linkedProp) => {
      const sourceRelationPropertyId = linkedProp.sourceRelationPropertyId as string | undefined;
      const sourceDisplayFieldId = linkedProp.sourceDisplayFieldId as string | undefined;
      if (!sourceRelationPropertyId || !sourceDisplayFieldId) return;

      const sourceRelationProp = (collection.properties ?? []).find((p) => p.id === sourceRelationPropertyId);
      const targetCollectionId =
        (linkedProp.sourceTargetCollectionId as string | undefined) ?? sourceRelationProp?.relation?.targetCollectionId;
      const targetCollection = targetCollectionId
        ? collections.find((c) => c.id === targetCollectionId)
        : null;

      if (!targetCollection) return;

      const relationIds = normalizeRelationIds(item[sourceRelationPropertyId]);
      if (!relationIds.length) {
        projected[linkedProp.id] = null;
        return;
      }

      const rawValues = relationIds
        .map((id) => targetCollection.items?.find((it) => it.id === id)?.[sourceDisplayFieldId])
        .filter((value) => value !== undefined && value !== null && value !== '');

      if (!rawValues.length) {
        projected[linkedProp.id] = null;
        return;
      }

      if (linkedProp.type === 'multiselect' || (linkedProp.type as string) === 'multi_select') {
        projected[linkedProp.id] = rawValues.flatMap((value) => (Array.isArray(value) ? value : [value]));
        return;
      }

      projected[linkedProp.id] = rawValues[0];
    });

    return projected;
  });
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

  const relationLinkedProperties: Property[] = useMemo(
    () => buildRelationLinkedProperties(collection, collections),
    [collection, collections]
  );

  const properties: Property[] = useMemo(
    () => [...(collection?.properties ?? []), ...relationLinkedProperties],
    [collection, relationLinkedProperties]
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
    () => projectLinkedValuesOnItems(collection?.items ?? [], relationLinkedProperties, collection, collections),
    [collection, collections, relationLinkedProperties]
  );

  const filteredItems: Item[] = useMemo(() => {
    let items = [...allItems];

    // 1) Filtre date global
    const hasGlobalDate = globalFilter?.preset || globalFilter?.start || globalFilter?.end;
    if (hasGlobalDate) {
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
