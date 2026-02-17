import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ui/ShinyButton';
import OptionListEditor from '@/components/inputs/OptionListEditor';
import IconPicker from '@/components/inputs/IconPicker';
import ColorPicker from '@/components/inputs/ColorPicker';
import * as Icons from 'lucide-react';
import { OptionType } from '@/components/inputs/LightSelect';
import EditableProperty from '@/components/fields/EditableProperty';

interface EditPropertyModalProps {
  onClose: () => void;
  onSave: (property: any) => void;
  property: any;
  collections: any[];
  currentCollectionId: string;
}

const EditPropertyModal: React.FC<EditPropertyModalProps> = ({ onClose, onSave, property, collections, currentCollectionId }) => {
  const [name, setName] = useState(property.name);
  const [type, setType] = useState(property.type || 'text');
  const [icon, setIcon] = useState(property.icon || 'Tag');
  const [color, setColor] = useState(property.color || '#8b5cf6');
  const [options, setOptions] = useState<OptionType[]>(property.options || []);
  const [relationTarget, setRelationTarget] = useState(property.relation?.targetCollectionId || '');
  const [relationType, setRelationType] = useState(property.relation?.type || 'many_to_many');
  const [relationFilterField, setRelationFilterField] = useState(property.relation?.filter?.fieldId || '');
  const [relationFilterValue, setRelationFilterValue] = useState(property.relation?.filter?.value || '');
  const [showContextMenu, setShowContextMenu] = useState(property.showContextMenu || false);
  const [defaultTemplates, setDefaultTemplates] = useState<any[]>(property.defaultTemplates || []);
  const [showIconPopover, setShowIconPopover] = useState(false);
  const [showColorPopover, setShowColorPopover] = useState(false);

  const targetCollection = (collections || []).find((c: any) => c.id === relationTarget);
  const filterProp = targetCollection?.properties?.find((p: any) => p.id === relationFilterField);
  const currentCollection = (collections || []).find((c: any) => c.id === currentCollectionId);
  const templateSourceOptions = (currentCollection?.properties || []).filter((p: any) => p.id !== property.id);

  const handleSave = () => {
    const updatedProperty: any = {
      ...property,
      name,
      type,
      icon,
      color,
      showContextMenu,
      defaultTemplates
    };
    if (type === 'select' || type === 'multi_select') {
      updatedProperty.options = options;
    } else {
      delete updatedProperty.options;
    }
    delete updatedProperty.defaultDuration;
    if (type === 'relation') {
      if (!relationTarget) {
        alert('Veuillez choisir une collection cible');
        return;
      }
      const relation: any = { targetCollectionId: relationTarget, type: relationType };
      if (relationFilterField && relationFilterValue) {
        relation.filter = { fieldId: relationFilterField, value: relationFilterValue };
      }
      updatedProperty.relation = relation;
    } else {
      delete updatedProperty.relation;
    }
    onSave(updatedProperty);
  };
  
  return (
     <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl p-8 min-w-96 max-h-[80vh] overflow-y-auto backdrop-blur" onClick={e => e.stopPropagation()} >
        <h3 className="text-xl font-bold mb-6">Modifier la propriété</h3>
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Nom</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-4 py-2 bg-gray-300 dark:bg-neutral-800/50 borderborder-black/10 dark:border-white/10  rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none" 
              />
            </div>
            {/* Champ valeur par défaut dynamique selon le type */}
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
                          <EditableProperty
                            property={{
                              ...property,
                              type,
                              options,
                              relation: type === 'relation' ? {
                                targetCollectionId: relationTarget,
                                type: relationType,
                                filter: relationFilterField && relationFilterValue ? { fieldId: relationFilterField, value: relationFilterValue } : undefined
                              } : undefined
                            }}
                            value={tpl.value}
                            onChange={(val) => updateTemplate({ value: val })}
                            collections={collections}
                            currentItem={{}}
                            size="md"
                            readOnly={false}
                            forceRichEditor={true}
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
                        ) : (
                          <EditableProperty
                            property={{
                              ...property,
                              type,
                              options,
                              relation: type === 'relation' ? {
                                targetCollectionId: relationTarget,
                                type: relationType,
                                filter: relationFilterField && relationFilterValue ? { fieldId: relationFilterField, value: relationFilterValue } : undefined
                              } : undefined
                            }}
                            value={tpl.value}
                            onChange={(val) => updateTemplate({ value: val })}
                            collections={collections}
                            currentItem={{}}
                            size="md"
                            readOnly={false}
                            onRelationChange={(_prop, _item, val) => updateTemplate({ value: val })}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="text">Texte</option>
                  <option value="number">Nombre</option>
                  <option value="select">Sélection</option>
                  <option value="multi_select">Multi-sélection</option>
                  <option value="date">Date</option>
                  <option value="date_range">Période</option>
                  <option value="checkbox">Case à cocher</option>
                  <option value="url">URL</option>
                  <option value="email">Email</option>
                  <option value="phone">Téléphone</option>
                  <option value="relation">Relation</option>
                  <option value="rich_text">Texte enrichi</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Icône et couleur</label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowIconPopover((v) => !v)}
                      className="w-9 h-9 flex items-center justify-center bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 rounded-lg text-neutral-600 dark:text-neutral-300"
                      title="Choisir une icône"
                    >
                      {(Icons as any)[icon] ? React.createElement((Icons as any)[icon], { size: 14 }) : <Icons.Tag size={14} />}
                    </button>
                    {showIconPopover && (
                      <div className="absolute z-[150] mt-2 w-[320px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                        <IconPicker value={icon} onChange={(val) => { setIcon(val); setShowIconPopover(false); }} mode="all" />
                      </div>
                    )}
                  </div>

                  <div className="relative leading-none">
                    <button
                      type="button"
                      onClick={() => setShowColorPopover((v) => !v)}
                      className="w-9 h-9 rounded-lg border border-white/10"
                      style={{ backgroundColor: color }}
                      title="Choisir une couleur"
                    />
                    {showColorPopover && (
                      <div className="absolute z-[150] mt-2 w-[320px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                        <ColorPicker value={color} onChange={(val) => { setColor(val); setShowColorPopover(false); }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
                  {(collections || []).filter((c: any) => c.id !== currentCollectionId).map((c: any) => (
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

          <div className="border-t border-white/10 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showContextMenu}
                onChange={(e) => setShowContextMenu(e.target.checked)}
                className="w-4 h-4 rounded border-white/10"
              />
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Afficher dans le menu contextuel</span>
            </label>
            <p className="text-xs text-neutral-500 mt-2 ml-7">Cette propriété apparaîtra dans le menu contextuel au clic droit sur les objets</p>
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={handleSave} className="flex-1">Enregistrer</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default EditPropertyModal;
