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
  const [showIconPopover, setShowIconPopover] = useState(false);
  const [showColorPopover, setShowColorPopover] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = () => {
    const updatedCollection = {
      ...collection,
      name,
      icon,
      color,
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl p-8 w-[500px] max-h-[90vh] overflow-y-auto backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Modifier la collection</h3>
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Nom</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full px-4 py-2 bg-gray-300 dark:bg-neutral-800/50 borderborder-black/10 dark:border-white/10  rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Icône et couleur</label>
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
