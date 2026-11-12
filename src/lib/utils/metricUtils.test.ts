import { describe, expect, it } from 'vitest';
import { calculateMetric, getMetricFields } from './metricUtils';
import type { Property, Item } from '@/lib/types';

const properties: Property[] = [
  { id: 'status', name: 'Statut', type: 'select', options: Array.from({ length: 16 }, (_, i) => `Option ${i}`) },
  { id: 'tags', name: 'Étiquettes', type: 'multiselect', options: ['A', 'B', 'C'] },
  { id: 'price', name: 'Prix', type: 'number' },
  { id: 'checked', name: 'Coché', type: 'checkbox' },
];
const items = [
  { id: '1', status: 'Option 0', tags: ['A', 'B'], price: 0, checked: false },
  { id: '2', status: 'Option 0', tags: ['B'], price: 10, checked: true },
  { id: '3', status: '', tags: [], price: null },
  { id: '4' },
] as Item[];

describe('metric aggregations', () => {
  it('counts configured options independently of item filters and usage', () => {
    expect(calculateMetric(items, properties, 'status', 'options-count')).toBe(16);
    expect(calculateMetric([], properties, 'status', 'options-count')).toBe(16);
    expect(calculateMetric(items.slice(0, 1), properties, 'tags', 'options-count')).toBe(3);
    expect(calculateMetric(items, properties, 'price', 'options-count')).toBe(0);
    expect(calculateMetric(items, [{ ...properties[0], options: undefined }], 'status', 'options-count')).toBe(0);
  });

  it('offers fields appropriate to each calculation', () => {
    expect(getMetricFields(properties, 'options-count').map(({ id }) => id)).toEqual(['status', 'tags']);
    expect(getMetricFields(properties, 'sum').map(({ id }) => id)).toEqual(['price']);
    expect(getMetricFields(properties, 'unique')).toEqual(properties);
  });

  it('counts used distinct values and ignores empty values and repeated selections', () => {
    expect(calculateMetric(items, properties, 'status', 'unique')).toBe(1);
    expect(calculateMetric(items, properties, 'tags', 'unique')).toBe(2);
    expect(calculateMetric(items.slice(2), properties, 'tags', 'unique')).toBe(0);
  });

  it('counts filled and empty items, preserving zero and false as values', () => {
    for (const field of ['price', 'checked', 'status', 'tags']) {
      expect(calculateMetric(items, properties, field, 'filled')).toBe(2);
      expect(calculateMetric(items, properties, field, 'empty')).toBe(2);
    }
  });

  it('preserves numeric calculations and item counts', () => {
    expect(calculateMetric(items, properties, '', 'count')).toBe(4);
    expect(calculateMetric(items, properties, 'price', 'sum')).toBe(10);
    expect(calculateMetric(items, properties, 'price', 'avg')).toBe(5);
    expect(calculateMetric(items, properties, 'price', 'min')).toBe(0);
    expect(calculateMetric(items, properties, 'price', 'max')).toBe(10);
    expect(calculateMetric([], properties, 'price', 'sum')).toBe(0);
    expect(calculateMetric(items, properties, 'deleted-field', 'unique')).toBe(0);
  });
});
