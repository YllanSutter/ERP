
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
        const MONTH_NAMES = [
          'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        return MONTH_NAMES[date.getMonth()];
      }
      if (granularity === 'month-year') {
        const MONTH_NAMES = [
          'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
        ];
        return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
      }
    }
    return rawValue;
  };

  const matchesFilterValue = (itemVal: any, filter: any, prop: any) => {
    const fVal = filter.value;
    const normalizedVal = normalizeValueByProp(itemVal, prop);
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
    const relatedIds = Array.isArray(relationValue)
      ? relationValue
      : relationValue
        ? [relationValue]
        : [];
    if (!relatedIds.length) return [];

    const sourceRelationProp = (currentCollection?.properties || []).find((p: any) => p.id === config.sourceRelationPropertyId);
    const targetCollection = collections.find((c: any) => c.id === config.sourceTargetCollectionId)
      || collections.find((c: any) => c.id === sourceRelationProp?.relation?.targetCollectionId);
    const targetItems = targetCollection?.items || [];

    return relatedIds
      .map((id: string) => targetItems.find((it: any) => it.id === id)?.[config.sourceDisplayFieldId])
      .filter((v: any) => v !== undefined && v !== null && v !== '');
  };
  
  currentViewConfig.filters.forEach((filter: any) => {
    filtered = filtered.filter((item) => {
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
        if (filter.operator === 'not_equals') {
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
        const ids = Array.isArray(relationValue)
          ? relationValue
          : relationValue
            ? [relationValue]
            : [];
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
      if (filter.operator === 'not_equals') {
        if (!relatedItems.length) return true;
        return relatedItems.every((relItem: any) => matchesFilterValue(relItem?.[filter.property], filter, sourceProp));
      }

      return relatedItems.some((relItem: any) => matchesFilterValue(relItem?.[filter.property], filter, sourceProp));
    });
  });

  if (relationFilter.collectionId === activeCollection && relationFilter.ids?.length) {
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
