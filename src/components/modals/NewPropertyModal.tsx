import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ui/ShinyButton';
import OptionListEditor from '@/components/inputs/OptionListEditor';
import IconPicker from '@/components/inputs/IconPicker';
import { OptionType } from '@/components/inputs/LightSelect';
import RichTextEditor from '@/components/fields/RichTextEditor';
import EditableProperty from '@/components/fields/EditableProperty';

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
  relation: 'Relation',
  rich_text: 'Texte enrichi'
};

const NewPropertyModal: React.FC<NewPropertyModalProps> = ({ onClose, onSave, collections, currentCollection }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [options, setOptions] = useState<OptionType[]>([]);
  const [relationTarget, setRelationTarget] = useState('');
  const [relationType, setRelationType] = useState('many_to_many');
  const [relationFilterField, setRelationFilterField] = useState('');
  const [relationFilterValue, setRelationFilterValue] = useState('');
  const [defaultTemplates, setDefaultTemplates] = useState<any[]>([]);

  const targetCollection = (collections || []).find((c: any) => c.id === relationTarget);
  const filterProp = targetCollection?.properties?.find((p: any) => p.id === relationFilterField);
  const currentCollectionData = (collections || []).find((c: any) => c.id === currentCollection);
  const templateSourceOptions = (currentCollectionData?.properties || []).filter((p: any) => p.id !== undefined);

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
      const relation: any = { targetCollectionId: relationTarget, type: relationType };
      if (relationFilterField && relationFilterValue) {
        relation.filter = { fieldId: relationFilterField, value: relationFilterValue };
      }
      property.relation = relation;
    }
    if (defaultTemplates.length > 0) {
      property.defaultTemplates = defaultTemplates;
    }
    onSave(property);
  };
  
  return (
     <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl p-8 min-w-96 max-h-[80vh] overflow-y-auto backdrop-blur" onClick={e => e.stopPropagation()} >
        <h3 className="text-xl font-bold mb-6">Nouvelle propriété</h3>
        <div className="space-y-4">
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Nom" 
            className="w-full px-4 py-2 bg-gray-200 dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none" 
          />
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value)} 
            className="bg-gray-200 dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded px-4 py-2 text-sm text-neutral-700 dark:text-white w-full"
          >
            {Object.entries(PropertyTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Templates conditionnels</label>
                        <button
                          type="button"
                          onClick={() => setDefaultTemplates((prev) => ([
                            ...prev,
                            { id: `tpl_${Date.now()}`, when: { fieldId: '', value: '' }, value: '' }
                          ]))}
                          className="text-xs px-2 py-1 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                        >
                          + Ajouter un template
                        </button>
                      </div>
                      {defaultTemplates.length === 0 && (
                        <p className="text-xs text-neutral-500">Aucun template défini.</p>
                      )}
                      <div className="space-y-3">
                        {defaultTemplates.map((tpl, index) => {
                          const sourceProp = templateSourceOptions.find((p: any) => p.id === tpl.when?.fieldId);
                          const sourceType = sourceProp?.type;
                          const updateTemplate = (patch: any) => {
                            setDefaultTemplates((prev) => prev.map((t, i) => i === index ? { ...t, ...patch } : t));
                          };
                          const updateWhen = (patch: any) => {
                            setDefaultTemplates((prev) => prev.map((t, i) => i === index ? { ...t, when: { ...(t.when || {}), ...patch } } : t));
                          };

                          return (
                            <div key={tpl.id || index} className="rounded-lg border border-black/10 dark:border-white/10 p-3 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                <div>
                                  <label className="block text-xs text-neutral-500 mb-1">Si le champ</label>
                                  <select
                                    value={tpl.when?.fieldId || ''}
                                    onChange={(e) => updateWhen({ fieldId: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-sm text-neutral-700 dark:text-white"
                                  >
                                    <option value="">Sélectionner...</option>
                                    {templateSourceOptions.map((p: any) => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs text-neutral-500 mb-1">Vaut</label>
                                  {sourceType === 'select' || sourceType === 'multi_select' ? (
                                    <select
                                      value={tpl.when?.value ?? ''}
                                      onChange={(e) => updateWhen({ value: e.target.value })}
                                      className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-sm text-neutral-700 dark:text-white"
                                    >
                                      <option value="">Sélectionner...</option>
                                      {(sourceProp?.options || []).map((opt: any) => {
                                        const optValue = typeof opt === 'string' ? opt : opt.value;
                                        return (
                                          <option key={optValue} value={optValue}>{optValue}</option>
                                        );
                                      })}
                                    </select>
                                  ) : sourceType === 'checkbox' ? (
                                    <select
                                      value={tpl.when?.value === true ? 'true' : tpl.when?.value === false ? 'false' : ''}
                                      onChange={(e) => updateWhen({ value: e.target.value === 'true' })}
                                      className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-sm text-neutral-700 dark:text-white"
                                    >
                                      <option value="">Sélectionner...</option>
                                      <option value="true">Oui</option>
                                      <option value="false">Non</option>
                                    </select>
                                  ) : sourceType === 'number' ? (
                                    <input
                                      type="number"
                                      value={tpl.when?.value ?? ''}
                                      onChange={(e) => updateWhen({ value: e.target.value === '' ? '' : Number(e.target.value) })}
                                      className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-sm text-neutral-700 dark:text-white"
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      value={tpl.when?.value ?? ''}
                                      onChange={(e) => updateWhen({ value: e.target.value })}
                                      className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-sm text-neutral-700 dark:text-white"
                                    />
                                  )}
                                </div>
                                <button
                                  type="button"
                                  title="Marquer comme template par défaut"
                                  onClick={() => setDefaultTemplates((prev) => prev.map((t, i) => ({
                                    ...t,
                                    isDefault: i === index
                                  })))}
                                  className={
                                    "px-3 py-2 text-xs rounded " +
                                    (tpl.isDefault ? "bg-violet-500/20 text-violet-600" : "bg-black/5 dark:bg-white/5")
                                  }
                                >
                                  Défaut
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDefaultTemplates((prev) => prev.filter((_, i) => i !== index))}
                                  className="px-3 py-2 text-xs rounded bg-red-500/10 text-red-600 hover:bg-red-500/20"
                                >
                                  Supprimer
                                </button>
                              </div>
                              <div>
                                <label className="block text-xs text-neutral-500 mb-1">Alors définir la valeur à</label>
                                {type === 'rich_text' ? (
                                  <RichTextEditor
                                    value={tpl.value}
                                    onChange={(val) => updateTemplate({ value: val })}
                                    className="bg-gray-200 dark:bg-neutral-800/50"
                                  />
                                ) : type === 'date' || type === 'date_range' ? (
                                  <input
                                    type="number"
                                    min="0.25"
                                    step="0.25"
                                    value={tpl.value ?? ''}
                                    onChange={(e) => updateTemplate({ value: e.target.value === '' ? '' : Number(e.target.value) })}
                                    className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-sm text-neutral-700 dark:text-white"
                                    placeholder="Durée (heures)"
                                  />
                                ) : type === 'relation' ? (
                                  <EditableProperty
                                    property={{
                                      name,
                                      type,
                                      relation: relationTarget ? {
                                        targetCollectionId: relationTarget,
                                        type: relationType,
                                        filter: relationFilterField && relationFilterValue ? { fieldId: relationFilterField, value: relationFilterValue } : undefined
                                      } : undefined
                                    }}
                                    value={tpl.value}
                                    onChange={(val: any) => updateTemplate({ value: val })}
                                    onRelationChange={(_prop: any, _item: any, val: any) => updateTemplate({ value: val })}
                                    collections={collections}
                                    currentItem={{}}
                                    size="md"
                                    readOnly={false}
                                  />
                                ) : type === 'select' || type === 'multi_select' ? (
                                  <select
                                    value={tpl.value ?? ''}
                                    onChange={(e) => updateTemplate({ value: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-sm text-neutral-700 dark:text-white"
                                  >
                                    <option value="">Sélectionner...</option>
                                    {options.map((opt: any) => {
                                      const optValue = typeof opt === 'string' ? opt : opt.value;
                                      return (
                                        <option key={optValue} value={optValue}>{optValue}</option>
                                      );
                                    })}
                                  </select>
                                ) : type === 'checkbox' ? (
                                  <select
                                    value={tpl.value === true ? 'true' : tpl.value === false ? 'false' : ''}
                                    onChange={(e) => updateTemplate({ value: e.target.value === 'true' })}
                                    className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-sm text-neutral-700 dark:text-white"
                                  >
                                    <option value="">Sélectionner...</option>
                                    <option value="true">Oui</option>
                                    <option value="false">Non</option>
                                  </select>
                                ) : (
                                  <input
                                    type={type === 'number' ? 'number' : 'text'}
                                    value={tpl.value ?? ''}
                                    onChange={(e) => updateTemplate({ value: type === 'number' ? Number(e.target.value) : e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-sm text-neutral-700 dark:text-white"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
          {type === 'relation' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Collection liée</label>
                <select 
                  value={relationTarget}
                  onChange={(e) => { setRelationTarget(e.target.value); setRelationFilterField(''); setRelationFilterValue(''); }}
                  className="w-full px-4 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="">Sélectionner...</option>
                  {(collections || []).filter((c: any) => c.id !== currentCollection).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Type de relation</label>
                <select 
                  value={relationType}
                  onChange={(e) => setRelationType(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="one_to_one">One to One</option>
                  <option value="one_to_many">One to Many</option>
                  <option value="many_to_many">Many to Many</option>
                </select>
              </div>
              {relationTarget && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Filtrer par propriété</label>
                    <select
                      value={relationFilterField}
                      onChange={(e) => setRelationFilterField(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
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
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Valeur du filtre</label>
                    {filterProp?.type === 'select' || filterProp?.type === 'multi_select' ? (
                      <select
                        value={relationFilterValue}
                        onChange={(e) => setRelationFilterValue(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
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
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={handleSave} className="flex-1">Créer</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default NewPropertyModal;
