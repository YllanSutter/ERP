import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const formatValue = (value: any, type: string, item?: any, propId?: string) => {
  if (!value) return '-';
  switch (type) {
    case 'date':
      const duration = item && propId ? item[`${propId}_duration`] : null;
      return (
        <div>
          <div>{new Date(value).toLocaleString('fr-FR')}</div>
          {duration && <div className="text-xs text-neutral-500 mt-1">Durée: {duration}h</div>}
        </div>
      );
    case 'date_range':
      if (value.start && value.end) {
        return `${new Date(value.start).toLocaleDateString('fr-FR')} - ${new Date(value.end).toLocaleDateString('fr-FR')}`;
      }
      return '-';
    case 'checkbox':
      return value ? '✓' : '✗';
    case 'url':
      return <a href={value} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{value}</a>;
    case 'multi_select':
      return Array.isArray(value) ? value.join(', ') : value;
    default:
      return value;
  }
};

interface ItemDetailModalProps {
  item: any;
  collection: any;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, collection, onClose, onEdit, onDelete }) => {
  const getNameValue = () => {
    const nameField = collection.properties.find((p: any) => p.name === 'Nom' || p.id === 'name');
    return nameField ? item[nameField.id] : item.name || 'Sans titre';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[700px] max-h-[80vh] overflow-y-auto backdrop-blur"
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-white mb-2">{getNameValue()}</h3>
            <p className="text-sm text-neutral-500">{collection.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {collection.properties.map((prop: any) => {
            const value = item[prop.id];
            if (!value) return null;

            return (
              <div key={prop.id} className="border-b border-white/5 pb-4">
                <label className="block text-xs font-semibold text-neutral-500 uppercase mb-2">
                  {prop.name}
                </label>
                <div className="text-base text-white">
                  {formatValue(value, prop.type, item, prop.id)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-8 pt-6 border-t border-white/10">
          <button
            onClick={onEdit}
            className="flex-1 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 rounded-lg transition-colors font-medium"
          >
            Modifier
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg transition-colors font-medium"
          >
            Supprimer
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ItemDetailModal;
