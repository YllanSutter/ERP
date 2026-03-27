import React, { useState } from 'react';
import ModalWrapper, { FormField, FormInput, FormSelect, FormCheckbox } from '@/components/ui/ModalWrapper';
import { VIEW_TYPES, type TableGroupColumnCount, type TableGroupDisplayMode } from '@/components/modals/modalLib';
import { cn } from '@/lib/utils';

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
                  ? 'border-violet-500 bg-violet-500/15 text-violet-600 dark:text-violet-400'
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

        {type === 'layout' && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Vues à combiner</div>
            {layoutPanels.map((panel, idx) => (
              <div key={panel.id || idx} className="flex items-center gap-2">
                <FormSelect
                  value={panel.collectionId || collection?.id || ''}
                  onChange={(v) => {
                    const next = [...layoutPanels];
                    next[idx] = { ...next[idx], collectionId: v, viewId: '' };
                    setLayoutPanels(next);
                  }}
                  className="w-40"
                  options={[
                    { value: '', label: 'Collection…' },
                    ...collectionOptions.map((col: any) => ({ value: col.id, label: col.name })),
                  ]}
                />
                <FormSelect
                  value={panel.viewId || ''}
                  onChange={(v) => {
                    const next = [...layoutPanels];
                    next[idx] = { ...next[idx], viewId: v };
                    setLayoutPanels(next);
                  }}
                  className="flex-1"
                  options={[
                    { value: '', label: 'Choisir une vue…' },
                    ...(allViews[panel.collectionId || collection?.id || ''] || availableViews)
                      .filter((v: any) => v.type !== 'layout')
                      .map((v: any) => ({ value: v.id, label: v.name })),
                  ]}
                />
                <FormSelect
                  value={String(panel.colSpan || 6)}
                  onChange={(v) => {
                    const next = [...layoutPanels];
                    next[idx] = { ...next[idx], colSpan: Number(v) };
                    setLayoutPanels(next);
                  }}
                  className="w-20"
                  options={[3, 4, 6, 8, 12].map((n) => ({ value: String(n), label: `${n}/12` }))}
                />
                <FormSelect
                  value={String(panel.rowSpan || 2)}
                  onChange={(v) => {
                    const next = [...layoutPanels];
                    next[idx] = { ...next[idx], rowSpan: Number(v) };
                    setLayoutPanels(next);
                  }}
                  className="w-20"
                  options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n}L` }))}
                />
                <button
                  type="button"
                  onClick={() => setLayoutPanels((prev) => prev.filter((_, i) => i !== idx))}
                  className="px-2 py-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLayoutPanels((prev) => ([...prev, { id: Date.now().toString(), collectionId: collection?.id || '', viewId: '', colSpan: 6, rowSpan: 2 }]))}
              className="px-3 py-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-sm"
            >
              + Ajouter un panneau
            </button>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

export default NewViewModal;
