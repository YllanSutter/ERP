import { ImageField } from '@/components/fields/ImageField';
import { normalizeImageField } from '@/lib/itemImages';
import React, { useEffect, useState } from 'react';
import { FormField, FormInput, FormSelect, FormHint, FormCheckbox, FormNameInput, BUILTIN_PROPERTY_TYPES } from '@/components/ui/ModalWrapper';
import OptionListEditor from '@/components/inputs/OptionListEditor';
import * as Icons from 'lucide-react';
import { OptionType } from '@/components/inputs/LightSelect';
import EditableProperty from '@/components/fields/EditableProperty';
import FilterOptionPicker from '@/components/filters/FilterOptionPicker';
import { cn } from '@/lib/utils';
import { DATE_GRANULARITIES, getPluginPropertyTypeOptions } from '@/components/modals/modalLib';
import { useAuth } from '@/auth/AuthProvider';
import { getSelectionLimit } from '@/lib/utils/selectionLimit';
import { SettingsSheet, SettingsTabs, SettingsTabContent, SettingsFooter, SettingsLabel } from '@/components/ui/settings-panel';
import { Button } from '@/components/ui/button';

const LazyRichTextEditor = React.lazy(() => import('@/components/fields/RichTextEditor'));

interface PropertyModalProps {
  nested?: boolean;
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
  multiselect: 'Options',
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
  currentCollectionId,
  nested = false
}) => {
  const { activeOrganizationId } = useAuth();
  const isEditing = !!property;

  const [imageMaxWidth, setImageMaxWidth] = useState(String(property?.imageDisplay?.maxWidth || ''));
  const [imageMaxHeight, setImageMaxHeight] = useState(String(property?.imageDisplay?.maxHeight || ''));
  const [imageFit, setImageFit] = useState(property?.imageDisplay?.fit || 'contain');
  const [defaultImage, setDefaultImage] = useState(property?.defaultImage || null);
  const [name, setName] = useState(property?.name || '');
  const [type, setType] = useState(property?.type || 'text');
  const [icon, setIcon] = useState(property?.icon || 'Tag');
  const [color, setColor] = useState(property?.color || '#8b5cf6');
  const [maxValues, setMaxValues] = useState(property?.maxValues != null ? String(property.maxValues) : '');
  const [options, setOptions] = useState<OptionType[]>(property?.options || []);
  const [relationTarget, setRelationTarget] = useState(property?.relation?.targetCollectionId || '');
  const [relationType, setRelationType] = useState((property?.relation?.type || 'many_to_many').replace(/-/g, '_'));
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
  const [activeTab, setActiveTab] = useState<string>(isEditing && TYPE_CONFIG_LABEL[property?.type] ? 'config' : 'infos');

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
    { id: 'infos', label: 'Général', Icon: Icons.SlidersHorizontal },
    ...(configLabel ? [{ id: 'config', label: configLabel, Icon: Icons.ListChecks }] : []),
    ...(type !== 'image' ? [{ id: 'templates', label: 'Valeurs par défaut', Icon: Icons.WandSparkles }] : []),
  ];

  // Si on change de type et que l'onglet 'config' disparaît, revenir sur 'infos'
  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (newType === 'image' && icon === 'Tag') setIcon('Image');
    if ((activeTab === 'config' && !TYPE_CONFIG_LABEL[newType]) || (activeTab === 'templates' && newType === 'image')) {
      setActiveTab('infos');
    }
  };

  const supportsValueLimit = ['multi_select', 'multiselect', 'relation'].includes(type);
  const singleRelation = type === 'relation' && !['one_to_many', 'many_to_many'].includes(relationType);
  const effectiveMaxValues = singleRelation ? '1' : maxValues;
  const selectionLimit = getSelectionLimit(effectiveMaxValues);
  const validSelectionLimit = !supportsValueLimit || effectiveMaxValues === '' || selectionLimit !== undefined;
  const valueLimitField = supportsValueLimit && (
    <FormField label={type === 'relation' ? 'Nombre maximum de liens' : 'Nombre maximum de valeurs'}
      hint={singleRelation ? 'Une relation simple permet un seul lien.' : 'Vide pour illimité. Avec 1, un nouveau choix remplace le précédent.'}>
      <FormInput type="number" aria-label={type === 'relation' ? 'Nombre maximum de liens' : 'Nombre maximum de valeurs'}
        min={1} step={1} value={effectiveMaxValues} disabled={singleRelation}
        placeholder="Illimité" onChange={(event) => setMaxValues(event.target.value)} />
      {!validSelectionLimit && <FormHint>Choisis un nombre entier supérieur ou égal à 1.</FormHint>}
    </FormField>
  );

  const handleSave = () => {
    if (!validSelectionLimit) return;
    if (!name.trim()) {
      alert('Le nom de la propriété est requis');
      return;
    }

    const savedProperty: any = isEditing ? { ...property } : {};
    savedProperty.name = name;
    savedProperty.type = type;
    savedProperty.icon = icon;
    savedProperty.color = color;
    if (type === 'image') {
      savedProperty.imageDisplay = { fit: imageFit,
        ...(Number(imageMaxWidth) > 0 ? { maxWidth: Number(imageMaxWidth) } : {}),
        ...(Number(imageMaxHeight) > 0 ? { maxHeight: Number(imageMaxHeight) } : {}),
      };
    } else delete savedProperty.imageDisplay;
    if (type === 'image' && normalizeImageField(defaultImage).images.length) savedProperty.defaultImage = defaultImage;
    else delete savedProperty.defaultImage;
    savedProperty.showContextMenu = showContextMenu;
    savedProperty.defaultTemplates = defaultTemplates;
    if (supportsValueLimit && selectionLimit !== undefined) savedProperty.maxValues = selectionLimit;
    else delete savedProperty.maxValues;

    if (type === 'date' || type === 'date_range') {
      savedProperty.dateGranularity = dateGranularity;
      savedProperty.includeDuration = includeDuration;
    } else {
      delete savedProperty.dateGranularity;
      delete savedProperty.includeDuration;
    }

    if (type === 'select' || type === 'multi_select' || type === 'multiselect') {
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

  const TinyLabel = SettingsLabel;

  return (
    <SettingsSheet open wide nested={nested} onOpenChange={(open) => { if (!open) onClose(); }}
      title={isEditing ? 'Modifier la propriété' : 'Nouvelle propriété'}
      description={name.trim() || 'Configure le champ et ses valeurs.'}>
        <SettingsTabs value={activeTab} onValueChange={setActiveTab}
          items={tabs.map(({ id, label, Icon }) => ({ id, label, icon: Icon }))}>
          <SettingsTabContent value={activeTab} scrollable>
      {/* ── Onglet Infos ───────────────────────────────────────────────────── */}
      {activeTab === 'infos' && (
        <div className="space-y-4">
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

          <FormField label="Type de champ">
            <FormSelect value={type} onChange={handleTypeChange}
              options={[
                ...BUILTIN_PROPERTY_TYPES.map(({ value, label, icon }) => ({ value, label, icon })),
                ...(type === 'multiselect' ? [{ value: 'multiselect', label: 'Multisélection', icon: Icons.ListChecks }] : []),
                ...Object.entries(pluginPropertyTypeLabels).map(([value, label]) => ({ value, label })),
              ]} />
          </FormField>
        </div>
      )}

      {activeTab === 'infos' && type === 'image' && (
        <div className="space-y-4 border-t border-border pt-4 mt-4">
          <FormField label="Image par défaut" hint="Affichée quand l’objet n’a aucune image. L’étoile choisit l’image principale.">
            <ImageField value={defaultImage} onChange={setDefaultImage} name="Image par défaut" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Largeur maximale (px)" hint="Vide : toute la largeur disponible.">
              <FormInput type="number" min={1} step={1} value={imageMaxWidth} placeholder="Automatique" onChange={event => setImageMaxWidth(event.target.value)} />
            </FormField>
            <FormField label="Hauteur maximale (px)" hint="Vide : hauteur naturelle.">
              <FormInput type="number" min={1} step={1} value={imageMaxHeight} placeholder="Automatique" onChange={event => setImageMaxHeight(event.target.value)} />
            </FormField>
          </div>
          <FormField label="Cadrage de la bannière">
            <FormSelect value={imageFit} onChange={setImageFit} options={[
              { value: 'contain', label: 'Contenir : image entière' },
              { value: 'cover', label: 'Couvrir : remplir et recadrer' },
              { value: 'fill', label: 'Étirer' },
              { value: 'none', label: 'Taille originale' },
              { value: 'scale-down', label: 'Réduire seulement' },
            ]} />
          </FormField>
        </div>
      )}

      {/* ── Onglet Config (Select / Multi-select) ──────────────────────────── */}
      {activeTab === 'config' && (type === 'select' || type === 'multi_select' || type === 'multiselect') && (
        <div className="space-y-4">
          {valueLimitField}
          <OptionListEditor options={options} onChange={setOptions} />
        </div>
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
          <section className="grid gap-3 sm:grid-cols-2" aria-label="Relation">
            <FormField label="Collection liée">
              <FormSelect value={relationTarget}
                onChange={(value) => { setRelationTarget(value); setRelationDisplayFieldIds([]); setRelationAutoHideSource(true); setRelationFilterField(''); setRelationFilterValue(''); setShowRelationFilter(false); }}
                options={[
                  { value: '', label: 'Choisir une collection' },
                  ...collections.map((collection: any) => ({ value: collection.id, label: collection.id === currentCollectionId ? `${collection.name} (ici)` : collection.name })),
                ]} />
            </FormField>
            <FormField label="Type de relation">
              <FormSelect value={relationType} onChange={setRelationType}
                options={[
                  { value: 'one_to_one', label: 'Un seul élément (1 : 1)', icon: Icons.ArrowRight as any },
                  { value: 'many_to_one', label: 'Un seul élément (N : 1)', icon: Icons.ArrowRight as any },
                  { value: 'one_to_many', label: 'Plusieurs éléments (1 : N)', icon: Icons.GitBranch as any },
                  { value: 'many_to_many', label: 'Plusieurs éléments (N : N)', icon: Icons.GitMerge as any },
                ]} />
            </FormField>
          </section>
          <section className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2" aria-label="Sélection et affichage">
            {valueLimitField}
            <FormField label="Nombre de liens visibles" hint="Limite l’affichage des liens dans les vues.">
              <FormInput type="number" aria-label="Nombre de liens visibles" min={1} step={1}
                value={relationMaxVisible} placeholder="Tous"
                onChange={(event) => setRelationMaxVisible(event.target.value)} />
            </FormField>
          </section>
          <section className="space-y-3 border-t border-border pt-4" aria-label="Champs des éléments liés">
            <FormField label="Champs affichés sur les éléments liés">
              {relationTarget ? (
                <FilterOptionPicker multiple label="Champs affichés sur les éléments liés" options={(targetCollection?.properties ?? [])
                  .filter((field: any) => field.type !== 'relation')
                  .map((field: any) => ({ value: field.id, label: field.name }))}
                  values={relationDisplayFieldIds} onChange={setRelationDisplayFieldIds}
                  placeholder="Nom de l’élément" />
              ) : <p className="text-xs text-muted-foreground">Choisis d’abord une collection liée.</p>}
            </FormField>
          </section>

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
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 text-[10px] font-medium">actif</span>
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
                <FilterOptionPicker multiple label="Colonnes sources"
                  options={availableNumberFields.map((p: any) => ({ value: p.id, label: p.name }))}
                  values={calculationFieldIds}
                  onChange={setCalculationFieldIds}
                  placeholder="Sélectionner les colonnes nombres"
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
      {(activeTab === 'templates' || (type === 'image' && activeTab === 'infos')) && (
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
                          ? 'border-brand-500 text-brand-600 dark:text-brand-400'
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
                      <span className="text-[10px] font-semibold text-brand-400 uppercase tracking-wider block mb-2">→ Définir à</span>
                      {type === 'rich_text' ? (
                        <React.Suspense fallback={<div className="text-xs text-neutral-500 py-2">Chargement de l’éditeur…</div>}>
                          <LazyRichTextEditor value={tpl.value} onChange={(val) => updateTemplate({ value: val })} className="bg-gray-200 dark:bg-neutral-800/50" />
                        </React.Suspense>
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
                      ) : type === 'select' || type === 'multi_select' || type === 'multiselect' ? (
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
      {activeTab === 'infos' && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <FormCheckbox label="Afficher dans le menu contextuel" checked={showContextMenu} onChange={setShowContextMenu} />
          <FormHint className="ml-6">Au clic droit sur les objets</FormHint>
        </div>
      )}
          </SettingsTabContent>
        </SettingsTabs>
        <SettingsFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Annuler</Button>
          <Button type="button" size="sm" disabled={!name.trim() || !validSelectionLimit} onClick={handleSave}>
            {isEditing ? 'Enregistrer' : 'Créer la propriété'}
          </Button>
        </SettingsFooter>
    </SettingsSheet>
  );
};

export default PropertyModal;
