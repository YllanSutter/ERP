import React, { useState, useCallback } from 'react';
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

  // Tri par colonne
  const [sortState, setSortState] = useState<{ column: string | null; direction: 'asc' | 'desc' }>({ column: null, direction: 'asc' });

  const handleSort = useCallback((columnId: string) => {
    setSortState((prev) => {
      if (prev.column === columnId) {
        return { column: columnId, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column: columnId, direction: 'asc' };
    });
  }, []);

  // Fonction de tri générique
  const sortItems = useCallback((arr: any[]) => {
    if (!sortState.column) return arr;
    const col = sortState.column;
    return [...arr].sort((a, b) => {
      const aVal = a && col in a ? a[col] : undefined;
      const bVal = b && col in b ? b[col] : undefined;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortState.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortState.direction === 'asc'
        ? String(aVal).localeCompare(String(bVal), 'fr', { numeric: true })
        : String(bVal).localeCompare(String(aVal), 'fr', { numeric: true });
    });
  }, [sortState]);
  
  // Hooks de permissions
  const canEdit = useCanEdit(collection?.id);
  const canEditFieldFn = (fieldId: string) => useCanEditField(fieldId, collection?.id);
  const canViewFieldFn = (fieldId: string) => useCanViewField(fieldId, collection?.id);

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-700 dark:text-neutral-500">
        <p>Collection non accessible</p>
      </div>
    );
  }

  // Filtrer les propriétés selon les permissions de vue
  const visibleProperties = orderedProperties.filter(p => 
    !hiddenFields.includes(p.id) && canViewFieldFn(p.id)
  );

  return (
    <div className=" border border-black/10 dark:border-white/5 rounded-lg overflow-hidden backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full">
          <TableHeader
            visibleProperties={visibleProperties}
            items={items}
            onEditProperty={onEditProperty}
            onToggleField={onToggleField}
            onDeleteProperty={onDeleteProperty}
            collectionId={collection?.id}
            sortState={sortState}
            onSort={handleSort}
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
                  sortItems={sortItems}
                />
              ))
            ) : (
              // Sans groupes : affichage normal
              sortItems(items).map(item => (
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
                  collection = {collection}
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
