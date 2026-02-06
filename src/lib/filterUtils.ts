export const getFilteredItems = (
  currentCollection: any,
  currentViewConfig: any,
  relationFilter: { collectionId: string | null; ids: string[] },
  activeCollection: string | null,
  collections: any[]
) => {
  if (!currentCollection || !currentViewConfig) return [];
  let filtered = [...currentCollection.items];
  
  currentViewConfig.filters.forEach((filter: any) => {
    filtered = filtered.filter((item) => {
      const prop = (currentCollection.properties || []).find((p: any) => p.id === filter.property);
      if (!prop) return true;
      const itemVal = item[filter.property];
      const fVal = filter.value;
      const isArrayVal = Array.isArray(itemVal);

      switch (filter.operator) {
        case 'equals':
          if (isArrayVal) {
            if (Array.isArray(fVal)) {
              // Matches any selected value
              return fVal.some((v: any) => itemVal.includes(v));
            }
            return itemVal.includes(fVal);
          }
          return itemVal === fVal;
        case 'not_equals':
          if (isArrayVal) {
            if (Array.isArray(fVal)) {
              // Doesn't match any selected value
              return !fVal.some((v: any) => itemVal.includes(v));
            }
            return !itemVal.includes(fVal);
          }
          return itemVal !== fVal;
        case 'contains':
          if (isArrayVal) {
            if (Array.isArray(fVal)) {
              return fVal.some((fv: any) =>
                itemVal.some((v: any) =>
                  String(v).toLowerCase().includes(String(fv).toLowerCase())
                )
              );
            }
            return itemVal.some((v: any) =>
              String(v).toLowerCase().includes(String(fVal).toLowerCase())
            );
          }
          return String(itemVal || '')
            .toLowerCase()
            .includes(String(fVal || '').toLowerCase());
        case 'greater':
          return Number(itemVal) > Number(fVal);
        case 'less':
          return Number(itemVal) < Number(fVal);
        case 'is_empty':
          return isArrayVal ? itemVal.length === 0 : !itemVal || itemVal === '';
        case 'is_not_empty':
          return isArrayVal ? itemVal.length > 0 : itemVal && itemVal !== '';
        default:
          return true;
      }
    });
  });

  if (relationFilter.collectionId === activeCollection && relationFilter.ids?.length) {
    filtered = filtered.filter((item) => relationFilter.ids.includes(item.id));
  }
  
  return filtered;
};

export const getOrderedProperties = (
  currentCollection: any,
  currentViewConfig: any
) => {
  const props = currentCollection?.properties || [];
  const order =
    currentViewConfig?.fieldOrder && currentViewConfig.fieldOrder.length
      ? currentViewConfig.fieldOrder
      : props.map((p: any) => p.id);
  const ordered = order
    .map((id: string) => props.find((p: any) => p.id === id))
    .filter(Boolean) as any[];
  const missing = props.filter((p: any) => !order.includes(p.id));
  return [...ordered, ...missing];
};
