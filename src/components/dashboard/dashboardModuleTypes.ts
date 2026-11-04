import { MODULE_TYPE_LABELS, type DashboardModuleConfig } from '@/lib/dashboardTypes';
import { getViewRegistrations, type ViewDefinition, type ViewRegistration } from '@/lib/views';

export function getDashboardViewRegistration(type: string) {
  if (Object.hasOwn(MODULE_TYPE_LABELS, type)) return undefined;
  return getViewRegistrations().find((view) => view.type === type && view.Renderer);
}

export function getDashboardModuleOptions() {
  return [
    ...Object.entries(MODULE_TYPE_LABELS),
    ...getViewRegistrations()
      .filter((view) => view.Renderer && !Object.hasOwn(MODULE_TYPE_LABELS, view.type))
      .map((view): [string, string] => [view.type, view.label]),
  ];
}

export function getDashboardViewConfig(
  module: DashboardModuleConfig,
  registration: ViewRegistration,
  collectionId: string,
  views?: Record<string, ViewDefinition[]>
): ViewDefinition {
  const defaults = registration.createDefaultConfig(module.id, collectionId);
  const cardViews = (module.type === 'cards' || module.type === 'steamcards')
    ? views?.[collectionId]?.filter((view) => view.type === 'cards' || view.type === 'steamcards')
    : undefined;
  const source = cardViews?.find((view) => view.type === module.type) ?? cardViews?.[0];

  return {
    ...defaults,
    ...(source && {
      hiddenFields: source.hiddenFields,
      groups: source.groups,
      groupDisplayMode: source.groupDisplayMode,
      groupDisplayModes: source.groupDisplayModes,
      groupTabStyleFieldIds: source.groupTabStyleFieldIds,
      fieldOrder: source.fieldOrder,
      fieldGroups: source.fieldGroups,
      cardGroupPlacements: source.cardGroupPlacements,
      cardColumns: source.cardColumns,
      cardDensity: source.cardDensity,
      cardIconFieldId: source.cardIconFieldId,
      cardColorFieldId: source.cardColorFieldId,
      cardStyle: source.type === module.type ? source.cardStyle ?? defaults.cardStyle : defaults.cardStyle,
    }),
    ...module.viewSettings,
    id: defaults.id,
    type: defaults.type,
    collectionId,
  };
}
