import React, { useCallback, useMemo } from 'react';
import { Plus, Zap } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import ViewShell from './ViewShell';
import ViewGrouping from './ViewGrouping';
import CardsGrid from './CardsGrid';
import type { TableViewProps } from '@/lib/types';
import { useCanEdit } from '@/lib/hooks/useCanEdit';
import { useViewPagination } from '@/lib/hooks/useViewPagination';
import type { FieldGroup } from '@/lib/types';

type CardsViewProps = Omit<TableViewProps, 'displayAsCards'> & {
  cardStyle?: 'default' | 'steamFullArt';
  cardDensity?: 'compact' | 'comfortable' | 'spacious';
  cardIconFieldId?: string | null;
  cardColorFieldId?: string | null;
  fieldGroups?: FieldGroup[];
  cardGroupPlacements?: Record<string, string>;
};

const CardsView: React.FC<CardsViewProps> = ({
  collection,
  items,
  orderedProperties,
  hiddenFields,
  collections,
  onEdit,
  onViewDetail,
  onRelationChange,
  onNavigateToCollection,
  groups = [],
  onShowNewItemModal,
  onQuickCreateItem,
  initialExpandedGroups,
  onExpandedGroupsChange,
  groupDisplayMode = 'accordion',
  groupDisplayModes = {},
  groupDisplayColumnCount = 3,
  groupDisplayColumnCounts = {},
  cardStyle = 'default',
  cardDensity = 'comfortable',
  cardIconFieldId,
  cardColorFieldId,
  fieldGroups = [],
  cardGroupPlacements = {},
  cardColumns = 'auto',
}) => {
  const canEdit = useCanEdit(collection.id);
  const steamProperty = useMemo(
    () => orderedProperties.find((property) => property.type === 'steam'),
    [orderedProperties],
  );
  const iconProperty = useMemo(
    () => collection.properties?.find((property) => property.id === cardIconFieldId),
    [cardIconFieldId, collection.properties],
  );
  const colorProperty = useMemo(
    () => collection.properties?.find((property) => property.id === cardColorFieldId),
    [cardColorFieldId, collection.properties],
  );
  const visibleProperties = useMemo(
    () => orderedProperties
      .filter((property) => property.id !== steamProperty?.id && !hiddenFields.includes(property.id))
      .map((property) => ({
        ...(collection.properties?.find((candidate) => candidate.id === property.id) || {}),
        ...property,
        options: property.options || collection.properties?.find((candidate) => candidate.id === property.id)?.options || [],
      })),
    [collection.properties, hiddenFields, orderedProperties, steamProperty?.id],
  );
  const fieldPlacements = useMemo(() => {
    const groupedIds = new Set(fieldGroups.flatMap((group) => group.fieldIds));
    return Object.fromEntries([
      ...fieldGroups.flatMap((group) => group.fieldIds.map((fieldId) => [fieldId, cardGroupPlacements[group.id] || 'description'])),
      ...visibleProperties.filter((property) => !groupedIds.has(property.id)).map((property) => [property.id, cardGroupPlacements.__ungrouped__ || 'description']),
    ]) as Record<string, string>;
  }, [cardGroupPlacements, fieldGroups, visibleProperties]);
  const canEditField = useCallback(() => canEdit, [canEdit]);
  const { rowsPerPage, page } = useViewPagination({
    items,
    groupedItemCount: items.length,
    hasGroups: groups.length > 0,
    resetKey: `${collection.id}|${groups.join(',')}`,
  });
  const paginateItems = useCallback((groupItems: typeof items) => {
    const start = (page - 1) * rowsPerPage;
    return groupItems.slice(start, start + rowsPerPage);
  }, [page, rowsPerPage]);
  const renderCards = useCallback((groupItems: typeof items) => (
    <CardsGrid
      items={groupItems}
      cardColumns={cardColumns}
      steamProperty={steamProperty}
      cardStyle={cardStyle}
      cardDensity={cardDensity}
      iconProperty={iconProperty}
      colorProperty={colorProperty}
      fieldPlacements={fieldPlacements}
      properties={visibleProperties}
      collection={collection}
      collections={collections}
      canEdit={canEdit}
      canEditField={canEditField}
      onViewDetail={onViewDetail}
      onEdit={onEdit}
      onRelationChange={onRelationChange}
      onNavigateToCollection={onNavigateToCollection}
    />
  ), [
    canEdit,
    canEditField,
    cardColumns,
    collection,
    collections,
    onEdit,
    onNavigateToCollection,
    onRelationChange,
    onViewDetail,
    steamProperty,
    cardDensity,
    cardStyle,
    colorProperty,
    iconProperty,
    fieldPlacements,
    visibleProperties,
  ]);

  const content = (
    <ViewGrouping
      items={items}
      groups={groups}
      properties={orderedProperties}
      collections={collections}
      initialExpandedGroups={initialExpandedGroups}
      onExpandedGroupsChange={onExpandedGroupsChange}
      groupDisplayMode={groupDisplayMode}
      groupDisplayModes={groupDisplayModes}
      groupDisplayColumnCount={groupDisplayColumnCount}
      groupDisplayColumnCounts={groupDisplayColumnCounts}
      paginateItems={paginateItems}
      renderItems={renderCards}
      className="min-h-0 flex-1 overflow-auto"
    />
  );
  const wrappedContent = <ViewShell>{content}</ViewShell>;

  if (!onShowNewItemModal && !onQuickCreateItem) return wrappedContent;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild><div className="flex min-h-0 flex-1">{wrappedContent}</div></ContextMenuTrigger>
      <ContextMenuContent className="min-w-[200px]">
        <ContextMenuItem disabled={!canEdit || !onShowNewItemModal} onSelect={() => onShowNewItemModal?.()}>
          <Plus size={14} className="mr-2 text-emerald-400" /> Nouveau {collection.name}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!canEdit || !onQuickCreateItem} onSelect={() => onQuickCreateItem?.()}>
          <Zap size={14} className="mr-2 text-amber-400" /> Création rapide
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default CardsView;
