import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import RichTextEditor from '@/components/fields/RichTextEditor';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { LightSelect } from '@/components/inputs/LightSelect';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';
import { PopoverButton, LinkedItemsViewer } from '@/components/inputs/PopoverButton';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { workDayStart, workDayEnd } from '@/lib/calendarUtils';

interface EditablePropertyProps {
  property: any;
  value: any;
  onChange: (value: any) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isNameField?: boolean;
  onViewDetail?: () => void;
  className?: string;
  readOnly?: boolean;
  disableNameLink?: boolean;
  collections?: any[];
  collection?: any;
  currentItem?: any;
  onRelationChange?: (property: any, item: any, value: any) => void;
  onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
  forceRichEditor?: boolean;
}

// Composants utilitaires extraits
const NameLink = ({ value, onViewDetail }: { value: any; onViewDetail: () => void }) => (
  <button
    onClick={onViewDetail}
    className="text-cyan-400 hover:text-cyan-300 hover:underline font-medium text-left"
  >
    {value || 'Sans titre'}
  </button>
);

function SimpleInput({ 
  type, 
  value, 
  onChange, 
  sizeClasses, 
  className, 
  readOnly, 
  placeholder,
  ref,
  onFocus,
  onClick
}: { 
  type: string; 
  value: any; 
  onChange: (value: any) => void; 
  sizeClasses: any; 
  className?: string; 
  readOnly?: boolean; 
  placeholder?: string; 
  ref?: React.RefObject<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onClick?: React.MouseEventHandler<HTMLInputElement>;
}) {
  // Largeur dynamique en fonction du contenu (max 60ch)
  // Pour les champs texte, largeur minimale plus grande
  let minLen = 20;
  if (type === 'number' || type === 'email' || type === 'tel') minLen = 12;
  const inputLength = (value && typeof value === 'string') ? Math.min(Math.max(value.length, minLen), 60) : minLen;
  return (
    <input
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={readOnly}
      className={cn(
        "px-2 py-1 bg-transparent border border-transparent text-neutral-700 dark:text-white placeholder-neutral-600 focus:border-black/10 dark:focus:border-white/10 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        sizeClasses,
        className
      )}
      style={{ width: `${inputLength}ch` }}
      ref={ref}
      onFocus={onFocus}
      onClick={onClick}
    />
  );
}

const CheckboxInput = ({ value, onChange, readOnly }: { value: any; onChange: (value: boolean) => void; readOnly?: boolean }) => (
  <input
    type="checkbox"
    checked={value || false}
    onChange={(e) => onChange(e.target.checked)}
    disabled={readOnly}
    className="w-5 h-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
  />
);

const UrlInput = ({ 
  value, 
  onChange, 
  sizeClasses, 
  className, 
  readOnly 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  sizeClasses: string; 
  className?: string; 
  readOnly?: boolean; 
}) => {
  const protocol = value.startsWith('http://') ? 'http://' : 'https://';
  const withoutProtocol = value.replace(/^https?:\/\//, '');
  const url = withoutProtocol ? `${protocol}${withoutProtocol}` : '';
  const urlLength = Math.max(20, withoutProtocol.length || 10);

  return (
    <div className={cn('flex items-center gap-2 w-full', className)}>
      <span className="text-neutral-500">
        <Icons.Link size={13} className="opacity-70" />
      </span>
      <span className="text-xs text-neutral-500">{protocol}</span>
      <input
        type="text"
        value={withoutProtocol}
        onChange={e => {
          const inputVal = e.target.value;
          const nextProtocol = value.startsWith('http://') ? 'http://' : 'https://';
          onChange(inputVal ? `${nextProtocol}${inputVal.replace(/^https?:\/\//, '')}` : '');
        }}
        className={cn(
          "flex-1 bg-transparent  text-neutral-700 dark:text-white px-0 py-0.5 focus:border-violet-500 focus:outline-none",
          sizeClasses
        )}
        style={{ width: `${urlLength}ch` }}
        disabled={readOnly}
        placeholder="exemple.com"
      />
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-neutral-500 hover:text-neutral-700 dark:hover:text-white transition-colors"
          title="Ouvrir le lien"
        >
          <Icons.ExternalLink size={12} />
        </a>
      )}
    </div>
  );
};

