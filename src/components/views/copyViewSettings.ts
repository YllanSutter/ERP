import type { ViewDefinition } from '@/lib/views';

export const COPY_CATEGORIES = [
  { id: 'filters', label: 'Filtrage' }, { id: 'groups', label: 'Groupage' },
  { id: 'totals', label: 'Totaux' }, { id: 'settings', label: 'Paramètres' },
] as const;
export type CopyCategory = typeof COPY_CATEGORIES[number]['id'];
export type CopySelection = Record<CopyCategory, boolean>;

const defaults: Record<CopyCategory, Record<string, unknown>> = {
  filters: { filters: [] },
  groups: { groups: [], groupBy: null, groupDisplayMode: 'accordion', groupDisplayModes: {}, groupDisplayColumnCount: 3, groupDisplayColumnCounts: {}, groupTabStyleFieldIds: {} },
  totals: { totalFields: {}, totalsFieldVisibility: {}, totalsPosition: 'none', totalsScope: null, totalsAlwaysVisible: false, groupTotalsByGroupId: {} },
  settings: { hiddenFields: [], fieldOrder: [], fieldGroups: [], fieldGroupsLayout: 'stacked' },
};
const typeSettings: Record<string, Record<string, unknown>> = {
  kanban: { kanbanShowFieldsOnHover: false, kanbanSortDirection: 'asc' },
  cards: { cardIconFieldId: null, cardColorFieldId: null, cardStyle: 'default', cardColumns: 'auto', cardDensity: null, cardGroupPlacements: {} },
  steamcards: { cardIconFieldId: null, cardColorFieldId: null, cardStyle: 'steamFullArt', cardColumns: 'auto', cardDensity: null, cardGroupPlacements: {} },
  calendar: { dateProperty: null, calendarViewMode: 'month', showCollectionsSelector: true },
  layout: { layoutTileBackground: false, layoutResizable: true, layoutAutoHeight: false, layoutPanels: [], layoutModules: [], layoutOrder: [] },
};

/** Copy only the chosen settings, never the identity, type or access rights of a view. */
export function copyViewSettings(source: ViewDefinition, target: ViewDefinition, selected: CopySelection): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const { id } of COPY_CATEGORIES) {
    if (!selected[id]) continue;
    const keys = { ...defaults[id], ...(id === 'settings' && source.type === target.type ? typeSettings[source.type] : {}) };
    for (const [key, fallback] of Object.entries(keys)) patch[key] = structuredClone(source[key] ?? fallback);
  }
  if (selected.totals && source.totalsPosition == null) patch.totalsPosition = source.type === 'table' ? 'bottom' : 'none';
  if (selected.groups && source.type !== target.type) {
    const groups = Array.isArray(source.groups) && source.groups.length ? source.groups : typeof source.groupBy === 'string' ? [source.groupBy] : [];
    patch.groups = structuredClone(groups);
    patch.groupBy = typeof source.groupBy === 'string' ? source.groupBy : groups[0] || null;
  }
  // Column settings mix display and total preferences; merge only the selected parts.
  if (selected.settings || selected.totals) {
    const sourceColumns = (source.kanbanColumnSettings || {}) as Record<string, Record<string, Record<string, unknown>>>;
    const targetColumns = (target.kanbanColumnSettings || {}) as typeof sourceColumns;
    const columns = structuredClone(targetColumns);
    const keys = [
      ...(selected.settings ? ['visibleFieldIds', 'sortFieldId', 'sortDirection'] : []),
      ...(selected.totals ? ['totalFields', 'totalsPosition', 'showTotals', 'totalsFieldVisibility'] : []),
    ];
    for (const group of new Set([...Object.keys(sourceColumns), ...Object.keys(targetColumns)])) {
      columns[group] ||= {};
      for (const column of new Set([...Object.keys(sourceColumns[group] || {}), ...Object.keys(targetColumns[group] || {})])) {
        const config = columns[group][column] ||= {};
        for (const key of keys) {
          delete config[key];
          if (sourceColumns[group]?.[column]?.[key] !== undefined) config[key] = structuredClone(sourceColumns[group][column][key]);
        }
      }
    }
    patch.kanbanColumnSettings = columns;
  }
  return patch;
}
