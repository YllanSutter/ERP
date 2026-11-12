import type { MetricAggregationType } from '@/lib/dashboardTypes';
import type { Item, Property } from '@/lib/types';
import { aggregateItems } from './dashboardUtils';

export function getMetricFields(properties: Property[], aggregation: MetricAggregationType): Property[] {
  if (aggregation === 'count') return [];
  if (aggregation === 'options-count') {
    return properties.filter(({ type }) => ['select', 'multiselect', 'multi_select'].includes(type));
  }
  if (['unique', 'filled', 'empty'].includes(aggregation)) return properties;
  return properties.filter(({ type }) => type === 'number');
}

const isEmpty = (value: unknown): boolean => value == null || value === '' || (Array.isArray(value) && value.length === 0);

export function calculateMetric(items: Item[], properties: Property[], fieldId: string, aggregation: MetricAggregationType): number {
  if (aggregation === 'count') return items.length;
  const field = getMetricFields(properties, aggregation).find(({ id }) => id === fieldId);
  if (!field) return 0;
  // Configured options include those not used by any item or excluded by filters.
  if (aggregation === 'options-count') return field.options?.length ?? 0;
  if (aggregation === 'filled') return items.filter((item) => !isEmpty(item[fieldId])).length;
  if (aggregation === 'empty') return items.filter((item) => isEmpty(item[fieldId])).length;
  if (aggregation === 'unique') {
    const values = items.flatMap((item) => Array.isArray(item[fieldId]) ? item[fieldId] : [item[fieldId]]);
    return new Set(values.filter((value) => !isEmpty(value)).map((value) => JSON.stringify(value))).size;
  }
  return aggregateItems(items, fieldId, aggregation);
}
