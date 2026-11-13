import React from 'react';
import TotalsWidget, { type TotalsWidgetPreferences } from '@/components/TableView/TotalsWidget';
import { useViewTotals } from '@/lib/hooks/useViewTotals';
import type { Collection, Item, Property } from '@/lib/types';
import { useViewGrouping } from './ViewGrouping';
import { getGroupLabel } from '@/lib/groupingUtils';

interface ViewTotalsProps { collection: Collection; collections: Collection[]; properties: Property[]; items: Item[]; hiddenFields?: string[]; totalFields?: Record<string, string>; groups?: string[]; contextPath?: string; className?: string; }

const getDefaultPreferences = (hasGroups: boolean): TotalsWidgetPreferences => ({
  showTotalsWidget: true,
  widgetExpanded: true,
  widgetModules: { stats: true, bar: true, donut: hasGroups, table: false },
  activeMetricId: '',
  activeLevelDepth: 'overview',
  selectedByDepth: {},
  collapsedGroupIds: [],
  hiddenFieldIds: [],
  fieldOrderIds: [],
});

const getStorageKey = (collectionId: string) => `erp:view-totals:${collectionId}`;

const readPreferences = (collectionId: string, hasGroups: boolean): TotalsWidgetPreferences => {
  const fallback = getDefaultPreferences(hasGroups);
  if (typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getStorageKey(collectionId)) || '{}');
    return parsed && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
};

/** Reusable compact totals surface for non-table renderers. */
export const ViewTotals: React.FC<ViewTotalsProps> = ({ collection, collections, properties, items, hiddenFields = [], totalFields = {}, groups = [], contextPath, className }) => {
  const { calculateTotal, formatTotal } = useViewTotals(properties, collection, collections);
  const { groupedStructure, getItemsForGroup } = useViewGrouping(items, groups, properties, collections);
  const groupedSections = React.useMemo(() => {
    if (!groupedStructure || !groups.length) return undefined;
    const sections: Array<{ path: string; label: string; items: Item[]; depth: number; propertyName: string }> = [];
    const visit = (path: string, depth: number) => {
      const node = groupedStructure.structure[path];
      if (!node) return;
      const property = properties.find((candidate) => candidate.id === groups[depth]);
      const rawValue = path.split('/').pop() || path;
      const groupItems = getItemsForGroup(path);
      if (groupItems.length) sections.push({ path, label: property ? String(getGroupLabel(property, rawValue === '(vide)' ? undefined : rawValue, collections)) : rawValue, items: groupItems, depth, propertyName: property?.name || '' });
      node.subGroups.forEach((subPath: string) => visit(subPath, depth + 1));
    };
    groupedStructure.rootGroups.forEach((path: string) => visit(path, 0));
    return sections;
  }, [collections, getItemsForGroup, groupedStructure, groups, properties]);
  const [preferences, setPreferences] = React.useState<TotalsWidgetPreferences>(() => readPreferences(collection.id, groups.length > 0));
  const preferencesKey = getStorageKey(collection.id);
  React.useEffect(() => {
    setPreferences(readPreferences(collection.id, groups.length > 0));
  }, [collection.id, groups.length]);
  const handlePreferencesChange = React.useCallback((next: TotalsWidgetPreferences) => {
    setPreferences(next);
    try {
      window.localStorage.setItem(preferencesKey, JSON.stringify(next));
    } catch {
      // Keep the current session usable if storage is unavailable.
    }
  }, [preferencesKey]);
  if (!Object.keys(totalFields).length || !items.length) return null;
  return <div className={className}><TotalsWidget defaultHiddenFields={hiddenFields} onFieldVisibilityChange={(id, visible, fieldIds) => handlePreferencesChange({ ...preferences, fieldVisibility: { ...preferences.fieldVisibility, ...Object.fromEntries((fieldIds || [id]).map((fieldId) => [fieldId, visible])) } })} displayProperties={properties} items={items} totalFields={totalFields} calculateTotal={calculateTotal} formatTotal={formatTotal} groupedSections={groupedSections} persistKey={preferencesKey} contextPath={contextPath || groupedStructure?.rootGroups[0]} preferences={preferences} onPreferencesChange={handlePreferencesChange} /></div>;
};
