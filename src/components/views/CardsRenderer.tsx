import React from 'react';
import CardsView from './CardsView';
import type { ViewRendererProps } from '@/lib/views';
import type { TableViewProps } from '@/lib/types';

type CardsRendererProps = ViewRendererProps & Partial<TableViewProps>;

const CardsRenderer: React.FC<CardsRendererProps> = ({
  collection,
  items,
  collections,
  properties,
  view,
  onEdit,
  onDelete,
  onViewDetail,
  onRelationChange,
  onNavigateToCollection,
  ...legacyProps
}) => {
  if (!onEdit || !onDelete || !onViewDetail || !onRelationChange || !onNavigateToCollection) {
    return <div role="alert">Le renderer Cartes n&apos;a pas reçu ses actions requises.</div>;
  }

  return (
    <CardsView
      collection={collection}
      items={items}
      onEdit={onEdit}
      onDelete={onDelete}
      onViewDetail={onViewDetail}
      collections={collections}
      orderedProperties={properties}
      showHiddenRelations={view.cardShowRelations === true}
      hiddenFields={Array.isArray(view.hiddenFields) ? view.hiddenFields : []}
      onRelationChange={onRelationChange}
      onNavigateToCollection={onNavigateToCollection}
      onReorderItems={legacyProps.onReorderItems || (() => {})}
      onToggleField={legacyProps.onToggleField || (() => {})}
      onDeleteProperty={legacyProps.onDeleteProperty || (() => {})}
      onEditProperty={legacyProps.onEditProperty || (() => {})}
      groups={Array.isArray(view.groups) ? view.groups as string[] : []}
      groupDisplayMode={view.groupDisplayMode as TableViewProps['groupDisplayMode']}
      groupDisplayModes={view.groupDisplayModes as TableViewProps['groupDisplayModes']}
      groupTabStyleFieldIds={view.groupTabStyleFieldIds as TableViewProps['groupTabStyleFieldIds']}
      cardStyle={view.cardStyle === 'steamFullArt' ? 'steamFullArt' : 'default'}
      cardColumns={typeof view.cardColumns === 'number' ? view.cardColumns : 'auto'}
      cardDensity={view.cardDensity === 'compact' || view.cardDensity === 'spacious' ? view.cardDensity : 'comfortable'}
      cardIconFieldId={typeof view.cardIconFieldId === 'string' ? view.cardIconFieldId : null}
      cardColorFieldId={typeof view.cardColorFieldId === 'string' ? view.cardColorFieldId : null}
      fieldGroups={Array.isArray(view.fieldGroups) ? view.fieldGroups as any[] : []}
      cardGroupPlacements={view.cardGroupPlacements as Record<string, string> || {}}
      {...legacyProps}
    />
  );
};

export default CardsRenderer;
