/**
 * MetricModule – carte KPI affichant une valeur agrégée.
 */

import React, { useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { DashboardModuleConfig } from '@/lib/dashboardTypes';
import { DashboardItemData } from '@/lib/hooks/useDashboardItemData';
import { aggregateItems, formatMetricValue } from '@/lib/utils/dashboardUtils';

interface Props {
  module: DashboardModuleConfig;
  data: DashboardItemData;
}

const DEFAULT_ICON = 'TrendingUp';

const MetricModule: React.FC<Props> = ({ module, data }) => {
  const { filteredItems, properties, collection } = data;

  const value = useMemo(() => {
    const agg = module.metricAggregation ?? 'count';
    const fieldId = module.metricField ?? '';
    return aggregateItems(filteredItems, fieldId, agg);
  }, [filteredItems, module.metricAggregation, module.metricField]);

  const label = module.metricLabel ?? collection?.name ?? 'Métrique';
  const IconComp = (LucideIcons as any)[module.metricIcon ?? DEFAULT_ICON] ?? LucideIcons.TrendingUp;
  const color = module.metricColor ?? '#6366f1';

  const formatted = formatMetricValue(value, module.metricPrefix, module.metricSuffix);

  // Libellé de l'agrégation pour la légende
  const aggLabel = module.metricAggregation
    ? { count: 'éléments', sum: 'total', avg: 'moyenne', min: 'minimum', max: 'maximum' }[module.metricAggregation]
    : 'éléments';

  if (!data.collection) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucune collection sélectionnée
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-4 select-none">
      {/* Icône */}
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
        style={{ background: `${color}20` }}
      >
        <IconComp size={24} style={{ color }} />
      </div>

      {/* Valeur */}
      <div className="text-center">
        <div className="text-4xl font-bold tracking-tight" style={{ color }}>
          {formatted}
        </div>
        <div className="text-xs text-muted-foreground mt-1 capitalize">
          {label} · {filteredItems.length} {aggLabel}
        </div>
      </div>
    </div>
  );
};

export default MetricModule;
