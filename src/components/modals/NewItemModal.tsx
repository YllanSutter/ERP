import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ShinyButton';
import EditableProperty from '@/components/EditableProperty';

interface NewItemModalProps {
  collection: any;
  onClose: () => void;
  onSave: (item: any) => void;
  editingItem: any;
  collections: any[];
}

const NewItemModal: React.FC<NewItemModalProps> = ({ collection, onClose, onSave, editingItem, collections }) => {
  const [formData, setFormData] = useState(editingItem || {});
  const handleChange = (propId: string, value: any) => {
    setFormData({ ...formData, [propId]: value });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[600px] max-h-[80vh] overflow-y-auto backdrop-blur">
        <h3 className="text-xl font-bold mb-6">{editingItem ? 'Modifier' : 'Nouveau'} {collection.name}</h3>
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
