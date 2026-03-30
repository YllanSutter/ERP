/**
 * CalendarModule – réutilise CalendarView dans un module de dashboard.
 */

import React, { useCallback, useMemo } from 'react';
import { DashboardModuleConfig } from '@/lib/dashboardTypes';
import { DashboardItemData } from '@/lib/hooks/useDashboardItemData';
import CalendarView from '@/components/views/CalendarView';

interface Props {
  module: DashboardModuleConfig;
  data: DashboardItemData;
  collections: any[];
  onEdit?: (item: any) => void;
  onViewDetail?: (item: any) => void;
}

const CalendarModule: React.FC<Props> = ({ module, data, collections, onEdit, onViewDetail }) => {
  const { collection, dateFields } = data;

  const noop = useCallback(() => {}, []);

  // Champ date principal
  const dateField = module.dateField ?? dateFields[0]?.id ?? null;

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucune collection sélectionnée
      </div>
    );
  }

  if (!dateField) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucun champ date dans cette collection
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <CalendarView
        collection={collection}
        items={data.filteredItems}
        dateProperty={dateField}
        onEdit={onEdit ?? noop}
        onDelete={noop}
        onViewDetail={onViewDetail ?? noop}
        collections={collections}
      />
    </div>
  );
};

export default CalendarModule;
