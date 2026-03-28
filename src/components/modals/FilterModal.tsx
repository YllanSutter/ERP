import React, { useState } from 'react';
import ModalWrapper, { FormSelect, FormDateInput } from '@/components/ui/ModalWrapper';
import { LightSelect } from '@/components/inputs/LightSelect';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';
import {
  FILTER_OPERATORS, COMPACT_OPERATOR_LABELS, isMultiValueOperator,
  prepareFilterValue, getRelationItemLabel, getValueLabels, getValueSummary,
  getOrderedProperties, normalizeRelationIds, MONTH_NAMES,
} from '@/components/modals/modalLib';

interface FilterModalProps {
  properties: any[];
  collections: any[];
  onClose: () => void;
  onAdd: (property: string, operator: string, value: any, sourceCollectionId?: string, filterMeta?: any) => void;
  initialFilter?: { property: string; operator: string; value: any; sourceCollectionId?: string } | null;
}

const FilterModal: React.FC<FilterModalProps> = ({ properties, collections, onClose, onAdd, initialFilter }) => {
  const defaultTabCandidate = collections.findIndex(c => c.properties === properties);
  const defaultTab = defaultTabCandidate >= 0 ? defaultTabCandidate : 0;
  const [selectedTab, setSelectedTab] = useState(defaultTab);
  const [property, setProperty] = useState('');
  const [operator, setOperator] = useState('equals');
  const [value, setValue] = useState<any>('');

  const selectedCollection = collections[selectedTab] || null;
  const accentColor = selectedCollection?.color || '#8b5cf6';
  const multiValue = isMultiValueOperator(operator);

  const currentProperties = React.useMemo(() => {
    if (!selectedCollection) return [];
    return getOrderedProperties(selectedCollection, null, collections).filter((p: any) => !!p?.id);
  }, [selectedCollection, collections]);

  const isEditing = Boolean(initialFilter);
  const selectedProp = currentProperties.find((p: any) => p.id === property);

  const nativeProperties = React.useMemo(
    () => currentProperties.filter((p: any) => !p?.isRelationLinkedColumn),
    [currentProperties]
  );
  const linkedPropertiesByRelation = React.useMemo(() => {
    const groups = new Map<string, any[]>();
    currentProperties
      .filter((p: any) => p?.isRelationLinkedColumn && p?.sourceRelationPropertyId)
      .forEach((p: any) => {
        const key = p.sourceRelationPropertyId;
        groups.set(key, [...(groups.get(key) || []), p]);
      });
    return groups;
  }, [currentProperties]);

  React.useEffect(() => {
    if (initialFilter) {
      const isInitialTab = (collections[selectedTab]?.properties || []).some(
        (p: any) => p.id === initialFilter.property
      );
      if (isInitialTab) return;
    }
    setProperty('');
    setValue('');
    setOperator('equals');
  }, [selectedTab, collections, initialFilter]);

  React.useEffect(() => {
    if (!initialFilter) return;
    const targetTab = initialFilter.sourceCollectionId
      ? collections.findIndex((c: any) => c.id === initialFilter.sourceCollectionId)
      : collections.findIndex((c: any) =>
          (c.properties || []).some((p: any) => p.id === initialFilter.property)
        );
    if (targetTab >= 0 && targetTab !== selectedTab) setSelectedTab(targetTab);
    setProperty(initialFilter.property || '');
    setOperator(initialFilter.operator || 'equals');
    setValue(initialFilter.value ?? '');
  }, [initialFilter, collections]);

  const handleSave = () => {
    if (!property) return;
    onAdd(
      property,
      operator,
      prepareFilterValue(value, operator),
      selectedCollection?.id,
      selectedProp
        ? {
            isRelationLinkedColumn: Boolean(selectedProp.isRelationLinkedColumn),
            sourceRelationPropertyId: selectedProp.sourceRelationPropertyId,
            sourceDisplayFieldId: selectedProp.sourceDisplayFieldId,
            sourceTargetCollectionId: selectedProp.sourceTargetCollectionId,
          }
        : undefined
    );
  };

  const valueSummary = getValueSummary(selectedProp, value, operator, collections, normalizeRelationIds);
  const selectedOperatorCompactLabel = COMPACT_OPERATOR_LABELS[operator] || operator;

  const renderPropertySelect = () => (
    <FormSelect
      value={property}
      onChange={setProperty}
      options={[
        // Propriétés natives
        ...nativeProperties.map((prop: any) => ({ value: prop.id, label: prop.name })),
        // Propriétés liées via relation
        ...Array.from(linkedPropertiesByRelation.entries()).flatMap(([relationPropId, props]) => {
          const relationProp = (selectedCollection?.properties || []).find((p: any) => p.id === relationPropId);
          return props.map((prop: any) => ({
            value: prop.id,
            label: `${prop.name} (via ${relationProp?.name || 'relation'})`,
          }));
        }),
      ]}
    />
  );

  const renderValueEditor = () => {
    if (!selectedProp) {
      return (
        <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 px-4 py-5 text-sm text-neutral-500 dark:text-neutral-400">
          Choisis d'abord un champ pour définir la valeur.
        </div>
      );
    }

    if (['is_empty', 'is_not_empty'].includes(operator)) {
      return (
        <div className="rounded-xl border border-dashed border-black/10 dark:border-white/10 px-4 py-5 text-sm text-neutral-500 dark:text-neutral-400">
          Aucune valeur à renseigner pour cet opérateur.
        </div>
      );
    }

    if (selectedProp?.type === 'relation') {
      const relation = selectedProp.relation || {};
      const targetCollection = (collections || []).find((c: any) => c.id === relation.targetCollectionId);
      const targetItems = targetCollection?.items || [];
      const isSourceMany = relation.type === 'one_to_many' || relation.type === 'many_to_many';
      const relationOptions = targetItems.map((ti: any) => ({
        value: ti.id,
        label: getRelationItemLabel(ti, relation, targetCollection),
      }));

      if (isSourceMany || multiValue) {
        return (
          <LightMultiSelect
            options={relationOptions}
            values={normalizeRelationIds(value)}
            onChange={(vals) => setValue(vals)}
            placeholder="Aucun"
            getOptionLabel={opt => typeof opt === 'string' ? opt : (opt.label || opt.value)}
          />
        );
      }
      return (
        <FormSelect
          value={typeof value === 'string' ? value : ''}
          onChange={setValue}
          options={[{ value: '', label: 'Sélectionner...' }, ...relationOptions]}
        />
      );
    }

    if (selectedProp?.type === 'select') {
      const opts = (selectedProp.options || []).map((opt: any) =>
        typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label || opt.value, color: opt.color, icon: opt.icon }
      );
      if (multiValue) {
        return (
          <LightMultiSelect
            options={opts}
            values={normalizeRelationIds(value)}
            onChange={(vals) => setValue(vals)}
          />
        );
      }
      return <LightSelect options={opts} value={typeof value === 'string' ? value : ''} onChange={setValue} />;
    }

    if (selectedProp?.type === 'multiselect' || selectedProp?.type === 'multi_select') {
      const opts = (selectedProp.options || []).map((opt: any) =>
        typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label || opt.value, color: opt.color, icon: opt.icon }
      );
      return (
        <LightMultiSelect
          options={opts}
          values={Array.isArray(value) ? value : []}
          onChange={(vals) => setValue(vals)}
        />
      );
    }

    if (selectedProp?.type === 'date' || selectedProp?.type === 'date_range') {
      const granularity = selectedProp.dateGranularity || 'full';

      if (granularity === 'month') {
        return (
          <FormSelect
            value={typeof value === 'string' ? value : ''}
            onChange={setValue}
            options={MONTH_NAMES.map((month) => ({ value: month, label: month }))}
          />
        );
      }
      if (granularity === 'month-year') {
        const years = Array.from({ length: 21 }, (_, i) => 2020 + i);
        const opts: string[] = [];
        for (const year of years) for (const month of MONTH_NAMES) opts.push(`${month} ${year}`);
        return (
          <FormSelect
            value={typeof value === 'string' ? value : ''}
            onChange={setValue}
            options={opts.map((opt) => ({ value: opt, label: opt }))}
          />
        );
      }
      if (granularity === 'year') {
        const years = Array.from({ length: 21 }, (_, i) => 2020 + i);
        return (
          <FormSelect
            value={typeof value === 'string' ? value : ''}
            onChange={setValue}
            options={years.map((year) => ({ value: String(year), label: String(year) }))}
          />
        );
      }
      return (
        <FormDateInput
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    }

    const inputDisplayValue = Array.isArray(value) ? value.join(', ') : value;
    return (
      <input
        type="text"
        value={typeof inputDisplayValue === 'string' ? inputDisplayValue : ''}
        onChange={(e) => setValue(e.target.value)}
        placeholder={multiValue ? 'Valeurs séparées par des virgules' : 'Valeur'}
        className="w-full rounded-xl border border-black/10 bg-gray-300 px-4 py-2 text-neutral-700 focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-neutral-800/50 dark:text-white"
      />
    );
  };

  return (
    <ModalWrapper
      title={isEditing ? 'Modifier un filtre' : 'Ajouter un filtre'}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={isEditing ? 'Enregistrer' : 'Ajouter'}
      canSave={Boolean(property)}
      className="max-w-3xl"
    >
      {/* Onglets collections */}
      <div className="flex flex-wrap gap-2 mb-5">
        {collections.map((col, idx) => (
          <button
            key={col.id || idx}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors duration-300 ${selectedTab === idx ? 'text-white border-transparent' : 'bg-gray-300 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 border-black/10 dark:border-white/10 hover:bg-gray-400 dark:hover:bg-neutral-700'}`}
            style={selectedTab === idx ? { backgroundColor: col.color || '#8b5cf6' } : undefined}
            onClick={() => setSelectedTab(idx)}
          >
            {col.name || `Collection ${idx + 1}`}
          </button>
        ))}
      </div>

      {/* Aperçu */}
      <div
        className="mb-5 rounded-2xl border p-4"
        style={{ backgroundColor: `${accentColor}14`, borderColor: `${accentColor}40` }}
      >
        <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">Aperçu</div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full px-3 py-1 font-medium text-white" style={{ backgroundColor: accentColor }}>
            {selectedCollection?.name || 'Collection'}
          </span>
          <span className="rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 font-medium text-neutral-700 dark:text-neutral-200">
            {selectedProp?.name || 'Champ'}
          </span>
          <span className="rounded-full bg-black/5 dark:bg-white/10 px-3 py-1 text-neutral-600 dark:text-neutral-300">
            {selectedOperatorCompactLabel}
          </span>
          <span className="rounded-full bg-white/70 dark:bg-white/10 px-3 py-1 font-medium text-neutral-700 dark:text-neutral-100 max-w-full truncate">
            {valueSummary}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 items-stretch">
        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold">Champ</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">Choisis la propriété à filtrer.</div>
          </div>
          {renderPropertySelect()}
        </div>

        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {FILTER_OPERATORS.map((op) => (
              <button
                key={op.value}
                type="button"
                onClick={() => setOperator(op.value)}
                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${operator === op.value ? 'text-white border-transparent' : 'border-black/10 dark:border-white/10 bg-gray-300 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 hover:bg-gray-400 dark:hover:bg-neutral-700'}`}
                style={operator === op.value ? { backgroundColor: accentColor } : undefined}
                title={op.label}
              >
                {COMPACT_OPERATOR_LABELS[op.value] || op.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4 space-y-3 col-span-2">
          {renderValueEditor()}
        </div>
      </div>
    </ModalWrapper>
  );
};

export default FilterModal;
