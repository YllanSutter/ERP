import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import * as Icons from 'lucide-react';
import ModalWrapper, { FormField, FormInput, FormCheckbox, FormHint } from '@/components/ui/ModalWrapper';
import IconPicker from '@/components/inputs/IconPicker';
import ColorPicker from '@/components/inputs/ColorPicker';

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
  const [showIconPopover, setShowIconPopover] = useState(false);
  const [showColorPopover, setShowColorPopover] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = () => {
    const props = collection.properties || [];
    const normalizedDefaultVisible = defaultVisibleFieldIds.length
      ? defaultVisibleFieldIds
      : (props[0] ? [props[0].id] : []);
    onSave({ ...collection, name, icon, color, isPrimary, defaultVisibleFieldIds: normalizedDefaultVisible });
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(collection.id);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const deleteActions = (
    <>
      {showDeleteConfirm && (
        <button
          onClick={() => setShowDeleteConfirm(false)}
          className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg"
        >
          Confirmer suppression ?
        </button>
      )}
      <button
        onClick={handleDelete}
        className={`px-4 py-2 rounded-lg transition-colors ${
          showDeleteConfirm
            ? 'bg-red-600/80 hover:bg-red-600 text-white'
            : 'bg-white/5 hover:bg-white/10'
        }`}
        title="Supprimer la collection"
      >
        <Trash2 size={18} />
      </button>
    </>
  );

  return (
    <ModalWrapper
      title="Modifier la collection"
      onClose={onClose}
      onSave={handleSave}
      extraActions={deleteActions}
    >
      <div className="space-y-6">
        <FormField label="Nom">
          <FormInput value={name} onChange={(e) => setName(e.target.value)} />
          <FormCheckbox
            label="Collection principale"
            checked={isPrimary}
            onChange={setIsPrimary}
            className="mt-4"
          />
          <FormHint className="mt-1">Utilisée en priorité pour les créations rapides (ex: clic droit calendrier).</FormHint>
        </FormField>

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

        <FormField label="Icône et couleur">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowIconPopover((v) => !v)}
                className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-300"
                title="Choisir une icône"
              >
                {(Icons as any)[icon] ? React.createElement((Icons as any)[icon], { size: 20 }) : <Icons.Database size={20} />}
              </button>
              {showIconPopover && (
                <div className="absolute z-[150] mt-2 w-[320px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                  <IconPicker value={icon} onChange={(val) => { setIcon(val); setShowIconPopover(false); }} mode="all" />
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColorPopover((v) => !v)}
                className="w-12 h-12 rounded-lg border border-white/10"
                style={{ backgroundColor: color }}
                title="Choisir une couleur"
              />
              {showColorPopover && (
                <div className="absolute z-[150] mt-2 w-[320px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                  <ColorPicker value={color} onChange={setColor} />
                </div>
              )}
            </div>
          </div>
        </FormField>
      </div>
    </ModalWrapper>
  );
};

export default EditCollectionModal;
