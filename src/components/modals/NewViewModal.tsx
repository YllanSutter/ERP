import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ui/ShinyButton';
import { cn } from '@/lib/utils';

interface NewViewModalProps {
  onClose: () => void;
  onSave: (name: string, type: string, config?: any) => void;
  collection: any;
}

const NewViewModal: React.FC<NewViewModalProps> = ({ onClose, onSave, collection }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('table');
  const [groupBy, setGroupBy] = useState('');
  const [dateProperty, setDateProperty] = useState('');
  
  const viewTypes = [
    { value: 'table', label: 'Tableau' },
    { value: 'kanban', label: 'Kanban' },
    { value: 'calendar', label: 'Calendrier' }
  ];

  const selectProps = collection?.properties.filter((p: any) => p.type === 'select') || [];
  const dateProps = collection?.properties.filter((p: any) => p.type === 'date' || p.type === 'date_range') || [];

  const handleSave = () => {
    const config: any = { name, type };
    if (type === 'kanban' && groupBy) config.groupBy = groupBy;
    if (type === 'calendar' && dateProperty) config.dateProperty = dateProperty;
    onSave(name, type, config);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-96 max-h-[80vh] overflow-y-auto backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Nouvelle vue</h3>
        <div className="space-y-4">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la vue" className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none" />
          <div className="space-y-2">
            {viewTypes.map(vt => (
              <button
                key={vt.value}
                onClick={() => setType(vt.value)}
                className={cn('w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all', type === vt.value ? 'border-violet-500 bg-violet-500/20' : 'border-white/10 hover:border-white/20')}
              >
                <span className="font-medium">{vt.label}</span>
              </button>
            ))}
          </div>

          {type === 'kanban' && selectProps.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Grouper par</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none">
                <option value="">Sélectionner une propriété...</option>
                {selectProps.map((prop: any) => (
                  <option key={prop.id} value={prop.id}>{prop.name}</option>
                ))}
              </select>
            </div>
          )}

          {type === 'calendar' && dateProps.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Propriété date</label>
              <select value={dateProperty} onChange={(e) => setDateProperty(e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none">
                <option value="">Sélectionner une propriété...</option>
                {dateProps.map((prop: any) => (
                  <option key={prop.id} value={prop.id}>{prop.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={handleSave} className="flex-1">Créer</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default NewViewModal;
