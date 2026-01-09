import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { LightSelect } from '@/components/inputs/LightSelect';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';
import { PopoverButton, LinkedItemsViewer } from '@/components/inputs/PopoverButton';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface EditablePropertyProps {
  property: any;
  value: any;
  onChange: (value: any) => void;
  size?: 'sm' | 'md' | 'lg';
  isNameField?: boolean;
  onViewDetail?: () => void;
  className?: string;
  readOnly?: boolean;
  disableNameLink?: boolean; // Désactive le lien cliquable pour le champ nom (pour édition directe)
  // Relations support
  collections?: any[];
  currentItem?: any;
  onRelationChange?: (property: any, item: any, value: any) => void;
  onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
}

const EditableProperty: React.FC<EditablePropertyProps> = React.memo(({
  property,
  value,
  onChange,
  size = 'md',
  isNameField = false,
  onViewDetail,
  className,
  readOnly = false,
  disableNameLink = false,
  collections,
  currentItem,
  onRelationChange,
  onNavigateToCollection
}) => {
  const sizeClasses = {
    sm: 'text-xs h-7',
    md: 'text-sm h-8',
    lg: 'text-base h-9'
  };

  // Si c'est le champ nom et qu'on a un callback de détail, afficher comme un lien (sauf si désactivé)
  if (isNameField && onViewDetail && !disableNameLink) {
    return (
      <button
        onClick={onViewDetail}
        className="text-cyan-400 hover:text-cyan-300 hover:underline font-medium text-left"
      >
        {value || 'Sans titre'}
      </button>
    );
  }

  // Select (single) - affichage léger avec puce + bouton +
  if (property.type === 'select') {
    return (
      <LightSelect
        options={property.options || []}
        value={value || ''}
        onChange={onChange}
        className={className}
        sizeClass={sizeClasses[size]}
        disabled={readOnly}
      />
    );
  }

  // Multi-select - puces + bouton + avec cases à cocher
  if (property.type === 'multi_select') {
    const selectedValues: string[] = Array.isArray(value) ? value : (value ? [value] : []);
    return (
      <LightMultiSelect
        options={property.options || []}
        values={selectedValues}
        onChange={onChange}
        className={className}
        sizeClass={sizeClasses[size]}
        disabled={readOnly}
      />
    );
  }

  // Checkbox - toujours affiché
  if (property.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={value || false}
        onChange={(e) => onChange(e.target.checked)}
        disabled={readOnly}
        className="w-5 h-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      />
    );
  }

  // Date - toujours affiché avec heure et durée
  if (property.type === 'date') {
    const [open, setOpen] = useState(false);
    const selectedDate = value ? new Date(value) : undefined;
    const durationKey = `${property.id}_duration`;
    const currentDuration = currentItem?.[durationKey] || property.defaultDuration || 1;
    
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={readOnly}
            className={cn(
              "w-full px-2 py-1 bg-transparent border border-transparent text-left text-white hover:border-white/10 rounded transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
              sizeClasses[size],
              !value && "text-neutral-600",
              className
            )}
          >
            <CalendarIcon size={14} className="opacity-50" />
            {value ? format(selectedDate!, 'dd MMM yyyy HH:mm', { locale: fr }) : 'Choisir une date et heure'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-700" align="start">
          <div className="flex flex-col">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  // Preserve time if exists, otherwise set to 09:00
                  const existingDate = value ? new Date(value) : null;
                  if (existingDate) {
                    date.setHours(existingDate.getHours(), existingDate.getMinutes());
                  } else {
                    date.setHours(9, 0);
                  }
                  onChange(date.toISOString());
                }
              }}
              initialFocus
              className="bg-neutral-900 text-white"
            />
            <div className="p-3 border-t border-white/10 space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Heure de début</label>
                <input
                  type="time"
                  value={value ? format(new Date(value), 'HH:mm') : '09:00'}
                  onChange={(e) => {
                    const currentDate = value ? new Date(value) : new Date();
                    const [hours, minutes] = e.target.value.split(':');
                    currentDate.setHours(parseInt(hours), parseInt(minutes));
                    onChange(currentDate.toISOString());
                  }}
                  className="w-full px-3 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none text-sm"
                />
              </div>
              {onRelationChange && currentItem && (
                <div>
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5">Durée (heures)</label>
                  <input
                    type="number"
                    value={currentDuration}
                    onChange={(e) => {
                      const newDuration = parseFloat(e.target.value) || 1;
                      onRelationChange(property, { ...currentItem, [durationKey]: newDuration }, value);
                    }}
                    min="0.25"
                    step="0.25"
                    placeholder="1"
                    className="w-full px-3 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none text-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Relation - affichage et édition
  if (property.type === 'relation') {
    const relation = property.relation || {};
    const targetCollectionId = relation.targetCollectionId;
    const relationType = relation.type || 'many_to_many';
    const targetCollection = collections?.find((c: any) => c.id === targetCollectionId);
    const targetItemsRaw = targetCollection?.items || [];
    const filterCfg = relation.filter;
    const targetItems = (() => {
      if (!filterCfg || !targetCollection) return targetItemsRaw;
      const prop = (targetCollection.properties || []).find((p: any) => p.id === filterCfg.fieldId);
      if (!prop) return targetItemsRaw;
      const filterVal = String(filterCfg.value || '').toLowerCase();
      return targetItemsRaw.filter((it: any) => {
        const val = it[filterCfg.fieldId];
        if (val == null) return false;
        if (Array.isArray(val)) return val.map((v: any) => String(v).toLowerCase()).includes(filterVal);
        return String(val).toLowerCase() === filterVal;
      });
    })();

    const isSourceMany = relationType === 'one_to_many' || relationType === 'many_to_many';

    // Popovers en mode non contrôlé (ouverture au clic simple)

    const getItemName = (it: any) => {
      const nameField = targetCollection?.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');
      return nameField ? it[nameField.id] || 'Sans titre' : it.name || 'Sans titre';
    };

    // Vue de liste via icône
    const ViewerButton = (
      <LinkedItemsViewer
        isSourceMany={isSourceMany}
        value={value}
        targetItems={targetItems}
        targetCollection={targetCollection}
        getItemName={getItemName}
        onNavigateToCollection={onNavigateToCollection}
        targetCollectionId={targetCollectionId}
        top={0.35}
        right={0}
      />
    );

    if (!collections || !currentItem || !onRelationChange) {
      // Fallback lecture seule si contexte manquant
      return (
        <div className={cn("flex items-center gap-2", sizeClasses[size], className)}>
          {ViewerButton}
        </div>
      );
    }

    if (!isSourceMany) {
      // Sélection légère: chip + bouton +
      const [searchQuery, setSearchQuery] = useState('');
      const [newItemData, setNewItemData] = useState<any>({});
      const [isCreating, setIsCreating] = useState(false);

      const filteredItems = targetItems.filter((ti: any) => 
        getItemName(ti).toLowerCase().includes(searchQuery.toLowerCase())
      );

      const handleCreateNew = () => {
        const nameField = targetCollection?.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');
        const nameValue = newItemData[nameField?.id || 'name'];
        if (!nameValue || !nameValue.trim()) return;
        
        // Créer un nouvel élément dans la collection cible avec tous les champs
        const newItem = {
          id: `new_${Date.now()}`,
          ...newItemData,
        };
        
        // Ajouter à la collection cible
        targetCollection.items.push(newItem);
        
        // Sélectionner le nouvel élément
        onRelationChange(property, currentItem, newItem.id);
        
        // Réinitialiser
        setNewItemData({});
        setIsCreating(false);
        setSearchQuery('');
      };

      return (
        <div className={cn("flex items-center gap-2", className)}>
          <div className="flex flex-wrap gap-1 flex-1">
            {value ? (
              (() => {
                const it = targetItems.find((ti: any) => ti.id === value);
                const label = it ? getItemName(it) : value;
                return <span className="px-2 py-0.5 text-xs rounded bg-white/10 border border-white/10">{label}</span>;
              })()
            ) : (
              <span className="text-xs text-neutral-500">Aucun</span>
            )}
          </div>
          {!readOnly && (
            <PopoverButton
              icon="Plus"
              title="Ajouter / changer"
              isAbsolute={true}
              size={14}
              contentClassName="w-80"
            >
              <div className="space-y-2">
                  {/* Champ de recherche */}
                  {!isCreating && (
                    <div className="relative">
                      <Icons.Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
                      <input
                        type="text"
                        placeholder="Rechercher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-2 py-1.5 bg-neutral-800/50 border border-white/10 rounded text-sm text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Création d'un nouvel élément */}
                  {isCreating ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="text-sm font-medium text-white">Nouvel élément</span>
                        <button
                          onClick={() => { setIsCreating(false); setNewItemData({}); }}
                          className="text-neutral-400 hover:text-white"
                        >
                          <Icons.X size={16} />
                        </button>
                      </div>
                      
                      {/* Formulaire complet */}
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {targetCollection?.properties?.map((prop: any) => {
                          if (prop.type === 'relation') return null; // Skip relations dans la création rapide
                          
                          return (
                            <div key={prop.id}>
                              <label className="block text-xs font-medium text-neutral-400 mb-1">
                                {prop.name}
                              </label>
                              <EditableProperty
                                property={prop}
                                value={newItemData[prop.id]}
                                onChange={(val) => setNewItemData({ ...newItemData, [prop.id]: val })}
                                size="sm"
                                collections={collections}
                                currentItem={newItemData}
                                onRelationChange={() => {}}
                                readOnly={false}
                              />
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-white/10">
                        <button
                          onClick={handleCreateNew}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 rounded text-sm text-white font-medium"
                        >
                          <Icons.Check size={14} />
                          Créer et lier
                        </button>
                        <button
                          onClick={() => { setIsCreating(false); setNewItemData({}); }}
                          className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-sm text-white"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setIsCreating(true)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded text-sm text-violet-300"
                      >
                        <Icons.Plus size={14} />
                        Créer nouveau
                      </button>

                      {/* Liste des éléments */}
                      <div className="space-y-1 max-h-64 overflow-y-auto text-sm">
                        <button
                          className="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-neutral-300"
                          onClick={() => {
                            onRelationChange(property, currentItem, null);
                            setSearchQuery('');
                          }}
                        >
                          Aucun
                        </button>
                        {filteredItems.map((ti: any) => (
                          <button
                            key={ti.id}
                            className="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-neutral-100"
                            onClick={() => {
                              onRelationChange(property, currentItem, ti.id);
                              setSearchQuery('');
                            }}
                          >
                            {getItemName(ti)}
                          </button>
                        ))}
                        {filteredItems.length === 0 && searchQuery && (
                          <div className="text-xs text-neutral-500 px-2 py-1">Aucun résultat</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
            </PopoverButton>
          )}
          {ViewerButton}
        </div>
      );
    }

    // Sélection multiple via popover + chips
    const selectedIds = Array.isArray(value) ? value : [];
    const [searchQueryMulti, setSearchQueryMulti] = useState('');
    const [newItemDataMulti, setNewItemDataMulti] = useState<any>({});
    const [isCreatingMulti, setIsCreatingMulti] = useState(false);

    const filteredItemsMulti = targetItems.filter((ti: any) => 
      getItemName(ti).toLowerCase().includes(searchQueryMulti.toLowerCase())
    );

    const handleCreateNewMulti = () => {
      const nameField = targetCollection?.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');
      const nameValue = newItemDataMulti[nameField?.id || 'name'];
      if (!nameValue || !nameValue.trim()) return;
      
      // Créer un nouvel élément dans la collection cible avec tous les champs
      const newItem = {
        id: `new_${Date.now()}`,
        ...newItemDataMulti,
      };
      
      // Ajouter à la collection cible
      targetCollection.items.push(newItem);
      
      // Ajouter aux éléments sélectionnés
      const next = [...selectedIds, newItem.id];
      onRelationChange(property, currentItem, next);
      
      // Réinitialiser
      setNewItemDataMulti({});
      setIsCreatingMulti(false);
      setSearchQueryMulti('');
    };

    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex flex-wrap gap-1 flex-1">
          {selectedIds.map((id: string) => {
            const it = targetItems.find((ti: any) => ti.id === id);
            const label = it ? getItemName(it) : id;
            return (
              <span key={id} className="px-2 py-0.5 text-xs rounded bg-white/10 border border-white/10">
                {label}
              </span>
            );
          })}
          {selectedIds.length === 0 && (
            <span className="text-xs text-neutral-500">Aucun lien</span>
          )}
        </div>
        {!readOnly && (
          <PopoverButton
            icon="Plus"
            title="Ajouter / gérer"
            isAbsolute={true}
            size={13}
            contentClassName="w-80"
          >
            <div className="space-y-2">
                {/* Champ de recherche */}
                {!isCreatingMulti && (
                  <div className="relative">
                    <Icons.Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Rechercher..."
                      value={searchQueryMulti}
                      onChange={(e) => setSearchQueryMulti(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 bg-neutral-800/50 border border-white/10 rounded text-sm text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                )}

                {/* Création d'un nouvel élément */}
                {isCreatingMulti ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <span className="text-sm font-medium text-white">Nouvel élément</span>
                      <button
                        onClick={() => { setIsCreatingMulti(false); setNewItemDataMulti({}); }}
                        className="text-neutral-400 hover:text-white"
                      >
                        <Icons.X size={16} />
                      </button>
                    </div>
                    
                    {/* Formulaire complet */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {targetCollection?.properties?.map((prop: any) => {
                        if (prop.type === 'relation') return null; // Skip relations dans la création rapide
                        
                        return (
                          <div key={prop.id}>
                            <label className="block text-xs font-medium text-neutral-400 mb-1">
                              {prop.name}
                            </label>
                            <EditableProperty
                              property={prop}
                              value={newItemDataMulti[prop.id]}
                              onChange={(val) => setNewItemDataMulti({ ...newItemDataMulti, [prop.id]: val })}
                              size="sm"
                              collections={collections}
                              currentItem={newItemDataMulti}
                              onRelationChange={() => {}}
                              readOnly={false}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-white/10">
                      <button
                        onClick={handleCreateNewMulti}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 rounded text-sm text-white font-medium"
                      >
                        <Icons.Check size={14} />
                        Créer et lier
                      </button>
                      <button
                        onClick={() => { setIsCreatingMulti(false); setNewItemDataMulti({}); }}
                        className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-sm text-white"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setIsCreatingMulti(true)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded text-sm text-violet-300"
                    >
                      <Icons.Plus size={14} />
                      Créer nouveau
                    </button>

                    {/* Liste des éléments */}
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {filteredItemsMulti.map((ti: any) => {
                        const checked = selectedIds.includes(ti.id);
                        return (
                          <label key={ti.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-sm text-white cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...selectedIds, ti.id]
                                  : selectedIds.filter((id: string) => id !== ti.id);
                                onRelationChange(property, currentItem, next);
                              }}
                              className="cursor-pointer"
                            />
                            <span className="truncate">{getItemName(ti)}</span>
                          </label>
                        );
                      })}
                      {filteredItemsMulti.length === 0 && searchQueryMulti && (
                        <div className="text-xs text-neutral-500 px-2 py-1">Aucun résultat</div>
                      )}
                      {targetItems.length === 0 && !searchQueryMulti && (
                        <div className="text-xs text-neutral-500 px-2 py-1">Aucun élément dans la collection</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </PopoverButton>
        )}
        {ViewerButton}
      </div>
    );
  }

  // Number - toujours affiché
  if (property.type === 'number') {
    return (
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        className={cn(
          "w-full px-2 py-1 bg-transparent border border-transparent text-white placeholder-neutral-600 focus:border-white/10 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  // Email, URL, Phone, Text - toujours affichés
  const inputType = property.type === 'email' ? 'email' : 
                   property.type === 'url' ? 'url' :
                   property.type === 'phone' ? 'tel' : 'text';

  const textLength = (value || '').toString().length;
  const width = Math.max(textLength, 5) + 'ch';

  const inputElement = (
    <input
      type={inputType}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={value ? '' : '-'}
      disabled={readOnly}
      style={{ width }}
      className={cn(
        "min-w-full px-2 py-1 bg-transparent border border-transparent text-white placeholder-neutral-600 focus:border-white/10 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap",
        sizeClasses[size],
        className
      )}
    />
  );

  // Si c'est une URL avec une valeur, ajouter le menu contextuel
  if (property.type === 'url' && value) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {inputElement}
        </ContextMenuTrigger>
        <ContextMenuContent className="bg-neutral-900 border-neutral-700">
          <ContextMenuItem
            onClick={() => {
              const url = value.startsWith('http://') || value.startsWith('https://') 
                ? value 
                : `https://${value}`;
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
            className="cursor-pointer text-white hover:bg-white/10 flex items-center gap-2"
          >
            <Icons.ExternalLink size={14} />
            Ouvrir le lien
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return inputElement;
});

EditableProperty.displayName = 'EditableProperty';

export default EditableProperty;
