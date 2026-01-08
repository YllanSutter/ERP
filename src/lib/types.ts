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
}

export interface Item {
  id: string;
  [key: string]: any;
}

export interface TableViewProps {
  collection: Collection;
  items: Item[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  hiddenFields: string[];
  orderedProperties: Property[];
  onReorderItems: (items: Item[]) => void;
  onToggleField: (fieldId: string) => void;
  onDeleteProperty: (propId: string) => void;
  onEditProperty: (prop: Property) => void;
  onViewDetail: (item: Item) => void;
  collections: Collection[];
  onRelationChange: (prop: Property, item: Item, value: any) => void;
  onNavigateToCollection: (collectionId: string, linkedIds?: string[]) => void;
  groups?: string[];
  canEdit?: boolean;
  canEditField?: (fieldId: string) => boolean;
}
