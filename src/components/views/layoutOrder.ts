import type { DashboardModuleConfig } from '@/lib/dashboardTypes';
import type { ViewDefinition } from '@/lib/views';
import type { LayoutPanelConfig } from './LayoutPanelsEditor';

export function getLayoutEntries(view: ViewDefinition) {
  const panels = Array.isArray(view.layoutPanels) ? view.layoutPanels as LayoutPanelConfig[] : [];
  const modules = Array.isArray(view.layoutModules)
    ? (view.layoutModules as DashboardModuleConfig[]).filter(({ type }) => type !== 'layout')
    : [];
  const entries = new Map([
    ...panels.map((panel) => [`panel:${panel.id}`, { panel }] as const),
    ...modules.map((module) => [`module:${module.id}`, { module }] as const),
  ] as ReadonlyArray<readonly [string, { panel?: LayoutPanelConfig; module?: DashboardModuleConfig }]>);
  const savedOrder = Array.isArray(view.layoutOrder) ? view.layoutOrder : [];
  const order = [...new Set([...savedOrder, ...entries.keys()])].filter((key) => entries.has(key));
  return { panels, modules, entries, order };
}

export function moveLayoutEntry(order: string[], index: number, offset: number) {
  const next = [...order];
  const destination = index + offset;
  if (index >= 0 && index < next.length && destination >= 0 && destination < next.length) {
    [next[index], next[destination]] = [next[destination], next[index]];
  }
  return next;
}
