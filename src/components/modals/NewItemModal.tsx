import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import EditableProperty from '@/components/fields/EditableProperty';
import { cn } from '@/lib/utils';

interface NewItemModalProps {
  collection: any;
  onClose: () => void;
  onSave: (item: any) => void;
  editingItem: any;
  collections: any[];
  favorites?: { views: string[]; items: string[] };
  onToggleFavoriteItem?: (itemId: string) => void;
}

const NewItemModal: React.FC<NewItemModalProps> = ({ 
  collection, 
  onClose, 
  onSave, 
  editingItem, 
  collections,
  favorites,
  onToggleFavoriteItem
}) => {
  const [formData, setFormData] = useState(editingItem || {});
  const handleChange = (propId: string, value: any) => {
    setFormData({ ...formData, [propId]: value });
  };

  const isFavorite = favorites && editingItem ? favorites.items.includes(editingItem.id) : false;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[600px] max-h-[80vh] overflow-y-auto backdrop-blur">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">{editingItem ? 'Modifier' : 'Nouveau'} {collection.name}</h3>
          {editingItem && onToggleFavoriteItem && (
            <button
              onClick={() => onToggleFavoriteItem(editingItem.id)}
              className={cn(
                "p-2 rounded-lg transition-all",
                isFavorite 
                  ? "text-yellow-500 hover:text-yellow-400 bg-yellow-500/10" 
                  : "text-neutral-500 hover:text-yellow-500 hover:bg-yellow-500/10"
              )}
              title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            >
              <Star size={20} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          )}
        </div>
        <div className="space-y-4">
          {collection.properties.map((prop: any) => (
            <div key={prop.id}>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                {prop.name} {prop.required && <span className="text-red-500">*</span>}
              </label>
              <EditableProperty
                property={prop}
                value={formData[prop.id]}
                onChange={(val) => handleChange(prop.id, val)}
                size="md"
                collections={collections}
                currentItem={formData}
                onRelationChange={(property, item, value) => {
                  handleChange(property.id, value);
                }}
                readOnly={false}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={() => onSave(formData)} className="flex-1">{editingItem ? 'Modifier' : 'Créer'}</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default NewItemModal;
