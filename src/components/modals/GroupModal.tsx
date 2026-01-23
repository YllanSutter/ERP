import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ui/ShinyButton';

interface GroupModalProps {
  properties: any[];
  onClose: () => void;
  onAdd: (property: string) => void;
}

const GroupModal: React.FC<GroupModalProps> = ({ properties, onClose, onAdd }) => {
  const [property, setProperty] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl p-8 min-w-96 backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Grouper par</h3>
        <select value={property} onChange={(e) => setProperty(e.target.value)} className="w-full px-4 py-2 bg-gray-300 dark:bg-neutral-800/50 border border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none mb-6">
          <option value="">Sélectionner...</option>
          {properties.filter((p: any) => ['select', 'multi_select', 'relation'].includes(p.type)).map((prop: any) => (
            <option key={prop.id} value={prop.id}>{prop.name}</option>
          ))}
        </select>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={() => property && onAdd(property)} className="flex-1">Grouper</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default GroupModal;
