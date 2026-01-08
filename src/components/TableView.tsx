import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

interface GroupNode {
  key: string;
  label: string;
  items?: any[];
  children?: Record<string, GroupNode>;
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
  // Construire la hiérarchie de groupes et collectionner tous les chemins
  const { groupedData, allGroupPaths } = useMemo(() => {
    if (!groups || groups.length === 0) return { groupedData: null, allGroupPaths: [] };

    const paths: string[] = [];

    const buildGroupTree = (items: any[], groupProperties: any[], depth: number = 0, parentPath: string = 'group'): GroupNode => {
      if (depth >= groupProperties.length) {
        return { key: 'items', label: '', items };
      }

      const prop = groupProperties[depth];
      const grouped: Record<string, any[]> = {};

      items.forEach(item => {
        const groupKey = String(item[prop.id] || '(vide)');
        if (!grouped[groupKey]) grouped[groupKey] = [];
        grouped[groupKey].push(item);
      });

      const children: Record<string, GroupNode> = {};
      Object.entries(grouped).forEach(([key, groupItems]) => {
        const groupPath = `${parentPath}/${key}`;
        paths.push(groupPath);
        children[key] = buildGroupTree(groupItems, groupProperties, depth + 1, groupPath);
      });

      return {
        key: 'root',
        label: '',
        children
      };
    };

    const groupProperties = groups
      .map((groupId: string) => collection.properties.find((p: any) => p.id === groupId))
      .filter(Boolean);

    const tree = buildGroupTree(items, groupProperties);
    return { groupedData: tree, allGroupPaths: paths };
  }, [items, groups, collection]);

  // Initialiser avec tous les groupes ouverts par défaut
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(allGroupPaths));

  // Mettre à jour expandedGroups quand les données changent
  React.useEffect(() => {
    setExpandedGroups(new Set(allGroupPaths));
  }, [allGroupPaths]);

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


  // Composant pour afficher un groupe
  const countItemsInNode = (node: GroupNode): number => {
    if (node.items && node.items.length > 0) {
      return node.items.length;
    }
    if (node.children) {
      return Object.values(node.children).reduce((total, child) => total + countItemsInNode(child), 0);
    }
    return 0;
  };

  const GroupSection: React.FC<{ node: GroupNode; property: any; depth: number; parentPath: string }> = ({ 
    node, 
    property, 
    depth, 
    parentPath 
  }) => {
    if (!node.children) return null;

    return (
      <>
        {Object.entries(node.children).map(([key, childNode]) => {
          const groupPath = `${parentPath}/${key}`;
          const isExpanded = expandedGroups.has(groupPath);
          const label = getGroupLabel(property, key === '(vide)' ? undefined : key);
          const itemCount = countItemsInNode(childNode);

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
              <AnimatePresence>
                {isExpanded && (
                  <>
                    {depth + 1 < groups.length ? (
                      // Sub-groups
                      <GroupSection
                        node={childNode}
                        property={collection.properties.find((p: any) => p.id === groups[depth + 1])}
                        depth={depth + 1}
                        parentPath={groupPath}
                      />
                    ) : (
                      // Items in this group
                      childNode.items?.map((item: any) => (
                        <motion.tr
                          key={item.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
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
                      ))
                    )}
                  </>
                )}
              </AnimatePresence>
            </React.Fragment>
          );
        })}
      </>
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
            {groupedData ? (
              <GroupSection 
                node={groupedData} 
                property={collection.properties.find((p: any) => p.id === groups[0])}
                depth={0}
                parentPath="group"
              />
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
