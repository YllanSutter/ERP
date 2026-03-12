import { Item, Property, Collection } from './types';

/**
 * Structure de données pour les items groupés
 */
export interface GroupedItems {
  [groupPath: string]: {
    itemIds: string[];
    subGroups: string[];
  };
}

export interface GroupStructure {
  structure: GroupedItems;
  rootGroups: string[];
}

/**
 * Construire la structure de groupage à partir des items
 */
export function buildGroupStructure(
  items: Item[],
  groups: string[],
  properties: Property[],
  collections: Collection[] = []
): GroupStructure | null {
  if (!groups || groups.length === 0) return null;

  const structure: GroupedItems = {};
  const rootGroups = new Set<string>();

  // Pour chaque item, construire son chemin de groupe
  items.forEach(item => {
    let currentPath = '';
    
    for (let depth = 0; depth < groups.length; depth++) {
      const groupId = groups[depth];
      const prop = properties.find((p: any) => p.id === groupId);
      if (!prop) continue;

      const rawValue = (() => {
        const linkedProp: any = prop as any;
        if (!linkedProp?.isRelationLinkedColumn || !linkedProp?.sourceRelationPropertyId || !linkedProp?.sourceDisplayFieldId) {
          return item[groupId];
        }

        const relationValue = (item as any)[linkedProp.sourceRelationPropertyId];
        const relatedIds = Array.isArray(relationValue)
          ? relationValue
          : relationValue
            ? [relationValue]
            : [];
        if (!relatedIds.length) return null;

        const sourceRelationProp: any = properties.find((p: any) => p.id === linkedProp.sourceRelationPropertyId);
        const targetCollection = collections.find((c: any) => c.id === linkedProp.sourceTargetCollectionId)
          || collections.find((c: any) => c.id === sourceRelationProp?.relation?.targetCollectionId);
        const targetItems = targetCollection?.items || [];

        const values = relatedIds
          .map((id: string) => (targetItems as any[]).find((it: any) => it.id === id)?.[linkedProp.sourceDisplayFieldId])
          .filter((v: any) => v !== undefined && v !== null && v !== '');

        if (!values.length) return null;
        if (linkedProp.type === 'multi_select') {
          return values.flatMap((v: any) => Array.isArray(v) ? v : [v]);
        }
        if (linkedProp.type === 'checkbox') {
          return values.some(Boolean);
        }
        return values[0];
      })();
      let groupValue: string;
      
      // Formater la valeur selon le type
      if (prop.type === 'date' || (prop as any).dateGranularity) {
        groupValue = formatDateByGranularity(rawValue, (prop as any).dateGranularity);
      } else if (rawValue === null || rawValue === undefined || rawValue === '') {
        groupValue = '(vide)';
      } else {
        groupValue = String(rawValue);
      }
      
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${groupValue}` : groupValue;

      // Initialiser ce niveau de groupe s'il n'existe pas
      if (!structure[currentPath]) {
        structure[currentPath] = { itemIds: [], subGroups: [] };
      }

      // Si c'est le dernier niveau de groupage, ajouter l'item
      if (depth === groups.length - 1) {
        if (!structure[currentPath].itemIds.includes(item.id)) {
          structure[currentPath].itemIds.push(item.id);
        }
      }

      // Enregistrer ce groupe comme sous-groupe de son parent
      if (parentPath && !structure[parentPath].subGroups.includes(currentPath)) {
        structure[parentPath].subGroups.push(currentPath);
      } else if (!parentPath) {
        rootGroups.add(currentPath.split('/')[0]);
      }
    }
  });

  return { structure, rootGroups: Array.from(rootGroups) };
}

/**
 * Formater une valeur de date selon la granularité
 */
export function formatDateByGranularity(dateString: string, granularity?: string): string {
  if (!dateString) return '(vide)';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return String(dateString);
    
    if (granularity === 'year') {
      return date.getFullYear().toString();
    } else if (granularity === 'month') {
      return date.toLocaleDateString('fr-FR', { month: 'long' });
    } else if (granularity === 'month-year') {
      return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    } else {
      // Full date format
      return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    }
  } catch (e) {
    return String(dateString);
  }
}

/**
 * Obtenir le libellé d'une valeur pour affichage
 */
export function getGroupLabel(
  property: Property,
  value: any,
  collections: Collection[]
): string {
  if (!value && value !== 0 && value !== false) return '(vide)';
  
  if (property.type === 'date' || (property as any).dateGranularity) {
    return formatDateByGranularity(value, (property as any).dateGranularity);
  }
  
  if (property.type === 'relation') {
    const targetCollection = collections.find(
      (c: any) => c.id === property.relation?.targetCollectionId
    );
    if (!targetCollection) return String(value);
    
    const nameField = targetCollection.properties.find(
      (p: any) => p.id === 'name' || p.name === 'Nom'
    );
    
    if (Array.isArray(value)) {
      return value.map(id => {
        const item = targetCollection.items.find((i: any) => i.id === id);
        return item ? (item[nameField?.id || 'name'] || item.name || id) : id;
      }).join(', ');
    } else {
      const item = targetCollection.items.find((i: any) => i.id === value);
      return item ? (item[nameField?.id || 'name'] || item.name || value) : String(value);
    }
  }
  
  return String(value);
}

/**
 * Compter récursivement tous les items dans un groupe et ses sous-groupes
 */
export function countItemsInGroup(
  groupPath: string,
  structure: GroupedItems
): number {
  const data = structure[groupPath];
  if (!data) return 0;
  
  return data.itemIds.length + 
    data.subGroups.reduce((sum, subPath) => sum + countItemsInGroup(subPath, structure), 0);
}
