import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ShinyButton';

interface FilterModalProps {
  properties: any[];
  onClose: () => void;
  onAdd: (property: string, operator: string, value: string) => void;
}

const FilterModal: React.FC<FilterModalProps> = ({ properties, onClose, onAdd }) => {
  const [property, setProperty] = useState('');
  const [operator, setOperator] = useState('equals');
  const [value, setValue] = useState('');
  const operators = [
    { value: 'equals', label: 'Est égal à' },
    { value: 'contains', label: 'Contient' },
    { value: 'greater', label: 'Supérieur à' },
    { value: 'less', label: 'Inférieur à' },
    { value: 'is_empty', label: 'Est vide' },
    { value: 'is_not_empty', label: "N'est pas vide" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-96 backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Ajouter un filtre</h3>
        <div className="space-y-4">
          <select value={property} onChange={(e) => setProperty(e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none">
            <option value="">Sélectionner...</option>
            {properties.map((prop: any) => (
              <option key={prop.id} value={prop.id}>{prop.name}</option>
            ))}
          </select>
          <select value={operator} onChange={(e) => setOperator(e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none">
            {operators.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          {!['is_empty', 'is_not_empty'].includes(operator) && (
            <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Valeur" className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none" />
          )}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={() => property && onAdd(property, operator, value)} className="flex-1">Ajouter</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default FilterModal;
