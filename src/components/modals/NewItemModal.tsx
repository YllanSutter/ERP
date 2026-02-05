import React, { useState, useMemo } from 'react';
// Mini composant Tabs local
function Tabs({ tabs, active, onTab, className = "" }: { tabs: string[], active: string, onTab: (tab: string) => void, className?: string }) {
  return (
    <div className={"flex gap-2 border-b border-black/10 dark:border-white/10 mb-4 flex-wrap " + className}>
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onTab(tab)}
          className={
            "px-3 py-1 rounded-t text-sm font-medium transition-all duration-300 " +
            (active === tab ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-black dark:hover:text-white")
          }
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
import { motion } from 'framer-motion';
import { Star, Trash2 } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import EditableProperty from '@/components/fields/EditableProperty';
import { splitEventByWorkdays, workDayStart, workDayEnd, breakStart, breakEnd } from '@/lib/calendarUtils';
import { calculateSegmentsClient, formatSegmentDisplay } from '@/lib/calculateSegmentsClient';
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
  // Ajout d'un sélecteur de collection (pour création uniquement)
  const [selectedCollectionId, setSelectedCollectionId] = useState(collection.id);
  const selectedCollection = collections.find((c: any) => c.id === selectedCollectionId) || collection;

  function getRoundedNow() {
    const now = new Date();
    const minutes = now.getMinutes();
    const rounded = Math.round(minutes / 15) * 15;
    now.setMinutes(rounded);
    now.setSeconds(0);
    now.setMilliseconds(0);
    return now;
  }

  // Fusionne l'item prérempli (editingItem) avec les valeurs par défaut
  function getInitialFormData(col = selectedCollection, prefill: any = editingItem) {
    const data: any = { ...(prefill || {}) };
    const props = orderedProperties && orderedProperties.length > 0 ? orderedProperties : col.properties;
    props.forEach((prop: any) => {
      if (data[prop.id] === undefined) {
        if (prop.defaultValue !== undefined && prop.defaultValue !== null) {
          data[prop.id] = prop.defaultValue;
        } else if (prop.type === 'date') {
          data[prop.id] = getRoundedNow().toISOString();
        }
      }
    });
    // Pour chaque champ *_duration, si pas de valeur, injecte la valeur par défaut
    props.forEach((prop: any) => {
      if (prop.id.endsWith('_duration') && data[prop.id] === undefined) {
        // Priorité : defaultValue du champ → defaultDuration → 1 heure par défaut
        if (prop.defaultValue !== undefined && prop.defaultValue !== null) {
          data[prop.id] = prop.defaultValue;
        } else if (prop.defaultDuration !== undefined && prop.defaultDuration !== null) {
          data[prop.id] = prop.defaultDuration;
        } else {
          // Initialiser avec 1 heure par défaut pour que les segments se génèrent
          data[prop.id] = 1;
        }
      }
    });
    // Si on édite, on force l'id dans le formData
    if (editingItem && editingItem.id) {
      data.id = editingItem.id;
    }
    // IMPORTANT: Ne PLUS recalculer les segments côté client
    // Les segments sont maintenant calculés côté serveur dans POST /api/state
    // On garde seulement ceux qui proviennent de la BDD (si édition)
    if (prefill && prefill._eventSegments) {
      data._eventSegments = prefill._eventSegments;
    } else {
      // Initialiser avec un array vide - sera recalculé au serveur
      data._eventSegments = [];
    }
    return data;
  }



  const [formData, setFormDataRaw] = useState(getInitialFormData(selectedCollection, editingItem));

  // NOUVEAU COMPORTEMENT: setFormData ne recalcule PLUS côté client
  // Tout recalcul se fait côté serveur via POST /api/state
  const setFormData = (data: any) => {
    setFormDataRaw(data);
  };

  // Lors d'un changement de collection, garder les segments existants
  React.useEffect(() => {
    if (formData && formData._eventSegments) {
      setFormDataRaw({ ...formData });
    } else {
      setFormDataRaw({ ...formData, _eventSegments: [] });
    }
    // eslint-disable-next-line
  }, [selectedCollection]);

  const handleChange = (propId: string, value: any) => {
    // Plus besoin de vérifier si c'est un champ date
    // Tous les changements sont envoyés au serveur qui recalculera les segments
    setFormData({ ...formData, [propId]: value });
  };


  // State temporaire pour propager la valeur du champ date
  const [pendingDateValue, setPendingDateValue] = useState<string | undefined>(undefined);

  const handleCollectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCollectionId = e.target.value;
    if (!editingItem) {
      // Cherche la première valeur trouvée dans formData parmi tous les champs date de la collection courante
      let previousDateValue = undefined;
      const prevCol = collections.find((c: any) => c.id === selectedCollectionId) || collection;
      const prevDateFields = prevCol.properties.filter((p: any) => p.type === 'date');
      if (formData && prevDateFields.length > 0) {
        for (let i = 0; i < prevDateFields.length; i++) {
          const field = prevDateFields[i];
          if (formData[field.id]) {
            previousDateValue = formData[field.id];
            break;
          }
        }
      }
      setPendingDateValue(previousDateValue);
    }
    setSelectedCollectionId(newCollectionId);
  };

  // Quand selectedCollectionId change, si pendingDateValue est défini, on préremplit tous les champs date
  React.useEffect(() => {
    if (!editingItem && pendingDateValue !== undefined) {
      const newCol = collections.find((c: any) => c.id === selectedCollectionId) || collection;
      const dateFields = newCol.properties.filter((p: any) => p.type === 'date');
      let prefill: any = {};
      if (pendingDateValue) {
        dateFields.forEach((field: any) => {
          prefill[field.id] = pendingDateValue;
        });
      }
      setFormData(getInitialFormData(newCol, prefill));
      setPendingDateValue(undefined);
    }
    // eslint-disable-next-line
  }, [selectedCollectionId]);

  // Quand la modal reçoit un nouvel editingItem (préremplissage), on met à jour le formData
  React.useEffect(() => {
    if (!editingItem) return;
    // On force la réinitialisation du formData à partir de l'editingItem reçu (qui doit contenir les _eventSegments à jour)
    setFormDataRaw(getInitialFormData(selectedCollection, editingItem));
  }, [editingItem, selectedCollection]);

  const isFavorite = favorites && editingItem ? favorites.items.includes(editingItem.id) : false;

  // Pour la création, on recalcule dynamiquement les champs selon la collection sélectionnée
  // Pour l'édition, on garde orderedProperties (pour garder l'ordre de la vue courante)
  // Mode édition si un id existe, même si isNew traîne
  const isReallyEditing = editingItem && editingItem.id;
  const propsList = isReallyEditing
    ? (orderedProperties && orderedProperties.length > 0 ? orderedProperties : selectedCollection.properties)
    : selectedCollection.properties;
  const classicProps = propsList.filter((p: any) => p.type !== 'relation');
  const richTextProps = classicProps.filter((p: any) => p.type === 'rich_text');
  const classicPropsSansRichText = classicProps.filter((p: any) => p.type !== 'rich_text');
  const relationProps = propsList.filter((p: any) => p.type === 'relation');
  // Pour chaque champ de type 'date', créer un onglet dédié aux plages horaires
  const dateProps = propsList.filter((p: any) => p.type === 'date');
  const extraTabs = [
    { id: '__relations__', name: 'Relation', type: 'relation' },
    ...dateProps.map((p: any) => ({ id: `_eventSegments_${p.id}`, name: `${p.name}`, type: 'segments', dateProp: p })),
  ];
  const [activeTab, setActiveTab] = useState(extraTabs[0]?.id || '');

  // Calcule les segments prégénérés côté client (pour aperçu dans le modal)
  const previewSegments = useMemo(() => {
    return calculateSegmentsClient(formData, selectedCollection);
  }, [formData, selectedCollection]);

  // Détecte si les segments ont changé et demande confirmation
  const segmentsHaveChanged = useMemo(() => {
    if (!isReallyEditing || !editingItem) return false;
    const oldSegments = editingItem._eventSegments || [];
    const newSegments = previewSegments;
    return JSON.stringify(oldSegments) !== JSON.stringify(newSegments);
  }, [previewSegments, editingItem, isReallyEditing]);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      {/* Style global pour masquer les flèches des input[type=number] */}
      <style>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-background dark:bg-neutral-900/60 text-neutral-700 dark:text-neutral-400 border border-black/10 dark:border-white/10 rounded-2xl p-8 py-4 w-[1200px] max-h-[80vh] overflow-y-auto backdrop-blur"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-black/10 dark:border-white/10">
          <h3 className="text-xl font-bold">{isReallyEditing ? 'Modifier' : 'Nouveau'} {selectedCollection.name}</h3>
          {!isReallyEditing && (
            <div className="gap-4 flex items-center">
              <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-300">Collection</label>
              <select
                className="px-3 py-2 rounded bg-neutral-800 text-white border border-black/10 dark:border-white/10 focus:border-violet-500"
                value={selectedCollectionId}
                onChange={handleCollectionChange}
              >
                {collections.map((col: any) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>
          )}
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
          {/* Sélecteur de collection (création uniquement) */}
          
          {/* Partie gauche : champs classiques */}
          <div className="flex-1 min-w-[0] pr-4 border-r border-black/10 dark:border-white/10 relative">
            {/* Grande barre verticale à droite des labels */}
            <div
              className="pointer-events-none absolute top-0 left-[100px] w-[1px] h-full rounded bg-black/10 dark:bg-white/10 transition-colors duration-100 z-10"
              id="big-label-bar"
            >
              {/* Petites barres alignées à chaque label (calcul dynamique) */}
              {classicPropsSansRichText.map((prop: any) => (
                <div
                  key={prop.id}
                  id={`mini-bar-${prop.id}`}
                  className="absolute left-0 w-full h-[32px] rounded bg-black/0 dark:bg-white/0 transition-colors duration-100"
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
            {classicPropsSansRichText.length === 0 && (
              <div className="text-neutral-500 text-sm">Aucun champ classique</div>
            )}
            <div
              className="flex flex-col space-y-2 group/classic-fields"
            >
              {classicPropsSansRichText.map((prop: any) => (
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
                        "block text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap w-full px-3 py-2 rounded-l transition-colors duration-100 " +
                        "group-hover:bg-black/5 dark:group-hover:bg-white/5 group-focus-within:bg-black/5 dark:group-focus-within:bg-white/5 focus-within:bg-black/5 dark:focus-within:bg-white/5 hover:bg-black/5 dark:hover:bg-white/5 "
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
                        collection={collection}
                        currentItem={formData}
                        onRelationChange={(property, item, value) => {
                          if (property.type === 'relation' || property.type === 'multi_select') {
                            setFormData({ ...formData, [property.id]: value });
                          } else {
                            setFormData(item);
                          }
                        }}
                        readOnly={false}
                        forceRichEditor={true}
                      />
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Partie droite : relations sous forme d'onglets */}
          <div className="flex-1 min-w-[0] pl-2">
            {(() => {
              // Tabs = richTextProps + extraTabs
              const allTabs = [
                ...extraTabs,
                ...richTextProps.map((p: any) => ({ id: `_richText_${p.id}`, name: p.name, type: 'rich_text', prop: p }))
              ];
              if (allTabs.length === 0) {
                return <div className="text-neutral-500 text-sm">Aucune relation</div>;
              }
              return <>
                <Tabs
                  tabs={allTabs.map((t: any) => t.name)}
                  active={allTabs.find((t: any) => t.id === activeTab)?.name || allTabs[0].name}
                  onTab={tabName => {
                    const found = allTabs.find((t: any) => t.name === tabName);
                    if (found) setActiveTab(found.id);
                  }}
                  className="mb-2"
                />
                
                {/* Onglet unique pour toutes les relations */}
                {activeTab === '__relations__' && (
                  <div>
                    {relationProps.length === 0 ? (
                      <div className="text-neutral-500 text-sm">Aucune relation</div>
                    ) : (
                      <div className="space-y-4">
                        {relationProps.map((prop: any) => (
                          <div className="flex justify-between" key={prop.id}>
                            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                              {prop.name} {prop.required && <span className="text-red-500">*</span>}
                            </label>
                            <EditableProperty
                              property={prop}
                              value={formData[prop.id]}
                              onChange={(val) => handleChange(prop.id, val)}
                              size="md"
                              collections={collections}
                              collection={collection}
                              currentItem={formData}
                              onRelationChange={(property, item, value) => {
                                setFormData({ ...formData, [property.id]: value });
                              }}
                              readOnly={false}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Onglet rich_text */}
                {allTabs.filter(t => t.type === 'rich_text').map(tab => (
                  activeTab === tab.id && (
                    <div key={tab.id} className="mb-4">
                      <EditableProperty
                        property={tab.prop}
                        value={formData[tab.prop.id]}
                        onChange={(val) => handleChange(tab.prop.id, val)}
                        size="md"
                        collections={collections}
                        collection={collection}
                        currentItem={formData}
                        readOnly={false}
                        forceRichEditor={tab.type === 'rich_text'}
                      />
                    </div>
                  )
                ))}
                {/* Onglets plages horaires par champ date - affichage lisible, sans édition du label */}
                {dateProps.map((dateProp: any) => (
                  activeTab === `_eventSegments_${dateProp.id}` && (
                    <div key={`_eventSegments_${dateProp.id}`}>
                      <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-4">Plages horaires pour {dateProp.name}</label>
                      
                      {/* Section: Aperçu des plages générées automatiquement */}
                      <div className="mb-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                        <div className="flex items-center justify-between mb-3">
                          <label className="font-semibold text-sm text-blue-400">📋 Aperçu automatique</label>
                          {segmentsHaveChanged && isReallyEditing && (
                            <span className="text-xs px-2 py-1 bg-orange-500/30 text-orange-300 rounded border border-orange-500/30">Modifié</span>
                          )}
                        </div>
                        {(() => {
                          const autoSegments = previewSegments.filter((seg: { label: any; }) => seg.label === dateProp.name);
                          if (!autoSegments || autoSegments.length === 0) {
                            return <div className="text-neutral-500 text-xs italic">Aucune plage générée (vérifier: date remplie + durée définie)</div>;
                          }
                          return (
                            <div className="space-y-2">
                              {autoSegments.map((seg: any, idx: number) => (
                                <div key={idx} className="text-sm text-neutral-400 flex items-center gap-2">
                                  <span className="text-blue-400">▸</span>
                                  {formatSegmentDisplay(seg)}
                                </div>
                              ))}
                              {isReallyEditing && segmentsHaveChanged && (
                                <button
                                  type="button"
                                  className="mt-2 w-full px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
                                  onClick={() => {
                                    // Remplacer les segments manuels par les segments auto-générés
                                    const oldManualSegs = (formData._eventSegments || []).filter((seg: { label: any; }) => seg.label !== dateProp.name);
                                    setFormData({ ...formData, _eventSegments: [...oldManualSegs, ...autoSegments] });
                                  }}
                                >
                                  Appliquer ces plages
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Section: Édition manuelle des plages */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400">Plages personnalisées</label>
                          <button
                            className="px-2 py-1 text-xs rounded bg-green-600 hover:bg-green-700 text-white transition-colors"
                            onClick={() => {
                              const segs = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                              const now = new Date();
                              const start = now.toISOString();
                              const end = new Date(now.getTime() + 60*60*1000).toISOString();
                              segs.push({ start, end, label: dateProp.name });
                              setFormData({ ...formData, _eventSegments: segs });
                            }}
                            type="button"
                          >+ Ajouter</button>
                        </div>
                      </div>

                      {(() => {
                        const segments = (formData._eventSegments || []).filter((seg: { label: any; }) => seg.label === dateProp.name);
                        if (!segments || segments.length === 0) return <div className="text-neutral-500 text-xs">Aucune plage personnalisée</div>;
                        // Grouper par jour
                        const segmentsByDay: Record<string, any[]> = {};
                        segments.forEach((seg: any) => {
                          const dayKey = new Date(seg.start || seg.__eventStart).toLocaleDateString('fr-FR');
                          if (!segmentsByDay[dayKey]) segmentsByDay[dayKey] = [];
                          segmentsByDay[dayKey].push(seg);
                        });
                        return (
                          <div className="space-y-4">
                            {Object.entries(segmentsByDay).map(([day, segs]) => (
                              <div key={day}>
                                <div className="font-semibold text-sm text-violet-300 mb-1">{day}</div>
                                <ul className="space-y-2">
                                  {segs.map((seg: any, idx: number) => (
                                    <li key={idx} className="p-2 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 flex items-center gap-2">
                                      {/* Date de début (jour) */}
                                      <input
                                        type="date"
                                        value={(() => {
                                          const d = new Date(seg.start || seg.__eventStart);
                                          return d.toISOString().slice(0, 10);
                                        })()}
                                        onChange={e => {
                                          const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                          const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                          if (globalIdx !== -1) {
                                            const d = new Date(seg.start || seg.__eventStart);
                                            const [year, month, day] = e.target.value.split('-');
                                            d.setFullYear(Number(year), Number(month) - 1, Number(day));
                                            segsCopy[globalIdx] = { ...segsCopy[globalIdx], start: d.toISOString() };
                                            setFormData({ ...formData, _eventSegments: segsCopy });
                                          }
                                        }}
                                        style={{ width: 130, fontSize: '1rem', border: 'none', background: 'transparent', textAlign: 'center', marginRight: 4 }}
                                      />
                                      {/* Heure et minutes de début */}
                                      <input
                                        type="number"
                                        min={0}
                                        max={23}
                                        value={(() => {
                                          const d = new Date(seg.start || seg.__eventStart);
                                          return d.getHours();
                                        })()}
                                        onChange={e => {
                                          const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                          const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                          if (globalIdx !== -1) {
                                            const d = new Date(seg.start || seg.__eventStart);
                                            d.setHours(Number(e.target.value));
                                            segsCopy[globalIdx] = { ...segsCopy[globalIdx], start: d.toISOString() };
                                            setFormData({ ...formData, _eventSegments: segsCopy });
                                          }
                                        }}
                                        style={{ width: 20, fontSize: '1rem', border: 'none', background: 'transparent', textAlign: 'center' }}
                                      />
                                      <span className="font-mono text-neutral-700 dark:text-neutral-300">h</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={(() => {
                                          const d = new Date(seg.start || seg.__eventStart);
                                          return d.getMinutes().toString().padStart(2, '0');
                                        })()}
                                        onChange={e => {
                                          const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                          const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                          if (globalIdx !== -1) {
                                            const d = new Date(seg.start || seg.__eventStart);
                                            d.setMinutes(Number(e.target.value));
                                            segsCopy[globalIdx] = { ...segsCopy[globalIdx], start: d.toISOString() };
                                            setFormData({ ...formData, _eventSegments: segsCopy });
                                          }
                                        }}
                                        style={{ width: 20, fontSize: '1rem', border: 'none', background: 'transparent', textAlign: 'center', MozAppearance: 'textfield' }}
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        onWheel={e => e.currentTarget.blur()}
                                        onKeyDown={e => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()}
                                      />
                                      <span className="font-mono text-neutral-700 dark:text-neutral-300">m</span>
                                      {' '}→{' '}
                                      {/* Heure et minutes de fin */}
                                      <input
                                        type="number"
                                        min={0}
                                        max={23}
                                        value={(() => {
                                          const d = new Date(seg.end || seg.__eventEnd);
                                          return d.getHours();
                                        })()}
                                        onChange={e => {
                                          const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                          const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                          if (globalIdx !== -1) {
                                            const d = new Date(seg.end || seg.__eventEnd);
                                            d.setHours(Number(e.target.value));
                                            segsCopy[globalIdx] = { ...segsCopy[globalIdx], end: d.toISOString() };
                                            setFormData({ ...formData, _eventSegments: segsCopy });
                                          }
                                        }}
                                        style={{ width: 20, fontSize: '1rem', border: 'none', background: 'transparent', textAlign: 'center' }}
                                      />
                                      <span className="font-mono text-neutral-700 dark:text-neutral-300">h</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={59}
                                        value={(() => {
                                          const d = new Date(seg.end || seg.__eventEnd);
                                          return d.getMinutes().toString().padStart(2, '0');
                                        })()}
                                        onChange={e => {
                                          const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                          const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                          if (globalIdx !== -1) {
                                            const d = new Date(seg.end || seg.__eventEnd);
                                            d.setMinutes(Number(e.target.value));
                                            segsCopy[globalIdx] = { ...segsCopy[globalIdx], end: d.toISOString() };
                                            setFormData({ ...formData, _eventSegments: segsCopy });
                                          }
                                        }}
                                        style={{ width: 20, fontSize: '1rem', border: 'none', background: 'transparent', textAlign: 'center', MozAppearance: 'textfield' }}
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        onWheel={e => e.currentTarget.blur()}
                                        onKeyDown={e => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.preventDefault()}
                                      />
                                      <span className="font-mono text-neutral-700 dark:text-neutral-300">m</span>
                                      <button
                                        className="ml-2"
                                        onClick={() => {
                                          const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                          const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                          if (globalIdx !== -1) {
                                            segsCopy.splice(globalIdx, 1);
                                            setFormData({ ...formData, _eventSegments: segsCopy });
                                          }
                                        }}
                                        type="button"
                                        title="Supprimer la plage"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24"><path fill="#ef4444" d="M7 21q-.825 0-1.412-.587Q5 19.825 5 19V7H4q-.425 0-.712-.288Q3 6.425 3 6t.288-.713Q3.575 5 4 5h4V4q0-.825.588-1.412Q9.175 2 10 2h4q.825 0 1.413.588Q16 3.175 16 4v1h4q.425 0 .713.287Q21 5.575 21 6t-.287.712Q20.425 7 20 7h-1v12q0 .825-.587 1.413Q17.825 21 17 21Zm10-14H7v12q0 .425.288.713Q7.575 20 8 20h8q.425 0 .713-.287Q17.425 19.425 17.425 19V7ZM9 17q.425 0 .713-.288Q10 16.425 10 16v-6q0-.425-.287-.713Q9.425 9 9 9t-.713.287Q8 9.575 8 10v6q0 .425.287.713Q8.575 17 9 17Zm3 0q.425 0 .713-.288Q13 16.425 13 16v-6q0-.425-.287-.713Q12.425 9 12 9t-.713.287Q11 9.575 11 10v6q0 .425.287.713Q11.575 17 12 17Zm3 0q.425 0 .713-.288Q16 16.425 16 16v-6q0-.425-.287-.713Q15.425 9 15 9t-.713.287Q14 9.575 14 10v6q0 .425.287.713Q14.575 17 15 17ZM10 5h4V4h-4Z"/></svg>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  )
                ))}
              </>;
            })()}
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton
            onClick={() => {
              let dataToSave = { ...formData, __collectionId: selectedCollectionId };
              
              // Si on crée un nouvel item et que les segments sont vides, appliquer les segments prégénérés
              if (!isReallyEditing && (!dataToSave._eventSegments || dataToSave._eventSegments.length === 0) && previewSegments.length > 0) {
                dataToSave._eventSegments = previewSegments;
              }
              
              if (!isReallyEditing) {
                const { id, ...rest } = dataToSave;
                dataToSave = rest;
              }
              onSave(dataToSave);
            }}
            className="flex-1"
          >
            {isReallyEditing ? 'Modifier' : 'Créer'}
          </ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default NewItemModal;
