import type { ComponentType } from 'react';
import type { Collection, Item, Property } from '@/lib/types';

export type ViewType = 'table' | 'cards' | 'steamcards' | 'kanban' | 'calendar' | 'layout';

export interface ViewDefinition {
  id: string;
  name: string;
  type: ViewType;
  collectionId?: string;
  hiddenFields?: string[];
  filters?: unknown[];
  [key: string]: unknown;
}

export interface ViewCapabilities {
  supportsGrouping: boolean;
  supportsSorting: boolean;
  supportsInlineEditing: boolean;
  supportsDragAndDrop: boolean;
  supportsMultiCollection: boolean;
  supportsNestedViews: boolean;
  supportsSelection: boolean;
}

export interface ViewRenderContext {
  collection: Collection;
  collections: Collection[];
  view: ViewDefinition;
  items: Item[];
  properties: Property[];
}

export interface ViewSettingsProps {
  view: ViewDefinition;
  collection: Collection;
  properties: Property[];
  onUpdate: (updates: Record<string, unknown>) => void;
}

export interface ViewRegistration {
  type: ViewType;
  label: string;
  capabilities: ViewCapabilities;
  Settings?: ComponentType<ViewSettingsProps>;
  createDefaultConfig: (id: string, collectionId: string) => ViewDefinition;
}
