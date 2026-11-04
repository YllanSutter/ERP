import React, { useState } from 'react';
import ModalWrapper, { FormField, FormInput, FormSelect, FormCheckbox } from '@/components/ui/ModalWrapper';
import { VIEW_TYPES, type TableGroupColumnCount, type TableGroupDisplayMode } from '@/components/modals/modalLib';
import { cn } from '@/lib/utils';
import LayoutPanelsEditor from '@/components/views/LayoutPanelsEditor';

interface NewViewModalProps {
  onClose: () => void;
  onSave: (name: any, type?: string, config?: any) => void;
  collection: any;
  view?: any;
  mode?: 'create' | 'edit';
  availableViews?: any[];
  collections?: any[];
  allViews?: Record<string, any[]>;
}

const NewViewModal: React.FC<NewViewModalProps> = ({
  onClose,
  onSave,
  collection,
  view,
  mode = 'create',
  availableViews = [],
  collections = [],
  allViews = {}
}) => {
  const [name, setName] = useState(view?.name || '');
  const [type, setType] = useState(view?.type || 'table');
  const [groupBy, setGroupBy] = useState(view?.groupBy || '');
  const [dateProperty] = useState(view?.dateProperty || '');
  const [cardStyleFieldId, setCardStyleFieldId] = useState(view?.cardStyleFieldId || '');
  const [kanbanShowFieldsOnHover, setKanbanShowFieldsOnHover] = useState<boolean>(
    Boolean(view?.kanbanShowFieldsOnHover)
  );
  const [groupDisplayMode, setGroupDisplayMode] = useState<TableGroupDisplayMode>(
    view?.groupDisplayMode || 'accordion'
  );
  const [groupDisplayColumnCount, setGroupDisplayColumnCount] = useState<TableGroupColumnCount>(
    view?.groupDisplayColumnCount === 1 || view?.groupDisplayColumnCount === 2 || view?.groupDisplayColumnCount === 3
      ? view.groupDisplayColumnCount
      : 3
  );
  const [layoutPanels, setLayoutPanels] = useState<any[]>(() => Array.isArray(view?.layoutPanels) ? view.layoutPanels : []);

  const selectProps = collection?.properties.filter((p: any) => p.type === 'select') || [];
  const collectionOptions = collections.length ? collections : (collection ? [collection] : []);

  const handleSave = () => {
    const props = collection?.properties || [];
    const defaultVisibleFieldIds = Array.isArray(collection?.defaultVisibleFieldIds)
      ? collection.defaultVisibleFieldIds
      : (props[0] ? [props[0].id] : []);
    const defaultHiddenFields = props.filter((p: any) => !defaultVisibleFieldIds.includes(p.id)).map((p: any) => p.id);
    const config: any = { name, type };
    if (mode === 'create') config.hiddenFields = defaultHiddenFields;
    if (type === 'table') {
      config.groupDisplayMode = groupDisplayMode;
      config.groupDisplayColumnCount = groupDisplayColumnCount;
    }
    if (type === 'kanban') {
      if (groupBy) config.groupBy = groupBy;
      config.kanbanShowFieldsOnHover = kanbanShowFieldsOnHover;
    }
    if (type === 'steamcards') config.cardStyleFieldId = cardStyleFieldId;
    if (type === 'calendar' && dateProperty) config.dateProperty = dateProperty;
    if (type === 'layout') config.layoutPanels = layoutPanels;
    if (mode === 'edit') {
      onSave({ ...config, name, type } as any);
      return;
    }
    onSave(name, type, config);
  };

  return (
    <ModalWrapper
      title={mode === 'edit' ? 'Modifier la vue' : 'Nouvelle vue'}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={mode === 'edit' ? 'Enregistrer' : 'Créer'}
      size="sm"
    >
      <div className="space-y-4">
        <FormInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la vue" />

        <div className="grid grid-cols-2 gap-2">
          {VIEW_TYPES.map(vt => (
            <button
              key={vt.value}
              onClick={() => setType(vt.value)}
              className={cn(
                'flex flex-col items-center gap-2 px-4 py-4 rounded-xl border transition-all',
                type === vt.value
                  ? 'border-brand-500 bg-brand-500/15 text-brand-600 dark:text-brand-400'
                  : 'border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20 text-neutral-500 dark:text-neutral-400'
              )}
            >
              <vt.icon size={22} />
              <span className="text-sm font-medium text-neutral-700 dark:text-white">{vt.label}</span>
            </button>
          ))}
        </div>

        {type === 'table' && (
          <FormField label="Affichage du groupage" hint="S'applique quand la vue tableau utilise au moins un groupage.">
            <FormSelect
              value={groupDisplayMode}
              onChange={(v) => setGroupDisplayMode(v as TableGroupDisplayMode)}
              options={[
                { value: 'accordion', label: 'Chevrons' },
                { value: 'columns',   label: 'Colonnes' },
                { value: 'tabs',      label: 'Onglets' },
              ]}
            />
            {groupDisplayMode === 'columns' && (
              <div className="mt-3">
                <FormSelect
                  value={String(groupDisplayColumnCount)}
                  onChange={(v) => setGroupDisplayColumnCount(Number(v) as TableGroupColumnCount)}
                  options={[
                    { value: '1', label: '1 colonne' },
                    { value: '2', label: '2 colonnes' },
                    { value: '3', label: '3 colonnes' },
                  ]}
                />
              </div>
            )}
          </FormField>
        )}

        {type === 'steamcards' && (
          <FormField label="Couleur et icône des cartes" hint="Chaque carte prend la couleur et l'icône de son option dans ce champ.">
            <FormSelect
              value={cardStyleFieldId}
              onChange={setCardStyleFieldId}
              options={[
                { value: '', label: 'Aucun (orange par défaut)' },
                ...(collection?.properties || [])
                  .filter((p: any) => ['select', 'multiselect', 'multi_select'].includes(p.type))
                  .map((prop: any) => ({ value: prop.id, label: prop.name })),
              ]}
            />
          </FormField>
        )}

        {type === 'kanban' && selectProps.length > 0 && (
          <FormField label="Grouper par">
            <FormSelect
              value={groupBy}
              onChange={setGroupBy}
              options={[
                { value: '', label: 'Sélectionner une propriété...' },
                ...selectProps.map((prop: any) => ({ value: prop.id, label: prop.name })),
              ]}
            />
            <FormCheckbox
              label="Afficher les champs des cartes seulement au survol"
              checked={kanbanShowFieldsOnHover}
              onChange={setKanbanShowFieldsOnHover}
              className="mt-3"
            />
          </FormField>
        )}

        {type === 'layout' && <LayoutPanelsEditor panels={layoutPanels} onChange={setLayoutPanels} collection={collection} collections={collectionOptions} views={allViews} availableViews={availableViews} />}
      </div>
    </ModalWrapper>
  );
};

export default NewViewModal;
