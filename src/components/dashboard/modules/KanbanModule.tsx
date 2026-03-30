/**
 * KanbanModule – réutilise KanbanView dans un module de dashboard.
 */

import React, { useCallback, useMemo } from 'react';
import { DashboardModuleConfig } from '@/lib/dashboardTypes';
import { DashboardItemData } from '@/lib/hooks/useDashboardItemData';
import KanbanView from '@/components/views/KanbanView';
import { getOrderedProperties } from '@/lib/filterUtils';

interface Props {
  module: DashboardModuleConfig;
  data: DashboardItemData;
  collections: any[];
  onEdit?: (item: any) => void;
  onViewDetail?: (item: any) => void;
}

const KanbanModule: React.FC<Props> = ({ module, data, collections, onEdit, onViewDetail }) => {
  const { filteredItems, properties, collection } = data;

  const noop = useCallback(() => {}, []);

  const orderedProperties = useMemo(
    () => getOrderedProperties(collection, null, collections),
    [collection, collections]
  );

  // Champ de groupement : priorité au paramètre du module, sinon premier champ select
  const groupBy = useMemo(() => {
    if (module.kanbanGroupBy) return module.kanbanGroupBy;
    return properties.find((p) => p.type === 'select')?.id ?? '';
  }, [module.kanbanGroupBy, properties]);

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucune collection sélectionnée
      </div>
    );
  }

  if (!groupBy) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucun champ select disponible pour le kanban
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <KanbanView
        collection={collection}
        items={filteredItems}
        groupBy={groupBy}
        hiddenFields={module.hiddenFields ?? []}
        orderedProperties={orderedProperties}
        onEdit={onEdit ?? noop}
        onDelete={noop}
        onViewDetail={onViewDetail ?? noop}
        collections={collections}
        onRelationChange={noop}
        onNavigateToCollection={noop}
      />
    </div>
  );
};

export default KanbanModule;
