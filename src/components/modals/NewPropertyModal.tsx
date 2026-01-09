import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ui/ShinyButton';
import OptionListEditor from '@/components/inputs/OptionListEditor';
import IconPicker from '@/components/inputs/IconPicker';
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
  const [relationFilterField, setRelationFilterField] = useState('');
  const [relationFilterValue, setRelationFilterValue] = useState('');
  const [defaultDuration, setDefaultDuration] = useState(1);

  const targetCollection = (collections || []).find((c: any) => c.id === relationTarget);
  const filterProp = targetCollection?.properties?.find((p: any) => p.id === relationFilterField);

  const handleSave = () => {
    const property: any = { name, type, icon: 'Tag', color: '#8b5cf6' };
    if (type === 'select' || type === 'multi_select') {
      property.options = options;
    }
    if (type === 'date' || type === 'date_range') {
      property.defaultDuration = defaultDuration;
    }
    if (type === 'relation') {
      if (!relationTarget) {
        alert('Veuillez choisir une collection cible');
        return;
      }
      const relation: any = { targetCollectionId: relationTarget, type: relationType };
      if (relationFilterField && relationFilterValue) {
        relation.filter = { fieldId: relationFilterField, value: relationFilterValue };
      }
      property.relation = relation;
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
            className="w-full px-4 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none" 
          />
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value)} 
            className="bg-neutral-900 border border-white/10 rounded px-4 py-2 text-sm text-white w-full"
          >
            {Object.entries(PropertyTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          {(type === 'date' || type === 'date_range') && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Durée par défaut (heures)</label>
              <input
                type="number"
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(parseFloat(e.target.value) || 1)}
                min="0.25"
                step="0.25"
                className="w-full px-4 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                placeholder="1"
              />
              <p className="text-xs text-neutral-500 mt-1">Durée par défaut des événements dans le calendrier</p>
            </div>
          )}
          {type === 'relation' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Collection liée</label>
                <select 
                  value={relationTarget}
                  onChange={(e) => { setRelationTarget(e.target.value); setRelationFilterField(''); setRelationFilterValue(''); }}
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
              {relationTarget && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Filtrer par propriété</label>
                    <select
                      value={relationFilterField}
                      onChange={(e) => setRelationFilterField(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                    >
                      <option value="">Aucune</option>
                      {(collections.find((c: any) => c.id === relationTarget)?.properties || [])
                        .filter((p: any) => p.type !== 'relation')
                        .map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-2">Valeur du filtre</label>
                    {filterProp?.type === 'select' || filterProp?.type === 'multi_select' ? (
                      <select
                        value={relationFilterValue}
                        onChange={(e) => setRelationFilterValue(e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none"
                      >
                        <option value="">Sélectionner...</option>
                        {(filterProp.options || []).map((opt: any) => {
                          const optValue = typeof opt === 'string' ? opt : opt.value;
                          return (
                            <option key={optValue} value={optValue}>{optValue}</option>
                          );
                        })}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={relationFilterValue}
                        onChange={(e) => setRelationFilterValue(e.target.value)}
                        placeholder="Ex: dev, rédac..."
                        className="w-full px-3 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              )}
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
