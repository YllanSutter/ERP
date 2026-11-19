// Inputs are immutable React snapshots: keep unchanged items/collections stable.
const calculatedCollectionCache = new WeakMap<object, any>();
const calculatedItemCaches = new WeakMap<object, WeakMap<object, any>>();
export type NumberCalculationOperation = 'add' | 'subtract' | 'multiply' | 'divide';

const parseNumberish = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = String(value).replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

export const isCalculatedNumberProperty = (property: any): boolean => {
  if (!property || property.type !== 'number') return false;
  if (property.numberMode === 'calculated') return true;
  return Boolean(property.calculation && Array.isArray(property.calculation.fieldIds));
};

const computeOperation = (
  operation: NumberCalculationOperation,
  values: Array<number | null>
): number | null => {
  const nums = values.filter((v): v is number => Number.isFinite(v as number));
  if (nums.length === 0) return null;

  if (operation === 'add') {
    return nums.reduce((acc, n) => acc + n, 0);
  }
  if (operation === 'multiply') {
    return nums.reduce((acc, n) => acc * n, 1);
  }
  if (operation === 'subtract') {
    const [first, ...rest] = nums;
    return rest.reduce((acc, n) => acc - n, first);
  }

  const [first, ...rest] = nums;
  let result = first;
  for (const n of rest) {
    if (n === 0) return null;
    result = result / n;
  }
  return result;
};

export const applyCalculatedFieldsToCollection = (collection: any) => {
  if (!collection || !Array.isArray(collection?.properties) || !Array.isArray(collection?.items)) {
    return collection;
  }

  const cachedCollection = calculatedCollectionCache.get(collection);
  if (cachedCollection) return cachedCollection;
  const properties = collection.properties || [];
  const calculatedProps = properties.filter((p: any) => isCalculatedNumberProperty(p));
  if (calculatedProps.length === 0) return collection;

  const propMap = new Map<string, any>(properties.map((p: any) => [p.id, p]));

  let itemCache = calculatedItemCaches.get(properties);
  if (!itemCache) { itemCache = new WeakMap(); calculatedItemCaches.set(properties, itemCache); }
  const computedItems = collection.items.map((item: any) => {
    const cached = itemCache!.get(item);
    if (cached) return cached;
    const cache = new Map<string, number | null>();
    const inProgress = new Set<string>();

    const resolveNumericField = (fieldId: string): number | null => {
      const prop = propMap.get(fieldId);
      if (!prop || prop.type !== 'number') {
        return parseNumberish(item?.[fieldId]);
      }

      if (!isCalculatedNumberProperty(prop)) {
        return parseNumberish(item?.[fieldId]);
      }

      if (cache.has(fieldId)) return cache.get(fieldId) ?? null;
      if (inProgress.has(fieldId)) return null;

      inProgress.add(fieldId);
      const calc = prop.calculation || {};
      const operation: NumberCalculationOperation = calc.operation || 'add';
      const fieldIds: string[] = Array.isArray(calc.fieldIds) ? calc.fieldIds : [];
      const value = computeOperation(
        operation,
        fieldIds.map((id) => resolveNumericField(id))
      );
      inProgress.delete(fieldId);
      cache.set(fieldId, value);
      return value;
    };

    const nextItem = { ...item };
    calculatedProps.forEach((prop: any) => {
      nextItem[prop.id] = resolveNumericField(prop.id);
    });

    itemCache!.set(item, nextItem);
    return nextItem;
  });

  const result = { ...collection, items: computedItems };
  calculatedCollectionCache.set(collection, result);
  return result;
};

export const applyCalculatedFieldsToCollections = (collections: any[]) => {
  if (!Array.isArray(collections)) return [];
  return collections.map((collection) => applyCalculatedFieldsToCollection(collection));
};

export const stripCalculatedNumberFieldsFromItem = (item: any, collection: any) => {
  if (!item || !collection || !Array.isArray(collection?.properties)) return item;
  const next = { ...item };
  (collection.properties || []).forEach((prop: any) => {
    if (isCalculatedNumberProperty(prop)) {
      delete next[prop.id];
    }
  });
  return next;
};
