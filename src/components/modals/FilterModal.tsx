import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ui/ShinyButton';
import { LightSelect } from '@/components/inputs/LightSelect';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MONTH_NAMES } from '@/lib/calendarUtils';

interface FilterModalProps {
  properties: any[];
  collections: any[];
  onClose: () => void;
  onAdd: (property: string, operator: string, value: any) => void;
  initialFilter?: { property: string; operator: string; value: any } | null;
}

const FilterModal: React.FC<FilterModalProps> = ({ properties, collections, onClose, onAdd, initialFilter }) => {
  // Onglet sélectionné : index de la collection
  const defaultTab = collections.findIndex(c => c.properties === properties) || 0;
  const [selectedTab, setSelectedTab] = useState(defaultTab);
  const [property, setProperty] = useState('');
  const [operator, setOperator] = useState('equals');
  const [value, setValue] = useState<any>('');
  const isMultiValueOperator = ['equals', 'not_equals'].includes(operator);
  const operators = [
    { value: 'equals', label: 'Est égal à' },
    { value: 'not_equals', label: 'Est différent de' },
    { value: 'contains', label: 'Contient' },
    { value: 'greater', label: 'Supérieur à' },
    { value: 'less', label: 'Inférieur à' },
    { value: 'is_empty', label: 'Est vide' },
    { value: 'is_not_empty', label: "N'est pas vide" },
  ];
  const compactOperatorLabels: Record<string, string> = {
    equals: '=',
    not_equals: '≠',
    contains: 'contient',
    greater: '>',
    less: '<',
    is_empty: 'vide',
    is_not_empty: 'non vide',
  };
  const selectedCollection = collections[selectedTab] || null;
  const accentColor = selectedCollection?.color || '#8b5cf6';
  // Propriétés de la collection sélectionnée
  const currentProperties = selectedCollection?.properties || [];
  const isEditing = Boolean(initialFilter);
  const selectedProp = currentProperties.find((p: any) => p.id === property);
  // Reset property si on change d'onglet
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
    const targetTab = collections.findIndex((c: any) =>
      (c.properties || []).some((p: any) => p.id === initialFilter.property)
    );
    if (targetTab >= 0 && targetTab !== selectedTab) {
      setSelectedTab(targetTab);
    }
    setProperty(initialFilter.property || '');
    setOperator(initialFilter.operator || 'equals');
    setValue(initialFilter.value ?? '');
  }, [initialFilter, collections]);

  const prepareFilterValue = () => {
    if (!isMultiValueOperator) return value;
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      return value
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
    }
    return value;
  };

  const getValueLabels = () => {
    if (!selectedProp) return [];

    if (selectedProp?.type === 'relation') {
      const relation = selectedProp.relation || {};
      const targetCollection = (collections || []).find((c: any) => c.id === relation.targetCollectionId);
      const targetItems = targetCollection?.items || [];
      const nameField = targetCollection?.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');
      const values = Array.isArray(value) ? value : value ? [value] : [];

      return values.map((id: string) => {
        const item = targetItems.find((ti: any) => ti.id === id);
        return item ? (nameField ? item[nameField.id] || 'Sans titre' : item.name || 'Sans titre') : id;
      });
    }

    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (value === null || value === undefined || value === '') return [];
    return [String(value)];
  };

  const getValueSummary = () => {
    const labels = getValueLabels();
    if (['is_empty', 'is_not_empty'].includes(operator)) return 'Aucune valeur attendue';
    if (labels.length === 0) return 'Aucune valeur';
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} + ${labels[1]}`;
    return `${labels[0]} +${labels.length - 1}`;
  };

  const selectedOperatorLabel = operators.find((op) => op.value === operator)?.label || operator;
  const selectedOperatorCompactLabel = compactOperatorLabels[operator] || selectedOperatorLabel;

  const renderShadcnSelect = (
    currentValue: string,
    onChange: (nextValue: string) => void,
    options: Array<{ value: string; label: string }>,
    placeholder = 'Sélectionner...'
  ) => (
    <Select value={currentValue || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full rounded-xl border-black/10 bg-gray-300 text-neutral-700 focus:ring-1 focus:ring-violet-500 dark:border-white/10 dark:bg-neutral-800/50 dark:text-white">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="border-black/10 bg-gray-200 dark:border-white/10 dark:bg-neutral-900/95">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
      const targetCollectionId = relation.targetCollectionId;
      const relationType = relation.type || 'many_to_many';
      const targetCollection = (collections || []).find((c: any) => c.id === targetCollectionId);
      const targetItems = targetCollection?.items || [];
      const isSourceMany = relationType === 'one_to_many' || relationType === 'many_to_many';
      const nameField = targetCollection?.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');

      if (isSourceMany || isMultiValueOperator) {
        const currentValues = Array.isArray(value) ? value : value ? [value] : [];
        return (
          <LightMultiSelect
            options={targetItems.map((ti: any) => ({
              value: ti.id,
              label: nameField ? ti[nameField.id] || 'Sans titre' : ti.name || 'Sans titre'
            }))}
            values={currentValues}
            onChange={(vals) => setValue(vals)}
            placeholder="Aucun"
            getOptionLabel={opt => typeof opt === 'string' ? opt : (opt.label || opt.value)}
          />
        );
      }

      return (
        renderShadcnSelect(
          typeof value === 'string' ? value : '',
          (nextValue) => setValue(nextValue),
          targetItems.map((ti: any) => ({
            value: ti.id,
            label: nameField ? ti[nameField.id] || 'Sans titre' : ti.name || 'Sans titre'
          }))
        )
      );
    }

    if (selectedProp?.type === 'select') {
      const opts = (selectedProp.options || []).map((opt: any) =>
        typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.value, color: opt.color, icon: opt.icon }
      );
      if (isMultiValueOperator) {
        const currentValues = Array.isArray(value) ? value : value ? [value] : [];
        return (
          <LightMultiSelect
            options={opts}
            values={currentValues}
            onChange={(vals) => setValue(vals)}
          />
        );
      }
      return (
        <LightSelect
          options={opts}
          value={typeof value === 'string' ? value : ''}
          onChange={(val) => setValue(val)}
        />
      );
    }

    if (selectedProp?.type === 'multi_select') {
      const opts = (selectedProp.options || []).map((opt: any) =>
        typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.value, color: opt.color, icon: opt.icon }
      );
      const currentValues = Array.isArray(value) ? value : [];
      return (
        <LightMultiSelect
          options={opts}
          values={currentValues}
          onChange={(vals) => setValue(vals)}
        />
      );
    }

    if (selectedProp?.type === 'date' || selectedProp?.type === 'date_range') {
      const granularity = selectedProp.dateGranularity || 'full';

      if (granularity === 'month') {
        return (
          renderShadcnSelect(
            typeof value === 'string' ? value : '',
            (nextValue) => setValue(nextValue),
            MONTH_NAMES.map((month) => ({ value: month, label: month }))
          )
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
          renderShadcnSelect(
            typeof value === 'string' ? value : '',
            (nextValue) => setValue(nextValue),
            options.map((opt) => ({ value: opt, label: opt }))
          )
        );
      }

      if (granularity === 'year') {
        const years = Array.from({ length: 21 }, (_, i) => 2020 + i);
        return (
          renderShadcnSelect(
            typeof value === 'string' ? value : '',
            (nextValue) => setValue(nextValue),
            years.map((year) => ({ value: String(year), label: String(year) }))
          )
        );
      }

      return (
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-gray-300 px-4 py-2 text-neutral-700 focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-neutral-800/50 dark:text-white"
        />
      );
    }

    const inputDisplayValue = Array.isArray(value) ? value.join(', ') : value;
    return (
      <input
        type="text"
        value={typeof inputDisplayValue === 'string' ? inputDisplayValue : ''}
        onChange={(e) => setValue(e.target.value)}
        placeholder={isMultiValueOperator ? 'Valeurs séparées par des virgules' : 'Valeur'}
        className="w-full rounded-xl border border-black/10 bg-gray-300 px-4 py-2 text-neutral-700 focus:border-violet-500 focus:outline-none dark:border-white/10 dark:bg-neutral-800/50 dark:text-white"
      />
    );
  };

  return (
     <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[10]" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl p-8 min-w-96 max-w-3xl max-h-[80vh] overflow-y-auto backdrop-blur" onClick={e => e.stopPropagation()} >
        <h3 className="text-xl font-bold mb-6">{isEditing ? 'Modifier un filtre' : 'Ajouter un filtre'}</h3>
        {/* Onglets collections */}
        <div className="flex flex-wrap gap-2 mb-5">
          {collections.map((col, idx) => (
            <button
              key={col.id || idx}
              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors duration-300 ${selectedTab === idx ? 'text-white border-transparent' : 'bg-gray-300 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 border-black/10 dark:border-white/10 hover:bg-gray-400 dark:hover:bg-neutral-700'}`}
              style={selectedTab === idx ? { backgroundColor: col.color || '#8b5cf6' } : undefined}
              onClick={() => setSelectedTab(idx)}
            >
              {col.name || `Collection ${idx+1}`}
            </button>
          ))}
        </div>
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
              {getValueSummary()}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5 items-stretch">
          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4 space-y-3">
            <div>
              <div className="text-sm font-semibold">Champ</div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">Choisis la propriété à filtrer.</div>
            </div>
            {renderShadcnSelect(
              property,
              (nextValue) => setProperty(nextValue),
              currentProperties.map((prop: any) => ({ value: prop.id, label: prop.name }))
            )}
          </div>

          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4 space-y-3">

            <div className="flex flex-wrap gap-2">
              {operators.map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setOperator(op.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${operator === op.value ? 'text-white border-transparent' : 'border-black/10 dark:border-white/10 bg-gray-300 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 hover:bg-gray-400 dark:hover:bg-neutral-700'}`}
                  style={operator === op.value ? { backgroundColor: accentColor } : undefined}
                  title={op.label}
                >
                  {compactOperatorLabels[op.value] || op.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 p-4 space-y-3 col-span-2">

            {renderValueEditor()}
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton
            onClick={() => property && onAdd(property, operator, prepareFilterValue())}
            className="flex-1"
          >
            {isEditing ? 'Enregistrer' : 'Ajouter'}
          </ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default FilterModal;
