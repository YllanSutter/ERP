import React, { useState } from 'react';
import ModalWrapper, { FormField, FormCheckbox, FormHint, FormInput, FormNameInput, DeleteConfirmButton } from '@/components/ui/ModalWrapper';

interface EditCollectionModalProps {
  onClose: () => void;
  onSave: (collection: any) => void;
  onDelete: (collectionId: string) => void;
  collection: any;
  renderPluginSettings?: (collection: any, onChange: (changes: any) => void) => React.ReactNode;
}

const EditCollectionModal: React.FC<EditCollectionModalProps> = ({ onClose, onSave, onDelete, collection, renderPluginSettings }) => {
  const [pluginChanges, setPluginChanges] = useState<Record<string, any>>({});
  const [name, setName] = useState(collection.name);
  const [icon, setIcon] = useState(collection.icon || 'Database');
  const [color, setColor] = useState(collection.color || '#8b5cf6');
  const [isPrimary, setIsPrimary] = useState(!!collection.isPrimary);
  const [defaultVisibleFieldIds, setDefaultVisibleFieldIds] = useState<string[]>(() => {
    const props = collection.properties || [];
    if (Array.isArray(collection.defaultVisibleFieldIds) && collection.defaultVisibleFieldIds.length) {
      return collection.defaultVisibleFieldIds;
    }
    return props[0] ? [props[0].id] : [];
  });
  const [collectionTemplates, setCollectionTemplates] = useState<any[]>(() =>
    Array.isArray(collection.collectionTemplates) ? collection.collectionTemplates : []
  );

  const handleSave = () => {
    const props = collection.properties || [];
    const normalizedDefaultVisible = defaultVisibleFieldIds.length
      ? defaultVisibleFieldIds
      : (props[0] ? [props[0].id] : []);
    onSave({ ...collection, ...pluginChanges, name, icon, color, isPrimary, defaultVisibleFieldIds: normalizedDefaultVisible, collectionTemplates });
  };

  const updateTemplate = (index: number, changes: Record<string, any>) => {
    setCollectionTemplates(previous => previous.map((template, templateIndex) =>
      templateIndex === index ? { ...template, ...changes } : template
    ));
  };

  return (
    <ModalWrapper
      title="Modifier la collection"
      onClose={onClose}
      onSave={handleSave}
      extraActions={<DeleteConfirmButton onDelete={() => onDelete(collection.id)} title="Supprimer la collection" />}
    >
      <div className="space-y-6">
        {renderPluginSettings?.({ ...collection, ...pluginChanges }, changes => setPluginChanges(prev => ({ ...prev, ...changes })))}
        <FormNameInput
          label="Nom"
          value={name}
          onChange={setName}
          icon={icon}
          onIconChange={setIcon}
          color={color}
          onColorChange={setColor}
          placeholder="Nom de la collection"
        />
        <div>
          <FormCheckbox
            label="Collection principale"
            checked={isPrimary}
            onChange={setIsPrimary}
          />
          <FormHint className="mt-1 ml-6">Utilisée en priorité pour les créations rapides (ex: clic droit calendrier).</FormHint>
        </div>

        <FormField
          label="Champs visibles par défaut"
          hint="Ces champs seront visibles lors de la création d'une nouvelle vue."
        >
          <div className="space-y-2 max-h-48 overflow-auto rounded-lg border border-black/10 dark:border-white/10 p-3">
            {(collection.properties || []).map((prop: any, idx: number) => (
              <FormCheckbox
                key={prop.id}
                label={<>{prop.name}{idx === 0 && <span className="text-xs text-neutral-500 ml-1">(par défaut)</span>}</>}
                checked={defaultVisibleFieldIds.includes(prop.id)}
                onChange={(checked) => {
                  const next = checked
                    ? Array.from(new Set([...defaultVisibleFieldIds, prop.id]))
                    : defaultVisibleFieldIds.filter((id) => id !== prop.id);
                  setDefaultVisibleFieldIds(next.length ? next : (collection.properties?.[0] ? [collection.properties[0].id] : []));
                }}
              />
            ))}
            {(collection.properties || []).length === 0 && (
              <div className="text-xs text-neutral-500">Aucun champ.</div>
            )}
          </div>
        </FormField>

        <FormField
          label="Templates de collection"
          hint="Un template choisit les champs affichés à la création et peut préremplir leurs valeurs."
        >
          <div className="space-y-3">
            {collectionTemplates.map((template, index) => {
              const fieldIds = Array.isArray(template.fieldIds) ? template.fieldIds : [];
              const values = template.values && typeof template.values === 'object' ? template.values : {};
              return (
                <div key={template.id || index} className="rounded-lg border border-black/10 dark:border-white/10 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <FormInput
                      aria-label={`Nom du template ${index + 1}`}
                      value={template.name || ''}
                      placeholder={`Template ${index + 1}`}
                      onChange={event => updateTemplate(index, { name: event.target.value })}
                    />
                    <button type="button" className="text-xs text-red-500 hover:text-red-600" onClick={() => setCollectionTemplates(previous => previous.filter((_, i) => i !== index))}>
                      Supprimer
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-auto rounded-md bg-black/[0.02] dark:bg-white/[0.02] p-2">
                    {(collection.properties || []).map((prop: any) => {
                      const included = fieldIds.includes(prop.id);
                      return (
                        <div key={prop.id} className="space-y-1">
                          <FormCheckbox
                            label={prop.name}
                            checked={included}
                            onChange={checked => {
                              const nextFieldIds = checked
                                ? [...new Set([...fieldIds, prop.id])]
                                : fieldIds.filter((id: string) => id !== prop.id);
                              updateTemplate(index, { fieldIds: nextFieldIds });
                            }}
                          />
                          {included && (
                            <FormInput
                              aria-label={`Valeur par défaut pour ${prop.name} dans ${template.name || `Template ${index + 1}`}`}
                              value={values[prop.id] ?? ''}
                              placeholder="Valeur par défaut (facultatif)"
                              onChange={event => updateTemplate(index, { values: { ...values, [prop.id]: event.target.value } })}
                              className="ml-6 w-[calc(100%-1.5rem)]"
                            />
                          )}
                        </div>
                      );
                    })}
                    {(collection.properties || []).length === 0 && <div className="text-xs text-neutral-500">Ajoute d’abord des champs à cette collection.</div>}
                  </div>
                  <FormHint>Les champs cochés seront affichés. Valeurs multiples séparées par des virgules ; pour une date, utilise « current_date » ou une date ISO.</FormHint>
                </div>
              );
            })}
            <button
              type="button"
              className="w-full rounded-md border border-dashed border-black/20 dark:border-white/20 px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => setCollectionTemplates(previous => [...previous, { id: `collection_tpl_${Date.now()}`, name: '', fieldIds: [], values: {} }])}
            >
              + Ajouter un template
            </button>
          </div>
        </FormField>
      </div>
    </ModalWrapper>
  );
};

export default EditCollectionModal;
