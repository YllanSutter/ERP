import React, { useEffect, useState } from 'react';
import ModalWrapper, { FormField, FormInput, FormSelect, FormHint, FormCheckbox } from '@/components/ui/ModalWrapper';
import OptionListEditor from '@/components/inputs/OptionListEditor';
import IconPicker from '@/components/inputs/IconPicker';
import ColorPicker from '@/components/inputs/ColorPicker';
import * as Icons from 'lucide-react';
import { OptionType } from '@/components/inputs/LightSelect';
import RichTextEditor from '@/components/fields/RichTextEditor';
import EditableProperty from '@/components/fields/EditableProperty';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';
import { DATE_GRANULARITIES } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';
import { getPluginPropertyTypeOptions } from '@/lib/plugins/propertyTypes';

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
  const { activeOrganizationId } = useAuth();

  const isEditing = !!property;

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
  const [pluginPropertyTypeLabels, setPluginPropertyTypeLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const loadPluginPropertyTypes = async () => {
      try {
        const opts = await getPluginPropertyTypeOptions(activeOrganizationId);
        if (cancelled) return;
        setPluginPropertyTypeLabels(Object.fromEntries(opts.map((o) => [o.value, o.label])));
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load plugin property types:', error);
          setPluginPropertyTypeLabels({});
        }
      }
    };
    loadPluginPropertyTypes();
    return () => { cancelled = true; };
  }, [activeOrganizationId]);

  const availablePropertyTypeEntries = (() => {
    const merged: [string, string][] = Object.entries({ ...PropertyTypeLabels, ...pluginPropertyTypeLabels });
    if (type && !merged.some(([value]) => value === type)) merged.push([type, type]);
    return merged;
  })();

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

    const savedProperty: any = isEditing ? { ...property } : {};
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
        savedProperty.calculation = { operation: calculationOperation, fieldIds: calculationFieldIds };
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
        if (Number.isFinite(parsedMax) && parsedMax > 0) relation.maxVisible = Math.floor(parsedMax);
      }
      if (relationDisplayFieldIds.length > 0) relation.displayFieldIds = relationDisplayFieldIds;
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

  // Petit label de section inline (style compact, utilisé dans les templates conditionnels)
  const TinyLabel = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs text-neutral-500 mb-1">{children}</label>
  );

  return (
    <ModalWrapper
      title={isEditing ? 'Modifier la propriété' : 'Nouvelle propriété'}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={isEditing ? 'Enregistrer' : 'Créer'}
    >
      <div className="space-y-6">

        {/* Nom */}
        <FormField label="Nom *">
          <FormInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de la propriété"
            autoFocus
          />
        </FormField>

        {/* Type et icône/couleur */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField label="Type">
            <FormSelect value={type} onChange={(e) => setType(e.target.value)}>
              {availablePropertyTypeEntries.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </FormSelect>
          </FormField>

          <FormField label="Icône et couleur">
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
                    <ColorPicker value={color} onChange={setColor} />
                  </div>
                )}
              </div>
            </div>
          </FormField>
        </div>

        {/* Templates conditionnels */}
        <div className="space-y-3 border-t border-black/10 dark:border-white/10 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Templates conditionnels</span>
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
            <FormHint>Aucun template défini.</FormHint>
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
                      <TinyLabel>Si le champ</TinyLabel>
                      <FormSelect
                        value={tpl.when?.fieldId || ''}
                        onChange={(e) => updateWhen({ fieldId: e.target.value })}
                        className="rounded text-sm"
                      >
                        <option value="">Sélectionner...</option>
                        {templateSourceOptions.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </FormSelect>
                    </div>
                    <div>
                      <TinyLabel>Vaut</TinyLabel>
                      {sourceType === 'select' || sourceType === 'multi_select' ? (
                        <FormSelect value={tpl.when?.value ?? ''} onChange={(e) => updateWhen({ value: e.target.value })} className="rounded text-sm">
                          <option value="">Sélectionner...</option>
                          {(sourceProp?.options || []).map((opt: any) => {
                            const optValue = typeof opt === 'string' ? opt : opt.value;
                            const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);
                            return <option key={optValue} value={optValue}>{optLabel}</option>;
                          })}
                        </FormSelect>
                      ) : sourceType === 'checkbox' ? (
                        <FormSelect value={tpl.when?.value === true ? 'true' : tpl.when?.value === false ? 'false' : ''} onChange={(e) => updateWhen({ value: e.target.value === 'true' })} className="rounded text-sm">
                          <option value="">Sélectionner...</option>
                          <option value="true">Oui</option>
                          <option value="false">Non</option>
                        </FormSelect>
                      ) : sourceType === 'number' ? (
                        <FormInput type="number" value={tpl.when?.value ?? ''} onChange={(e) => updateWhen({ value: e.target.value === '' ? '' : Number(e.target.value) })} className="rounded text-sm" />
                      ) : (
                        <FormInput type="text" value={tpl.when?.value ?? ''} onChange={(e) => updateWhen({ value: e.target.value })} className="rounded text-sm" />
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
                    <TinyLabel>Alors définir à</TinyLabel>
                    {type === 'rich_text' ? (
                      <RichTextEditor value={tpl.value} onChange={(val) => updateTemplate({ value: val })} className="bg-gray-200 dark:bg-neutral-800/50" />
                    ) : type === 'date' || type === 'date_range' ? (
                      <div className="space-y-2">
                        <FormInput type="text" value={tpl.value ?? ''} onChange={(e) => updateTemplate({ value: e.target.value })} className="rounded text-sm" placeholder="Ex: {{now:month}}, {{now:year}}, {{now}}" />
                        <FormHint>Templates: <code>{'{{now:month}}'}</code>, <code>{'{{now:year}}'}</code>, <code>{'{{now}}'}</code></FormHint>
                      </div>
                    ) : type === 'relation' ? (
                      <div className="space-y-2">
                        <FormCheckbox
                          label={<><span className="text-neutral-700 dark:text-neutral-300">Groupage actuel</span><span className="text-xs text-neutral-500 ml-1">(rempli automatiquement si créé depuis un groupe)</span></>}
                          checked={tpl.isCurrentGroupTemplate === true}
                          onChange={(checked) => updateTemplate({ isCurrentGroupTemplate: checked, value: checked ? null : tpl.value })}
                        />
                        {!tpl.isCurrentGroupTemplate && (
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
                        )}
                      </div>
                    ) : type === 'select' || type === 'multi_select' ? (
                      <FormSelect value={tpl.value ?? ''} onChange={(e) => updateTemplate({ value: e.target.value })} className="rounded text-sm">
                        <option value="">Sélectionner...</option>
                        {(options || []).map((opt: any) => {
                          const optValue = typeof opt === 'string' ? opt : opt.value;
                          const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);
                          return <option key={optValue} value={optValue}>{optLabel}</option>;
                        })}
                      </FormSelect>
                    ) : type === 'checkbox' ? (
                      <FormSelect value={tpl.value === true ? 'true' : tpl.value === false ? 'false' : ''} onChange={(e) => updateTemplate({ value: e.target.value === 'true' })} className="rounded text-sm">
                        <option value="">Sélectionner...</option>
                        <option value="true">Coché</option>
                        <option value="false">Décoché</option>
                      </FormSelect>
                    ) : (
                      <FormInput type={type === 'number' ? 'number' : 'text'} value={tpl.value ?? ''} onChange={(e) => updateTemplate({ value: type === 'number' ? Number(e.target.value) : e.target.value })} className="rounded text-sm" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Configuration par type — Date */}
        {(type === 'date' || type === 'date_range') && (
          <div className="space-y-4 border-t border-black/10 dark:border-white/10 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Granularité d'affichage">
                <FormSelect value={dateGranularity} onChange={(e) => setDateGranularity(e.target.value)}>
                  {DATE_GRANULARITIES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </FormSelect>
              </FormField>
              <div className="flex items-end">
                <FormCheckbox label="Inclure la durée" checked={includeDuration} onChange={setIncludeDuration} />
              </div>
            </div>
          </div>
        )}

        {/* Configuration par type — Relation */}
        {type === 'relation' && (
          <div className="space-y-4 border-t border-black/10 dark:border-white/10 pt-4">
            <FormField label="Collection liée">
              <FormSelect
                value={relationTarget}
                onChange={(e) => { setRelationTarget(e.target.value); setRelationDisplayFieldIds([]); setRelationAutoHideSource(true); setRelationFilterField(''); setRelationFilterValue(''); }}
              >
                <option value="">Sélectionner...</option>
                {(collections || []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.id === currentCollectionId ? `${c.name} (cette collection)` : c.name}</option>
                ))}
              </FormSelect>
            </FormField>

            <FormField label="Type de relation">
              <FormSelect value={relationType} onChange={(e) => setRelationType(e.target.value)}>
                <option value="one_to_one">One to One</option>
                <option value="one_to_many">One to Many</option>
                <option value="many_to_many">Many to Many</option>
              </FormSelect>
            </FormField>

            <FormField label="Max affiché dans la cellule">
              <FormInput type="number" min={1} step={1} value={relationMaxVisible} onChange={(e) => setRelationMaxVisible(e.target.value)} placeholder="Sans limite" />
            </FormField>

            {relationTarget && (
              <FormField label="Colonnes liées affichées dans la cellule" hint="Sélectionnez les champs à concaténer (ex: Nom, Date). Si vide, on affiche le nom.">
                <LightMultiSelect
                  options={(collections.find((c: any) => c.id === relationTarget)?.properties || [])
                    .filter((p: any) => p.type !== 'relation')
                    .map((p: any) => ({ value: p.id, label: p.name }))}
                  values={relationDisplayFieldIds}
                  onChange={setRelationDisplayFieldIds}
                  placeholder="Par défaut: nom de l'élément lié"
                  maxVisible={3}
                />
              </FormField>
            )}

            {relationTarget && relationDisplayFieldIds.length > 0 && (
              <div>
                <FormCheckbox
                  label="Masquer automatiquement la colonne relation source"
                  checked={relationAutoHideSource}
                  onChange={setRelationAutoHideSource}
                />
                <FormHint className="ml-6">Si activé, la colonne parent est cachée quand des colonnes liées sont affichées.</FormHint>
              </div>
            )}

            {relationTarget && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField label="Filtrer par propriété">
                  <FormSelect value={relationFilterField} onChange={(e) => setRelationFilterField(e.target.value)}>
                    <option value="">Aucune</option>
                    {(collections.find((c: any) => c.id === relationTarget)?.properties || [])
                      .filter((p: any) => p.type !== 'relation')
                      .map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </FormSelect>
                </FormField>

                <FormField label="Valeur du filtre">
                  {filterProp?.type === 'select' || filterProp?.type === 'multi_select' ? (
                    <FormSelect value={relationFilterValue} onChange={(e) => setRelationFilterValue(e.target.value)}>
                      <option value="">Sélectionner...</option>
                      {(filterProp.options || []).map((opt: any) => {
                        const optValue = typeof opt === 'string' ? opt : opt.value;
                        const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);
                        return <option key={optValue} value={optValue}>{optLabel}</option>;
                      })}
                    </FormSelect>
                  ) : filterProp?.type === 'date' || filterProp?.type === 'date_range' ? (
                    <FormSelect value={relationFilterValue} onChange={(e) => setRelationFilterValue(e.target.value)}>
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
                    </FormSelect>
                  ) : (
                    <FormInput type="text" value={relationFilterValue} onChange={(e) => setRelationFilterValue(e.target.value)} placeholder="Ex: dev, rédac..." />
                  )}
                </FormField>
              </div>
            )}
          </div>
        )}

        {/* Configuration par type — Select / Multi-select */}
        {(type === 'select' || type === 'multi_select') && (
          <div className="border-t border-black/10 dark:border-white/10 pt-4">
            <OptionListEditor options={options} onChange={setOptions} />
          </div>
        )}

        {/* Configuration par type — Nombre */}
        {type === 'number' && (
          <div className="space-y-4 border-t border-black/10 dark:border-white/10 pt-4">
            <FormField label="Mode du champ nombre">
              <FormSelect value={numberMode} onChange={(e) => setNumberMode(e.target.value as 'classic' | 'calculated')}>
                <option value="classic">Classique (saisie manuelle)</option>
                <option value="calculated">Calculé (formule)</option>
              </FormSelect>
            </FormField>

            {numberMode === 'calculated' && (
              <div className="space-y-3 rounded-lg border border-black/10 dark:border-white/10 p-3">
                <FormField label="Opération">
                  <FormSelect value={calculationOperation} onChange={(e) => setCalculationOperation(e.target.value)}>
                    <option value="add">Addition</option>
                    <option value="subtract">Soustraction</option>
                    <option value="multiply">Multiplication</option>
                    <option value="divide">Division</option>
                  </FormSelect>
                </FormField>
                <FormField label="Colonnes sources">
                  <LightMultiSelect
                    options={availableNumberFields.map((p: any) => ({ value: p.id, label: p.name }))}
                    values={calculationFieldIds}
                    onChange={setCalculationFieldIds}
                    placeholder="Sélectionner les colonnes nombres"
                    maxVisible={3}
                  />
                  {availableNumberFields.length === 0 && (
                    <FormHint>Aucune autre colonne nombre disponible dans cette collection.</FormHint>
                  )}
                </FormField>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Préfixe">
                <FormInput value={numberPrefix} onChange={(e) => setNumberPrefix(e.target.value)} placeholder="Ex: €" />
              </FormField>
              <FormField label="Suffixe">
                <FormInput value={numberSuffix} onChange={(e) => setNumberSuffix(e.target.value)} placeholder="Ex: € / kg / h" />
              </FormField>
            </div>
          </div>
        )}

        {/* Menu contextuel */}
        <div className="border-t border-black/10 dark:border-white/10 pt-4">
          <FormCheckbox label="Afficher dans le menu contextuel" checked={showContextMenu} onChange={setShowContextMenu} />
          <FormHint className="ml-6">Au clic droit sur les objets</FormHint>
        </div>

      </div>
    </ModalWrapper>
  );
};

export default PropertyModal;
