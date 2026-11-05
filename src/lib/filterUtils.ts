
import { normalizeRelationIds } from '@/lib/utils/relationUtils';
import type { Collection, CollectionFilter } from '@/lib/types';
import { MONTH_NAMES } from '@/lib/utils/dateUtils';

export const getFilteredItems = (
  currentCollection: any,
  currentViewConfig: any,
  relationFilter: { collectionId: string | null; ids: string[] },
  activeCollection: string | null,
  collections: any[]
) => {
  if (!currentCollection || !currentViewConfig) return [];
  let filtered = [...currentCollection.items];

  const normalizeValueByProp = (rawValue: any, prop: any) => {
    if (!prop) return rawValue;
    if ((prop.type === 'date' || prop.type === 'date_range') && prop.dateGranularity && rawValue) {
      const date = new Date(rawValue);
      const granularity = prop.dateGranularity;

      if (granularity === 'year') {
        return String(date.getFullYear());
      }
      if (granularity === 'month') {
        return MONTH_NAMES[date.getMonth()];
      }
      if (granularity === 'month-year') {
        return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
      }
    }
    return rawValue;
  };

  // Normalise une valeur multiselect : aplatit les tableaux imbriqués, convertit en strings
  const normalizeMultiselectVal = (val: any): string[] => {
    if (!Array.isArray(val)) return val != null && val !== '' ? [String(val)] : [];
    return val.flatMap((v: any) => Array.isArray(v) ? v.map(String) : [String(v)]);
  };

  const matchesFilterValue = (itemVal: any, filter: any, prop: any) => {
    const fVal = filter.value;
    const isMultiSelectProp = prop?.type === 'multiselect' || prop?.type === 'multi_select';
    const rawNormalized = normalizeValueByProp(itemVal, prop);
    // Pour les champs multiselect, on normalise en tableau plat de strings
    const normalizedVal = isMultiSelectProp ? normalizeMultiselectVal(rawNormalized) : rawNormalized;
    const isArrayVal = Array.isArray(normalizedVal);

    switch (filter.operator) {
      case 'equals':
        if (isArrayVal) {
          if (Array.isArray(fVal)) {
            return fVal.some((v: any) => normalizedVal.includes(v));
          }
          return normalizedVal.includes(fVal);
        }
        if (Array.isArray(fVal)) {
          return fVal.includes(normalizedVal);
        }
        return normalizedVal === fVal;
      case 'not_equals':
        if (isArrayVal) {
          if (Array.isArray(fVal)) {
            return !fVal.some((v: any) => normalizedVal.includes(v));
          }
          return !normalizedVal.includes(fVal);
        }
        if (Array.isArray(fVal)) {
          return !fVal.includes(normalizedVal);
        }
        return normalizedVal !== fVal;
      case 'contains':
        if (isArrayVal) {
          if (Array.isArray(fVal)) {
            return fVal.some((fv: any) =>
              normalizedVal.some((v: any) =>
                String(v).toLowerCase().includes(String(fv).toLowerCase())
              )
            );
          }
          return normalizedVal.some((v: any) =>
            String(v).toLowerCase().includes(String(fVal).toLowerCase())
          );
        }
        if (Array.isArray(fVal)) {
          return fVal.some((fv: any) =>
            String(normalizedVal || '')
              .toLowerCase()
              .includes(String(fv || '').toLowerCase())
          );
        }
        return String(normalizedVal || '')
          .toLowerCase()
          .includes(String(fVal || '').toLowerCase());
      case 'greater':
        return Number(normalizedVal) > Number(fVal);
      case 'less':
        return Number(normalizedVal) < Number(fVal);
      case 'is_empty':
        return isArrayVal ? normalizedVal.length === 0 : !normalizedVal || normalizedVal === '';
      case 'is_not_empty':
        return isArrayVal ? normalizedVal.length > 0 : normalizedVal && normalizedVal !== '';
      default:
        return true;
    }
  };

  const getLinkedColumnConfig = (filter: any) => {
    if (filter?.isRelationLinkedColumn && filter?.sourceRelationPropertyId && filter?.sourceDisplayFieldId) {
      return {
        sourceRelationPropertyId: filter.sourceRelationPropertyId,
        sourceDisplayFieldId: filter.sourceDisplayFieldId,
        sourceTargetCollectionId: filter.sourceTargetCollectionId,
      };
    }

    const parts = String(filter?.property || '').split('__relcol__');
    if (parts.length === 2 && parts[0] && parts[1]) {
      return {
        sourceRelationPropertyId: parts[0],
        sourceDisplayFieldId: parts[1],
        sourceTargetCollectionId: undefined,
      };
    }

    return null;
  };

  const getProjectedLinkedValues = (item: any, config: any) => {
    if (!config) return [];

    const relationValue = item?.[config.sourceRelationPropertyId];
    const relatedIds = normalizeRelationIds(relationValue);
    if (!relatedIds.length) return [];

    const sourceRelationProp = (currentCollection?.properties || []).find((p: any) => p.id === config.sourceRelationPropertyId);
    const targetCollection = collections.find((c: any) => c.id === config.sourceTargetCollectionId)
      || collections.find((c: any) => c.id === sourceRelationProp?.relation?.targetCollectionId);
    const targetItems = targetCollection?.items || [];

    return relatedIds
      .map((id: string) => targetItems.find((it: any) => it.id === id)?.[config.sourceDisplayFieldId])
      .filter((v: any) => v !== undefined && v !== null && v !== '');
  };
  
  const pinnedFilters = (currentCollection.pinnedFilters ?? []).filter((filter: CollectionFilter) =>
    filter.collectionFields || !filter.sourceCollectionId || filter.sourceCollectionId === currentCollection.id
  );
  const viewFilters = (currentViewConfig.filters ?? []).filter((filter: CollectionFilter) =>
    filter.collectionFields || currentViewConfig.type !== 'layout' || !filter.sourceCollectionId || filter.sourceCollectionId === currentCollection.id
  );
  const filters = [...pinnedFilters, ...viewFilters];
  const matchesRule = (item: any, filter: any): boolean => {
    const sourceCollectionId = filter?.sourceCollectionId || currentCollection?.id;

    if (sourceCollectionId === currentCollection?.id) {
      const prop = (currentCollection.properties || []).find((p: any) => p.id === filter.property);
      if (prop) {
        return matchesFilterValue(item[filter.property], filter, prop);
      }

      const linkedConfig = getLinkedColumnConfig(filter);
      if (!linkedConfig) return true;

      const sourceRelationProp = (currentCollection?.properties || []).find((p: any) => p.id === linkedConfig.sourceRelationPropertyId);
      const targetCollection = collections.find((c: any) => c.id === linkedConfig.sourceTargetCollectionId)
        || collections.find((c: any) => c.id === sourceRelationProp?.relation?.targetCollectionId);
      const targetProp = (targetCollection?.properties || []).find((p: any) => p.id === linkedConfig.sourceDisplayFieldId);
      const projectedValues = getProjectedLinkedValues(item, linkedConfig);

      if (filter.operator === 'is_empty') {
        return projectedValues.length === 0;
      }
      if (filter.operator === 'is_not_empty') {
        return projectedValues.length > 0;
      }
      if (filter.operator === 'not_equals' || filter.operator === 'not_contains') {
        if (!projectedValues.length) return true;
        return projectedValues.every((val: any) => matchesFilterValue(val, filter, targetProp));
      }

      return projectedValues.some((val: any) => matchesFilterValue(val, filter, targetProp));
    }

    const sourceCollection = collections.find((c: any) => c.id === sourceCollectionId);
    if (!sourceCollection) return true;
    const sourceProp = (sourceCollection.properties || []).find((p: any) => p.id === filter.property);
    if (!sourceProp) return true;

    const relationProps = (currentCollection.properties || []).filter(
      (p: any) => p.type === 'relation' && p?.relation?.targetCollectionId === sourceCollectionId
    );
    if (!relationProps.length) return false;

    const relatedItems = relationProps.flatMap((relProp: any) => {
      const relationValue = item?.[relProp.id];
      const ids = normalizeRelationIds(relationValue);
      return ids
        .map((id: string) => (sourceCollection.items || []).find((it: any) => it.id === id))
        .filter(Boolean);
    });

    if (filter.operator === 'is_empty') {
      if (!relatedItems.length) return true;
      return relatedItems.every((relItem: any) => matchesFilterValue(relItem?.[filter.property], filter, sourceProp));
    }
    if (filter.operator === 'is_not_empty') {
      return relatedItems.some((relItem: any) => matchesFilterValue(relItem?.[filter.property], filter, sourceProp));
    }
    if (filter.operator === 'not_equals' || filter.operator === 'not_contains') {
      if (!relatedItems.length) return true;
      return relatedItems.every((relItem: any) => matchesFilterValue(relItem?.[filter.property], filter, sourceProp));
    }
    return relatedItems.some((relItem: any) => matchesFilterValue(relItem?.[filter.property], filter, sourceProp));
  };

  const mappedProperties = filters.some((filter: CollectionFilter) => filter.collectionFields)
    ? getOrderedProperties(currentCollection, null, collections)
    : [];
  filters.forEach((filter: CollectionFilter) => {
    if (!filter.collectionFields) {
      filtered = filtered.filter((item) => matchesRule(item, filter));
      return;
    }
    const fields = (filter.collectionFields[currentCollection.id] ?? [])
      .map((id) => mappedProperties.find((property) => property.id === id))
      .filter(Boolean);
    if (!fields.length) return;
    const source = collections.find((collection) => collection.id === filter.sourceCollectionId) ?? currentCollection;
    const sourceProperty = getOrderedProperties(source, null, collections).find((property) => property.id === filter.property);
    const selectTypes = ['select', 'multiselect', 'multi_select'];
    const translateValue = (targetProperty: any) => {
      if (!selectTypes.includes(sourceProperty?.type) || !selectTypes.includes(targetProperty.type)) return filter.value;
      const normalizeOption = (option: any) => typeof option === 'string'
        ? { value: option, label: option }
        : { value: option.value, label: option.label ?? option.value };
      const sourceOptions = (sourceProperty.options ?? []).map(normalizeOption);
      const targetOptions = (targetProperty.options ?? []).map(normalizeOption);
      const translate = (value: unknown) => {
        const label = sourceOptions.find((option: any) => option.value === value)?.label;
        return targetOptions.find((option: any) => option.value === value)?.value
          ?? targetOptions.find((option: any) => label !== undefined && option.label === label)?.value
          ?? value;
      };
      return Array.isArray(filter.value) ? filter.value.map(translate) : translate(filter.value);
    };
    const rules = fields.map((property) => ({
      ...filter,
      value: translateValue(property),
      property: property.id,
      sourceCollectionId: currentCollection.id,
      isRelationLinkedColumn: Boolean(property.isRelationLinkedColumn),
      sourceRelationPropertyId: property.sourceRelationPropertyId,
      sourceDisplayFieldId: property.sourceDisplayFieldId,
      sourceTargetCollectionId: property.sourceTargetCollectionId,
    }));
    // Exclusion applies to every mapped field. Positive rules accept any field.
    const exclude = ['not_equals', 'not_contains', 'is_empty'].includes(filter.operator);
    filtered = filtered.filter((item) => exclude
      ? rules.every((rule) => matchesRule(item, rule))
      : rules.some((rule) => matchesRule(item, rule)));
  });

  if (relationFilter.collectionId === activeCollection && currentCollection.id === activeCollection && relationFilter.ids?.length) {
    filtered = filtered.filter((item) => relationFilter.ids.includes(item.id));
  }
  
  return filtered;
};

