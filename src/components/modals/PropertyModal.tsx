import React, { useEffect, useState } from 'react';
import ModalWrapper, { FormField, FormInput, FormSelect, FormHint, FormCheckbox, FormNameInput, FormTabs, BUILTIN_PROPERTY_TYPES } from '@/components/ui/ModalWrapper';
import OptionListEditor from '@/components/inputs/OptionListEditor';
import * as Icons from 'lucide-react';
import { OptionType } from '@/components/inputs/LightSelect';
import RichTextEditor from '@/components/fields/RichTextEditor';
import EditableProperty from '@/components/fields/EditableProperty';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';
import { DATE_GRANULARITIES, getPluginPropertyTypeOptions } from '@/components/modals/modalLib';
import { useAuth } from '@/auth/AuthProvider';
import { cn } from '@/lib/utils';

interface PropertyModalProps {
  onClose: () => void;
  onSave: (property: any) => void;
  property?: any;
  collections: any[];
  currentCollectionId: string;
}

// Types qui ont un onglet de configuration dédié
const TYPE_CONFIG_LABEL: Record<string, string> = {
  select: 'Options',
  multi_select: 'Options',
  date: 'Date',
  date_range: 'Date',
  relation: 'Relation',
  number: 'Nombre',
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
  const [showRelationFilter, setShowRelationFilter] = useState(!!(property?.relation?.filter?.fieldId));
  const [selectedTplIndex, setSelectedTplIndex] = useState(0);
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

  // Onglet actif
  const [activeTab, setActiveTab] = useState<string>('infos');

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

  const targetCollection = (collections || []).find((c: any) => c.id === relationTarget);
  const filterProp = targetCollection?.properties?.find((p: any) => p.id === relationFilterField);
  const currentCollection = (collections || []).find((c: any) => c.id === currentCollectionId);
  const templateSourceOptions = (currentCollection?.properties || []).filter((p: any) => p.id !== property?.id);
  const availableNumberFields = (currentCollection?.properties || []).filter(
    (p: any) => p.type === 'number' && p.id !== property?.id
  );

  const configLabel = TYPE_CONFIG_LABEL[type];

  const tabs = [
    { id: 'infos', label: 'Infos' },
    ...(configLabel ? [{ id: 'config', label: configLabel }] : []),
    { id: 'templates', label: 'Templates' },
    { id: 'avance', label: 'Avancé' },
  ];

  // Si on change de type et que l'onglet 'config' disparaît, revenir sur 'infos'
  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (activeTab === 'config' && !TYPE_CONFIG_LABEL[newType]) {
      setActiveTab('infos');
    }
  };

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

  const TinyLabel = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs text-neutral-500 mb-1">{children}</label>
  );

  return (
    <ModalWrapper
      title={isEditing ? 'Modifier la propriété' : 'Nouvelle propriété'}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={isEditing ? 'Enregistrer' : 'Créer'}
      size="lg"
    >
      <FormTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* ── Onglet Infos ───────────────────────────────────────────────────── */}
      {activeTab === 'infos' && (
        <div className="space-y-5">
          <FormNameInput
            label="Nom"
            required
            value={name}
            onChange={setName}
            icon={icon}
            onIconChange={setIcon}
            color={color}
            onColorChange={setColor}
            placeholder="Nom de la propriété"
            autoFocus
          />

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Type</label>
            <div className="grid grid-cols-4 gap-1.5">
              {BUILTIN_PROPERTY_TYPES.map(({ value: v, label: l, icon: Icon }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleTypeChange(v)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border text-xs transition-all',
                    type === v
                      ? 'border-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-400'
                      : 'border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20 text-neutral-500 dark:text-neutral-400'
                  )}
                >
                  <Icon size={16} />
                  <span className="text-neutral-700 dark:text-white leading-tight text-center">{l}</span>
                </button>
              ))}
            </div>
            {Object.keys(pluginPropertyTypeLabels).length > 0 && (
              <FormSelect
                value={type}
                onChange={handleTypeChange}
                className="mt-2"
                options={[
                  { value: '', label: 'Types plugins…' },
                  ...Object.entries(pluginPropertyTypeLabels).map(([key, label]) => ({ value: key, label: label as string })),
                ]}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Onglet Config (Select / Multi-select) ──────────────────────────── */}
      {activeTab === 'config' && (type === 'select' || type === 'multi_select') && (
        <OptionListEditor options={options} onChange={setOptions} />
      )}

      {/* ── Onglet Config (Date) ───────────────────────────────────────────── */}
      {activeTab === 'config' && (type === 'date' || type === 'date_range') && (
        <div className="space-y-3">
          <FormField label="Granularité d'affichage">
            <FormSelect
              value={dateGranularity}
              onChange={setDateGranularity}
              options={DATE_GRANULARITIES.map(({ value, label }) => ({ value, label }))}
            />
          </FormField>
          {dateGranularity === 'full' && (
            <FormCheckbox label="Inclure la durée" checked={includeDuration} onChange={setIncludeDuration} />
          )}
        </div>
      )}

      {/* ── Onglet Config (Relation) ───────────────────────────────────────── */}
      {activeTab === 'config' && type === 'relation' && (
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
            <FormField label="Collection liée">
              <FormSelect
                value={relationTarget}
                onChange={(v) => { setRelationTarget(v); setRelationDisplayFieldIds([]); setRelationAutoHideSource(true); setRelationFilterField(''); setRelationFilterValue(''); setShowRelationFilter(false); }}
                options={[
                  { value: '', label: 'Sélectionner...' },
                  ...(collections || []).map((c: any) => ({ value: c.id, label: c.id === currentCollectionId ? `${c.name} (ici)` : c.name })),
                ]}
              />
            </FormField>

            <FormField label="Type">
              <FormSelect
                value={relationType}
                onChange={setRelationType}
                options={[
                  { value: 'one_to_one',   label: '1 : 1', icon: Icons.ArrowRight as any },
                  { value: 'one_to_many',  label: '1 : N', icon: Icons.GitBranch  as any },
                  { value: 'many_to_many', label: 'N : N', icon: Icons.GitMerge   as any },
                ]}
                className="w-24 text-xs"
              />
            </FormField>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Champs affichés</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-neutral-500">Max</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={relationMaxVisible}
                    onChange={(e) => setRelationMaxVisible(e.target.value)}
                    className="w-12 px-2 py-0.5 text-xs rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
              </div>
              {relationTarget ? (
                <LightMultiSelect
                  options={(collections.find((c: any) => c.id === relationTarget)?.properties || [])
                    .filter((p: any) => p.type !== 'relation')
                    .map((p: any) => ({ value: p.id, label: p.name }))}
                  values={relationDisplayFieldIds}
                  onChange={setRelationDisplayFieldIds}
                  placeholder="Nom de l'élément lié"
                  maxVisible={3}
                />
              ) : (
                <p className="text-xs text-neutral-400 italic">Choisir une collection d'abord</p>
              )}
            </div>
          </div>

          {relationTarget && relationDisplayFieldIds.length > 0 && (
            <FormCheckbox
              label="Masquer la colonne relation source quand des champs liés sont affichés"
              checked={relationAutoHideSource}
              onChange={setRelationAutoHideSource}
            />
          )}

          {relationTarget && (
            <div>
              <button
                type="button"
                onClick={() => setShowRelationFilter(v => !v)}
                className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
              >
                <Icons.ChevronRight size={12} className={cn('transition-transform', showRelationFilter && 'rotate-90')} />
                {showRelationFilter ? 'Masquer le filtre' : 'Filtrer les éléments liés'}
                {relationFilterField && relationFilterValue && !showRelationFilter && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] font-medium">actif</span>
                )}
              </button>
              {showRelationFilter && (
                <div className="mt-2 grid grid-cols-2 gap-3 pl-4 border-l-2 border-black/10 dark:border-white/10">
                  <FormField label="Propriété">
                    <FormSelect
                      value={relationFilterField}
                      onChange={(v) => { setRelationFilterField(v); setRelationFilterValue(''); }}
                      options={[
                        { value: '', label: 'Aucune' },
                        ...(collections.find((c: any) => c.id === relationTarget)?.properties || [])
                          .filter((p: any) => p.type !== 'relation')
                          .map((p: any) => ({ value: p.id, label: p.name })),
                      ]}
                    />
                  </FormField>
                  <FormField label="Valeur">
                    {filterProp?.type === 'select' || filterProp?.type === 'multi_select' ? (
                      <FormSelect
                        value={relationFilterValue}
                        onChange={setRelationFilterValue}
                        options={[
                          { value: '', label: 'Sélectionner...' },
                          ...(filterProp.options || []).map((opt: any) => {
                            const optValue = typeof opt === 'string' ? opt : opt.value;
                            const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);
                            return { value: optValue, label: optLabel };
                          }),
                        ]}
                      />
                    ) : filterProp?.type === 'date' || filterProp?.type === 'date_range' ? (
                      <FormSelect
                        value={relationFilterValue}
                        onChange={setRelationFilterValue}
                        options={[
                          { value: '', label: 'Sélectionner...' },
                          { value: 'today', label: "Aujourd'hui" },
                          { value: 'thisWeek', label: 'Cette semaine' },
                          { value: 'thisMonth', label: 'Ce mois' },
                          { value: 'thisYear', label: 'Cette année' },
                          { value: 'yesterday', label: 'Hier' },
                          { value: 'lastWeek', label: 'Semaine dernière' },
                          { value: 'lastMonth', label: 'Mois dernier' },
                          { value: 'future', label: 'Dates futures' },
                          { value: 'past', label: 'Dates passées' },
                        ]}
                      />
                    ) : (
                      <FormInput type="text" value={relationFilterValue} onChange={(e) => setRelationFilterValue(e.target.value)} placeholder="Ex: dev, rédac..." />
                    )}
                  </FormField>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Config (Nombre) ─────────────────────────────────────────── */}
      {activeTab === 'config' && type === 'number' && (
        <div className="space-y-4">
          <FormField label="Mode">
            <FormSelect
              value={numberMode}
              onChange={(v) => setNumberMode(v as 'classic' | 'calculated')}
              options={[
                { value: 'classic', label: 'Classique (saisie manuelle)' },
                { value: 'calculated', label: 'Calculé (formule)' },
              ]}
            />
          </FormField>

          {numberMode === 'calculated' && (
            <div className="space-y-3 rounded-lg border border-black/10 dark:border-white/10 p-3">
              <FormField label="Opération">
                <FormSelect
                  value={calculationOperation}
                  onChange={setCalculationOperation}
                  options={[
                    { value: 'add', label: 'Addition' },
                    { value: 'subtract', label: 'Soustraction' },
                    { value: 'multiply', label: 'Multiplication' },
                    { value: 'divide', label: 'Division' },
                  ]}
                />
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

      {/* ── Onglet Templates ───────────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-neutral-500">
              {defaultTemplates.length === 0 ? 'Aucun template défini.' : `${defaultTemplates.length} template${defaultTemplates.length > 1 ? 's' : ''}`}
            </p>
            <button
              type="button"
              onClick={() => {
                const newIndex = defaultTemplates.length;
                setDefaultTemplates((prev) => ([...prev, { id: `tpl_${Date.now()}`, when: { fieldId: '', value: '' }, value: '' }]));
                setSelectedTplIndex(newIndex);
              }}
              className="text-xs px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 font-medium"
            >
              + Ajouter
            </button>
          </div>

          {defaultTemplates.length > 0 && (
            <>
              {/* Barre de tabs des templates */}
              <div className="flex items-center gap-1 overflow-x-auto border-b border-black/10 dark:border-white/10 mb-3">
                {defaultTemplates.map((tpl, index) => {
                  const fieldName = templateSourceOptions.find((p: any) => p.id === tpl.when?.fieldId)?.name;
                  const label = fieldName ? fieldName : `Règle ${index + 1}`;
                  const isActive = index === selectedTplIndex;
                  return (
                    <div
                      key={tpl.id || index}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1.5 text-xs cursor-pointer whitespace-nowrap transition-colors border-b-2 -mb-px',
                        isActive
                          ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                          : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                      )}
                      onClick={() => setSelectedTplIndex(index)}
                    >
                      <span>{label}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDefaultTemplates((prev) => prev.filter((_, i) => i !== index));
                          setSelectedTplIndex((prev) => Math.min(prev, defaultTemplates.length - 2));
                        }}
                        className="ml-0.5 rounded hover:text-red-500 transition-colors"
                        title="Supprimer"
                      >
                        <Icons.X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {(() => {
                const index = Math.min(selectedTplIndex, defaultTemplates.length - 1);
                const tpl = defaultTemplates[index];
                if (!tpl) return null;
                const sourceProp = templateSourceOptions.find((p: any) => p.id === tpl.when?.fieldId);
                const sourceType = sourceProp?.type;
                const updateTemplate = (patch: any) =>
                  setDefaultTemplates((prev) => prev.map((t, i) => i === index ? { ...t, ...patch } : t));
                const updateWhen = (patch: any) =>
                  setDefaultTemplates((prev) => prev.map((t, i) => i === index ? { ...t, when: { ...(t.when || {}), ...patch } } : t));

                return (
                  <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
                    <div className="px-4 pt-4 pb-3 bg-black/[0.02] dark:bg-white/[0.02]">
                      <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-2">Condition</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <TinyLabel>Si le champ</TinyLabel>
                          <FormSelect
                            value={tpl.when?.fieldId || ''}
                            onChange={(v) => updateWhen({ fieldId: v })}
                            options={[
                              { value: '', label: 'Sélectionner...' },
                              ...templateSourceOptions.map((p: any) => ({ value: p.id, label: p.name })),
                            ]}
                          />
                        </div>
                        <div>
                          <TinyLabel>Vaut</TinyLabel>
                          {sourceType === 'select' || sourceType === 'multi_select' ? (
                            <FormSelect
                              value={tpl.when?.value ?? ''}
                              onChange={(v) => updateWhen({ value: v })}
                              options={[
                                { value: '', label: 'Sélectionner...' },
                                ...(sourceProp?.options || []).map((opt: any) => {
                                  const optValue = typeof opt === 'string' ? opt : opt.value;
                                  const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);
                                  return { value: optValue, label: optLabel };
                                }),
                              ]}
                            />
                          ) : sourceType === 'checkbox' ? (
                            <FormSelect
                              value={tpl.when?.value === true ? 'true' : tpl.when?.value === false ? 'false' : ''}
                              onChange={(v) => updateWhen({ value: v === 'true' })}
                              options={[
                                { value: '', label: 'Sélectionner...' },
                                { value: 'true', label: 'Oui' },
                                { value: 'false', label: 'Non' },
                              ]}
                            />
                          ) : sourceType === 'number' ? (
                            <FormInput type="number" value={tpl.when?.value ?? ''} onChange={(e) => updateWhen({ value: e.target.value === '' ? '' : Number(e.target.value) })} />
                          ) : (
                            <FormInput type="text" value={tpl.when?.value ?? ''} onChange={(e) => updateWhen({ value: e.target.value })} />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 border-t border-black/10 dark:border-white/10">
                      <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider block mb-2">→ Définir à</span>
                      {type === 'rich_text' ? (
                        <RichTextEditor value={tpl.value} onChange={(val) => updateTemplate({ value: val })} className="bg-gray-200 dark:bg-neutral-800/50" />
                      ) : type === 'date' || type === 'date_range' ? (
                        <div className="space-y-2">
                          <FormInput type="text" value={tpl.value ?? ''} onChange={(e) => updateTemplate({ value: e.target.value })} placeholder="Ex: {{now:month}}, {{now:year}}, {{now}}" />
                          <FormHint>Templates: <code>{'{{now:month}}'}</code>, <code>{'{{now:year}}'}</code>, <code>{'{{now}}'}</code></FormHint>
                        </div>
                      ) : type === 'relation' ? (
                        <div className="space-y-2">
                          <FormCheckbox
                            label={<><span className="text-neutral-700 dark:text-neutral-300">Groupage actuel</span><span className="text-xs text-neutral-500 ml-1">(rempli auto. si créé depuis un groupe)</span></>}
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
                        <FormSelect
                          value={tpl.value ?? ''}
                          onChange={(v) => updateTemplate({ value: v })}
                          options={[
                            { value: '', label: 'Sélectionner...' },
                            ...(options || []).map((opt: any) => {
                              const optValue = typeof opt === 'string' ? opt : opt.value;
                              const optLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);
                              return { value: optValue, label: optLabel };
                            }),
                          ]}
                        />
                      ) : type === 'checkbox' ? (
                        <FormSelect
                          value={tpl.value === true ? 'true' : tpl.value === false ? 'false' : ''}
                          onChange={(v) => updateTemplate({ value: v === 'true' })}
                          options={[
                            { value: '', label: 'Sélectionner...' },
                            { value: 'true', label: 'Coché' },
                            { value: 'false', label: 'Décoché' },
                          ]}
                        />
                      ) : (
                        <FormInput type={type === 'number' ? 'number' : 'text'} value={tpl.value ?? ''} onChange={(e) => updateTemplate({ value: type === 'number' ? Number(e.target.value) : e.target.value })} />
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ── Onglet Avancé ─────────────────────────────────────────────────── */}
      {activeTab === 'avance' && (
        <div className="space-y-3">
          <FormCheckbox label="Afficher dans le menu contextuel" checked={showContextMenu} onChange={setShowContextMenu} />
          <FormHint className="ml-6">Au clic droit sur les objets</FormHint>
        </div>
      )}
    </ModalWrapper>
  );
};

export default PropertyModal;
