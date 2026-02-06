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
import { Star, Trash2, Clock, Edit2 } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import EditableProperty from '@/components/fields/EditableProperty';
import { calculateSegmentsClient, formatSegmentDisplay } from '@/lib/calculateSegmentsClient';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { workDayStart, workDayEnd } from '@/lib/calendarUtils';


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

  // État pour gérer l'ouverture du modal d'édition des plages
  const [editingDateProp, setEditingDateProp] = useState<any>(null);

  const timeOptions = useMemo(() => {
    const options: string[] = [];
    const minHour = Math.max(0, workDayStart - 1);
    const maxHour = Math.min(23, workDayEnd + 1);
    for (let h = minHour; h <= maxHour; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === maxHour && m > 0) continue;
        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');
        options.push(`${hh}:${mm}`);
      }
    }
    return options;
  }, []);

  const durationOptions = useMemo(
    () => Array.from({ length: 97 }, (_, i) => i * 0.25),
    []
  );

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
        className="bg-background/95 dark:bg-neutral-950/90 text-neutral-700 dark:text-neutral-300 border border-black/10 dark:border-white/10 rounded-none w-screen h-screen max-w-[1600px] max-h-[90%] overflow-hidden backdrop-blur flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-8 py-5 border-b border-black/10 dark:border-white/10 bg-background/80 dark:bg-neutral-950/80 backdrop-blur">
          <div className="flex-1 max-w-3xl">
            {classicPropsSansRichText.length > 0 && (
              <EditableProperty
                property={classicPropsSansRichText[0]}
                value={formData[classicPropsSansRichText[0].id]}
                onChange={(val) => handleChange(classicPropsSansRichText[0].id, val)}
                size="xl"
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
            )}
          </div>
          {!isReallyEditing && (
            <div className="gap-3 flex items-center">
              <label className="block text-xs font-medium text-neutral-500">Collection</label>
              <select
                className="px-3 py-2 rounded-lg bg-neutral-800 text-white border border-black/10 dark:border-white/10 focus:border-violet-500"
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
        <div className="flex-1 px-8 py-6 pt-10 z-10 relative overflow-y-auto">
          <div className="space-y-6">
          
          {/* Relations en haut sur toute la largeur */}
          {relationProps.length > 0 && (
            <div className="pb-10 border-b border-black/10 dark:border-white/10">
              <div className="border-t border-black/10 dark:border-white/10 pt-8 relative">
                <h4 className="absolute -top-3 left-0 px-4 py-1 rounded-full inline-block bg-background dark:bg-neutral-900 text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-4 uppercase tracking-wide">Relations</h4>
              </div>
              <div className="flex gap-4 items-center flex-wrap pl-4">
                {relationProps.map((prop: any) => (
                  <div className="flex items-center gap-3" key={prop.id}>
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
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
            </div>
          )}

          {/* Grid à 2 colonnes : champs classiques à gauche, horaires à droite */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_0.6fr] gap-6 relative">
          
          {/* Partie gauche : champs classiques */}
          <div className="min-w-[0]">
            <h4 className="absolute -top-[35px] left-0 px-4 py-1 rounded-full inline-block bg-background dark:bg-neutral-900 text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-4 uppercase tracking-wide">Détails</h4>

            {/* Grande barre verticale à droite des labels */}
            <div
              className="pointer-events-none absolute top-0 left-[130px] w-[1px] h-full rounded bg-black/10 dark:bg-white/10 transition-colors duration-100 z-10"
              id="big-label-bar"
            >
              {/* Petites barres alignées à chaque label (calcul dynamique) */}
              {classicPropsSansRichText.slice(1).map((prop: any) => (
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
            {classicPropsSansRichText.length <= 1 && (
              <div className="text-neutral-500 text-sm">Aucun champ classique supplémentaire</div>
            )}
            <div
              className="flex flex-col space-y-3 group/classic-fields"
            >
              {classicPropsSansRichText.slice(1).map((prop: any) => (
                <div
                  key={prop.id}
                  className="flex gap-0 items-stretch group/item focus-within:z-10 py-2 border-b border-black/10 dark:border-white/10 last:border-b-0"
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
                  <div className="flex items-center w-[130px] overflow-hidden">
                    <label
                      id={`label-${prop.id}`}
                      className={
                        "block text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap w-full px-3 py-2 transition-colors duration-100"
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

          {/* Colonne droite : Plages horaires */}
          <div className="min-w-[0] relative">
            <div className="mb-4">
              <h4 className="absolute -top-[35px] -left-2 px-4 py-1 rounded-full inline-block bg-background dark:bg-neutral-900 text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-4 uppercase tracking-wide">Horaires</h4>
            </div>
            <div className="space-y-6">
              {dateProps.length === 0 && (
                <div className="text-neutral-500 text-sm">Aucun champ date</div>
              )}
              {dateProps.map((dateProp: any) => {
                const segments = (formData._eventSegments || []).filter((seg: { label: any; }) => seg.label === dateProp.name);
                const autoSegments = previewSegments.filter((seg: { label: any; }) => seg.label === dateProp.name);
                
                // Résumé : nombre de plages et durée totale
                const getSegmentHours = (seg: any) => {
                  const start = new Date(seg.start || seg.__eventStart);
                  const end = new Date(seg.end || seg.__eventEnd);
                  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
                  const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  if (diffHours >= 0 && diffHours <= 24) return diffHours;
                  const startMinutes = start.getHours() * 60 + start.getMinutes();
                  const endMinutes = end.getHours() * 60 + end.getMinutes();
                  let minutes = endMinutes - startMinutes;
                  if (minutes < 0) minutes += 24 * 60;
                  return minutes / 60;
                };
                const totalDuration = segments.reduce((acc: number, seg: any) => acc + getSegmentHours(seg), 0);

                return (
                  <div key={`_eventSegments_${dateProp.id}`} className="pb-4 mb-4 border-b border-black/5 dark:border-white/5 last:border-0 last:pb-0 last:mb-0">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{dateProp.name}</label>
                      <button
                        onClick={() => setEditingDateProp(dateProp)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                      >
                        <Edit2 size={12} />
                        Modifier
                      </button>
                    </div>
                    
                    {/* Résumé lisible */}
                    <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                      <div className="relative group">
                        <div className="flex items-center gap-1 cursor-default">
                          <Clock size={14} />
                          <span>{segments.length || 0} plage{segments.length > 1 ? 's' : ''}</span>
                        </div>
                        {segments.length > 0 && (
                          <div className="absolute left-0 top-full mt-2 w-72 rounded-md border border-neutral-700 bg-neutral-900 p-3 text-xs text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none group-hover:pointer-events-auto">
                            <div className="text-[11px] font-semibold text-neutral-400 mb-2">Plages personnalisées</div>
                            <div className="space-y-1">
                              {segments.map((seg: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-blue-400">▸</span>
                                  {formatSegmentDisplay(seg)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {segments.length > 0 && (
                        <span className="text-neutral-500">·</span>
                      )}
                      {segments.length > 0 && (
                        <span>{totalDuration.toFixed(1)}h au total</span>
                      )}
                    </div>

                    {/* Popover avec aperçu automatique au survol */}
                    {autoSegments.length > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="mt-2 text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1">
                            <span>Plages de base ({autoSegments.length})</span>
                            {segmentsHaveChanged && isReallyEditing && (
                              <span className="px-1.5 py-0.5 bg-orange-500/30 text-orange-300 rounded text-[10px]">Modifié</span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 bg-neutral-900 border-neutral-700">
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-blue-400 mb-2">Plages calculées automatiquement</div>
                            {autoSegments.map((seg: any, idx: number) => (
                              <div key={idx} className="text-xs text-neutral-300 flex items-center gap-2">
                                <span className="text-blue-400">▸</span>
                                {formatSegmentDisplay(seg)}
                              </div>
                            ))}
                            {isReallyEditing && segmentsHaveChanged && (
                              <button
                                type="button"
                                className="mt-3 w-full px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                                onClick={() => {
                                  const oldManualSegs = (formData._eventSegments || []).filter((seg: { label: any; }) => seg.label !== dateProp.name);
                                  setFormData({ ...formData, _eventSegments: [...oldManualSegs, ...autoSegments] });
                                }}
                              >
                                Appliquer ces plages
                              </button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          </div>

          {/* Rich text en pleine largeur sur les deux colonnes */}
          {richTextProps.length > 0 && (
            <div className="pt-6 relative">
              <div className="space-y-6">
                {richTextProps.map((prop: any) => (
                  <div key={prop.id} className="pb-10 border-b border-black/5 dark:border-white/5 last:border-0 last:pb-0 relative">
                    <div className="absolute -top-3 left-3 px-4 py-1 rounded-full inline-block bg-background dark:bg-neutral-900 text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-4 uppercase tracking-wide z-10">{prop.name}</div>
                    <EditableProperty
                      property={prop}
                      value={formData[prop.id]}
                      onChange={(val) => handleChange(prop.id, val)}
                      size="md"
                      collections={collections}
                      collection={collection}
                      currentItem={formData}
                      readOnly={false}
                      forceRichEditor={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-8 py-4 border-t border-black/10 dark:border-white/10 bg-background/80 dark:bg-neutral-950/80 backdrop-blur">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            Annuler
          </button>
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
          >
            {isReallyEditing ? 'Modifier' : 'Créer'}
          </ShinyButton>
        </div>
      </motion.div>

      {/* Modal d'édition des plages horaires */}
      {editingDateProp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[300]"
          onClick={() => setEditingDateProp(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-background dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-neutral-300 dark:border-neutral-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-100">Modifier les plages - {editingDateProp.name}</h3>
              <button
                onClick={() => setEditingDateProp(null)}
                className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-100 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-4">
                <ShinyButton
                  onClick={() => {
                    const segs = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                    const now = new Date();
                    const start = now.toISOString();
                    const end = new Date(now.getTime() + 60*60*1000).toISOString();
                    segs.push({ start, end, label: editingDateProp.name });
                    setFormData({ ...formData, _eventSegments: segs });
                  }}
                >
                  + Ajouter une plage
                </ShinyButton>
              </div>

              {(() => {
                const segments = (formData._eventSegments || []).filter((seg: { label: any; }) => seg.label === editingDateProp.name);
                if (!segments || segments.length === 0) {
                  return <div className="text-neutral-500 text-sm">Aucune plage personnalisée</div>;
                }
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
                        <div className="font-semibold text-sm text-neutral-600 dark:text-neutral-400 mb-2">{day}</div>
                        <ul className="space-y-2">
                          {segs.map((seg: any, idx: number) => {
                            const startDate = new Date(seg.start || seg.__eventStart);
                            const endDate = new Date(seg.end || seg.__eventEnd);
                            const durationMinutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
                            const durationHoursValue = Math.round((durationMinutes / 60) * 4) / 4;
                            const currentTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;

                            return (
                              <li key={idx} className="p-3 border-b border-neutral-300 dark:border-neutral-700">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_140px_140px] gap-3 items-center">
                                    <div className="flex flex-col">
                                      <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">Date</label>
                                      <input
                                        type="date"
                                        value={startDate.toISOString().slice(0, 10)}
                                        onChange={e => {
                                          const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                          const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                          if (globalIdx !== -1) {
                                            const start = new Date(seg.start || seg.__eventStart);
                                            const [year, month, day] = e.target.value.split('-');
                                            start.setFullYear(Number(year), Number(month) - 1, Number(day));
                                            const newEnd = new Date(start.getTime() + durationMinutes * 60000);
                                            segsCopy[globalIdx] = { ...segsCopy[globalIdx], start: start.toISOString(), end: newEnd.toISOString() };
                                            setFormData({ ...formData, _eventSegments: segsCopy });
                                          }
                                        }}
                                        className="w-full px-2 py-1.5 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-100 text-sm rounded focus:border-violet-500 focus:outline-none"
                                      />
                                    </div>

                                    <div className="flex flex-col">
                                      <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">Heure</label>
                                      <select
                                        value={currentTime}
                                        onChange={e => {
                                          const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                          const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                          if (globalIdx !== -1) {
                                            const [hours, minutes] = e.target.value.split(':');
                                            const start = new Date(seg.start || seg.__eventStart);
                                            start.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                            const newEnd = new Date(start.getTime() + durationMinutes * 60000);
                                            segsCopy[globalIdx] = { ...segsCopy[globalIdx], start: start.toISOString(), end: newEnd.toISOString() };
                                            setFormData({ ...formData, _eventSegments: segsCopy });
                                          }
                                        }}
                                        className="w-full px-2 py-1.5 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-100 text-sm rounded focus:border-violet-500 focus:outline-none"
                                      >
                                        {timeOptions.map(opt => (
                                          <option key={opt} value={opt}>
                                            {opt}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="flex flex-col">
                                      <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">Durée</label>
                                      <select
                                        value={durationHoursValue}
                                        onChange={e => {
                                          const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                          const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                          if (globalIdx !== -1) {
                                            const start = new Date(seg.start || seg.__eventStart);
                                            const newDurationHours = parseFloat(e.target.value) || 0;
                                            const newEnd = new Date(start.getTime() + newDurationHours * 60 * 60000);
                                            segsCopy[globalIdx] = { ...segsCopy[globalIdx], end: newEnd.toISOString() };
                                            setFormData({ ...formData, _eventSegments: segsCopy });
                                          }
                                        }}
                                        className="w-full px-2 py-1.5 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-100 text-sm rounded focus:border-violet-500 focus:outline-none"
                                      >
                                        {durationOptions.map(dur => {
                                          const hours = Math.floor(dur);
                                          const mins = Math.round((dur % 1) * 60);
                                          const label = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                                          return (
                                            <option key={dur} value={dur}>
                                              {label}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  </div>

                                  <button
                                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
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
                                    <Trash2 size={16} className="text-red-400" />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div className="px-6 py-4 border-t border-neutral-300 dark:border-neutral-700 flex justify-end">
              <ShinyButton
                onClick={() => setEditingDateProp(null)}
                className=""
              >
                Fermer
              </ShinyButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default NewItemModal;
