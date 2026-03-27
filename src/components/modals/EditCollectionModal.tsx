import React, { useState } from 'react';
import ModalWrapper, { FormField, FormCheckbox, FormHint, FormNameInput, DeleteConfirmButton } from '@/components/ui/ModalWrapper';

interface EditCollectionModalProps {
  onClose: () => void;
  onSave: (collection: any) => void;
  onDelete: (collectionId: string) => void;
  collection: any;
}

const EditCollectionModal: React.FC<EditCollectionModalProps> = ({ onClose, onSave, onDelete, collection }) => {
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

  const handleSave = () => {
    const props = collection.properties || [];
    const normalizedDefaultVisible = defaultVisibleFieldIds.length
      ? defaultVisibleFieldIds
      : (props[0] ? [props[0].id] : []);
    onSave({ ...collection, name, icon, color, isPrimary, defaultVisibleFieldIds: normalizedDefaultVisible });
  };

  return (
    <ModalWrapper
      title="Modifier la collection"
      onClose={onClose}
      onSave={handleSave}
      extraActions={<DeleteConfirmButton onDelete={() => onDelete(collection.id)} title="Supprimer la collection" />}
    >
      <div className="space-y-6">
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
      </div>
    </ModalWrapper>
  );
};

export default EditCollectionModal;
