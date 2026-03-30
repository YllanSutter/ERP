/**
 * ListModule – liste compacte d'items avec champs configurables.
 */

import React, { useMemo } from 'react';
import { DashboardModuleConfig } from '@/lib/dashboardTypes';
import { DashboardItemData } from '@/lib/hooks/useDashboardItemData';
import { getNameValue } from '@/lib/calendarUtils';
import { compareValues } from '@/lib/utils/sortUtils';

interface Props {
  module: DashboardModuleConfig;
  data: DashboardItemData;
  onViewDetail?: (item: any) => void;
}

const ListModule: React.FC<Props> = ({ module, data, onViewDetail }) => {
  const { filteredItems, properties, collection } = data;

  const visibleProps = useMemo(() => {
    const hidden = new Set(module.hiddenFields ?? []);
    return properties.filter(
      (p) => !hidden.has(p.id) && p.type !== 'relation' && p.type !== 'steam'
    ).slice(0, 4); // max 4 champs secondaires en liste
  }, [properties, module.hiddenFields]);

  const sortedItems = useMemo(() => {
    let items = [...filteredItems];
    if (module.sortField) {
      items = items.sort((a, b) =>
        compareValues(
          a[module.sortField!],
          b[module.sortField!],
          module.sortDirection === 'desc' ? 'desc' : 'asc'
        )
      );
    }
    const limit = module.listLimit ?? module.sortLimit ?? 50;
    return items.slice(0, limit);
  }, [filteredItems, module.sortField, module.sortDirection, module.listLimit, module.sortLimit]);

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucune collection sélectionnée
      </div>
    );
  }

  if (sortedItems.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucun élément
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto divide-y divide-border">
      {sortedItems.map((item) => {
        const name = getNameValue(item, collection);
        return (
          <div
            key={item.id}
            className="px-3 py-2 hover:bg-accent/50 cursor-pointer flex items-start gap-2 group"
            onClick={() => onViewDetail?.(item)}
          >
            {/* Nom principal */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate text-foreground">
                {name || <span className="text-muted-foreground italic">Sans nom</span>}
              </div>
              {/* Champs secondaires */}
              {visibleProps.length > 0 && (
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  {visibleProps.map((prop) => {
                    const val = item[prop.id];
                    if (val === null || val === undefined || val === '') return null;
                    let display: string;
                    if (Array.isArray(val)) {
                      display = val.join(', ');
                    } else if (typeof val === 'boolean') {
                      display = val ? '✓' : '✗';
                    } else {
                      display = String(val);
                    }
                    if (!display) return null;
                    return (
                      <span
                        key={prop.id}
                        className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]"
                      >
                        <span className="opacity-60">{prop.name}: </span>
                        {display}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {filteredItems.length > sortedItems.length && (
        <div className="px-3 py-2 text-xs text-muted-foreground text-center">
          + {filteredItems.length - sortedItems.length} éléments masqués
        </div>
      )}
    </div>
  );
};

export default ListModule;
