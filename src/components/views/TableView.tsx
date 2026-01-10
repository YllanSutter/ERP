import React from 'react';
import { useGrouping } from '@/lib/hooks/useGrouping';
import { TableViewProps } from '@/lib/types';
import GroupRenderer from '@/components/TableView/GroupRenderer';
import TableItemRow from '@/components/TableView/TableItemRow';
import TableHeader from '@/components/TableView/TableHeader';
import { useCanEdit, useCanEditField, useCanViewField } from '@/lib/hooks/useCanEdit';

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
}) => {
  const { itemsMap, groupedStructure, expandedGroups, toggleGroup } = useGrouping(
    items,
    groups,
    collection.properties
  );
  
  // Hooks de permissions
  const canEdit = useCanEdit(collection?.id);
  const canEditFieldFn = (fieldId: string) => useCanEditField(fieldId, collection?.id);
  const canViewFieldFn = (fieldId: string) => useCanViewField(fieldId, collection?.id);

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        <p>Collection non accessible</p>
      </div>
    );
  }

  // Filtrer les propriétés selon les permissions de vue
  const visibleProperties = orderedProperties.filter(p => 
    !hiddenFields.includes(p.id) && canViewFieldFn(p.id)
  );

  return (
    <div className="bg-neutral-900/40 border border-white/5 rounded-lg overflow-hidden backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full">
          <TableHeader
            visibleProperties={visibleProperties}
            onEditProperty={onEditProperty}
            onToggleField={onToggleField}
            onDeleteProperty={onDeleteProperty}
            collectionId={collection?.id}
          />
          <tbody className="divide-y divide-white/5">
            {groupedStructure ? (
              // Rendu des groupes avec la nouvelle logique
              groupedStructure.rootGroups.map(rootGroup => (
                <GroupRenderer
                  key={rootGroup}
                  groupPath={rootGroup}
                  depth={0}
                  groups={groups}
                  groupedStructure={groupedStructure}
                  collection={collection}
                  collections={collections}
                  expandedGroups={expandedGroups}
                  toggleGroup={toggleGroup}
                  itemsMap={itemsMap}
                  visibleProperties={visibleProperties}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onViewDetail={onViewDetail}
                  onRelationChange={onRelationChange}
                  onNavigateToCollection={onNavigateToCollection}
                  canEdit={canEdit}
                  canEditField={canEditFieldFn}
                />
              ))
            ) : (
              // Sans groupes : affichage normal
              items.map(item => (
                <TableItemRow
                  key={item.id}
                  item={item}
                  visibleProperties={visibleProperties}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onViewDetail={onViewDetail}
                  collections={collections}
                  onRelationChange={onRelationChange}
                  onNavigateToCollection={onNavigateToCollection}
                  canEdit={canEdit}
                  canEditField={canEditFieldFn}
                  animate={false}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableView;
