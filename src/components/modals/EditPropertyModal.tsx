import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ShinyButton';
import OptionListEditor from '@/components/OptionListEditor';
import IconPicker from '@/components/IconPicker';
import ColorPicker from '@/components/ColorPicker';
import { OptionType } from '@/components/inputs/LightSelect';

interface EditPropertyModalProps {
  onClose: () => void;
  onSave: (property: any) => void;
  property: any;
}

const EditPropertyModal: React.FC<EditPropertyModalProps> = ({ onClose, onSave, property }) => {
  const [name, setName] = useState(property.name);
  const [icon, setIcon] = useState(property.icon || 'Tag');
  const [color, setColor] = useState(property.color || '#8b5cf6');
  const [options, setOptions] = useState<OptionType[]>(property.options || []);

  const handleSave = () => {
    const updatedProperty: any = {
      ...property,
      name,
      icon,
      color
    };
    if (property.type === 'select' || property.type === 'multi_select') {
      updatedProperty.options = options;
    }
    onSave(updatedProperty);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[500px] max-h-[90vh] overflow-y-auto backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Modifier la propriété</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Nom</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-3">Icône</label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-3">Couleur</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          {(property.type === 'select' || property.type === 'multi_select') && (
            <OptionListEditor options={options} onChange={setOptions} />
          )}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={handleSave} className="flex-1">Enregistrer</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default EditPropertyModal;
