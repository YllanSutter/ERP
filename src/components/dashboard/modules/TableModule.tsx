/**
 * TableModule – réutilise TableView dans un module de dashboard.
 * Fournit des props minimales via des no-ops pour les opérations non nécessaires en mode dashboard.
 */

import React, { useCallback, useMemo } from 'react';
import { DashboardModuleConfig } from '@/lib/dashboardTypes';
import { DashboardItemData } from '@/lib/hooks/useDashboardItemData';
import TableView from '@/components/views/TableView';
import { getOrderedProperties } from '@/lib/filterUtils';
import { compareValues } from '@/lib/utils/sortUtils';

interface Props {
  module: DashboardModuleConfig;
  data: DashboardItemData;
  collections: any[];
  onEdit?: (item: any) => void;
  onViewDetail?: (item: any) => void;
}

const TableModule: React.FC<Props> = ({ module, data, collections, onEdit, onViewDetail }) => {
  const { filteredItems, properties, collection } = data;

  const hiddenFields = useMemo(() => module.hiddenFields ?? [], [module.hiddenFields]);

  const sortedItems = useMemo(() => {
    if (!module.sortField) return filteredItems;
    return [...filteredItems].sort((a, b) =>
      compareValues(
        a[module.sortField!],
        b[module.sortField!],
        module.sortDirection === 'desc' ? 'desc' : 'asc'
      )
    );
  }, [filteredItems, module.sortField, module.sortDirection]);

  const orderedProperties = useMemo(
    () => getOrderedProperties(collection, null, collections),
    [collection, collections]
  );

  const noop = useCallback(() => {}, []);

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucune collection sélectionnée
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <TableView
        collection={collection}
        items={sortedItems}
        hiddenFields={hiddenFields}
        orderedProperties={orderedProperties}
        onEdit={onEdit ?? noop}
        onDelete={noop}
        onReorderItems={noop}
        onToggleField={noop}
        onDeleteProperty={noop}
        onEditProperty={noop}
        onViewDetail={onViewDetail ?? noop}
        collections={collections}
        onRelationChange={noop}
        onNavigateToCollection={noop}
        groups={module.tableGroups ?? []}
        groupDisplayMode={module.tableGroupDisplayMode ?? 'accordion'}
      />
    </div>
  );
};

export default TableModule;
