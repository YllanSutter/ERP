/**
 * Types et interfaces communes pour l'application
 */

export interface Collection {
  id: string;
  name: string;
  properties: Property[];
  items: Item[];
  [key: string]: any;
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  icon?: string;
  color?: string;
  relation?: RelationConfig;
  options?: string[];
  [key: string]: any;
}

export type PropertyType = 
  | 'text' 
  | 'number' 
  | 'date' 
  | 'select' 
  | 'multiselect' 
  | 'checkbox' 
  | 'relation' 
  | 'url' 
  | 'email' 
  | 'phone';

export interface RelationConfig {
  targetCollectionId: string;
  type?: 'one-to-one' | 'one-to-many' | 'many-to-many';
  maxVisible?: number;
  displayFieldIds?: string[];
  autoHideSource?: boolean;
  filter?: {
    fieldId: string;
    value: any;
  };
}

// Granularités de date disponibles
export const DATE_GRANULARITIES = [
  { value: 'full', label: 'Date complète' },
  { value: 'month', label: 'Mois uniquement' },
  { value: 'month-year', label: 'Mois + Année' },
  { value: 'year', label: 'Année uniquement' }
] as const;

export type DateGranularity = typeof DATE_GRANULARITIES[number]['value'];

export interface Item {
  id: string;
  [key: string]: any;
}

export type TableGroupDisplayMode = 'accordion' | 'columns' | 'tabs';
export type TableGroupColumnCount = 1 | 2 | 3;

export interface TableViewProps {
  collection: Collection;
  items: Item[];
  favoriteItemIds?: string[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onToggleFavoriteItem?: (itemId: string) => void;
  onBulkDelete?: (ids: string[], collectionId?: string) => void;
  hiddenFields: string[];
  orderedProperties: Property[];
  onReorderItems: (items: Item[]) => void;
  onToggleField: (fieldId: string) => void;
  onDeleteProperty: (propId: string) => void;
  onDuplicateProperty?: (propId: string, options?: { copyValues?: boolean }) => void;
  onEditProperty: (prop: Property) => void;
  onViewDetail: (item: Item) => void;
  collections: Collection[];
  onRelationChange: (prop: Property, item: Item, value: any) => void;
  onNavigateToCollection: (collectionId: string, linkedIds?: string[]) => void;
  groups?: string[];
  onShowNewItemModal?: () => void;
  onQuickCreateItem?: () => void;
  initialSortState?: { column: string | null; direction: 'asc' | 'desc' };
  onSortStateChange?: (state: { column: string | null; direction: 'asc' | 'desc' }) => void;
  initialExpandedGroups?: string[];
  onExpandedGroupsChange?: (groupPaths: string[]) => void;
  groupDisplayMode?: TableGroupDisplayMode;
  groupDisplayModes?: Record<string, TableGroupDisplayMode>;
  groupDisplayColumnCount?: TableGroupColumnCount;
  totalFields?: Record<string, string>; // fieldId -> totalType (sum, count, unique, avg, min, max)
  onSetTotalField?: (fieldId: string, totalType: string | null) => void;
}
