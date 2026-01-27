import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ui/ShinyButton';
import { LightSelect } from '@/components/inputs/LightSelect';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';

interface FilterModalProps {
  properties: any[];
  collections: any[];
  onClose: () => void;
  onAdd: (property: string, operator: string, value: any) => void;
}

const FilterModal: React.FC<FilterModalProps> = ({ properties, collections, onClose, onAdd }) => {
  // Onglet sélectionné : index de la collection
  const defaultTab = collections.findIndex(c => c.properties === properties) || 0;
  const [selectedTab, setSelectedTab] = useState(defaultTab);
  const [property, setProperty] = useState('');
  const [operator, setOperator] = useState('equals');
  const [value, setValue] = useState<any>('');
  const operators = [
    { value: 'equals', label: 'Est égal à' },
    { value: 'not_equals', label: 'Est différent de' },
    { value: 'contains', label: 'Contient' },
    { value: 'greater', label: 'Supérieur à' },
    { value: 'less', label: 'Inférieur à' },
    { value: 'is_empty', label: 'Est vide' },
    { value: 'is_not_empty', label: "N'est pas vide" },
  ];
  // Propriétés de la collection sélectionnée
  const currentProperties = collections[selectedTab]?.properties || [];
  // Reset property si on change d'onglet
  React.useEffect(() => {
    setProperty('');
    setValue('');
    setOperator('equals');
  }, [selectedTab]);
  return (
     <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl p-8 min-w-96 backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Ajouter un filtre</h3>
        {/* Onglets collections */}
        <div className="flex gap-2 mb-4">
          {collections.map((col, idx) => (
            <button
              key={col.id || idx}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-300 ${selectedTab === idx ? 'bg-violet-600 text-white' : 'bg-gray-300 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 hover:bg-gray-400 dark:hover:bg-neutral-700'}`}
              onClick={() => setSelectedTab(idx)}
            >
              {col.name || `Collection ${idx+1}`}
            </button>
          ))}
        </div>
        <div className="space-y-4">
          <select value={property} onChange={(e) => setProperty(e.target.value)} className="w-full px-4 py-2 bg-gray-300 dark:bg-neutral-800/50 borderborder-black/10 dark:border-white/10  rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none">
            <option value="">Sélectionner...</option>
            {currentProperties.map((prop: any) => (
              <option key={prop.id} value={prop.id}>{prop.name}</option>
            ))}
          </select>
          <select value={operator} onChange={(e) => setOperator(e.target.value)} className="w-full px-4 py-2 bg-gray-300 dark:bg-neutral-800/50 borderborder-black/10 dark:border-white/10  rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none">
            {operators.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          {!['is_empty', 'is_not_empty'].includes(operator) && (() => {
            const selectedProp = currentProperties.find((p: any) => p.id === property);
            // Relation: construire options depuis la collection cible
            if (selectedProp?.type === 'relation') {
              const relation = selectedProp.relation || {};
              const targetCollectionId = relation.targetCollectionId;
              const relationType = relation.type || 'many_to_many';
              const targetCollection = (collections || []).find((c: any) => c.id === targetCollectionId);
              const targetItems = targetCollection?.items || [];
              const isSourceMany = relationType === 'one_to_many' || relationType === 'many_to_many';
              const nameField = targetCollection?.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');

              if (isSourceMany) {
                const currentValues = Array.isArray(value) ? value : [];
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
              } else {
                return (
                  <select
                    value={typeof value === 'string' ? value : ''}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
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
            if (selectedProp?.type === 'select') {
              const opts = (selectedProp.options || []).map((opt: any) =>
                typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.value, color: opt.color, icon: opt.icon }
              );
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
            return (
              <input
                type="text"
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Valeur"
                className="w-full px-4 py-2 bg-gray-300 dark:bg-neutral-800/50 borderborder-black/10 dark:border-white/10  rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
              />
            );
          })()}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={() => property && onAdd(property, operator, value)} className="flex-1">Ajouter</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default FilterModal;
