import React from 'react';
import TableView from './TableView';
import type { ViewRendererProps } from '@/lib/views';
import type { TableViewProps } from '@/lib/types';

type TableRendererProps = ViewRendererProps & Partial<TableViewProps>;

const TableRenderer: React.FC<TableRendererProps> = ({
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
    return <div role="alert">Le renderer Tableau n&apos;a pas reçu ses actions requises.</div>;
  }

  return (
    <TableView
      collection={collection}
      items={items}
      onEdit={onEdit}
      onDelete={onDelete}
      onViewDetail={onViewDetail}
      collections={collections}
      orderedProperties={properties}
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
      {...legacyProps}
    />
  );
};

export default TableRenderer;
