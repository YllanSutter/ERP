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
import {
  AGGREGATION_LABELS,
  CHART_AGG_DURATION_FIELD_ID,
  CHART_AGG_DURATION_FIELD_LABEL,
  DashboardModuleConfig,
} from '@/lib/dashboardTypes';
import { DashboardItemData } from '@/lib/hooks/useDashboardItemData';
import { Item } from '@/lib/types';
import {
  aggregateItems,
  getChartColor,
  formatDurationValue,
  formatMetricValue,
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

function getPropertyLabel(fieldId?: string, data?: DashboardItemData) {
  if (!fieldId || !data) return '';
  if (fieldId === CHART_AGG_DURATION_FIELD_ID) return CHART_AGG_DURATION_FIELD_LABEL;
  return data.properties.find((prop) => prop.id === fieldId)?.name ?? fieldId;
}

function getFieldRawValue(item: Item, fieldId: string, data: DashboardItemData, module: DashboardModuleConfig) {
  const prop = data.properties.find((p) => p.id === fieldId);
  const rawValue = item[fieldId];

  if (rawValue === null || rawValue === undefined || rawValue === '') return 'Vide';

  if (fieldId === module.chartYField && module.chartYFieldIsDuration) {
    const numericValue = Number(rawValue);
    if (!Number.isNaN(numericValue)) {
      return formatDurationValue(numericValue, module.chartYFieldDurationUnit ?? 'minutes');
    }
  }

  if ((prop?.type === 'date' || (prop?.type as string) === 'date_range') && module.chartDateFieldsAsDuration) {
    const startRaw = typeof rawValue === 'object' && rawValue?.start ? rawValue.start : rawValue;
    const endFromRange = typeof rawValue === 'object' && rawValue?.end ? rawValue.end : null;
    const endFromOtherField = module.chartDateDurationEndField ? item[module.chartDateDurationEndField] : null;
    const endRaw = endFromRange ?? endFromOtherField;
    if (startRaw && endRaw) {
      const startDate = new Date(String(startRaw));
      const endDate = new Date(String(endRaw));
      if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
        const minutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
        return formatDurationValue(minutes, 'minutes');
      }
    }

    return 'Durée indisponible';
  }

  if (prop?.type === 'date' || (prop?.type as string) === 'date_range') {
    const dateValue = typeof rawValue === 'string' ? new Date(rawValue) : new Date(String(rawValue));
    if (!Number.isNaN(dateValue.getTime())) {
      return dateValue.toLocaleDateString('fr-FR');
    }
  }

  if (prop?.type === 'number') {
    const numericValue = Number(rawValue);
    if (!Number.isNaN(numericValue)) return formatMetricValue(numericValue);
  }

  if (Array.isArray(rawValue)) {
    return rawValue.map(String).join(', ');
  }

  return String(rawValue);
}

function buildFieldSummary(
  item: Item | undefined,
  fieldIds: string[] | undefined,
  data: DashboardItemData,
  module: DashboardModuleConfig,
  aggregatedValue?: number,
  withFieldNames: boolean = true
) {
  if (!item || !fieldIds?.length) return '';

  return fieldIds
    .map((fieldId) => {
      const label = getPropertyLabel(fieldId, data);
      const value = fieldId === CHART_AGG_DURATION_FIELD_ID
        ? formatDurationValue(aggregatedValue ?? 0, module.chartYFieldDurationUnit ?? 'minutes')
        : fieldId === module.chartXField && module.chartXDateDisplayMode === 'duration'
          ? formatDurationValue(aggregatedValue ?? 0, 'minutes')
          : getFieldRawValue(item, fieldId, data, module);
      return withFieldNames ? `${label}: ${value}` : value;
    })
    .filter(Boolean)
    .join(' · ');
}

function resolveChartLabel(
  module: DashboardModuleConfig,
  data: DashboardItemData,
  source: 'aggregation' | 'xField' | 'yField' | 'custom' | undefined,
  customLabel?: string
) {
  switch (source) {
    case 'xField':
      return getPropertyLabel(module.chartXField, data) || module.chartXField || '';
    case 'yField':
      return getPropertyLabel(module.chartYField, data) || module.chartYField || AGGREGATION_LABELS[module.chartYAggregation ?? 'count'];
    case 'custom':
      return customLabel?.trim() || AGGREGATION_LABELS[module.chartYAggregation ?? 'count'];
    case 'aggregation':
    default:
      return AGGREGATION_LABELS[module.chartYAggregation ?? 'count'];
  }
}

