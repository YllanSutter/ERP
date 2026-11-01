import React from 'react';
import TotalsWidget, { type TotalsWidgetPreferences } from '@/components/TableView/TotalsWidget';
import { useViewTotals } from '@/lib/hooks/useViewTotals';
import type { Collection, Item, Property } from '@/lib/types';
import { useViewGrouping } from './ViewGrouping';
import { getGroupLabel } from '@/lib/groupingUtils';

interface ViewTotalsProps { collection: Collection; collections: Collection[]; properties: Property[]; items: Item[]; totalFields?: Record<string, string>; groups?: string[]; contextPath?: string; className?: string; }

/** Reusable compact totals surface for non-table renderers. */
export const ViewTotals: React.FC<ViewTotalsProps> = ({ collection, collections, properties, items, totalFields = {}, groups = [], contextPath, className }) => {
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
  const [preferences, setPreferences] = React.useState<TotalsWidgetPreferences>({ showTotalsWidget: true, widgetExpanded: true, widgetModules: { stats: true, bar: true, donut: groups.length > 0, table: false }, activeMetricId: '', activeLevelDepth: 'overview', selectedByDepth: {}, collapsedGroupIds: [], hiddenFieldIds: [], fieldOrderIds: [] });
  if (!Object.keys(totalFields).length || !items.length) return null;
  return <div className={className}><TotalsWidget displayProperties={properties} items={items} totalFields={totalFields} calculateTotal={calculateTotal} formatTotal={formatTotal} groupedSections={groupedSections} persistKey={`view-totals:${collection.id}`} contextPath={contextPath || groupedStructure?.rootGroups[0]} preferences={preferences} onPreferencesChange={setPreferences} /></div>;
};
