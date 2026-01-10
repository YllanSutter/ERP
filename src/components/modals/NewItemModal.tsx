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
        className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 py-4 w-[900px] max-h-[80vh] overflow-y-auto backdrop-blur"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
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
        <div className="flex gap-2">
          {/* Partie gauche : champs classiques */}
          <div className="flex-1 min-w-[0] pr-4 border-r border-white/10 relative">
            {/* Grande barre verticale à droite des labels */}
            <div
              className="pointer-events-none absolute top-0 left-[100px] w-[1px] h-full rounded bg-white/10 transition-colors duration-100 z-10"
              id="big-label-bar"
            >
              {/* Petites barres alignées à chaque label (calcul dynamique) */}
              {classicProps.map((prop: any) => (
                <div
                  key={prop.id}
                  id={`mini-bar-${prop.id}`}
                  className="absolute left-0 w-full h-[32px] rounded bg-white/0 transition-colors duration-100"
                  style={{ top: 0 }}
                  ref={el => {
                    if (!el) return;
                    const label = document.getElementById(`label-${prop.id}`);
                    if (label) {
                      const parent = el.parentElement?.parentElement;
                      const parentRect = parent?.getBoundingClientRect();
                      const rect = label.getBoundingClientRect();
                      if (parentRect) {
                        el.style.top = `${rect.top - parentRect.top}px`;
                        el.style.height = `${rect.height}px`;
                      }
                    }
                  }}
                />
              ))}
            </div>
            {classicProps.length === 0 && (
              <div className="text-neutral-500 text-sm">Aucun champ classique</div>
            )}
            <div
              className="flex flex-col space-y-4 group/classic-fields"
            >
              {classicProps.map((prop: any) => (
                <div
                  key={prop.id}
                  className="flex gap-0 items-stretch group/item focus-within:z-10"
                  onMouseOver={() => {
                    const mini = document.getElementById(`mini-bar-${prop.id}`);
                    if (mini) mini.style.background = 'rgba(255,255,255,0.15)';
                  }}
                  onMouseOut={() => {
                    const mini = document.getElementById(`mini-bar-${prop.id}`);
                    if (mini) mini.style.background = 'rgba(255,255,255,0)';
                  }}
                  onFocusCapture={() => {
                    const mini = document.getElementById(`mini-bar-${prop.id}`);
                    if (mini) mini.style.background = 'rgba(255,255,255,0.15)';
                  }}
                  onBlurCapture={() => {
                    const mini = document.getElementById(`mini-bar-${prop.id}`);
                    if (mini) mini.style.background = 'rgba(255,255,255,0)';
                  }}
                >
                  <div className="flex items-center min-w-[100px] max-w-[100px]">
                    <label
                      id={`label-${prop.id}`}
                      className={
                        "block text-sm font-medium text-neutral-300 whitespace-nowrap w-full px-3 py-2 rounded-l transition-colors duration-100 " +
                        "group-hover:bg-white/5 group-focus-within:bg-white/5 focus-within:bg-white/5 hover:bg-white/5 "
                      }
                      htmlFor={`field-${prop.id}`}
                    >
                      {prop.name} {prop.required && <span className="text-red-500">*</span>}
                    </label>
                  </div>
                  <div className="flex-1 pl-4 flex items-center">
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
                </div>
              ))}
            </div>
          </div>
          {/* Partie droite : relations sous forme d'onglets */}
          <div className="flex-1 min-w-[0] pl-2">
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
