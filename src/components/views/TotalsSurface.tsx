import React, { useState } from 'react';
import TotalsBar, { type TotalsBarProps } from '@/components/TableView/TotalsBar';
import TotalsWidget, { type TotalsWidgetPreferences, type TotalsWidgetProps } from '@/components/TableView/TotalsWidget';

type Props = Pick<TotalsBarProps, 'displayProperties' | 'items' | 'totalFields' | 'calculateTotal' | 'formatTotal'> &
  Pick<TotalsWidgetProps, 'groupedSections' | 'contextPath' | 'resolveValue' | 'preferences' | 'onPreferencesChange' | 'persistKey'> & {
    position: 'top' | 'bottom';
    compact?: boolean;
  };

function TopTotals({ preferences, onPreferencesChange, ...props }: Omit<Props, 'position' | 'compact'>) {
  const [savedPreferences, setSavedPreferences] = useState<TotalsWidgetPreferences>(() => {
    try {
      if (props.persistKey && typeof window !== 'undefined') {
        const saved = JSON.parse(window.localStorage.getItem(props.persistKey) || 'null');
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
      }
    } catch { /* Keep modules usable when storage is unavailable. */ }
    return { showTotalsWidget: true, widgetExpanded: true };
  });
  return <TotalsWidget {...props} displayProperties={props.displayProperties.filter((property) => props.totalFields[property.id])}
    preferences={preferences || savedPreferences} onPreferencesChange={onPreferencesChange || setSavedPreferences} />;
}

/** Every top total uses the module panel; every bottom total uses the compact summary. */
export default function TotalsSurface({ position, compact, ...props }: Props) {
  if (!props.items.length || !props.displayProperties.some((property) => props.totalFields[property.id])) return null;
  return position === 'top'
    ? <TopTotals key={props.persistKey} {...props} />
    : <TotalsBar displayProperties={props.displayProperties} items={props.items} totalFields={props.totalFields}
        calculateTotal={props.calculateTotal} formatTotal={props.formatTotal} variant="inline" inlineMode="plain" compact={compact} />;
}