const getRichTextPreview = (value: any) => {
  if (!value) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const text = extractFirstLineFromSlate(parsed);
        return text;
      }
    } catch {
      // ignore JSON parse errors
    }

    if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(trimmed, 'text/html');
      const plain = doc.body.textContent || '';
      return (plain.split('\n').find((line) => line.trim() !== '') || '').trim();
    }

    return trimmed.split('\n')[0] || '';
  }

  if (Array.isArray(value)) {
    return extractFirstLineFromSlate(value);
  }

  return '';
};

const extractFirstLineFromSlate = (nodes: any[]): string => {
  let text = '';

  const walk = (node: any) => {
    if (!node || text.includes('\n')) return;
    if (typeof node.text === 'string') {
      text += node.text;
    }
    if (Array.isArray(node.children)) {
      node.children.forEach((child: any) => walk(child));
    }
    if (node.type && text && !text.endsWith('\n')) {
      if (
        node.type === 'paragraph' ||
        node.type === 'heading-one' ||
        node.type === 'heading-two' ||
        node.type === 'list-item' ||
        node.type === 'task-item'
      ) {
        text += '\n';
      }
    }
  };

  nodes.forEach((node) => walk(node));
  return (text.split('\n').find((line) => line.trim() !== '') || '').trim();
};

// Hook utilitaire pour la logique de date
const useDateHandlers = (property: any, currentItem: any, collections: any[], collection: any, onChange: (value: any) => void, onRelationChange?: (property: any, item: any, value: any) => void) => {
  const handleEventUpdate = useCallback((propId: string, val: any) => {
    // NOUVEAU: Ne plus recalculer les segments côté client
    // Juste mettre à jour le champ et laisser le serveur recalculer les segments
    const updated = { ...currentItem, [propId]: val };
    
    if (typeof onChange === 'function') onChange(updated);
    if (typeof onRelationChange === 'function') onRelationChange(property, updated, val);
  }, [collections, collection, currentItem, onChange, onRelationChange, property]);

  return { handleEventUpdate };
};

