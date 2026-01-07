import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ShinyButton';
import OptionListEditor from '@/components/OptionListEditor';
import IconPicker from '@/components/IconPicker';
import { OptionType } from '@/components/inputs/LightSelect';

interface NewPropertyModalProps {
  onClose: () => void;
  onSave: (property: any) => void;
  collections: any[];
  currentCollection: string;
}

const PropertyTypeLabels = {
  text: 'Texte',
  number: 'Nombre',
  select: 'Sélection',
  multi_select: 'Multi-sélection',
  date: 'Date',
  date_range: 'Période',
  checkbox: 'Case à cocher',
  url: 'URL',
  email: 'Email',
  phone: 'Téléphone',
  relation: 'Relation'
};

const NewPropertyModal: React.FC<NewPropertyModalProps> = ({ onClose, onSave, collections, currentCollection }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [options, setOptions] = useState<OptionType[]>([]);
  const [relationTarget, setRelationTarget] = useState('');
  const [relationType, setRelationType] = useState('many_to_many');

  const handleSave = () => {
    const property: any = { name, type, icon: 'Tag', color: '#8b5cf6' };
    if (type === 'select' || type === 'multi_select') {
      property.options = options;
    }
    if (type === 'relation') {
      if (!relationTarget) {
        alert('Veuillez choisir une collection cible');
        return;
      }
      property.relation = { targetCollectionId: relationTarget, type: relationType };
    }
    onSave(property);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[500px] max-h-[90vh] overflow-y-auto backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Nouvelle propriété</h3>
        <div className="space-y-4">
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Nom" 
            className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none" 
          />
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value)} 
            className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none"
          >
            {Object.entries(PropertyTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          {type === 'relation' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Collection liée</label>
                <select 
                  value={relationTarget}
                  onChange={(e) => setRelationTarget(e.target.value)}
                  className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="">Sélectionner...</option>
                  {(collections || []).filter((c: any) => c.id !== currentCollection).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Type de relation</label>
                <select 
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value)}
                  className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="one_to_one">One to One</option>
                  <option value="one_to_many">One to Many</option>
                  <option value="many_to_many">Many to Many</option>
                </select>
              </div>
            </div>
          )}
          {(type === 'select' || type === 'multi_select') && (
            <OptionListEditor options={options} onChange={setOptions} />
          )}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={handleSave} className="flex-1">Créer</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default NewPropertyModal;
