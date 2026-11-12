/**
 * MetricModule – carte KPI affichant une valeur agrégée.
 */

import React, { useMemo } from 'react';
import * as LucideIcons from 'lucide-react';
import { DashboardModuleConfig } from '@/lib/dashboardTypes';
import { DashboardItemData } from '@/lib/hooks/useDashboardItemData';
import { formatMetricValue } from '@/lib/utils/dashboardUtils';

import { calculateMetric } from '@/lib/utils/metricUtils';

interface Props {
  module: DashboardModuleConfig;
  data: DashboardItemData;
}

const DEFAULT_ICON = 'TrendingUp';

const MetricModule: React.FC<Props> = ({ module, data }) => {
  const { filteredItems, collection, properties } = data;

  const value = useMemo(() => {
    const agg = module.metricAggregation ?? 'count';
    const fieldId = module.metricField ?? '';
    return calculateMetric(filteredItems, properties, fieldId, agg);
  }, [filteredItems, properties, module.metricAggregation, module.metricField]);

  const label = module.metricLabel ?? collection?.name ?? 'Métrique';
  const IconComp = (LucideIcons as any)[module.metricIcon ?? DEFAULT_ICON] ?? LucideIcons.TrendingUp;
  const color = module.metricColor;

  const formatted = formatMetricValue(value, module.metricPrefix, module.metricSuffix);

  // Libellé de l'agrégation pour la légende
  const aggLabel = module.metricAggregation
    ? { count: 'éléments', sum: 'total', avg: 'moyenne', min: 'minimum', max: 'maximum', 'options-count': 'options configurées', unique: 'valeurs distinctes', filled: 'éléments renseignés', empty: 'éléments vides' }[module.metricAggregation]
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
        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm bg-brand-600/10 dark:bg-brand-400/15"
        style={color ? { backgroundColor: `${color}20` } : undefined}
      >
        <IconComp size={24} className="text-brand-700 dark:text-brand-300" style={{ color }} />
      </div>

      {/* Valeur */}
      <div className="text-center">
        <div className="text-4xl font-bold tracking-tight text-brand-700 dark:text-brand-300" style={{ color }}>
          {formatted}
        </div>
        <div className="text-xs text-muted-foreground mt-1 capitalize">
          {label} · {['options-count', 'unique', 'filled', 'empty'].includes(module.metricAggregation ?? '') ? aggLabel : `${filteredItems.length} ${aggLabel}`}
        </div>
      </div>
    </div>
  );
};

export default MetricModule;
