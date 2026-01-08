import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import EditableProperty from '@/components/EditableProperty';
import { cn } from '@/lib/utils';
import DraggableList from '@/components/DraggableList';

interface TableViewProps {
  collection: any;
  items: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  hiddenFields: string[];
  orderedProperties: any[];
  onReorderItems: (items: any[]) => void;
  onToggleField: (fieldId: string) => void;
  onDeleteProperty: (propId: string) => void;
  onEditProperty: (prop: any) => void;
  onViewDetail: (item: any) => void;
  collections: any[];
  onRelationChange: (prop: any, item: any, value: any) => void;
  onNavigateToCollection: (collectionId: string, linkedIds?: string[]) => void;
  groups?: string[];
  canEdit?: boolean;
  canEditField?: (fieldId: string) => boolean;
}

interface GroupedItems {
  [groupPath: string]: {
    itemIds: string[];
    subGroups: string[];
  };
}

const TableView: React.FC<TableViewProps> = ({
  collection,
  items,
  onEdit,
  onDelete,
  hiddenFields,
  orderedProperties,
  onReorderItems,
  onToggleField,
  onDeleteProperty,
  onEditProperty,
  onViewDetail,
  collections,
  onRelationChange,
  onNavigateToCollection,
  groups = [],
  canEdit = true,
  canEditField = () => true,
}) => {
  // Indexer les items par ID pour accès O(1)
  const itemsMap = useMemo(() => {
    const map = new Map<string, any>();
    items.forEach(item => map.set(item.id, item));
    return map;
  }, [items]);

  // Nouvelle logique de groupage : structure plate avec IDs uniquement
  const groupedStructure = useMemo(() => {
    if (!groups || groups.length === 0) return null;

    const structure: GroupedItems = {};
    const rootGroups = new Set<string>();

    // Pour chaque item, construire son chemin de groupe
    items.forEach(item => {
      let currentPath = '';
      
      for (let depth = 0; depth < groups.length; depth++) {
        const groupId = groups[depth];
        const prop = collection.properties.find((p: any) => p.id === groupId);
        if (!prop) continue;

        const groupValue = String(item[groupId] || '(vide)');
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
  }, [items, groups, collection.properties]);

  // Initialiser les groupes ouverts
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (!groupedStructure) return new Set();
    return new Set(Object.keys(groupedStructure.structure));
  });

  // Mettre à jour les groupes ouverts pour les nouveaux groupes uniquement
  React.useEffect(() => {
    if (!groupedStructure) return;
    setExpandedGroups(prev => {
      const newGroups = Object.keys(groupedStructure.structure).filter(path => !prev.has(path));
      if (newGroups.length === 0) return prev;
      const next = new Set(prev);
      newGroups.forEach(path => next.add(path));
      return next;
    });
  }, [groupedStructure]);

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        <p>Collection non accessible</p>
      </div>
    );
  }

  const visibleProperties = orderedProperties.filter((p: any) => !hiddenFields.includes(p.id));

  // Obtenir le libellé d'une valeur pour affichage
  const getGroupLabel = (property: any, value: any): string => {
    if (!value && value !== 0 && value !== false) return '(vide)';
    
    if (property.type === 'relation') {
      const targetCollection = collections.find((c: any) => c.id === property.relation?.targetCollectionId);
      if (!targetCollection) return String(value);
      const nameField = targetCollection.properties.find((p: any) => p.id === 'name' || p.name === 'Nom');
      if (Array.isArray(value)) {
        return value.map(id => {
          const item = targetCollection.items.find((i: any) => i.id === id);
          return item ? (item[nameField?.id] || item.name || id) : id;
        }).join(', ');
      } else {
        const item = targetCollection.items.find((i: any) => i.id === value);
        return item ? (item[nameField?.id] || item.name || value) : String(value);
      }
    }
    return String(value);
  };

  // Fonction de rendu récursive pour les groupes
  const renderGroup = (groupPath: string, depth: number): React.ReactNode => {
    if (!groupedStructure) return null;

    const groupData = groupedStructure.structure[groupPath];
    if (!groupData) return null;

    const pathParts = groupPath.split('/');
    const groupValue = pathParts[pathParts.length - 1];
    const groupId = groups[depth];
    const property = collection.properties.find((p: any) => p.id === groupId);
    if (!property) return null;

    const isExpanded = expandedGroups.has(groupPath);
    const label = getGroupLabel(property, groupValue === '(vide)' ? undefined : groupValue);
    
    // Compter récursivement tous les items dans ce groupe et ses sous-groupes
    const countItems = (path: string): number => {
      const data = groupedStructure.structure[path];
      if (!data) return 0;
      return data.itemIds.length + 
        data.subGroups.reduce((sum, subPath) => sum + countItems(subPath), 0);
    };
    const itemCount = countItems(groupPath);

    return (
      <React.Fragment key={groupPath}>
        {/* Group Header */}
        <tr className="bg-neutral-800/40 hover:bg-neutral-800/60 border-b border-white/5">
          <td colSpan={visibleProperties.length + (canEdit ? 1 : 0)} className="px-6 py-3">
            <button
              onClick={() => {
                const next = new Set(expandedGroups);
                if (next.has(groupPath)) {
                  next.delete(groupPath);
                } else {
                  next.add(groupPath);
                }
                setExpandedGroups(next);
              }}
              className="flex items-center gap-2 text-sm font-semibold text-white hover:text-cyan-400 transition-colors"
            >
              <motion.div
                animate={{ rotate: isExpanded ? 90 : 0 }}
                className="flex items-center justify-center"
              >
                <Icons.ChevronRight size={18} />
              </motion.div>
              <span style={{ marginLeft: `${depth * 20}px` }}>
                {property.name}: <span className="text-neutral-400">{label}</span>
              </span>
              <span className="text-xs bg-white/10 px-2 py-1 rounded ml-2">
                {itemCount}
              </span>
            </button>
          </td>
        </tr>

        {/* Sub-groups or items */}
        {isExpanded && (
          <>
            {/* Sous-groupes d'abord */}
            {groupData.subGroups.map(subPath => renderGroup(subPath, depth + 1))}
            
            {/* Items de ce groupe */}
            {groupData.itemIds.map(itemId => {
              const item = itemsMap.get(itemId);
              if (!item) return null;

              return (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-white/5 transition-colors border-b border-white/5"
                >
                  {visibleProperties.map((prop: any) => (
                    <td key={prop.id} className="px-6 py-4 whitespace-nowrap text-sm text-neutral-300" style={{ paddingLeft: `${24 + (depth + 1) * 20}px` }}>
                      <EditableProperty
                        property={prop}
                        value={item[prop.id]}
                        onChange={(val) => onEdit({ ...item, [prop.id]: val })}
                        size="md"
                        isNameField={prop.id === 'name' || prop.name === 'Nom'}
                        onViewDetail={prop.id === 'name' || prop.name === 'Nom' ? () => onViewDetail(item) : undefined}
                        collections={collections}
                        currentItem={item}
                        onRelationChange={onRelationChange}
                        onNavigateToCollection={onNavigateToCollection}
                        readOnly={!canEdit || !canEditField(prop.id)}
                      />
                    </td>
                  ))}
                  {canEdit && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-3 text-neutral-500">
                        <Icons.GripVertical size={16} className="cursor-grab" />
                        <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-400">
                          <Icons.Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </motion.tr>
              );
            })}
          </>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="bg-neutral-900/40 border border-white/5 rounded-lg overflow-hidden backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-900/60 border-b border-white/5">
            <tr>
              {visibleProperties.map((prop: any) => {
                const PropIcon = (Icons as any)[prop.icon] || Icons.Tag;
                return (
                  <th key={prop.id} style={{ backgroundColor: `${prop.color || '#8b5cf6'}10` }} className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2 font-black">
                      <PropIcon size={14}  />
                      {prop.name}
                      {canEdit && (
                        <div className="flex gap-1 opacity-0 hover:opacity-100 transition-all duration-500">
                          <button
                            onClick={() => onEditProperty(prop)}
                            className="text-neutral-600 hover:text-cyan-400"
                            title="Modifier la propriété"
                          >
                            <Icons.Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => onToggleField(prop.id)}
                            className="text-neutral-600 hover:text-neutral-400"
                            title="Masquer la colonne"
                          >
                            <Icons.EyeOff size={14} />
                          </button>
                          {prop.id !== 'name' && (
                            <button
                              onClick={() => onDeleteProperty(prop.id)}
                              className="text-neutral-600 hover:text-red-500"
                              title="Supprimer la propriété"
                            >
                              <Icons.Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
              {canEdit && <th className="px-6 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {groupedStructure ? (
              // Rendu des groupes avec la nouvelle logique
              groupedStructure.rootGroups.map(rootGroup => renderGroup(rootGroup, 0))
            ) : (
              // Sans groupes : affichage normal
              items.map((item: any) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-white/5 transition-colors"
                >
                  {visibleProperties.map((prop: any) => (
                    <td key={prop.id} className="px-6 py-4 whitespace-nowrap text-sm text-neutral-300">
                      <EditableProperty
                        property={prop}
                        value={item[prop.id]}
                        onChange={(val) => onEdit({ ...item, [prop.id]: val })}
                        size="md"
                        isNameField={prop.id === 'name' || prop.name === 'Nom'}
                        onViewDetail={prop.id === 'name' || prop.name === 'Nom' ? () => onViewDetail(item) : undefined}
                        collections={collections}
                        currentItem={item}
                        onRelationChange={onRelationChange}
                        onNavigateToCollection={onNavigateToCollection}
                        readOnly={!canEdit || !canEditField(prop.id)}
                      />
                    </td>
                  ))}
                  {canEdit && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-3 text-neutral-500">
                        <Icons.GripVertical size={16} className="cursor-grab" />
                        <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-400">
                          <Icons.Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableView;