function formatChartValue(
  value: unknown,
  module: DashboardModuleConfig
): string {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numericValue)) return String(value ?? '');

  const yIsDurationFieldMode =
    Boolean(module.chartYField) &&
    (
      module.chartYFieldIsDuration ||
      module.chartDateFieldsAsDuration ||
      module.chartYDateDisplayMode === 'duration' ||
      module.chartYField === module.chartDurationField ||
      module.chartYField?.endsWith('_duration') ||
      (module.chartYField === module.chartXField && module.chartXDateDisplayMode === 'duration')
    );

  if (module.chartTooltipValueFormat === 'duration' || module.chartYFieldIsDuration || yIsDurationFieldMode) {
    return formatDurationValue(numericValue, module.chartYFieldDurationUnit ?? 'minutes');
  }

  return formatMetricValue(numericValue);
}

function formatPieLabel(
  name: string,
  value: number,
  module: DashboardModuleConfig
): string {
  const formattedValue = formatChartValue(value, module);
  const mode = module.chartPieLabelMode ?? 'name';

  if (mode === 'value') return formattedValue;
  if (mode === 'name_value') return `${name} — ${formattedValue}`;
  return name;
}

function getDurationSourceField(module: DashboardModuleConfig): string | undefined {
  if (module.chartYFieldIsDuration && module.chartYField) return module.chartYField;
  if (module.chartDurationField) return module.chartDurationField;
  return undefined;
}

