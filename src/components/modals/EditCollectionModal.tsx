import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import IconPicker from '@/components/inputs/IconPicker';
import ColorPicker from '@/components/inputs/ColorPicker';
import * as Icons from 'lucide-react';

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
    const updatedCollection = {
      ...collection,
      name,
      icon,
      color,
      isPrimary,
      defaultVisibleFieldIds: normalizedDefaultVisible,
    };
    onSave(updatedCollection);
  };

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(collection.id);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  return (
     <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl p-8 min-w-96 max-h-[80vh] overflow-y-auto backdrop-blur" onClick={e => e.stopPropagation()} >
        <h3 className="text-xl font-bold mb-6">Modifier la collection</h3>
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-300 mb-2">Nom</label>

              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-4 py-2 bg-gray-300 dark:bg-neutral-800/50 borderborder-black/10 dark:border-white/10  rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none" 
              />
              <label className="mt-4 flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                  type="checkbox"
                  className="accent-violet-500"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                />
                <span>Collection principale</span>
              </label>
              <p className="text-xs text-neutral-500 mt-1">Utilisée en priorité pour les créations rapides (ex: clic droit calendrier).</p>
          <div>
            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-300 mt-4 mb-2">Champs visibles par défaut</label>
            <p className="text-xs text-neutral-500 mb-3">Ces champs seront visibles lors de la création d'une nouvelle vue.</p>
            <div className="space-y-2 max-h-48 overflow-auto rounded-lg border border-black/10 dark:border-white/10 p-3">
              {(collection.properties || []).map((prop: any, idx: number) => {
                const checked = defaultVisibleFieldIds.includes(prop.id);
                return (
                  <label key={prop.id} className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <input
                      type="checkbox"
                      className="accent-violet-500"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? Array.from(new Set([...defaultVisibleFieldIds, prop.id]))
                          : defaultVisibleFieldIds.filter((id) => id !== prop.id);
                        setDefaultVisibleFieldIds(next.length ? next : (collection.properties?.[0] ? [collection.properties[0].id] : []));
                      }}
                    />
                    <span>{prop.name}</span>
                    {idx === 0 && <span className="text-xs text-neutral-500">(par défaut)</span>}
                  </label>
                );
              })}
              {(collection.properties || []).length === 0 && (
                <div className="text-xs text-neutral-500">Aucun champ.</div>
              )}
            </div>
          </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-300 mb-2">Icône et couleur</label>
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
                    <div className="absolute z-[1200] mt-2 w-[320px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
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
                    <div className="absolute z-[1200] mt-2 w-[320px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                      <ColorPicker value={color} onChange={(val) => { setColor(val); setShowColorPopover(false); }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg">Annuler</button>
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
          <ShinyButton onClick={handleSave} className="flex-1">Enregistrer</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default EditCollectionModal;
