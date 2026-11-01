import type { ComponentType } from 'react';
import type { Collection, Item, Property } from '@/lib/types';

export type NativeViewType = 'table' | 'cards' | 'steamcards' | 'kanban' | 'calendar' | 'layout';
export type ViewType = NativeViewType | (string & {});

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

export interface ViewRendererProps extends ViewRenderContext {
  onUpdateView: (updates: Record<string, unknown>) => void;
  views?: Record<string, ViewDefinition[]>;
  relationFilter?: { collectionId: string | null; ids: string[] };
  activeCollectionId?: string | null;
  onEdit?: (item: Item) => void;
  onDelete?: (id: string) => void;
  onViewDetail?: (item: Item) => void;
  onRelationChange?: (property: Property, item: Item, value: unknown) => void;
  onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
  onShowNewItemModal?: (prefill?: Record<string, unknown>) => void;
  onShowNewItemModalForCollection?: (collection: Collection, item?: Item) => void;
  [key: string]: unknown;
}

export interface ViewSettingsProps {
  view: ViewDefinition;
  collection: Collection;
  properties: Property[];
  onUpdate: (updates: Record<string, unknown>) => void;
}

export interface ViewRegistration {
  type: string;
  label: string;
  pluginId?: string;
  capabilities: ViewCapabilities;
  Renderer?: ComponentType<ViewRendererProps>;
  Settings?: ComponentType<ViewSettingsProps>;
  createDefaultConfig: (id: string, collectionId: string) => ViewDefinition;
}