export const getOrderedProperties = (
  currentCollection: any,
  currentViewConfig: any,
  collections: any[] = []
) => {
  const props = currentCollection?.properties || [];
  const relationLinkedBySourceId = new Map<string, any[]>();

  props.forEach((prop: any) => {
    if (prop?.type !== 'relation') return;
    const configuredFieldIds = Array.isArray(prop?.relation?.displayFieldIds)
      ? prop.relation.displayFieldIds.filter((id: any) => typeof id === 'string' && id.trim() !== '')
      : [];
    if (!configuredFieldIds.length) return;

    const targetCollection = collections.find((c: any) => c.id === prop?.relation?.targetCollectionId);
    const targetProperties = targetCollection?.properties || [];

    const linkedColumns = configuredFieldIds
      .map((fieldId: string) => {
        const targetField = targetProperties.find((p: any) => p.id === fieldId);
        if (!targetField || targetField.type === 'relation') return null;
        return {
          ...targetField,
          id: `${prop.id}__relcol__${fieldId}`,
          name: `${prop.name} · ${targetField.name}`,
          icon: targetField.icon || prop.icon,
          color: targetField.color || prop.color,
          showContextMenu: false,
          isRelationLinkedColumn: true,
          sourceRelationPropertyId: prop.id,
          sourceDisplayFieldId: fieldId,
          sourceTargetCollectionId: prop?.relation?.targetCollectionId,
          sourceRelationType: prop?.relation?.type || 'many_to_many',
        };
      })
      .filter(Boolean);

    if (linkedColumns.length > 0) {
      relationLinkedBySourceId.set(prop.id, linkedColumns);
    }
  });

  const order =
    currentViewConfig?.fieldOrder && currentViewConfig.fieldOrder.length
      ? currentViewConfig.fieldOrder
      : props.map((p: any) => p.id);
  const orderedBase = order
    .map((id: string) => props.find((p: any) => p.id === id))
    .filter(Boolean) as any[];
  const missingBase = props.filter((p: any) => !order.includes(p.id));

  const withLinkedColumns: any[] = [];
  [...orderedBase, ...missingBase].forEach((prop: any) => {
    withLinkedColumns.push(prop);
    const linkedCols = relationLinkedBySourceId.get(prop.id) || [];
    if (linkedCols.length > 0) {
      withLinkedColumns.push(...linkedCols);
    }
  });

  return withLinkedColumns;
};


export function filterTargetsCollection(filter: CollectionFilter, collectionId: string, ownerId: string): boolean {
  return filter.collectionFields
    ? (filter.collectionFields[collectionId]?.length ?? 0) > 0
    : (filter.sourceCollectionId || ownerId) === collectionId;
}

/** A layout can display several collections, each with its own global rules. */
export function routeLayoutFilters(owner: Collection, collections: Collection[], layoutFilters: CollectionFilter[] = []): Collection[] {
  const pinned = owner.pinnedFilters ?? [];
  const filters = [...pinned, ...layoutFilters];

  return collections.map((target) => {
    if (target.id === owner.id) return target;
    const inherited = filters.filter((filter) => filterTargetsCollection(filter, target.id, owner.id));
    return inherited.length ? { ...target, pinnedFilters: [...(target.pinnedFilters ?? []), ...inherited] } : target;
  });
}