function getItemDateDurationMinutes(item: Item, dateField: string, endField?: string): number | null {
  const durationKey = `${dateField}_duration`;
  const durationHours = Number(item[durationKey]);
  if (!Number.isNaN(durationHours) && durationHours > 0) {
    return Math.round(durationHours * 60);
  }

  const raw = item[dateField];

  // Cas multi-plages courants
  if (raw && typeof raw === 'object') {
    const candidateArrays = [raw.ranges, raw.customRanges, raw.segments, raw.plages].filter(Array.isArray);
    if (candidateArrays.length > 0) {
      const total = candidateArrays[0].reduce((sum: number, seg: any) => {
        const s = seg?.start || seg?.from || seg?.__eventStart;
        const e = seg?.end || seg?.to || seg?.__eventEnd;
        if (!s || !e) return sum;
        const start = new Date(String(s));
        const end = new Date(String(e));
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return sum;
        return sum + Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
      }, 0);
      if (total > 0) return total;
    }
  }

  const startRaw = typeof raw === 'object' && raw?.start ? raw.start : raw;
  const endRaw = (typeof raw === 'object' && raw?.end ? raw.end : null) ?? (endField ? item[endField] : null);
  if (!startRaw || !endRaw) return null;

  const start = new Date(String(startRaw));
  const end = new Date(String(endRaw));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function getDurationLabelForGroup(items: Item[], dateField: string, endField?: string, unit: 'minutes' | 'hours' = 'minutes'): string | null {
  const totalMinutes = items.reduce((sum, item) => {
    const m = getItemDateDurationMinutes(item, dateField, endField);
    return sum + (m ?? 0);
  }, 0);

  if (totalMinutes <= 0) return null;
  return formatDurationValue(totalMinutes, unit);
}

function getNumericFieldValue(item: Item, fieldId: string, data: DashboardItemData, module: DashboardModuleConfig): number | null {
  if (!fieldId) return null;
  const prop = data.properties.find((p) => p.id === fieldId);
  const rawValue = item[fieldId];

  if (prop?.type === 'date' || (prop?.type as string) === 'date_range') {
    const isYDateField = fieldId === module.chartYField;
    const useDurationForY = isYDateField && module.chartYDateDisplayMode === 'duration';
    const useDurationForX = fieldId === module.chartXField && module.chartXDateDisplayMode === 'duration';

    if (module.chartDateFieldsAsDuration || useDurationForX || useDurationForY) {
      const endField = isYDateField ? module.chartYDateDurationEndField : module.chartDateDurationEndField;
      return getItemDateDurationMinutes(item, fieldId, endField);
    }

    if (isYDateField && module.chartYDateDisplayMode === 'date') {
      const raw = item[fieldId];
      const startRaw = typeof raw === 'object' && raw?.start ? raw.start : raw;
      if (!startRaw) return null;
      const d = new Date(String(startRaw));
      return Number.isNaN(d.getTime()) ? null : d.getTime();
    }
    return null;
  }

  const n = Number(rawValue);
  if (Number.isNaN(n)) return null;
  return n;
}

/** Construit les données pour un graphique XY (bar, line, area) */
function buildXYData(module: DashboardModuleConfig, data: DashboardItemData) {
  const { filteredItems, properties, dateFields } = data;
  const xField = module.chartXField;
  const yMode = module.chartYMode ?? 'aggregation';
  const yAgg = module.chartYAggregation ?? 'count';
  const yField = module.chartYField ?? '';
  const durationField = getDurationSourceField(module);
  const isDateField = dateFields.some((f) => f.id === xField);

  if (!xField) return [];

  if (yMode === 'field' && yField) {
    const groupField = module.chartStackBy || xField;
    const isDateGroupField = dateFields.some((f) => f.id === groupField);
    const groups = isDateGroupField && module.chartDateGrouping
      ? groupItemsByDate(filteredItems, groupField, module.chartDateGrouping)
      : groupItemsByField(filteredItems, groupField, properties);

    const rows: Record<string, any>[] = [];

    groups.forEach((items, key) => {
      let label = isDateGroupField && module.chartDateGrouping
        ? getDateGroupLabel(key, module.chartDateGrouping)
        : key === EMPTY_GROUP_KEY || key === NO_DATE_KEY
          ? 'Vide'
          : key;

      if (groupField === xField && isDateField && module.chartXDateDisplayMode === 'duration') {
        const durationLabel = getDurationLabelForGroup(items, xField, module.chartDateDurationEndField, 'minutes');
        if (durationLabel) label = durationLabel;
      }

      const values = items
        .map((item) => getNumericFieldValue(item, yField, data, module))
        .filter((v): v is number => v !== null);

      const sumValue = values.reduce((sum, n) => sum + n, 0);

      rows.push({
        name: label,
        value: sumValue,
        __sampleItem: items[0],
        __durationValue: sumValue,
      });
    });

    return rows;
  }

  // Groupement par période de date
  const isDateGrouping = (module.chartDateGrouping && isDateField);

  let groups: Map<string, typeof filteredItems>;

  if (isDateGrouping && module.chartDateGrouping) {
    groups = groupItemsByDate(filteredItems, xField, module.chartDateGrouping);
  } else {
    groups = groupItemsByField(filteredItems, xField, properties);
  }

  const result: Record<string, any>[] = [];

  groups.forEach((items, key) => {
    let label = isDateGrouping && module.chartDateGrouping
      ? getDateGroupLabel(key, module.chartDateGrouping)
      : key === EMPTY_GROUP_KEY || key === NO_DATE_KEY
        ? 'Vide'
        : key;

    if (isDateField && module.chartXDateDisplayMode === 'duration') {
      const durationLabel = getDurationLabelForGroup(items, xField, module.chartDateDurationEndField, 'minutes');
      if (durationLabel) label = durationLabel;
    }

    const entry: Record<string, any> = { name: label, __sampleItem: items[0] };

    if (durationField) {
      entry.__durationValue = aggregateItems(items, durationField, 'sum');
    } else if (isDateField && module.chartXDateDisplayMode === 'duration') {
      entry.__durationValue = items.reduce((sum, it) => sum + (getItemDateDurationMinutes(it, xField, module.chartDateDurationEndField) ?? 0), 0);
    }

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
  const yMode = module.chartYMode ?? 'aggregation';
  const yAgg = module.chartYAggregation ?? 'count';
  const yField = module.chartYField ?? '';
  const isDateField = data.dateFields.some((f) => f.id === xField);
  const durationField = getDurationSourceField(module);

  if (!xField) return [];

  const groups = groupItemsByField(filteredItems, xField, properties);
  const result: { name: string; value: number }[] = [];

  groups.forEach((items, key) => {
    let label = key === EMPTY_GROUP_KEY || key === NO_DATE_KEY ? 'Vide' : key;
    if (isDateField && module.chartXDateDisplayMode === 'duration') {
      const durationLabel = getDurationLabelForGroup(items, xField, module.chartDateDurationEndField, 'minutes');
      if (durationLabel) label = durationLabel;
    }

    const durationValue = durationField
      ? aggregateItems(items, durationField, 'sum')
      : (isDateField && module.chartXDateDisplayMode === 'duration'
        ? items.reduce((sum, it) => sum + (getItemDateDurationMinutes(it, xField, module.chartDateDurationEndField) ?? 0), 0)
        : undefined);

    const valueFromFieldMode = yMode === 'field' && yField
      ? items.reduce((sum, it) => sum + (getNumericFieldValue(it, yField, data, module) ?? 0), 0)
      : undefined;

    const shouldUseDurationAsPieValue =
      durationValue !== undefined &&
      (module.chartXDateDisplayMode === 'duration' || module.chartYFieldIsDuration || yAgg === 'count');

    const pieValue = shouldUseDurationAsPieValue
      ? (durationValue ?? 0)
      : valueFromFieldMode !== undefined
        ? valueFromFieldMode
      : aggregateItems(items, yField, yAgg);

    result.push({
      name: label,
      value: pieValue,
      __sampleItem: items[0] as Item | undefined,
      __durationValue: durationValue,
    });
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
  const shouldFormatYAxisAsDuration =
    Boolean(module.chartYField) &&
    (
      module.chartYFieldIsDuration ||
      module.chartDateFieldsAsDuration ||
      module.chartYDateDisplayMode === 'duration' ||
      module.chartYField === module.chartDurationField ||
      module.chartYField?.endsWith('_duration') ||
      (module.chartYField === module.chartXField && module.chartXDateDisplayMode === 'duration')
    );

  const shouldFormatYAxisAsDate =
    (module.chartYMode ?? 'aggregation') === 'field' &&
    Boolean(module.chartYField) &&
    module.chartYDateDisplayMode === 'date';

  const yAxisTickFormatter = (v: any) => {
    const n = Number(v);
    if (Number.isNaN(n)) return String(v ?? '');
    if (shouldFormatYAxisAsDate) {
      const d = new Date(n);
      if (Number.isNaN(d.getTime())) return String(v ?? '');
      return d.toLocaleDateString('fr-FR');
    }
    return shouldFormatYAxisAsDuration
      ? formatDurationValue(n, module.chartYFieldDurationUnit ?? 'minutes')
      : formatMetricValue(n);
  };
  const mainSeriesName = (module.chartYMode ?? 'aggregation') === 'field' && module.chartYField
    ? getPropertyLabel(module.chartYField, data)
    : resolveChartLabel(module, data, module.chartLegendLabelSource ?? 'aggregation', module.chartLegendLabel);
  const tooltipValueLabel = (module.chartYMode ?? 'aggregation') === 'field' && module.chartYField
    ? getPropertyLabel(module.chartYField, data)
    : resolveChartLabel(module, data, module.chartTooltipLabelSource ?? 'aggregation', module.chartTooltipLabel);

  const renderTooltip = ({ active, label, payload }: any) => {
    if (!active || !payload?.length) return null;

    const firstEntry = payload[0]?.payload;
    const sampleItem: Item | undefined = firstEntry?.__sampleItem;
    const customFields = buildFieldSummary(
      sampleItem,
      module.chartTooltipFieldIds,
      data,
      module,
      Number(firstEntry?.__durationValue ?? payload[0]?.value ?? 0)
    );

    return (
      <div style={TOOLTIP_STYLE as React.CSSProperties} className="px-3 py-2">
        {label !== undefined && label !== null && (
          <div className="mb-1 text-xs font-medium text-foreground">{String(label)}</div>
        )}
        {customFields && <div className="mb-1 text-xs text-muted-foreground">{customFields}</div>}
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => {
            const entryLabel = entry?.name === 'value' ? tooltipValueLabel : String(entry?.name ?? '');
            return (
              <div key={`${entryLabel}-${index}`} className="flex items-center justify-between gap-4 text-xs">
                <span className="text-muted-foreground">{entryLabel}</span>
                <span className="font-medium text-foreground">
                  {formatChartValue(entry?.value, module)}
                </span>
              </div>
            );
          })}
          {module.chartTooltipShowValue !== false && module.chartTooltipFieldIds?.length === 0 && (
            <div className="flex items-center justify-between gap-4 text-xs pt-1 border-t border-border/60">
              <span className="text-muted-foreground">Valeur</span>
              <span className="font-medium text-foreground">{formatChartValue(payload[0]?.value, module)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPieLegend = ({ payload }: any) => {
    if (!payload?.length) return null;

    return (
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ fontSize: 11 }}>
        {payload.map((entry: any, index: number) => {
          const item = pieData[index];
          if (!item) return null;
          const sampleItem: Item | undefined = item.__sampleItem;
          const customFields = buildFieldSummary(
            sampleItem,
            module.chartLegendFieldIds,
            data,
            module,
            Number(item.__durationValue ?? item.value ?? 0),
            false
          );
          return (
            <div key={`${entry?.value ?? entry?.name ?? index}`} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">
                {customFields || formatPieLabel(String(entry?.value ?? entry?.name ?? ''), item.value, module)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPieSliceLabel = ({ name, value, payload, x, y, textAnchor, dominantBaseline }: any) => {
    const text =
      buildFieldSummary(
        payload?.__sampleItem,
        module.chartLegendFieldIds,
        data,
        module,
        Number(payload?.__durationValue ?? value ?? 0),
        false
      ) || formatPieLabel(String(name ?? ''), Number(value ?? 0), module);

    return (
      <text
        x={x}
        y={y}
        textAnchor={textAnchor}
        dominantBaseline={dominantBaseline}
        fill="hsl(var(--muted-foreground))"
        fontSize={11}
      >
        {text}
      </text>
    );
  };

  const xyData = useMemo(
    () => (chartType !== 'pie' ? buildXYData(module, data) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartType, data.filteredItems, module.chartXField, module.chartXDateDisplayMode, module.chartYMode, module.chartYField, module.chartYAggregation, module.chartStackBy, module.chartDateGrouping, module.chartDateFieldsAsDuration, module.chartDateDurationEndField]
  );

  const pieData = useMemo(
    () => (chartType === 'pie' ? buildPieData(module, data) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartType, data.filteredItems, module.chartXField, module.chartXDateDisplayMode, module.chartYMode, module.chartYField, module.chartYAggregation, module.chartDateFieldsAsDuration, module.chartDateDurationEndField, module.chartDurationField]
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
              label={renderPieSliceLabel}
              labelLine={false}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={getChartColor(i, colors)} />
              ))}
            </Pie>
            <Tooltip content={renderTooltip} />
            {showLegend && <Legend content={renderPieLegend} />}
          </PieChart>
        ) : chartType === 'line' ? (
          <LineChart data={xyData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
            <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} tickFormatter={yAxisTickFormatter} />
            <Tooltip content={renderTooltip} />
            {showLegend && (seriesKeys.length > 1 || Boolean(module.chartLegendLabel?.trim())) && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {seriesKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key === 'value' ? mainSeriesName : key}
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
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} tickFormatter={yAxisTickFormatter} />
            <Tooltip content={renderTooltip} />
            {showLegend && (seriesKeys.length > 1 || Boolean(module.chartLegendLabel?.trim())) && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {seriesKeys.map((key, i) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={key === 'value' ? mainSeriesName : key}
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
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} tickFormatter={yAxisTickFormatter} />
            <Tooltip content={renderTooltip} />
            {showLegend && (seriesKeys.length > 1 || Boolean(module.chartLegendLabel?.trim())) && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {seriesKeys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                name={key === 'value' ? mainSeriesName : key}
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
