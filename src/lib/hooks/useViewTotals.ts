import { steamTotalItems } from '@/lib/plugins/steam/exchanges';
import { useCallback } from 'react';
import type { Collection, Property } from '@/lib/types';

/** Shared total rules for any collection view. Renderers only choose where totals appear. */
export function useViewTotals(properties: Property[], collection: Collection, collections: Collection[]) {
  const calculateTotal = useCallback((fieldId: string, sourceItems: any[], totalType: string) => {
    const property = properties.find((candidate) => candidate.id === fieldId);
    if (!property) return null;
    sourceItems = steamTotalItems(collection, sourceItems, fieldId, totalType);
    if (property.type === 'checkbox' && totalType.startsWith('linked-progress:')) {
      const linkedFieldId = totalType.slice('linked-progress:'.length);
      return sourceItems.reduce((result, item) => {
        const amount = Number(item[linkedFieldId]) || 0;
        if (item[fieldId]) { result.paid += amount; result.checkedCount += 1; }
        else { result.remaining += amount; result.uncheckedCount += 1; }
        result.total = result.paid + result.remaining;
        return result;
      }, { paid: 0, remaining: 0, total: 0, checkedCount: 0, uncheckedCount: 0, linkedFieldId });
    }
    const filteredType = totalType.startsWith('number-filter:') ? totalType.split(':') : null;
    const resolvedType = filteredType?.[1] || totalType;
    const scopedItems = filteredType && filteredType.length >= 4
      ? sourceItems.filter((item) => String(item[filteredType[2]]?.value ?? item[filteredType[2]]) !== decodeURIComponent(filteredType.slice(3).join(':')))
      : sourceItems;
    if (resolvedType === 'count') return scopedItems.length;
    if (property.type === 'checkbox') {
      if (resolvedType === 'count-true') return scopedItems.filter((item) => item[fieldId] === true).length;
      if (resolvedType === 'count-false') return scopedItems.filter((item) => item[fieldId] === false).length;
    }
    if (property.type === 'relation') {
      const entries = scopedItems.flatMap((item) => Array.isArray(item[fieldId]) ? item[fieldId] : item[fieldId] == null ? [] : [item[fieldId]]);
      if (resolvedType === 'unique') return new Set(entries.map(String)).size;
      return entries.length;
    }
    if (resolvedType === 'unique') return new Set(scopedItems.flatMap((item) => Array.isArray(item[fieldId]) ? item[fieldId] : [item[fieldId]]).filter((value) => value != null).map(String)).size;
    if (property.type !== 'number') return null;
    const values = scopedItems.map((item) => Number(item[fieldId])).filter(Number.isFinite);
    if (!values.length) return 0;
    if (resolvedType === 'avg') return values.reduce((sum, value) => sum + value, 0) / values.length;
    if (resolvedType === 'min') return Math.min(...values);
    if (resolvedType === 'max') return Math.max(...values);
    return values.reduce((sum, value) => sum + value, 0);
  }, [properties, collection]);

  const formatTotal = useCallback((fieldId: string, total: any, totalType: string) => {
    const property = properties.find((candidate) => candidate.id === fieldId);
    if (!property || total == null) return '';
    if (totalType.startsWith('linked-progress:')) {
      const linked = collection.properties.find((candidate) => candidate.id === totalType.slice('linked-progress:'.length));
      const format = (value: number) => `${linked?.numberPrefix || ''}${Number(value || 0).toLocaleString('fr-FR')}${linked?.numberSuffix || ''}`;
      return `Payé: ${format(total.paid)} · Reste: ${format(total.remaining)}`;
    }
    const resolvedType = totalType.startsWith('number-filter:') ? totalType.split(':')[1] : totalType;
    if (resolvedType === 'count') return `${total} ligne${total > 1 ? 's' : ''}`;
    if (resolvedType === 'unique') return `${total} unique${total > 1 ? 's' : ''}`;
    if (resolvedType === 'count-true') return `${total} coché${total > 1 ? 's' : ''}`;
    if (resolvedType === 'count-false') return `${total} décoché${total > 1 ? 's' : ''}`;
    if (resolvedType === 'count-linked') return `${total} lié${total > 1 ? 's' : ''}`;
    if (typeof total !== 'number') return String(total);
    const value = resolvedType === 'avg' ? total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : total.toLocaleString('fr-FR');
    return property.type === 'number' ? `${property.numberPrefix || ''}${value}${property.numberSuffix || ''}` : value;
  }, [collection.properties, collections, properties]);

  return { calculateTotal, formatTotal };
}
