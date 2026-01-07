import React, { useState } from 'react';
import { motion } from 'framer-motion';
import IconPicker from '@/components/IconPicker';
import ColorPicker from '@/components/ColorPicker';
import ShinyButton from '@/components/ShinyButton';

interface NewCollectionModalProps {
  onClose: () => void;
  onSave: (name: string, icon: string, color: string) => void;
}

const NewCollectionModal: React.FC<NewCollectionModalProps> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Folder');
  const [color, setColor] = useState('#8b5cf6');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[500px] max-h-[90vh] overflow-y-auto backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Nouvelle collection</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
              placeholder="Nom de la collection"
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
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">Annuler</button>
          <ShinyButton onClick={() => name && onSave(name, icon, color)} className="flex-1">Créer</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default NewCollectionModal;
