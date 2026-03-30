/**
 * ChartModule – graphique recharts configuré dynamiquement.
 * Supporte : bar, line, area, pie.
 * Peut grouper par champ select ou par période de date.
 */

import React, { useMemo } from 'react';
import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { DashboardModuleConfig } from '@/lib/dashboardTypes';
import { DashboardItemData } from '@/lib/hooks/useDashboardItemData';
import {
  aggregateItems,
  getChartColor,
  groupItemsByDate,
  groupItemsByField,
  getDateGroupLabel,
  EMPTY_GROUP_KEY,
  NO_DATE_KEY,
} from '@/lib/utils/dashboardUtils';

interface Props {
  module: DashboardModuleConfig;
  data: DashboardItemData;
}

/** Construit les données pour un graphique XY (bar, line, area) */
function buildXYData(module: DashboardModuleConfig, data: DashboardItemData) {
  const { filteredItems, properties, dateFields } = data;
  const xField = module.chartXField;
  const yAgg = module.chartYAggregation ?? 'count';
  const yField = module.chartYField ?? '';

  if (!xField) return [];

  // Groupement par période de date
  const isDateGrouping = (module.chartDateGrouping && dateFields.some(f => f.id === xField));

  let groups: Map<string, typeof filteredItems>;

  if (isDateGrouping && module.chartDateGrouping) {
    groups = groupItemsByDate(filteredItems, xField, module.chartDateGrouping);
  } else {
    groups = groupItemsByField(filteredItems, xField, properties);
  }

  const result: Record<string, any>[] = [];

  groups.forEach((items, key) => {
    const label = isDateGrouping && module.chartDateGrouping
      ? getDateGroupLabel(key, module.chartDateGrouping)
      : key === EMPTY_GROUP_KEY || key === NO_DATE_KEY
        ? 'Vide'
        : key;

    const entry: Record<string, any> = { name: label };

    if (module.chartStackBy) {
      // Stacking : sous-groupes
      const subGroups = groupItemsByField(items, module.chartStackBy, properties);
      subGroups.forEach((subItems, subKey) => {
        const subLabel = subKey === EMPTY_GROUP_KEY ? 'Vide' : subKey;
        entry[subLabel] = aggregateItems(subItems, yField, yAgg);
      });
    } else {
      entry.value = aggregateItems(items, yField, yAgg);
    }

    result.push(entry);
  });

  return result;
}

/** Construit les données pour un graphique circulaire */
function buildPieData(module: DashboardModuleConfig, data: DashboardItemData) {
  const { filteredItems, properties } = data;
  const xField = module.chartXField;
  const yAgg = module.chartYAggregation ?? 'count';
  const yField = module.chartYField ?? '';

  if (!xField) return [];

  const groups = groupItemsByField(filteredItems, xField, properties);
  const result: { name: string; value: number }[] = [];

  groups.forEach((items, key) => {
    const label = key === EMPTY_GROUP_KEY || key === NO_DATE_KEY ? 'Vide' : key;
    result.push({ name: label, value: aggregateItems(items, yField, yAgg) });
  });

  return result.sort((a, b) => b.value - a.value).slice(0, 15);
}

const TOOLTIP_STYLE = {
  background: 'hsl(var(--background))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

const ChartModule: React.FC<Props> = ({ module, data }) => {
  const chartType = module.chartType ?? 'bar';
  const showLegend = module.chartShowLegend ?? true;
  const showGrid = module.chartShowGrid ?? true;
  const colors = module.chartColors;

  const xyData = useMemo(
    () => (chartType !== 'pie' ? buildXYData(module, data) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartType, data.filteredItems, module.chartXField, module.chartYField, module.chartYAggregation, module.chartStackBy, module.chartDateGrouping]
  );

  const pieData = useMemo(
    () => (chartType === 'pie' ? buildPieData(module, data) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartType, data.filteredItems, module.chartXField, module.chartYField, module.chartYAggregation]
  );

  // Toutes les "series" (clés de valeur) pour le stacking
  const seriesKeys = useMemo(() => {
    if (!module.chartStackBy || chartType === 'pie') return ['value'];
    const keys = new Set<string>();
    xyData.forEach((d) => Object.keys(d).filter((k) => k !== 'name').forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [xyData, module.chartStackBy, chartType]);

  if (!data.collection) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Aucune collection sélectionnée
      </div>
    );
  }

  if (!module.chartXField) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Configurer le champ X dans les paramètres
      </div>
    );
  }

  return (
    <div className="w-full h-full px-2 pt-2 pb-1">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'pie' ? (
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="70%"
              label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
              labelLine={false}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={getChartColor(i, colors)} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          </PieChart>
        ) : chartType === 'line' ? (
          <LineChart data={xyData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {showLegend && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {seriesKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key === 'value' ? (module.chartYAggregation ?? 'count') : key}
                stroke={getChartColor(i, colors)}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : chartType === 'area' ? (
          <AreaChart data={xyData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {showLegend && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {seriesKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={key === 'value' ? (module.chartYAggregation ?? 'count') : key}
                stroke={getChartColor(i, colors)}
                fill={`${getChartColor(i, colors)}30`}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        ) : (
          /* bar (default) */
          <BarChart data={xyData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            {showLegend && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {seriesKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                name={key === 'value' ? (module.chartYAggregation ?? 'count') : key}
                fill={getChartColor(i, colors)}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
                stackId={module.chartStackBy ? 'stack' : undefined}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default ChartModule;
