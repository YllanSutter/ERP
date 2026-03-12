import React, { useEffect, useMemo, useState } from 'react';
import { getGroupLabel, countItemsInGroup, GroupedItems } from '@/lib/groupingUtils';
import { Collection, Property, Item, GroupTotalConfig } from '@/lib/types';
import GroupHeader from './GroupHeader';
import TableItemRow from './TableItemRow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface GroupRendererProps {
  groupPath: string;
  depth: number;
  groups: string[];
  groupProperties: Property[];
  groupDisplayModes?: Record<string, 'accordion' | 'columns' | 'tabs'>;
  defaultGroupDisplayMode?: 'accordion' | 'columns' | 'tabs';
  groupDisplayColumnCounts?: Record<string, 1 | 2 | 3>;
  defaultGroupDisplayColumnCount?: 1 | 2 | 3;
  groupTotalsByGroupId?: Record<string, GroupTotalConfig>;
  groupedStructure: { structure: GroupedItems; rootGroups: string[] };
  collection: Collection;
  collections: Collection[];
  expandedGroups: Set<string>;
  toggleGroup: (path: string) => void;
  itemsMap: Map<string, Item>;
  visibleProperties: Property[];
  favoriteItemIds?: string[];
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onToggleFavoriteItem?: (itemId: string) => void;
  onViewDetail: (item: Item) => void;
  onRelationChange: (prop: Property, item: Item, value: any) => void;
  onNavigateToCollection: (collectionId: string, linkedIds?: string[]) => void;
  canEdit: boolean;
  canEditField: (fieldId: string) => boolean;
  sortItems?: (arr: any[]) => any[];
  enableSelection?: boolean;
  selectedItemIds?: Set<string>;
  onSelectionChange?: (itemId: string, checked: boolean) => void;
  draggableRows?: boolean;
  dragItemId?: string | null;
  dragOverItemId?: string | null;
  onRowDragStart?: (itemId: string) => void;
  onRowDragEnter?: (itemId: string) => void;
  onRowDrop?: (targetItemId: string, e: React.DragEvent<HTMLTableRowElement>) => void;
  onRowDragEnd?: () => void;
  totalFields?: Record<string, string>;
  calculateTotal?: (fieldId: string, items: Item[], totalType: string) => any;
  formatTotal?: (fieldId: string, total: any, totalType: string) => string;
  hideCurrentHeader?: boolean;
  depthOffset?: number;
  suppressTopTotalHeader?: boolean;
  topTotalRenderMode?: 'normal' | 'only' | 'skip';
}

