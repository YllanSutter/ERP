import React from 'react';
import { LightSelect } from '@/components/inputs/LightSelect';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';
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

  const renderValue = () => {
    if (property?.type === 'relation') {
      const targetCol = collections.find((c: any) => c.id === property.relation?.targetCollectionId);
      if (!targetCol) return filter.value;
      const nameField = targetCol.properties?.find((p: any) => p.name === 'Nom' || p.id === 'name') || targetCol.properties?.[0] || ({ id: 'name' } as any);
      if (Array.isArray(filter.value)) {
        return filter.value
          .map((id: string) => {
            const item = targetCol.items.find((i: any) => i.id === id);
            return item ? item[nameField.id] || item.name || id : id;
          })
          .join(', ');
      } else {
        const item = targetCol.items.find((i: any) => i.id === filter.value);
        return item ? item[nameField.id] || item.name || filter.value : filter.value;
      }
    }
    if (Array.isArray(filter.value)) {
      return filter.value.join(', ');
    }
    return filter.value;
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
        typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.value, color: opt.color, icon: opt.icon }
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
        typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.value, color: opt.color, icon: opt.icon }
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
    return <span className="truncate">{renderValue()}</span>;
  }

  return <div className={compact ? 'min-w-[140px]' : 'min-w-[180px]'}>{renderEditor()}</div>;
};

export default FilterValueDisplay;
