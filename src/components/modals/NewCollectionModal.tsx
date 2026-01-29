import React, { useState } from 'react';
import { motion } from 'framer-motion';
import IconPicker from '@/components/inputs/IconPicker';
import ColorPicker from '@/components/inputs/ColorPicker';
import ShinyButton from '@/components/ui/ShinyButton';

interface NewCollectionModalProps {
  onClose: () => void;
  onSave: (name: string, icon: string, color: string) => void;
}

const NewCollectionModal: React.FC<NewCollectionModalProps> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Folder');
  const [color, setColor] = useState('#8b5cf6');

  return (
     <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl p-8 min-w-96 max-h-[80vh] overflow-y-auto backdrop-blur" onClick={e => e.stopPropagation()} >

       
        <h3 className="text-xl font-bold mb-6">Nouvelle collection</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-300 dark:bg-neutral-800/50 borderborder-black/10 dark:border-white/10  rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
              placeholder="Nom de la collection"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-300 mb-3">Icône</label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-300 mb-3">Couleur</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors">Annuler</button>
          <ShinyButton onClick={() => name && onSave(name, icon, color)} className="flex-1">Créer</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default NewCollectionModal;
