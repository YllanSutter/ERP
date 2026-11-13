import { isTotalFieldVisible } from '@/lib/utils/totalVisibility';
import React, { useCallback, useState } from 'react';
import TotalsBar, { type TotalsBarProps } from '@/components/TableView/TotalsBar';
import TotalsWidget, { type TotalsWidgetPreferences, type TotalsWidgetProps } from '@/components/TableView/TotalsWidget';

type Props = Pick<TotalsBarProps, 'displayProperties' | 'items' | 'totalFields' | 'calculateTotal' | 'formatTotal'> &
  Pick<TotalsWidgetProps, 'groupedSections' | 'contextPath' | 'resolveValue' | 'preferences' | 'onPreferencesChange' | 'persistKey' | 'defaultHiddenFields' | 'fieldVisibility' | 'onFieldVisibilityChange'> & {
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
  const updatePreferences = useCallback((next: TotalsWidgetPreferences) => setSavedPreferences((previous) => ({ ...previous, ...next })), []);
  const updateVisibility = useCallback((id: string, visible: boolean, fieldIds?: string[]) => setSavedPreferences((previous) => ({ ...previous, fieldVisibility: { ...previous.fieldVisibility, ...Object.fromEntries((fieldIds || [id]).map((fieldId) => [fieldId, visible])) } })), []);
  return <TotalsWidget {...props} displayProperties={props.displayProperties.filter((property) => props.totalFields[property.id])}
    fieldVisibility={props.fieldVisibility || savedPreferences.fieldVisibility} onFieldVisibilityChange={props.onFieldVisibilityChange || updateVisibility}
    preferences={preferences || savedPreferences} onPreferencesChange={onPreferencesChange || updatePreferences} />;
}

/** Every top total uses the module panel; every bottom total uses the compact summary. */
export default function TotalsSurface({ position, compact, ...props }: Props) {
  if (!props.items.length || !props.displayProperties.some((property) => props.totalFields[property.id])) return null;
  return position === 'top'
    ? <TopTotals key={props.persistKey} {...props} />
    : <TotalsBar displayProperties={props.displayProperties.filter((property) => isTotalFieldVisible(property.id, props.defaultHiddenFields, props.fieldVisibility))} items={props.items} totalFields={props.totalFields}
        calculateTotal={props.calculateTotal} formatTotal={props.formatTotal} variant="inline" inlineMode="plain" compact={compact} />;
}
