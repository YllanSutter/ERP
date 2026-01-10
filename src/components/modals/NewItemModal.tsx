import React, { useState } from 'react';
// Mini composant Tabs local
function Tabs({ tabs, active, onTab, className = "" }: { tabs: string[], active: string, onTab: (tab: string) => void, className?: string }) {
  return (
    <div className={"flex gap-2 border-b border-white/10 mb-4 " + className}>
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onTab(tab)}
          className={
            "px-3 py-1 rounded-t text-sm font-medium " +
            (active === tab ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white")
          }
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
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
  orderedProperties?: any[];
}

const NewItemModal: React.FC<NewItemModalProps> = ({ 
  collection, 
  onClose, 
  onSave, 
  editingItem, 
  collections,
  favorites,
  onToggleFavoriteItem,
  orderedProperties
}) => {
  // Préremplissage date : si création (pas editingItem), on préremplit les champs date
  function getRoundedNow() {
    const now = new Date();
    const minutes = now.getMinutes();
    const rounded = Math.round(minutes / 15) * 15;
    now.setMinutes(rounded);
    now.setSeconds(0);
    now.setMilliseconds(0);
    return now;
  }

  function getInitialFormData() {
    if (editingItem) return editingItem;
    const data: any = {};
    (orderedProperties && orderedProperties.length > 0 ? orderedProperties : collection.properties).forEach((prop: any) => {
      if (prop.type === 'date') {
        data[prop.id] = getRoundedNow().toISOString();
      }
    });
    return data;
  }

  const [formData, setFormData] = useState(getInitialFormData());
  const handleChange = (propId: string, value: any) => {
    setFormData({ ...formData, [propId]: value });
  };

  const isFavorite = favorites && editingItem ? favorites.items.includes(editingItem.id) : false;

  // Utiliser l'ordre passé en props si dispo, sinon collection.properties
  const propsList = orderedProperties && orderedProperties.length > 0 ? orderedProperties : collection.properties;
  const classicProps = propsList.filter((p: any) => p.type !== 'relation');
  const relationProps = propsList.filter((p: any) => p.type === 'relation');

  const [activeTab, setActiveTab] = useState(relationProps[0]?.id || '');

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[900px] max-h-[80vh] overflow-y-auto backdrop-blur"
        onClick={e => e.stopPropagation()}
      >
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
        <div className="flex gap-8">
          {/* Partie gauche : champs classiques */}
          <div className="flex-1 min-w-[0] space-y-4 pr-4 border-r border-white/10">
            {classicProps.length === 0 && (
              <div className="text-neutral-500 text-sm">Aucun champ classique</div>
            )}
            {classicProps.map((prop: any) => (
              <div key={prop.id} className='flex gap-3 items-center'>
                <label className="block text-sm font-medium text-neutral-300 whitespace-nowrap">
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
                    if (property.type === 'relation' || property.type === 'multi_select') {
                      setFormData({ ...formData, [property.id]: value });
                    } else {
                      setFormData(item);
                    }
                  }}
                  readOnly={false}
                />
              </div>
            ))}
          </div>
          {/* Partie droite : relations sous forme d'onglets */}
          <div className="flex-2 min-w-[0] pl-2">
            {relationProps.length === 0 ? (
              <div className="text-neutral-500 text-sm">Aucune relation</div>
            ) : (
              <>
                <Tabs
                  tabs={relationProps.map((p: any) => p.name)}
                  active={relationProps.find((p: any) => p.id === activeTab)?.name || relationProps[0].name}
                  onTab={tabName => {
                    const found = relationProps.find((p: any) => p.name === tabName);
                    if (found) setActiveTab(found.id);
                  }}
                  className="mb-2"
                />
                {relationProps.map((prop: any) => (
                  prop.id === activeTab && (
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
                          setFormData({ ...formData, [property.id]: value });
                        }}
                        readOnly={false}
                      />
                    </div>
                  )
                ))}
              </>
            )}
          </div>
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
