import React from 'react';
import { getGroupLabel, countItemsInGroup, GroupedItems } from '@/lib/groupingUtils';
import { Collection, Property, Item } from '@/lib/types';
import GroupHeader from './GroupHeader';
import TableItemRow from './TableItemRow';

interface GroupRendererProps {
  groupPath: string;
  depth: number;
  groups: string[];
  groupedStructure: { structure: GroupedItems; rootGroups: string[] };
  collection: Collection;
  collections: Collection[];
  expandedGroups: Set<string>;
  toggleGroup: (path: string) => void;
  itemsMap: Map<string, Item>;
  visibleProperties: Property[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onViewDetail: (item: Item) => void;
  onRelationChange: (prop: Property, item: Item, value: any) => void;
  onNavigateToCollection: (collectionId: string, linkedIds?: string[]) => void;
  canEdit: boolean;
  canEditField: (fieldId: string) => boolean;
}

const GroupRenderer: React.FC<GroupRendererProps> = ({
  groupPath,
  depth,
  groups,
  groupedStructure,
  collection,
  collections,
  expandedGroups,
  toggleGroup,
  itemsMap,
  visibleProperties,
  onEdit,
  onDelete,
  onViewDetail,
  onRelationChange,
  onNavigateToCollection,
  canEdit,
  canEditField,
}) => {
  const groupData = groupedStructure.structure[groupPath];
  if (!groupData) return null;

  const pathParts = groupPath.split('/');
  const groupValue = pathParts[pathParts.length - 1];
  const groupId = groups[depth];
  const property = collection.properties.find((p: Property) => p.id === groupId);
  if (!property) return null;

  const isExpanded = expandedGroups.has(groupPath);
  const label = getGroupLabel(
    property,
    groupValue === '(vide)' ? undefined : groupValue,
    collections
  );
  const itemCount = countItemsInGroup(groupPath, groupedStructure.structure);

  return (
    <React.Fragment key={groupPath}>
      <GroupHeader
        groupPath={groupPath}
        label={label}
        propertyName={property.name}
        itemCount={itemCount}
        depth={depth}
        isExpanded={isExpanded}
        onToggle={() => toggleGroup(groupPath)}
        colSpan={visibleProperties.length + (canEdit ? 1 : 0)}
      />

      {isExpanded && (
        <>
          {/* Sous-groupes d'abord */}
          {groupData.subGroups.map(subPath => (
            <GroupRenderer
              key={subPath}
              groupPath={subPath}
              depth={depth + 1}
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
              canEditField={canEditField}
            />
          ))}

          {/* Items de ce groupe */}
          {groupData.itemIds.map(itemId => {
            const item = itemsMap.get(itemId);
            if (!item) return null;

            return (
              <TableItemRow
                key={item.id}
                item={item}
                visibleProperties={visibleProperties}
                onEdit={onEdit}
                onDelete={onDelete}
                onViewDetail={onViewDetail}
                collections={collections}
                collection={collection}
                onRelationChange={onRelationChange}
                onNavigateToCollection={onNavigateToCollection}
                canEdit={canEdit}
                canEditField={canEditField}
                paddingLeft={24 + (depth + 1) * 20}
                animate={true}
              />
            );
          })}
        </>
      )}
    </React.Fragment>
  );
};

export default React.memo(GroupRenderer);
