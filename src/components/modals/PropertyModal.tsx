import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ui/ShinyButton';
import OptionListEditor from '@/components/inputs/OptionListEditor';
import IconPicker from '@/components/inputs/IconPicker';
import ColorPicker from '@/components/inputs/ColorPicker';
import * as Icons from 'lucide-react';
import { OptionType } from '@/components/inputs/LightSelect';
import RichTextEditor from '@/components/fields/RichTextEditor';
import EditableProperty from '@/components/fields/EditableProperty';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';
import { DATE_GRANULARITIES } from '@/lib/types';

interface PropertyModalProps {
  onClose: () => void;
  onSave: (property: any) => void;
  property?: any; // undefined pour créer, défini pour modifier
  collections: any[];
  currentCollectionId: string;
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

const PropertyModal: React.FC<PropertyModalProps> = ({ 
  onClose, 
  onSave, 
  property, 
  collections, 
  currentCollectionId 
}) => {
  // Mode édition ou création
  const isEditing = !!property;
  
  // État initial basé sur le mode
  const [name, setName] = useState(property?.name || '');
  const [type, setType] = useState(property?.type || 'text');
  const [icon, setIcon] = useState(property?.icon || 'Tag');
  const [color, setColor] = useState(property?.color || '#8b5cf6');
  const [options, setOptions] = useState<OptionType[]>(property?.options || []);
  const [relationTarget, setRelationTarget] = useState(property?.relation?.targetCollectionId || '');
  const [relationType, setRelationType] = useState(property?.relation?.type || 'many_to_many');
  const [relationMaxVisible, setRelationMaxVisible] = useState(
    property?.relation?.maxVisible != null ? String(property.relation.maxVisible) : ''
  );
  const [relationDisplayFieldIds, setRelationDisplayFieldIds] = useState<string[]>(
    Array.isArray(property?.relation?.displayFieldIds) ? property.relation.displayFieldIds : []
  );
  const [relationAutoHideSource, setRelationAutoHideSource] = useState(
    property?.relation?.autoHideSource !== false
  );
  const [relationFilterField, setRelationFilterField] = useState(property?.relation?.filter?.fieldId || '');
  const [relationFilterValue, setRelationFilterValue] = useState(property?.relation?.filter?.value || '');
  const [showContextMenu, setShowContextMenu] = useState(property?.showContextMenu || false);
  const [defaultTemplates, setDefaultTemplates] = useState<any[]>(property?.defaultTemplates || []);
  const [showIconPopover, setShowIconPopover] = useState(false);
  const [showColorPopover, setShowColorPopover] = useState(false);
  const [dateGranularity, setDateGranularity] = useState(property?.dateGranularity || 'full');
  const [includeDuration, setIncludeDuration] = useState(property?.includeDuration !== false);
  const [numberPrefix, setNumberPrefix] = useState(property?.numberPrefix || '');
  const [numberSuffix, setNumberSuffix] = useState(property?.numberSuffix || '');
  const [numberMode, setNumberMode] = useState<'classic' | 'calculated'>(
    property?.numberMode === 'calculated' || property?.calculation ? 'calculated' : 'classic'
  );
  const [calculationOperation, setCalculationOperation] = useState(
    property?.calculation?.operation || 'add'
  );
  const [calculationFieldIds, setCalculationFieldIds] = useState<string[]>(
    Array.isArray(property?.calculation?.fieldIds) ? property.calculation.fieldIds : []
  );

  const targetCollection = (collections || []).find((c: any) => c.id === relationTarget);
  const filterProp = targetCollection?.properties?.find((p: any) => p.id === relationFilterField);
  const currentCollection = (collections || []).find((c: any) => c.id === currentCollectionId);
  const templateSourceOptions = (currentCollection?.properties || []).filter((p: any) => p.id !== property?.id);
  const availableNumberFields = (currentCollection?.properties || []).filter(
    (p: any) => p.type === 'number' && p.id !== property?.id
  );

  const handleSave = () => {
    if (!name.trim()) {
      alert('Le nom de la propriété est requis');
      return;
    }

    const savedProperty: any = isEditing 
      ? { ...property }
      : {};

    savedProperty.name = name;
    savedProperty.type = type;
    savedProperty.icon = icon;
    savedProperty.color = color;
    savedProperty.showContextMenu = showContextMenu;
    savedProperty.defaultTemplates = defaultTemplates;

    if (type === 'date' || type === 'date_range') {
      savedProperty.dateGranularity = dateGranularity;
      savedProperty.includeDuration = includeDuration;
    } else {
      delete savedProperty.dateGranularity;
      delete savedProperty.includeDuration;
    }

    if (type === 'select' || type === 'multi_select') {
      savedProperty.options = options;
    } else {
      delete savedProperty.options;
    }

    if (type === 'number') {
      savedProperty.numberPrefix = numberPrefix;
      savedProperty.numberSuffix = numberSuffix;
      savedProperty.numberMode = numberMode;
      if (numberMode === 'calculated') {
        if (!calculationFieldIds.length) {
          alert('Choisissez au moins une colonne source pour le calcul.');
          return;
        }
        savedProperty.calculation = {
          operation: calculationOperation,
          fieldIds: calculationFieldIds,
        };
      } else {
        delete savedProperty.calculation;
      }
    } else {
      delete savedProperty.numberPrefix;
      delete savedProperty.numberSuffix;
      delete savedProperty.numberMode;
      delete savedProperty.calculation;
    }

    if (type === 'relation') {
      if (!relationTarget) {
        alert('Veuillez choisir une collection cible');
        return;
      }
      const relation: any = { targetCollectionId: relationTarget, type: relationType };
      if (relationMaxVisible !== '') {
        const parsedMax = Number(relationMaxVisible);
        if (Number.isFinite(parsedMax) && parsedMax > 0) {
          relation.maxVisible = Math.floor(parsedMax);
        }
      }
      if (relationDisplayFieldIds.length > 0) {
        relation.displayFieldIds = relationDisplayFieldIds;
      }
      relation.autoHideSource = relationAutoHideSource;
      if (relationFilterField && relationFilterValue) {
        relation.filter = { fieldId: relationFilterField, value: relationFilterValue };
      }
      savedProperty.relation = relation;
    } else {
      delete savedProperty.relation;
    }

    onSave(savedProperty);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]" onClick={onClose}>
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl p-8 min-w-96 max-h-[80vh] overflow-y-auto backdrop-blur" 
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-6">
          {isEditing ? 'Modifier la propriété' : 'Nouvelle propriété'}
        </h3>
        
        <div className="space-y-6">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Nom *
            </label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Nom de la propriété"
              autoFocus
              className="w-full px-4 py-2 bg-gray-300 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none" 
            />
          </div>

          {/* Type et icône/couleur */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
              >
                {Object.entries(PropertyTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Icône et couleur</label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowIconPopover(!showIconPopover)}
                    className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5"
                    title="Choisir une icône"
                  >
                    {icon === 'Tag' ? <Icons.Tag size={16} /> : icon === 'Star' ? <Icons.Star size={16} /> : icon === 'Zap' ? <Icons.Zap size={16} /> : <Icons.Tag size={16} />}
                  </button>
                  {showIconPopover && (
                    <div className="absolute top-full left-0 mt-2 z-50">
                      <IconPicker value={icon} onChange={(val) => { setIcon(val); setShowIconPopover(false); }} />
                    </div>
                  )}
                </div>

                <div className="relative leading-none">
                  <button
                    type="button"
                    onClick={() => setShowColorPopover(!showColorPopover)}
                    className="w-9 h-9 rounded-lg border border-white/10"
                    style={{ backgroundColor: color }}
                    title="Choisir une couleur"
                  />
                  {showColorPopover && (
                    <div className="absolute top-full left-0 mt-2 z-50">
                      <ColorPicker value={color} onChange={(val) => { setColor(val); setShowColorPopover(false); }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Templates conditionnels */}
          <div className="space-y-3 border-t border-black/10 dark:border-white/10 pt-4">
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
                + Ajouter
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
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
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
                              return <option key={optValue} value={optValue}>{optValue}</option>;
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
                        onClick={() => setDefaultTemplates((prev) => prev.filter((_, i) => i !== index))}
                        className="px-2 py-2 rounded bg-red-500/10 text-red-600 hover:bg-red-500/20"
                        title="Supprimer"
                      >
                        <Icons.Trash2 size={14} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Alors définir à</label>
                      {type === 'rich_text' ? (
                        <RichTextEditor
                          value={tpl.value}
                          onChange={(val) => updateTemplate({ value: val })}
                          className="bg-gray-200 dark:bg-neutral-800/50"
                        />
                      ) : type === 'date' || type === 'date_range' ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={tpl.value ?? ''}
                            onChange={(e) => updateTemplate({ value: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-sm text-neutral-700 dark:text-white"
                            placeholder="Ex: {{now:month}}, {{now:year}}, {{now}}"
                          />
                          <p className="text-xs text-neutral-500">
                            Templates: <code>{'{{now:month}}'}</code>, <code>{'{{now:year}}'}</code>, <code>{'{{now}}'}</code>
                          </p>
                        </div>
                      ) : type === 'relation' ? (
                        <EditableProperty
                          property={{
                            name,
                            type,
                            relation: relationTarget ? {
                              targetCollectionId: relationTarget,
                              type: relationType,
                              displayFieldIds: relationDisplayFieldIds,
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
                          {(options || []).map((opt: any) => {
                            const optValue = typeof opt === 'string' ? opt : opt.value;
                            return <option key={optValue} value={optValue}>{optValue}</option>;
                          })}
                        </select>
                      ) : type === 'checkbox' ? (
                        <select
                          value={tpl.value === true ? 'true' : tpl.value === false ? 'false' : ''}
                          onChange={(e) => updateTemplate({ value: e.target.value === 'true' })}
                          className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-sm text-neutral-700 dark:text-white"
                        >
                          <option value="">Sélectionner...</option>
                          <option value="true">Coché</option>
                          <option value="false">Décoché</option>
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

          {/* Configuration par type */}
          {(type === 'date' || type === 'date_range') && (
            <div className="space-y-4 border-t border-black/10 dark:border-white/10 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Granularité d'affichage</label>
                  <select
                    value={dateGranularity}
                    onChange={(e) => setDateGranularity(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
                  >
                    {DATE_GRANULARITIES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDuration}
                      onChange={(e) => setIncludeDuration(e.target.checked)}
                      className="w-4 h-4 rounded border-white/10"
                    />
                    <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Inclure la durée</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {type === 'relation' && (
            <div className="space-y-4 border-t border-black/10 dark:border-white/10 pt-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Collection liée</label>
                <select 
                  value={relationTarget}
                  onChange={(e) => { setRelationTarget(e.target.value); setRelationDisplayFieldIds([]); setRelationAutoHideSource(true); setRelationFilterField(''); setRelationFilterValue(''); }}
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
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Max affiché dans la cellule</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={relationMaxVisible}
                  onChange={(e) => setRelationMaxVisible(e.target.value)}
                  placeholder="Sans limite"
                  className="w-full px-4 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
                />
              </div>
              {relationTarget && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Colonnes liées affichées dans la cellule</label>
                  <LightMultiSelect
                    options={(collections.find((c: any) => c.id === relationTarget)?.properties || [])
                      .filter((p: any) => p.type !== 'relation')
                      .map((p: any) => ({ value: p.id, label: p.name }))}
                    values={relationDisplayFieldIds}
                    onChange={setRelationDisplayFieldIds}
                    placeholder="Par défaut: nom de l'élément lié"
                    maxVisible={3}
                  />
                  <p className="text-xs text-neutral-500 mt-2">
                    Sélectionnez les champs à concaténer (ex: Nom, Date). Si vide, on affiche le nom.
                  </p>
                </div>
              )}
              {relationTarget && relationDisplayFieldIds.length > 0 && (
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={relationAutoHideSource}
                      onChange={(e) => setRelationAutoHideSource(e.target.checked)}
                      className="w-4 h-4 rounded border-white/10"
                    />
                    <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">
                      Masquer automatiquement la colonne relation source
                    </span>
                  </label>
                  <p className="text-xs text-neutral-500 mt-2 ml-7">
                    Si activé, la colonne parent est cachée quand des colonnes liées sont affichées.
                  </p>
                </div>
              )}
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
                          return <option key={optValue} value={optValue}>{optValue}</option>;
                        })}
                      </select>
                    ) : filterProp?.type === 'date' || filterProp?.type === 'date_range' ? (
                      <select
                        value={relationFilterValue}
                        onChange={(e) => setRelationFilterValue(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
                      >
                        <option value="">Sélectionner...</option>
                        <option value="today">Aujourd'hui</option>
                        <option value="thisWeek">Cette semaine</option>
                        <option value="thisMonth">Ce mois</option>
                        <option value="thisYear">Cette année</option>
                        <option value="yesterday">Hier</option>
                        <option value="lastWeek">La semaine dernière</option>
                        <option value="lastMonth">Le mois dernier</option>
                        <option value="future">Dates futures</option>
                        <option value="past">Dates passées</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={relationFilterValue}
                        onChange={(e) => setRelationFilterValue(e.target.value)}
                        placeholder="Ex: dev, rédac..."
                        className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {(type === 'select' || type === 'multi_select') && (
            <div className="border-t border-black/10 dark:border-white/10 pt-4">
              <OptionListEditor options={options} onChange={setOptions} />
            </div>
          )}

          {type === 'number' && (
            <div className="space-y-4 border-t border-black/10 dark:border-white/10 pt-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Mode du champ nombre</label>
                <select
                  value={numberMode}
                  onChange={(e) => setNumberMode(e.target.value as 'classic' | 'calculated')}
                  className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="classic">Classique (saisie manuelle)</option>
                  <option value="calculated">Calculé (formule)</option>
                </select>
              </div>

              {numberMode === 'calculated' && (
                <div className="space-y-3 rounded-lg border border-black/10 dark:border-white/10 p-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Opération</label>
                    <select
                      value={calculationOperation}
                      onChange={(e) => setCalculationOperation(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
                    >
                      <option value="add">Addition</option>
                      <option value="subtract">Soustraction</option>
                      <option value="multiply">Multiplication</option>
                      <option value="divide">Division</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Colonnes sources</label>
                    <LightMultiSelect
                      options={availableNumberFields.map((p: any) => ({ value: p.id, label: p.name }))}
                      values={calculationFieldIds}
                      onChange={setCalculationFieldIds}
                      placeholder="Sélectionner les colonnes nombres"
                      maxVisible={3}
                    />
                    {availableNumberFields.length === 0 && (
                      <p className="text-xs text-neutral-500 mt-2">Aucune autre colonne nombre disponible dans cette collection.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Préfixe</label>
                  <input
                    type="text"
                    value={numberPrefix}
                    onChange={(e) => setNumberPrefix(e.target.value)}
                    placeholder="Ex: €"
                    className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Suffixe</label>
                  <input
                    type="text"
                    value={numberSuffix}
                    onChange={(e) => setNumberSuffix(e.target.value)}
                    placeholder="Ex: € / kg / h"
                    className="w-full px-3 py-2 bg-gray-200 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded-lg text-neutral-700 dark:text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Menu contextuel */}
          <div className="border-t border-black/10 dark:border-white/10 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={showContextMenu}
                onChange={(e) => setShowContextMenu(e.target.checked)}
                className="w-4 h-4 rounded border-white/10"
              />
              <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300">Afficher dans le menu contextuel</span>
            </label>
            <p className="text-xs text-neutral-500 mt-2 ml-7">Au clic droit sur les objets</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <button 
            onClick={onClose} 
            className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-neutral-700 dark:text-white"
          >
            Annuler
          </button>
          <ShinyButton onClick={handleSave} className="flex-1">
            {isEditing ? 'Enregistrer' : 'Créer'}
          </ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default PropertyModal;
