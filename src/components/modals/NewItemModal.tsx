import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ShinyButton from '@/components/ShinyButton';
import { cn } from '@/lib/utils';

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
              {prop.type === 'text' && <input type="text" value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none" />}
              {prop.type === 'number' && <input type="number" value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none" />}
              {prop.type === 'email' && <input type="email" value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none" />}
              {prop.type === 'url' && <input type="url" value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none" />}
              {prop.type === 'phone' && <input type="tel" value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none" />}
              {prop.type === 'date' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      'w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none flex items-center gap-2',
                      !formData[prop.id] && 'text-neutral-500'
                    )}>
                      <CalendarIcon size={16} className="opacity-50" />
                      {formData[prop.id] ? format(new Date(formData[prop.id]), 'dd MMM yyyy', { locale: fr }) : 'Choisir une date'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-700" align="start">
                    <Calendar
                      mode="single"
                      selected={formData[prop.id] ? new Date(formData[prop.id]) : undefined}
                      onSelect={(date) => handleChange(prop.id, date ? format(date, 'yyyy-MM-dd') : '')}
                      initialFocus
                      className="bg-neutral-900 text-white"
                    />
                  </PopoverContent>
                </Popover>
              )}
              {prop.type === 'checkbox' && <input type="checkbox" checked={formData[prop.id] || false} onChange={(e) => handleChange(prop.id, e.target.checked)} className="w-5 h-5" />}
              {prop.type === 'select' && (
                <select value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none">
                  <option value="">Sélectionner...</option>
                  {prop.options?.map((opt: any) => {
                    const optValue = typeof opt === 'string' ? opt : opt.value;
                    return (
                      <option key={optValue} value={optValue}>{optValue}</option>
                    );
                  })}
                </select>
              )}
              {prop.type === 'relation' && (() => {
                const relation = prop.relation || {};
                const targetCollection = (collections || []).find((c: any) => c.id === relation.targetCollectionId);
                const targetItems = targetCollection?.items || [];
                const isSourceMany = relation.type === 'one_to_many' || relation.type === 'many_to_many';
                if (!targetCollection) return <div className="text-sm text-neutral-500">Collection liée introuvable</div>;
                if (!isSourceMany) {
                  return (
                    <select value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value || null)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none">
                      <option value="">Aucun</option>
                      {targetItems.map((ti: any) => (
                        <option key={ti.id} value={ti.id}>{(() => {
                          const nf = targetCollection.properties.find((p: any) => p.id === 'name' || p.name === 'Nom');
                          return nf ? ti[nf.id] || 'Sans titre' : ti.name || 'Sans titre';
                        })()}</option>
                      ))}
                    </select>
                  );
                }
                const selectedIds = Array.isArray(formData[prop.id]) ? formData[prop.id] : [];
                return (
                  <div className="space-y-2">
                    {targetItems.map((ti: any) => {
                      const checked = selectedIds.includes(ti.id);
                      const label = (() => {
                        const nf = targetCollection.properties.find((p: any) => p.id === 'name' || p.name === 'Nom');
                        return nf ? ti[nf.id] || 'Sans titre' : ti.name || 'Sans titre';
                      })();
                      return (
                        <label key={ti.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...selectedIds, ti.id]
                                : selectedIds.filter((id: string) => id !== ti.id);
                              handleChange(prop.id, next);
                            }}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                    {targetItems.length === 0 && (
                      <div className="text-xs text-neutral-500">Aucun élément dans la collection liée</div>
                    )}
                  </div>
                );
              })()}
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
