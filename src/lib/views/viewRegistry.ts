import type { NativeViewType, ViewDefinition, ViewRegistration, ViewType } from './viewTypes';
import {
  CalendarViewSettings,
  CardsViewSettings,
  KanbanViewSettings,
  LayoutViewSettings,
  TableViewSettings,
} from '@/components/views/ViewTypeSettings';
import { getPluginViewRegistrations } from './pluginViewRegistry';
import KanbanRenderer from '@/components/views/KanbanRenderer';
import CalendarRenderer from '@/components/views/CalendarRenderer';
import LayoutRenderer from '@/components/views/LayoutRenderer';
import TableRenderer from '@/components/views/TableRenderer';
import CardsRenderer from '@/components/views/CardsRenderer';

const defaultCapabilities = {
  supportsGrouping: false,
  supportsSorting: false,
  supportsInlineEditing: false,
  supportsDragAndDrop: false,
  supportsMultiCollection: false,
  supportsNestedViews: false,
  supportsSelection: false,
} as const;

const registrations: Record<NativeViewType, ViewRegistration> = {
  table: {
    type: 'table',
    label: 'Tableau',
    Settings: TableViewSettings,
    Renderer: TableRenderer,
    capabilities: { ...defaultCapabilities, supportsGrouping: true, supportsSorting: true, supportsInlineEditing: true, supportsSelection: true },
    createDefaultConfig: (id, collectionId) => ({ id, name: 'Tableau', type: 'table', collectionId }),
  },
  cards: {
    type: 'cards',
    label: 'Cartes',
    Settings: CardsViewSettings,
    Renderer: CardsRenderer,
    capabilities: { ...defaultCapabilities, supportsGrouping: true, supportsSorting: true, supportsDragAndDrop: true, supportsSelection: true },
    createDefaultConfig: (id, collectionId) => ({ id, name: 'Cartes', type: 'cards', collectionId, cardStyle: 'default' }),
  },
  steamcards: {
    type: 'steamcards',
    label: 'Cartes Steam',
    Settings: CardsViewSettings,
    Renderer: CardsRenderer,
    capabilities: { ...defaultCapabilities, supportsGrouping: true, supportsSorting: true, supportsDragAndDrop: true, supportsSelection: true },
    createDefaultConfig: (id, collectionId) => ({ id, name: 'Cartes', type: 'steamcards', collectionId, cardStyle: 'steamFullArt' }),
  },
  kanban: {
    type: 'kanban',
    label: 'Kanban',
    Settings: KanbanViewSettings,
    Renderer: KanbanRenderer,
    capabilities: { ...defaultCapabilities, supportsSorting: true, supportsDragAndDrop: true },
    createDefaultConfig: (id, collectionId) => ({ id, name: 'Kanban', type: 'kanban', collectionId }),
  },
  calendar: {
    type: 'calendar',
    label: 'Calendrier',
    Settings: CalendarViewSettings,
    Renderer: CalendarRenderer,
    capabilities: { ...defaultCapabilities, supportsSorting: true, supportsDragAndDrop: true, supportsMultiCollection: true },
    createDefaultConfig: (id, collectionId) => ({ id, name: 'Calendrier', type: 'calendar', collectionId }),
  },
  layout: {
    type: 'layout',
    label: 'Layout',
    Settings: LayoutViewSettings,
    Renderer: LayoutRenderer,
    capabilities: { ...defaultCapabilities, supportsNestedViews: false },
    createDefaultConfig: (id, collectionId) => ({ id, name: 'Layout', type: 'layout', collectionId, layoutPanels: [] }),
  },
};

export function getViewRegistration(type: string | null | undefined): ViewRegistration {
  const nativeRegistration = registrations[type as NativeViewType];
  return nativeRegistration || getPluginViewRegistrations().find((registration) => registration.type === type) || registrations.table;
}

export function getViewRegistrations(): ViewRegistration[] {
  return [...Object.values(registrations), ...getPluginViewRegistrations()];
}

export function createDefaultViewConfig(type: ViewType, id: string, collectionId: string): ViewDefinition {
  const registration = registrations[type as NativeViewType];
  if (!registration) {
    throw new Error(`Unknown native view type "${type}"`);
  }
  return registration.createDefaultConfig(id, collectionId);
}
