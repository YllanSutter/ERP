import React from 'react';
import { LightSelect } from '@/components/inputs/LightSelect';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MONTH_NAMES } from '@/lib/calendarUtils';

interface FilterValueDisplayProps {
  filter: { property: string; operator: string; value: any };
  property: any;
  collections: any[];
  currentCollection: any;
  canEdit?: boolean;
  onUpdateValue: (value: any) => void;
  compact?: boolean;
}

const FilterValueDisplay: React.FC<FilterValueDisplayProps> = ({
  filter,
  property,
  collections,
  currentCollection: _currentCollection,
  canEdit = true,
  onUpdateValue,
  compact = false
}) => {
  const isMultiValueOperator = ['equals', 'not_equals'].includes(filter.operator);

  const getValueLabels = (): string[] => {
    if (property?.type === 'relation') {
      const targetCol = collections.find((c: any) => c.id === property.relation?.targetCollectionId);
      if (!targetCol) {
        return Array.isArray(filter.value)
          ? filter.value.filter(Boolean).map(String)
          : filter.value
          ? [String(filter.value)]
          : [];
      }
      const nameField = targetCol.properties?.find((p: any) => p.name === 'Nom' || p.id === 'name') || targetCol.properties?.[0] || ({ id: 'name' } as any);
      const values = Array.isArray(filter.value) ? filter.value : filter.value ? [filter.value] : [];
      return values.map((id: string) => {
        const item = targetCol.items.find((i: any) => i.id === id);
        return item ? item[nameField.id] || item.name || id : id;
      });
    }

    if (property?.type === 'select' || property?.type === 'multi_select') {
      const opts = (property.options || []).map((opt: any) =>
        typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label || opt.value }
      );
      const values = Array.isArray(filter.value) ? filter.value : filter.value ? [filter.value] : [];
      return values.map((v: any) => {
        const opt = opts.find((o: any) => o.value === v);
        return opt ? opt.label : v;
      });
    }

    if (Array.isArray(filter.value)) {
      return filter.value.filter(Boolean).map(String);
    }

    if (filter.value === null || filter.value === undefined || filter.value === '') {
      return [];
    }

    return [String(filter.value)];
  };

  const getCompactSummary = () => {
    const labels = getValueLabels();
    if (labels.length === 0) return 'Aucune valeur';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} + ${labels[1]}`;
    return `${labels[0]} +${labels.length - 1}`;
  };

  const fullValueLabel = getValueLabels().join(', ');

  const renderValue = () => {
    return fullValueLabel;
  };

  const renderEditor = () => {
    if (property?.type === 'relation') {
      const targetCol = collections.find((c: any) => c.id === property.relation?.targetCollectionId);
      if (!targetCol) return null;
      const targetItems = targetCol.items || [];
      const nameField = targetCol.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');

      if (isMultiValueOperator) {
        const currentValues = Array.isArray(filter.value) ? filter.value : filter.value ? [filter.value] : [];
        return (
          <LightMultiSelect
            options={targetItems.map((ti: any) => ({
              value: ti.id,
              label: nameField ? ti[nameField.id] || 'Sans titre' : ti.name || 'Sans titre'
            }))}
            values={currentValues}
            onChange={(vals) => onUpdateValue(vals)}
            placeholder="Aucun"
          />
        );
      } else {
        return (
          <select
            value={typeof filter.value === 'string' ? filter.value : ''}
            onChange={(e) => onUpdateValue(e.target.value)}
            className="w-full px-2 py-1 bg-gray-300 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-neutral-700 dark:text-white text-sm"
          >
            <option value="">Sélectionner...</option>
            {targetItems.map((ti: any) => {
              const label = nameField ? ti[nameField.id] || 'Sans titre' : ti.name || 'Sans titre';
              return <option key={ti.id} value={ti.id}>{label}</option>;
            })}
          </select>
        );
      }
    }

    if (property?.type === 'select') {
      const opts = (property.options || []).map((opt: any) =>
        typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label || opt.value, color: opt.color, icon: opt.icon }
      );
      if (isMultiValueOperator) {
        const currentValues = Array.isArray(filter.value) ? filter.value : filter.value ? [filter.value] : [];
        return (
          <LightMultiSelect
            options={opts}
            values={currentValues}
            onChange={(vals) => onUpdateValue(vals)}
          />
        );
      } else {
        return (
          <LightSelect
            options={opts}
            value={filter.value}
            onChange={(val) => onUpdateValue(val)}
          />
        );
      }
    }

    if (property?.type === 'multi_select') {
      const opts = (property.options || []).map((opt: any) =>
        typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label || opt.value, color: opt.color, icon: opt.icon }
      );
      const currentValues = Array.isArray(filter.value) ? filter.value : [];
      return (
        <LightMultiSelect
          options={opts}
          values={currentValues}
          onChange={(vals) => onUpdateValue(vals)}
        />
      );
    }

    if (property?.type === 'date' || property?.type === 'date_range') {
      const granularity = property.dateGranularity || 'full';

      if (granularity === 'month') {
        return (
          <select
            value={typeof filter.value === 'string' ? filter.value : ''}
            onChange={(e) => onUpdateValue(e.target.value)}
            className="w-full px-2 py-1 bg-gray-300 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-neutral-700 dark:text-white text-sm"
          >
            <option value="">Sélectionner...</option>
            {MONTH_NAMES.map((month, idx) => (
              <option key={idx} value={month}>{month}</option>
            ))}
          </select>
        );
      }

      if (granularity === 'month-year') {
        const years = Array.from({ length: 21 }, (_, i) => 2020 + i);
        const options = [];
        for (const year of years) {
          for (const month of MONTH_NAMES) {
            options.push(`${month} ${year}`);
          }
        }
        return (
          <select
            value={typeof filter.value === 'string' ? filter.value : ''}
            onChange={(e) => onUpdateValue(e.target.value)}
            className="w-full px-2 py-1 bg-gray-300 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-neutral-700 dark:text-white text-sm max-h-64 overflow-y-auto"
          >
            <option value="">Sélectionner...</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      }

      if (granularity === 'year') {
        const years = Array.from({ length: 21 }, (_, i) => 2020 + i);
        return (
          <select
            value={typeof filter.value === 'string' ? filter.value : ''}
            onChange={(e) => onUpdateValue(e.target.value)}
            className="w-full px-2 py-1 bg-gray-300 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-neutral-700 dark:text-white text-sm"
          >
            <option value="">Sélectionner...</option>
            {years.map((year) => (
              <option key={year} value={String(year)}>{year}</option>
            ))}
          </select>
        );
      }

      // full: date complète
      return (
        <input
          type="date"
          value={typeof filter.value === 'string' ? filter.value : ''}
          onChange={(e) => onUpdateValue(e.target.value)}
          className="w-full px-2 py-1 bg-gray-300 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-neutral-700 dark:text-white text-sm"
        />
      );
    }

    // Default text input
    return (
      <input
        type="text"
        value={typeof filter.value === 'string' ? filter.value : ''}
        onChange={(e) => onUpdateValue(e.target.value)}
        className="w-full px-2 py-1 bg-gray-300 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-neutral-700 dark:text-white text-sm"
      />
    );
  };

  if (!canEdit) {
    return compact ? (
      <span className="inline-flex max-w-[180px] truncate rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-neutral-700 dark:bg-white/10 dark:text-neutral-200" title={fullValueLabel || 'Aucune valeur'}>
        {getCompactSummary()}
      </span>
    ) : (
      <span className="truncate">{renderValue()}</span>
    );
  }

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex max-w-[180px] items-center rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium text-neutral-700 transition hover:bg-black/10 dark:bg-white/10 dark:text-neutral-100 dark:hover:bg-white/15"
            title={fullValueLabel || 'Aucune valeur'}
          >
            <span className="truncate">{getCompactSummary()}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(24rem,80vw)]">
          <div className="space-y-2">
            <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Valeur du filtre</div>
            {renderEditor()}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return <div className={compact ? 'min-w-[140px]' : 'min-w-[180px]'}>{renderEditor()}</div>;
};

export default FilterValueDisplay;