// Composant Relation réutilisable
const RelationEditor = ({
  property,
  value,
  currentItem,
  collections,
  targetCollection,
  targetItems,
  getItemName,
  onRelationChange,
  readOnly,
  className,
  size,
  onNavigateToCollection,
  isSourceMany
}: {
  property: any;
  value: any;
  currentItem: any;
  collections: any[];
  targetCollection: any;
  targetItems: any[];
  getItemName: (item: any) => string;
  onRelationChange: (property: any, item: any, value: any) => void;
  readOnly?: boolean;
  className?: string;
  size?: string;
  onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
  isSourceMany: boolean;
}) => {
  const selectedIds = Array.isArray(value) ? value : (value ? [value] : []);
  const ViewerButton = (
    <LinkedItemsViewer
      isSourceMany={isSourceMany}
      value={value}
      targetItems={targetItems}
      targetCollection={targetCollection}
      getItemName={getItemName}
      onNavigateToCollection={onNavigateToCollection}
      targetCollectionId={property.relation?.targetCollectionId}
      top={0.35}
      right={0}
    />
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [newItemData, setNewItemData] = useState<any>({});
  const [isCreating, setIsCreating] = useState(false);

  const filteredItems = useMemo(() => 
    targetItems.filter((ti: any) => getItemName(ti).toLowerCase().includes(searchQuery.toLowerCase())),
  [targetItems, getItemName, searchQuery]);

  const handleCreateNew = useCallback(() => {
    const nameField = targetCollection?.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');
    const nameValue = newItemData[nameField?.id || 'name'];
    if (!nameValue?.trim()) return;

    const newItem = { id: `new_${Date.now()}`, ...newItemData };
    targetCollection.items.push(newItem);
    
    const nextValue = isSourceMany ? [...selectedIds, newItem.id] : newItem.id;
    onRelationChange(property, currentItem, nextValue);
    
    setNewItemData({});
    setIsCreating(false);
    setSearchQuery('');
  }, [newItemData, targetCollection, isSourceMany, selectedIds, onRelationChange, property, currentItem]);

  const toggleItem = useCallback((itemId: string, checked: boolean) => {
    const next = checked 
      ? [...selectedIds, itemId]
      : selectedIds.filter((id: string) => id !== itemId);
    onRelationChange(property, currentItem, next);
  }, [selectedIds, onRelationChange, property, currentItem]);

  const createForm = (
    <div className="space-y-2">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <span className="text-sm font-medium text-white">Nouvel élément</span>
        <button onClick={() => { setIsCreating(false); setNewItemData({}); }} className="text-neutral-400 hover:text-white">
          <Icons.X size={16} />
        </button>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {targetCollection?.properties?.map((prop: any) => {
          if (prop.type === 'relation') return null;
          return (
            <div key={prop.id}>
              <label className="block text-xs font-medium text-neutral-400 mb-1">{prop.name}</label>
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
          className="px-3 py-2 bg-gray-300 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded text-sm text-white"
        >
          Annuler
        </button>
      </div>
    </div>
  );

  const searchList = isSourceMany ? (
    <div className="space-y-1 max-h-64 overflow-y-auto">
      {filteredItems.map((ti: any) => {
        const checked = selectedIds.includes(ti.id);
        return (
          <label key={ti.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-sm text-white cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => toggleItem(ti.id, e.target.checked)}
              className="cursor-pointer"
            />
            <span className="truncate">{getItemName(ti)}</span>
          </label>
        );
      })}
      {filteredItems.length === 0 && searchQuery && (
        <div className="text-xs text-neutral-500 px-2 py-1">Aucun résultat</div>
      )}
    </div>
  ) : (
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
  );

  return (
    <div className={cn("flex items-center gap-2 ", className)}>
      <div className="flex gap-1 flex-1 min-w-0 justify-end flex-wrap max-w-[200px] overflow-hidden">
        {selectedIds.map((id: string) => {
          const it = targetItems.find((ti: any) => ti.id === id);
          const label = it ? getItemName(it) : id;
          const baseColor = property.color || '#8b5cf6';
          
          const shiftColor = (hex: string, shift: number) => {
            let r = parseInt(hex.slice(1, 3), 16);
            let g = parseInt(hex.slice(3, 5), 16);
            let b = parseInt(hex.slice(5, 7), 16);
            r = (r + shift * 13) % 256;
            g = (g + shift * 23) % 256;
            b = (b + shift * 37) % 256;
            return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          };
          
          let hash = 0;
          for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 32;
          const tagColor = shiftColor(baseColor, hash);
          
          return (
            <span
              key={id}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 border hover:bg-white/20 transition cursor-pointer group"
              style={{ backgroundColor: `${baseColor}12`, borderColor: `${baseColor}35` }}
            >
              <span className="truncate">{label}</span>
              {!readOnly && (
                <button
                  type="button"
                  className="ml-1 text-neutral-700 hover:text-red-800 dark:text-white dark:hover:text-red-400 rounded-full p-0.5 -mr-1 group-hover:opacity-100 opacity-60 transition"
                  onClick={() => {
                    const next = selectedIds.filter((sid: string) => sid !== id);
                    onRelationChange(property, currentItem, next);
                  }}
                  tabIndex={-1}
                  aria-label={`Retirer ${label}`}
                >
                  <Icons.X size={12} />
                </button>
              )}
            </span>
          );
        })}
        {selectedIds.length === 0 && (
          <span className="text-xs text-neutral-500">
            {isSourceMany ? 'Aucun lien' : 'Aucun'}
          </span>
        )}
      </div>
      
      {!readOnly && (
        <PopoverButton
          icon="Plus"
          title={isSourceMany ? "Ajouter / gérer" : "Ajouter / changer"}
          isAbsolute={true}
          size={13}
          contentClassName="w-80"
        >
          <div className="space-y-2">
            {!isCreating && (
              <div className="relative">
                <Icons.Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 bg-gray-100 dark:bg-neutral-800/50 border border-black/10 dark:border-white/10 rounded text-sm text-neutral-700 dark:text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
                />
              </div>
            )}
            
            {isCreating ? createForm : (
              <>
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded text-sm text-neutral-700 dark:text-white"
                >
                  <Icons.Plus size={14} />
                  Créer nouveau
                </button>
                {searchList}
              </>
            )}
          </div>
        </PopoverButton>
      )}
      {ViewerButton}
    </div>
  );
};

// Utilitaires
function groupSegmentsByDay(segments: any[]) {
  const segmentsByDay: Record<string, any[]> = {};
  (segments || []).forEach((seg: any) => {
    const dayKey = new Date(seg.start || seg.__eventStart).toLocaleDateString('fr-FR');
    if (!segmentsByDay[dayKey]) segmentsByDay[dayKey] = [];
    segmentsByDay[dayKey].push(seg);
  });
  return segmentsByDay;
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
  collection,
  currentItem,
  onRelationChange,
  onNavigateToCollection,
  forceRichEditor = false
}) => {
  const sizeClasses = {
    sm: 'text-xs h-7',
    md: 'text-sm h-8',
    lg: 'text-base h-9',
    xl: 'text-xl h-9'
  }[size];

  // Name field link
  if (isNameField && onViewDetail && !disableNameLink) {
    return <NameLink value={value} onViewDetail={onViewDetail} />;
  }

  // Select
  if (property.type === 'select') {
    return (
      <LightSelect
        options={property.options || []}
        value={value || ''}
        onChange={onChange}
        className={className}
        sizeClass={sizeClasses}
        disabled={readOnly}
      />
    );
  }

  // Multi-select
  if (property.type === 'multi_select') {
    const selectedValues: string[] = Array.isArray(value) ? value : (value ? [value] : []);
    return (
      <LightMultiSelect
        options={property.options || []}
        values={selectedValues}
        onChange={onChange}
        className={className}
        sizeClass={sizeClasses}
        disabled={readOnly}
      />
    );
  }

  // Checkbox
  if (property.type === 'checkbox') {
    return <CheckboxInput value={value} onChange={onChange} readOnly={readOnly} />;
  }

  // Date
  if (property.type === 'date') {
    const [open, setOpen] = useState(false);
    const selectedDate = value ? new Date(value) : undefined;
    const durationKey = `${property.id}_duration`;
    const currentDuration = currentItem?.[durationKey] || property.defaultDuration || 1;
    const { handleEventUpdate } = useDateHandlers(property, currentItem!, collections!, collection!, onChange, onRelationChange);

    const getTimeOptions = () => {
      const options = [];
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
    };

    const timeOptions = getTimeOptions();
    const currentTime = value ? format(new Date(value), 'HH:mm') : `${String(workDayStart).padStart(2, '0')}:00`;

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={readOnly}
            className={cn(
              "w-full px-2 py-1 bg-transparent border border-transparent text-left text-neutral-700 dark:text-white hover:border-black/10 dark:hover:border-white/10 rounded transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
              sizeClasses,
              !value && "text-neutral-600",
              className
            )}
          >
            <CalendarIcon size={14} className="opacity-50" />
            {value ? format(selectedDate!, 'dd MMM yyyy HH:mm', { locale: fr }) : 'Choisir une date et heure'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-background dark:bg-neutral-900 border-neutral-700" align="start">
          <div className="flex flex-row gap-4 p-3">
            {onRelationChange && currentItem && (
              <div className="flex flex-col items-center justify-center min-w-[110px]">
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Durée (H:M)</label>
                <select
                  value={currentDuration}
                  onChange={e => handleEventUpdate(durationKey, parseFloat(e.target.value) || 1)}
                  className="w-full h-50 text-center bg-background dark:bg-neutral-900 border-r border-white/10 text-black dark:text-white text-lg focus:border-violet-500 focus:outline-none overflow-y-scroll"
                  size={9}
                  style={{ WebkitAppearance: 'none', appearance: 'none' }}
                >
                  {Array.from({ length: 97 }, (_, i) => (i * 0.25)).map(dur => {
                    let label = dur % 1 === 0 
                      ? `${String(dur).padStart(2, '0')}:00`
                      : `${String(Math.floor(dur)).padStart(2, '0')}:${String((dur % 1) * 60).padStart(2, '0')}`;
                    return <option key={dur} value={dur}>{label}</option>;
                  })}
                </select>
              </div>
            )}
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  const existingDate = value ? new Date(value) : null;
                  if (existingDate) {
                    date.setHours(existingDate.getHours(), existingDate.getMinutes());
                  } else {
                    date.setHours(9, 0);
                  }
                  handleEventUpdate(property.id, date.toISOString());
                }
              }}
              initialFocus
              className="bg-background text-black dark:bg-neutral-900 dark:text-white"
            />
            <div className="flex flex-col items-center justify-center min-w-[110px]">
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Heure (H:M)</label>
              <select
                value={currentTime}
                onChange={e => {
                  const [hours, minutes] = e.target.value.split(':');
                  const d = value ? new Date(value) : new Date();
                  d.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                  handleEventUpdate(property.id, d.toISOString());
                }}
                className="w-full h-50 text-center bg-background text-black dark:bg-neutral-900 dark:text-white border-l border-white/10 text-lg focus:border-violet-500 focus:outline-none overflow-y-scroll"
                size={9}
                style={{ WebkitAppearance: 'none', appearance: 'none' }}
              >
                {timeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Relation
  if (property.type === 'relation') {
    const relation = property.relation || {};
    const targetCollectionId = relation.targetCollectionId;
    const relationType = relation.type || 'many_to_many';
    const targetCollection = collections?.find((c: any) => c.id === targetCollectionId);
    const targetItemsRaw = targetCollection?.items || [];
    const filterCfg = relation.filter;

    const targetItems = useMemo(() => {
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
    }, [targetItemsRaw, filterCfg, targetCollection]);

    const isSourceMany = relationType === 'one_to_many' || relationType === 'many_to_many';
    const getItemName = useCallback((it: any) => {
      const nameField = targetCollection?.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');
      return nameField ? it[nameField.id] || 'Sans titre' : it.name || 'Sans titre';
    }, [targetCollection]);

    if (!collections || !currentItem ) {
      return (
        <div className={cn("flex items-center gap-2 justify-between", sizeClasses, className)}>
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
        </div>
      );
    }

    return (
      <RelationEditor
        property={property}
        value={value}
        currentItem={currentItem}
        collections={collections}
        targetCollection={targetCollection}
        targetItems={targetItems}
        getItemName={getItemName}
        onRelationChange={onRelationChange ?? (() => {})}
        readOnly={readOnly}
        className={className}
        size={size}
        onNavigateToCollection={onNavigateToCollection}
        isSourceMany={isSourceMany}
      />
    );
  }

  // Rich text
  if (property.type === 'rich_text') {
    if (!forceRichEditor) {
      return (
        <div className={cn('truncate text-sm text-neutral-700 dark:text-white', className)}>
          {getRichTextPreview(value) || '—'}
        </div>
      );
    }

    return (
      <RichTextEditor
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        className={className}
        showToolbar={!readOnly}
      />
    );
  }

  // Number
  if (property.type === 'number') {
    return <SimpleInput type="number" value={value} onChange={onChange} sizeClasses={sizeClasses} className={className} readOnly={readOnly} />;
  }

  // URL
  if (property.type === 'url' && value) {
    return <UrlInput value={value} onChange={onChange} sizeClasses={sizeClasses} className={className} readOnly={readOnly} />;
  }

  // Text inputs
  const inputType = property.type === 'email' ? 'email' : 
                   property.type === 'phone' ? 'tel' : 'text';

  return (
    <SimpleInput 
      type={inputType} 
      value={value} 
      onChange={onChange} 
      sizeClasses={sizeClasses} 
      className={className} 
      readOnly={readOnly}
      placeholder={value ? '' : '...'}
    />
  );
});

EditableProperty.displayName = 'EditableProperty';
export default EditableProperty;