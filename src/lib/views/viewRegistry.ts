import type { ViewDefinition, ViewRegistration, ViewType } from './viewTypes';
import {
  CalendarViewSettings,
  CardsViewSettings,
  KanbanViewSettings,
  LayoutViewSettings,
  TableViewSettings,
} from '@/components/views/ViewTypeSettings';
import { getPluginViewRegistrations } from './pluginViewRegistry';

const defaultCapabilities = {
  supportsGrouping: false,
  supportsSorting: false,
  supportsInlineEditing: false,
  supportsDragAndDrop: false,
  supportsMultiCollection: false,
  supportsNestedViews: false,
  supportsSelection: false,
} as const;

const registrations: Record<ViewType, ViewRegistration> = {
  table: {
    type: 'table',
    label: 'Tableau',
    Settings: TableViewSettings,
    capabilities: { ...defaultCapabilities, supportsGrouping: true, supportsSorting: true, supportsInlineEditing: true, supportsSelection: true },
    createDefaultConfig: (id, collectionId) => ({ id, name: 'Tableau', type: 'table', collectionId }),
  },
  cards: {
    type: 'cards',
    label: 'Cartes',
    Settings: CardsViewSettings,
    capabilities: { ...defaultCapabilities, supportsGrouping: true, supportsSorting: true, supportsSelection: true },
    createDefaultConfig: (id, collectionId) => ({ id, name: 'Cartes', type: 'cards', collectionId, cardStyle: 'default' }),
  },
  steamcards: {
    type: 'steamcards',
    label: 'Cartes Steam',
    Settings: CardsViewSettings,
    capabilities: { ...defaultCapabilities, supportsGrouping: true, supportsSorting: true, supportsSelection: true },
    createDefaultConfig: (id, collectionId) => ({ id, name: 'Cartes', type: 'steamcards', collectionId, cardStyle: 'steamFullArt' }),
  },
  kanban: {
    type: 'kanban',
    label: 'Kanban',
    Settings: KanbanViewSettings,
    capabilities: { ...defaultCapabilities, supportsSorting: true, supportsDragAndDrop: true },
    createDefaultConfig: (id, collectionId) => ({ id, name: 'Kanban', type: 'kanban', collectionId }),
  },
  calendar: {
    type: 'calendar',
    label: 'Calendrier',
    Settings: CalendarViewSettings,
    capabilities: { ...defaultCapabilities, supportsSorting: true, supportsDragAndDrop: true, supportsMultiCollection: true },
    createDefaultConfig: (id, collectionId) => ({ id, name: 'Calendrier', type: 'calendar', collectionId }),
  },
  layout: {
    type: 'layout',
    label: 'Layout',
    Settings: LayoutViewSettings,
    capabilities: { ...defaultCapabilities, supportsNestedViews: false },
    createDefaultConfig: (id, collectionId) => ({ id, name: 'Layout', type: 'layout', collectionId, layoutPanels: [] }),
  },
};

export function getViewRegistration(type: string | null | undefined): ViewRegistration {
  const nativeRegistration = registrations[(type as ViewType) || 'table'];
  return nativeRegistration || getPluginViewRegistrations().find((registration) => registration.type === type) || registrations.table;
}

export function getViewRegistrations(): ViewRegistration[] {
  return [...Object.values(registrations), ...getPluginViewRegistrations()];
}

export function createDefaultViewConfig(type: ViewType, id: string, collectionId: string): ViewDefinition {
  return registrations[type].createDefaultConfig(id, collectionId);
}