const GroupRenderer: React.FC<GroupRendererProps> = ({
  groupPath,
  depth,
  groups,
  groupProperties,
  groupDisplayModes = {},
  defaultGroupDisplayMode = 'accordion',
  groupDisplayColumnCounts = {},
  defaultGroupDisplayColumnCount = 3,
  groupTotalsByGroupId = {},
  groupedStructure,
  collection,
  collections,
  expandedGroups,
  toggleGroup,
  itemsMap,
  visibleProperties,
  favoriteItemIds,
  onEdit,
  onDelete,
  onToggleFavoriteItem,
  onViewDetail,
  onRelationChange,
  onNavigateToCollection,
  canEdit,
  canEditField,
  sortItems,
  enableSelection = false,
  selectedItemIds,
  onSelectionChange,
  draggableRows = false,
  dragItemId,
  dragOverItemId,
  onRowDragStart,
  onRowDragEnter,
  onRowDrop,
  onRowDragEnd,
  totalFields = {},
  calculateTotal,
  formatTotal,
  hideCurrentHeader = false,
  depthOffset = 0,
  suppressTopTotalHeader = false,
  topTotalRenderMode = 'normal',
}) => {
  const groupData = groupedStructure.structure[groupPath];
  if (!groupData) return null;

  const pathParts = groupPath.split('/');
  const groupValue = pathParts[pathParts.length - 1];
  const groupId = groups[depth];
  const property = groupProperties.find((p: Property) => p.id === groupId);
  if (!property) return null;

  const currentLevelMode: 'accordion' | 'columns' | 'tabs' =
    (groupId && groupDisplayModes[groupId])
      || (depth === 0 ? (defaultGroupDisplayMode || 'accordion') : 'accordion');
  const canCollapse = currentLevelMode === 'accordion';
  const isExpanded = canCollapse ? expandedGroups.has(groupPath) : true;
  const shouldRenderChildren = hideCurrentHeader || isExpanded;
  const label = getGroupLabel(
    property,
    groupValue === '(vide)' ? undefined : groupValue,
    collections
  );
  const itemCount = countItemsInGroup(groupPath, groupedStructure.structure);
  const displayDepth = Math.max(0, depth + depthOffset);
  const nextGroupId = groups[depth + 1];
  const nextLevelMode: 'accordion' | 'columns' | 'tabs' =
    (nextGroupId && groupDisplayModes[nextGroupId]) || 'accordion';
  const normalizeColumnCount = (count: any): 1 | 2 | 3 => (count === 1 || count === 2 || count === 3 ? count : 3);
  const getColumnsClassName = (count: 1 | 2 | 3) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 lg:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3';
  };
  const nextLevelColumnCount = normalizeColumnCount(
    (nextGroupId && groupDisplayColumnCounts[nextGroupId]) || defaultGroupDisplayColumnCount
  );
  const nextLevelColumnsClassName = getColumnsClassName(nextLevelColumnCount);

  const displayColumnCount = visibleProperties.filter((p: any) => !p.showContextMenu).length;
  const displayProperties = visibleProperties.filter((p: any) => !p.showContextMenu);
  const currentGroupTotalConfig = (groupId && groupTotalsByGroupId[groupId]) || {};
  const showGroupTotal = currentGroupTotalConfig.enabled !== false;
  const groupTotalPosition: 'top' | 'bottom' = currentGroupTotalConfig.position === 'top' ? 'top' : 'bottom';
  const groupItemsForTotal = useMemo(() => {
    const visited = new Set<string>();
    const collect = (path: string): Item[] => {
      if (visited.has(path)) return [];
      visited.add(path);

      const node = groupedStructure.structure[path];
      if (!node) return [];

      const directItems = (node.itemIds || [])
        .map((itemId) => itemsMap.get(itemId))
        .filter((item): item is Item => Boolean(item));

      const nestedItems = (node.subGroups || []).flatMap((subPath) => collect(subPath));
      return [...directItems, ...nestedItems];
    };

    const all = collect(groupPath);
    const dedup = new Map<string, Item>();
    all.forEach((it) => dedup.set(it.id, it));
    return Array.from(dedup.values());
  }, [groupPath, groupedStructure.structure, itemsMap]);
  const subGroupCards = useMemo(() => {
    const nextProperty = nextGroupId
      ? groupProperties.find((p: Property) => p.id === nextGroupId)
      : undefined;
    return groupData.subGroups.map((subPath) => {
      const rawValue = subPath.split('/').pop() || subPath;
      const labelValue = rawValue === '(vide)' ? undefined : rawValue;
      const label = nextProperty ? getGroupLabel(nextProperty, labelValue, collections) : rawValue;
      const itemCount = countItemsInGroup(subPath, groupedStructure.structure);
      return { id: subPath, label, itemCount, propertyName: nextProperty?.name || '' };
    });
  }, [collections, groupData.subGroups, groupProperties, groupedStructure.structure, nextGroupId]);

  const [activeSubGroupTab, setActiveSubGroupTab] = useState<string | null>(subGroupCards[0]?.id || null);

  useEffect(() => {
    if (!subGroupCards.length) {
      setActiveSubGroupTab(null);
      return;
    }
    if (!activeSubGroupTab || !subGroupCards.some((card) => card.id === activeSubGroupTab)) {
      setActiveSubGroupTab(subGroupCards[0].id);
    }
  }, [activeSubGroupTab, subGroupCards]);

  const renderNestedTable = (
    subPath: string,
    topTotalMode: 'normal' | 'only' | 'skip' = 'normal'
  ) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10 bg-white/50 dark:bg-neutral-900/40">
            {draggableRows && <th className="px-1 py-2 w-8" />}
            {enableSelection && <th className="px-2 py-2 w-10" />}
            {displayProperties.map((prop: any) => (
              <th
                key={prop.id}
                className="px-4 py-2 text-left text-xs font-semibold text-neutral-600 dark:text-neutral-300"
              >
                {prop.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          <GroupRenderer
            groupPath={subPath}
            depth={depth + 1}
            groups={groups}
            groupProperties={groupProperties}
            groupDisplayModes={groupDisplayModes}
            defaultGroupDisplayMode={defaultGroupDisplayMode}
            groupDisplayColumnCounts={groupDisplayColumnCounts}
            defaultGroupDisplayColumnCount={defaultGroupDisplayColumnCount}
            groupTotalsByGroupId={groupTotalsByGroupId}
            groupedStructure={groupedStructure}
            collection={collection}
            collections={collections}
            expandedGroups={expandedGroups}
            toggleGroup={toggleGroup}
            itemsMap={itemsMap}
            visibleProperties={visibleProperties}
            favoriteItemIds={favoriteItemIds}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleFavoriteItem={onToggleFavoriteItem}
            onViewDetail={onViewDetail}
            onRelationChange={onRelationChange}
            onNavigateToCollection={onNavigateToCollection}
            canEdit={canEdit}
            canEditField={canEditField}
            sortItems={sortItems}
            enableSelection={enableSelection}
            selectedItemIds={selectedItemIds}
            onSelectionChange={onSelectionChange}
            draggableRows={draggableRows}
            dragItemId={dragItemId}
            dragOverItemId={dragOverItemId}
            onRowDragStart={onRowDragStart}
            onRowDragEnter={onRowDragEnter}
            onRowDrop={onRowDrop}
            onRowDragEnd={onRowDragEnd}
            totalFields={totalFields}
            calculateTotal={calculateTotal}
            formatTotal={formatTotal}
            hideCurrentHeader
            depthOffset={depthOffset}
            suppressTopTotalHeader
            topTotalRenderMode={topTotalMode}
          />
        </tbody>
      </table>
    </div>
  );

  const totalColSpan = displayColumnCount + (draggableRows ? 1 : 0) + (enableSelection ? 1 : 0);

  const renderGroupTotalRow = (position: 'top' | 'bottom') => {
    if (!showGroupTotal || Object.keys(totalFields).length === 0 || groupItemsForTotal.length === 0 || !calculateTotal || !formatTotal) {
      return null;
    }

    const showTopTotalHeaderRow = position === 'top' && !suppressTopTotalHeader;

    if (position === 'bottom') {
      return (
        <>
          <tr className="bg-white/70 dark:bg-neutral-900/35 border-t border-black/10 dark:border-white/10">
            {draggableRows && <td className="px-1 py-1 w-8"></td>}
            {enableSelection && <td className="px-2 py-1"></td>}
            {displayProperties.map((prop: any, index: number) => {
              const totalType = totalFields[prop.id];
              if (!totalType) {
                return (
                  <td
                    key={prop.id}
                    className="px-3 py-1 text-[10px] text-neutral-400"
                    style={index === 0 ? { paddingLeft: `${24 + (displayDepth + 1) * 20}px` } : undefined}
                  >
                  </td>
                );
              }
              const total = calculateTotal(prop.id, groupItemsForTotal, totalType);
              return (
                <td
                  key={prop.id}
                  className="px-3 py-1 text-[10px] font-semibold text-neutral-700 dark:text-neutral-200"
                  style={index === 0 ? { paddingLeft: `${24 + (displayDepth + 1) * 20}px` } : undefined}
                >
                  <span className="inline-block max-w-[180px] truncate align-bottom">{formatTotal(prop.id, total, totalType)}</span>
                </td>
              );
            })}
          </tr>
        </>
      );
    }

    return (
      <>
        <tr>
          <td colSpan={totalColSpan} className="px-0 pt-3 pb-3">
            <div className="mx-auto w-full max-w-[1200px] px-2">
              <table className="w-full">
                <tbody>
                  {showTopTotalHeaderRow && (
                    <tr className="bg-neutral-100 dark:bg-neutral-800/70 border-y border-black/10 dark:border-white/10">
                      {draggableRows && <td className="px-1 py-2.5 w-8"></td>}
                      {enableSelection && <td className="px-2 py-2.5"></td>}
                      {displayProperties.map((prop: any) => (
                        <td
                          key={`total-header-${prop.id}`}
                          className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-neutral-700 dark:text-neutral-100"
                        >
                          <div className="max-w-[180px] truncate">{prop.name}</div>
                        </td>
                      ))}
                    </tr>
                  )}

                  <tr className="bg-white/70 dark:bg-neutral-900/35 border-y border-black/10 dark:border-white/10">
                    {draggableRows && <td className={`px-1 ${showTopTotalHeaderRow ? 'py-2' : 'py-1'} w-8`}></td>}
                    {enableSelection && <td className={`px-2 ${showTopTotalHeaderRow ? 'py-2' : 'py-1'}`}></td>}
                    {displayProperties.map((prop: any, index: number) => {
                      const totalType = totalFields[prop.id];
                      if (!totalType) {
                        return (
                          <td
                            key={prop.id}
                            className={`px-3 ${showTopTotalHeaderRow ? 'py-2' : 'py-1'} text-[10px] text-neutral-400`}
                            style={index === 0 ? { paddingLeft: `${24 + (displayDepth + 1) * 20}px` } : undefined}
                          >
                          </td>
                        );
                      }
                      const total = calculateTotal(prop.id, groupItemsForTotal, totalType);
                      return (
                        <td
                          key={prop.id}
                          className={`px-3 ${showTopTotalHeaderRow ? 'py-2' : 'py-1'} text-[10px] font-semibold text-neutral-700 dark:text-neutral-200`}
                          style={index === 0 ? { paddingLeft: `${24 + (displayDepth + 1) * 20}px` } : undefined}
                        >
                          <span className="inline-block max-w-[180px] truncate align-bottom">{formatTotal(prop.id, total, totalType)}</span>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      </>
    );
  };

  return (
    <React.Fragment key={groupPath}>
      {shouldRenderChildren && topTotalRenderMode !== 'skip' && groupTotalPosition === 'top' && renderGroupTotalRow('top')}

      {topTotalRenderMode !== 'only' && !hideCurrentHeader && (
        <GroupHeader
          groupPath={groupPath}
          label={label}
          propertyName={property.name}
          itemCount={itemCount}
          depth={displayDepth}
          isExpanded={isExpanded}
          onToggle={() => {
            if (!canCollapse) return;
            toggleGroup(groupPath);
          }}
          colSpan={displayColumnCount + (draggableRows ? 1 : 0) + (enableSelection ? 1 : 0)}
          showChevron={canCollapse}
        />
      )}

      {topTotalRenderMode !== 'only' && shouldRenderChildren && (
        <>
          {/* Sous-groupes en tableaux dédiés (onglets/colonnes), sinon rendu accordéon classique */}
          {groupData.subGroups.length > 0 && (nextLevelMode === 'tabs' || nextLevelMode === 'columns') ? (
            <tr>
              <td colSpan={displayColumnCount + (draggableRows ? 1 : 0) + (enableSelection ? 1 : 0)} className="px-2 py-2">
                {nextLevelMode === 'tabs' ? (
                  <>
                    {(() => {
                      const activeSubGroupId =
                        subGroupCards.find((g) => g.id === activeSubGroupTab)?.id || subGroupCards[0]?.id;
                      if (!activeSubGroupId) return null;
                      return renderNestedTable(activeSubGroupId, 'only');
                    })()}

                    <Tabs value={activeSubGroupTab || undefined} onValueChange={setActiveSubGroupTab} className="w-full">
                      <TabsList className="mt-3 h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                        {subGroupCards.map((group) => (
                          <TabsTrigger
                            key={group.id}
                            value={group.id}
                            className="rounded-full border border-black/10 dark:border-white/10 bg-white/60 px-3 py-1.5 text-xs dark:bg-white/5"
                          >
                            {group.label} ({group.itemCount})
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {subGroupCards.map((group) => (
                        <TabsContent key={group.id} value={group.id} className="mt-0">
                          {renderNestedTable(group.id, 'skip')}
                        </TabsContent>
                      ))}
                    </Tabs>
                  </>
                ) : (
                  <div className={`grid gap-3 ${nextLevelColumnsClassName}`}>
                    {subGroupCards.map((group) => (
                      <div
                        key={group.id}
                        className="min-w-0 rounded-xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-neutral-900/30 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-neutral-800 dark:text-white">{group.label}</div>
                            {group.propertyName && (
                              <div className="text-xs text-neutral-500 dark:text-neutral-400">{group.propertyName}</div>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-black/5 dark:bg-white/10 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-300">
                            {group.itemCount}
                          </span>
                        </div>
                        {renderNestedTable(group.id)}
                      </div>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ) : (
            groupData.subGroups.map(subPath => (
              <GroupRenderer
                key={subPath}
                groupPath={subPath}
                depth={depth + 1}
                groups={groups}
                groupProperties={groupProperties}
                groupDisplayModes={groupDisplayModes}
                defaultGroupDisplayMode={defaultGroupDisplayMode}
                groupDisplayColumnCounts={groupDisplayColumnCounts}
                defaultGroupDisplayColumnCount={defaultGroupDisplayColumnCount}
                groupTotalsByGroupId={groupTotalsByGroupId}
                groupedStructure={groupedStructure}
                collection={collection}
                collections={collections}
                expandedGroups={expandedGroups}
                toggleGroup={toggleGroup}
                itemsMap={itemsMap}
                visibleProperties={visibleProperties}
                favoriteItemIds={favoriteItemIds}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleFavoriteItem={onToggleFavoriteItem}
                onViewDetail={onViewDetail}
                onRelationChange={onRelationChange}
                onNavigateToCollection={onNavigateToCollection}
                canEdit={canEdit}
                canEditField={canEditField}
                sortItems={sortItems}
                enableSelection={enableSelection}
                selectedItemIds={selectedItemIds}
                onSelectionChange={onSelectionChange}
                draggableRows={draggableRows}
                dragItemId={dragItemId}
                dragOverItemId={dragOverItemId}
                onRowDragStart={onRowDragStart}
                onRowDragEnter={onRowDragEnter}
                onRowDrop={onRowDrop}
                onRowDragEnd={onRowDragEnd}
                totalFields={totalFields}
                calculateTotal={calculateTotal}
                formatTotal={formatTotal}
                depthOffset={depthOffset}
                suppressTopTotalHeader={suppressTopTotalHeader}
              />
            ))
          )}

          {(() => {
            const groupItems = groupData.itemIds.map(itemId => itemsMap.get(itemId)).filter(Boolean);
            const sortedItems = sortItems ? sortItems(groupItems) : groupItems;
            return sortedItems.map(item => (
            <TableItemRow
              key={item.id}
              item={item}
              isFavorite={favoriteItemIds?.includes(item.id) ?? false}
              visibleProperties={visibleProperties}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleFavoriteItem={onToggleFavoriteItem}
              onViewDetail={onViewDetail}
              collections={collections}
              collection={collection}
              onRelationChange={onRelationChange}
              onNavigateToCollection={onNavigateToCollection}
              canEdit={canEdit}
              canEditField={canEditField}
              paddingLeft={24 + (depth + 1) * 20}
              animate={false}
              enableSelection={enableSelection}
              isSelected={selectedItemIds?.has(item.id) ?? false}
              onSelectionChange={onSelectionChange}
              enableDragReorder={draggableRows}
              isDragging={dragItemId === item.id}
              isDragOver={dragOverItemId === item.id && dragItemId !== item.id}
              onDragStart={(itemId, e) => {
                e.dataTransfer!.effectAllowed = 'move';
                onRowDragStart?.(itemId);
              }}
              onDragEnter={onRowDragEnter}
              onDragOver={(e) => {
                if (!draggableRows) return;
                e.preventDefault();
                e.dataTransfer!.dropEffect = 'move';
              }}
              onDrop={onRowDrop}
              onDragEnd={onRowDragEnd}
            />
            ));
          })()}

          {groupTotalPosition === 'bottom' && renderGroupTotalRow('bottom')}
        </>
      )}
    </React.Fragment>
  );
};

export default React.memo(GroupRenderer);
