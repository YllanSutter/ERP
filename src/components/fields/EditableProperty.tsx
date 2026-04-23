import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { normalizeRelationIds } from '@/lib/utils/relationUtils';
import * as Icons from 'lucide-react';
import RichTextEditor from '@/components/fields/RichTextEditor';
import SteamPropertyField from '@/components/fields/SteamPropertyField';
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
import { formatDateByGranularity } from '@/lib/groupingUtils';
import { calculateSegmentsClient } from '@/lib/calculateSegmentsClient';

interface EditablePropertyProps {
  property: any;
  value: any;
  onChange: (value: any) => void;
  size?: 'xs' |'sm' | 'md' | 'lg' | 'xl';
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
  onNavigateToRelatedItem?: (item: any, targetCollection: any, propName: string) => void;
  forceRichEditor?: boolean;
  maxVisible?: number; // Ajouté pour LightMultiSelect
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
        "py-1 bg-transparent border border-transparent text-neutral-700 dark:text-white placeholder-neutral-600 focus:border-black/10 dark:focus:border-white/10 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
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

const CheckboxInput = ({ value, onChange, readOnly }: { value: any; onChange: (value: boolean) => void; readOnly?: boolean }) => {
  const checked = Boolean(value);
  return (
    <label className={cn('inline-flex items-center justify-center', readOnly ? 'cursor-default' : 'cursor-pointer')}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={readOnly}
        className="sr-only peer"
      />
      <span className="h-4 w-4 rounded-md border border-black/20 dark:border-white/20 bg-white/80 dark:bg-neutral-800 shadow-sm transition-colors peer-checked:bg-violet-500 peer-checked:border-violet-500 flex items-center justify-center disabled:opacity-50">
        {checked ? <Icons.Check size={12} className="text-white" /> : null}
      </span>
    </label>
  );
};

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

const NumberInput = ({
  value,
  onChange,
  sizeClasses,
  className,
  readOnly,
  prefix,
  suffix
}: {
  value: any;
  onChange: (value: any) => void;
  sizeClasses: string;
  className?: string;
  readOnly?: boolean;
  prefix?: string;
  suffix?: string;
}) => {
  const parseNumeric = (raw: any): number | null => {
    if (raw === null || raw === undefined || raw === '') return null;
    const normalized = String(raw).replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  };

  const stepBy = (direction: 1 | -1) => {
    const current = parseNumeric(value) ?? 0;
    const next = current + direction;
    onChange(String(next));
  };

  const displayValue = value ?? '';
  const inputLength = Math.min(Math.max(String(displayValue).length || 1, 10), 20);

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {prefix ? (
        <span className="text-xs text-neutral-500 dark:text-neutral-400 select-none mr-0.5">{prefix}</span>
      ) : null}
      <input
        type="text"
        inputMode="decimal"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const parsed = parseNumeric(e.target.value);
          if (e.target.value === '') return;
          if (parsed !== null) onChange(String(parsed));
        }}
        disabled={readOnly}
        className={cn(
          'px-2 py-1 bg-transparent border border-transparent text-neutral-700 dark:text-white placeholder-neutral-600 focus:border-black/10 dark:focus:border-white/10 focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          sizeClasses
        )}
        style={{ width: `${inputLength}ch` }}
        placeholder="0"
      />
      {suffix ? (
        <span className="text-sm text-neutral-500 dark:text-neutral-400 select-none -ml-5 mr-1.5">{suffix}</span>
      ) : null}
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => stepBy(1)}
          disabled={readOnly}
          className="h-3.5 w-4 flex items-center justify-center rounded border border-black/10 dark:border-white/15 text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Augmenter"
        >
          <Icons.ChevronUp size={10} />
        </button>
        <button
          type="button"
          onClick={() => stepBy(-1)}
          disabled={readOnly}
          className="h-3.5 w-4 flex items-center justify-center rounded border border-black/10 dark:border-white/15 text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Diminuer"
        >
          <Icons.ChevronDown size={10} />
        </button>
      </div>
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
      if (parsed && typeof parsed === 'object' && parsed.type === 'doc') {
        const text = extractFirstLineFromTiptap(parsed);
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

  if (value && typeof value === 'object' && value.type === 'doc') {
    return extractFirstLineFromTiptap(value);
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

const extractFirstLineFromTiptap = (doc: any): string => {
  let text = '';

  const walk = (node: any) => {
    if (!node || text.includes('\n')) return;
    if (typeof node.text === 'string') {
      text += node.text;
    }
    if (Array.isArray(node.content)) {
      node.content.forEach((child: any) => walk(child));
    }
    if (node.type && text && !text.endsWith('\n')) {
      if (
        node.type === 'paragraph' ||
        node.type === 'heading' ||
        node.type === 'listItem' ||
        node.type === 'taskItem'
      ) {
        text += '\n';
      }
    }
  };

  walk(doc);
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
  getItemLabel,
  onRelationChange,
  readOnly,
  className,
  size,
  onNavigateToCollection,
  onNavigateToRelatedItem,
  isSourceMany
}: {
  property: any;
  value: any;
  currentItem: any;
  collections: any[];
  targetCollection: any;
  targetItems: any[];
  getItemName: (item: any) => string;
  getItemLabel: (item: any) => string;
  onRelationChange: (property: any, item: any, value: any) => void;
  readOnly?: boolean;
  className?: string;
  size?: string;
  onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
  onNavigateToRelatedItem?: (item: any, targetCollection: any, propName: string) => void;
  isSourceMany: boolean;
}) => {
  const selectedIds = normalizeRelationIds(value);
  const relationMaxVisibleRaw = property?.relation?.maxVisible;
  const relationMaxVisible = Number.isFinite(Number(relationMaxVisibleRaw)) && Number(relationMaxVisibleRaw) > 0
    ? Number(relationMaxVisibleRaw)
    : null;
  const visibleSelectedIds = relationMaxVisible ? selectedIds.slice(0, relationMaxVisible) : selectedIds;
  const hiddenSelectedCount = selectedIds.length - visibleSelectedIds.length;
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

  const toSearchText = useCallback((input: any): string => {
    if (input === null || input === undefined) return '';
    if (typeof input === 'string') return input.toLowerCase();
    if (typeof input === 'number' || typeof input === 'boolean') return String(input).toLowerCase();
    if (Array.isArray(input)) return input.map((v) => toSearchText(v)).join(' ').toLowerCase();
    if (typeof input === 'object') {
      const candidate = input.name ?? input.label ?? input.title ?? input.value ?? input.id ?? input.appid;
      if (candidate !== null && candidate !== undefined) return String(candidate).toLowerCase();
      try {
        return JSON.stringify(input).toLowerCase();
      } catch {
        return '';
      }
    }
    return String(input).toLowerCase();
  }, []);

  const filteredItems = useMemo(() => 
    targetItems.filter((ti: any) => {
      const q = searchQuery.toLowerCase();
      const byName = toSearchText(getItemName(ti)).includes(q);
      const byLabel = toSearchText(getItemLabel(ti)).includes(q);
      return byName || byLabel;
    }),
  [targetItems, getItemName, getItemLabel, searchQuery, toSearchText]);

  // Récupérer les templates de champs qui ont des conditions
  const availableTemplates = useMemo(() => {
    const templates: any[] = [];
    targetCollection?.properties?.forEach((prop: any) => {
      if (prop.defaultTemplates && Array.isArray(prop.defaultTemplates)) {
        prop.defaultTemplates.forEach((tpl: any) => {
          if (tpl.when?.fieldId && tpl.when?.value) {
            templates.push({ ...tpl, targetFieldId: prop.id, targetFieldName: prop.name });
          }
        });
      }
    });
    return templates;
  }, [targetCollection]);

  const handleCreateNew = useCallback((templateData?: any) => {
    try {
      const dataToUse = templateData || newItemData;
      
      console.log('handleCreateNew - dataToUse:', dataToUse);
      
      // Copier toutes les valeurs du formulaire, même vides
      const cleanData: any = {};
      targetCollection?.properties?.forEach((prop: any) => {
        if (prop.type === 'relation') return;
        const value = dataToUse[prop.id];
        console.log(`handleCreateNew - ${prop.id} (${prop.name}):`, value);
        
        if (value !== undefined && value !== null) {
          // Pour les objets complexes, essayer de les cloner proprement
          if (typeof value === 'object' && !Array.isArray(value)) {
            try {
              cleanData[prop.id] = JSON.parse(JSON.stringify(value));
            } catch {
              // Si JSON.stringify échoue, ignorer cette propriété
              console.warn(`Propriété ${prop.id} ignorée (référence circulaire)`);
            }
          } else {
            cleanData[prop.id] = value;
          }
        }
      });

      // Trouver le champ name pour s'assurer qu'il y a une valeur
      const nameField = targetCollection?.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');
      const nameFieldId = nameField?.id || 'name';
      let nameValue = cleanData[nameFieldId];
      
      console.log('handleCreateNew - nameFieldId:', nameFieldId, 'nameValue:', nameValue);
      
      // Si pas de nom, créer un nom par défaut
      if (!nameValue || !String(nameValue).trim()) {
        nameValue = `Nouvel élément ${Date.now()}`;
      }
      
      // Assurer que le nom est dans cleanData
      cleanData[nameFieldId] = nameValue;
      
      console.log('handleCreateNew - final cleanData:', cleanData);

      const newItem = { 
        id: `new_${Date.now()}`, 
        ...cleanData
      };
      
      // Ajouter l'item directement à la collection pour que la liaison se fasse
      if (!targetCollection?.items) {
        console.error('targetCollection ou items est manquant', targetCollection);
        return;
      }
      
      targetCollection.items.push(newItem);
      
      const nextValue = isSourceMany ? [...selectedIds, newItem.id] : newItem.id;
      
      // Mettre à jour currentItem avec la nouvelle relation ET ajouter les nouvelles données au targetCollection
      const updatedCurrentItem = { ...currentItem, [property.id]: nextValue };
      
      // Marquer les données du nouvel élément pour que le parent sache les sauvegarder
      if (!targetCollection.__newItems) {
        targetCollection.__newItems = [];
      }
      targetCollection.__newItems.push(newItem);
      
      onRelationChange(property, updatedCurrentItem, nextValue);
      
      setNewItemData({});
      setIsCreating(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      alert('Erreur lors de la création de l\'élément. Vérifiez la console pour plus de détails.');
    }
  }, [newItemData, targetCollection, isSourceMany, selectedIds, onRelationChange, property, currentItem]);

  const toggleItem = useCallback((itemId: string, checked: boolean) => {
    const next = checked 
      ? [...selectedIds, itemId]
      : selectedIds.filter((id: string) => id !== itemId);
    onRelationChange(property, currentItem, next);
  }, [selectedIds, onRelationChange, property, currentItem]);

  // Fonction utilitaire pour évaluer une valeur de template
  const evaluateTemplateValue = useCallback((value: any, propType: string) => {
    const now = new Date();
    
    // Évaluer les templates dynamiques
    if (typeof value === 'string') {
      if (value.includes('{{now:month}}')) {
        // Mois actuel au 1er du mois à 9h
        const date = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0, 0);
        return date.toISOString();
      } else if (value.includes('{{now:year}}')) {
        // Année actuelle au 1er janvier à 9h
        const date = new Date(now.getFullYear(), 0, 1, 9, 0, 0);
        return date.toISOString();
      } else if (value.includes('{{now}}')) {
        // Maintenant
        return now.toISOString();
      }
    }
    
    if (propType === 'date' && typeof value === 'string') {
      // Si c'est une date et que la valeur n'est pas déjà une ISO string
      if (!value.match(/^\d{4}-\d{2}-\d{2}T/)) {
        // Essayer de parser différents formats
        if (value.match(/^\d{4}-\d{2}$/)) {
          // Format YYYY-MM
          const [year, month] = value.split('-');
          const date = new Date(parseInt(year), parseInt(month) - 1, 1, 9, 0, 0);
          return date.toISOString();
        } else if (value.match(/^\d{4}$/)) {
          // Format YYYY
          const date = new Date(parseInt(value), 0, 1, 9, 0, 0);
          return date.toISOString();
        } else {
          // Essayer de créer une date valide
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          } else {
            // Valeur par défaut : maintenant
            return now.toISOString();
          }
        }
      }
    }
    
    return value;
  }, []);

  // Fonction pour initialiser les données avec les templates applicables
  const initializeWithTemplates = useCallback(() => {
    const initialData: any = {};
    
    targetCollection?.properties?.forEach((prop: any) => {
      if (prop.defaultTemplates && Array.isArray(prop.defaultTemplates)) {
        // Prendre tous les templates qui ont une valeur
        const applicableTemplates = prop.defaultTemplates.filter((tpl: any) => 
          tpl.value !== undefined && tpl.value !== null && tpl.value !== ''
        );
        
        // Utiliser le premier template trouvé
        const applicableTemplate = applicableTemplates[0];
        
        if (applicableTemplate) {
          const evaluatedValue = evaluateTemplateValue(applicableTemplate.value, prop.type);
          initialData[prop.id] = evaluatedValue;
        }
      }
    });
    return initialData;
  }, [targetCollection, evaluateTemplateValue]);

  const createForm = (
    <div className="space-y-2">
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <span className="text-sm font-medium text-white">Nouvel élément</span>
        <button onClick={() => { setIsCreating(false); setNewItemData({}); }} className="text-neutral-400 hover:text-white">
          <Icons.X size={16} />
        </button>
      </div>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {targetCollection?.properties?.map((prop: any) => {
          if (prop.type === 'relation') return null;
          const fieldValue = newItemData[prop.id];
          const applicableTemplates = (prop.defaultTemplates || []).filter((tpl: any) => 
            tpl.value !== undefined && tpl.value !== null && tpl.value !== ''
          );
          
          return (
            <div key={prop.id}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label className="block text-xs font-medium text-neutral-400">{prop.name}</label>
                {applicableTemplates.length > 0 && (
                  <div className="flex gap-1">
                    {applicableTemplates.map((tpl: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const evaluatedValue = evaluateTemplateValue(tpl.value, prop.type);
                          setNewItemData((prev: any) => ({ ...prev, [prop.id]: evaluatedValue }));
                        }}
                        className="text-xs px-1.5 py-0.5 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/30 rounded text-emerald-300"
                        title={`Utiliser: ${tpl.value}`}
                      >
                        Auto
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <EditableProperty
                property={prop}
                value={fieldValue}
                onChange={(val) => setNewItemData((prev: any) => ({ ...prev, [prop.id]: val }))}
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
          onClick={() => handleCreateNew()}
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

  const renderSearchList = (close: () => void) =>
    isSourceMany ? (
      <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
        {filteredItems.map((ti: any) => {
          const checked = selectedIds.includes(ti.id);
          const label = getItemLabel(ti);
          return (
            <button
              key={ti.id}
              type="button"
              className={cn(
                'px-2 py-1 rounded-full text-xs border border-black/10 dark:border-white/10 transition',
                checked ? 'font-semibold' : 'hover:bg-black/10 dark:hover:bg-white/10'
              )}
              style={checked ? { backgroundColor: 'rgba(139,92,246,0.16)', color: '#a78bfa' } : {  }}
              onClick={() => {
                toggleItem(ti.id, !checked);
                close();
              }}
            >
              <span className="truncate">{label}</span>
            </button>
          );
        })}
        {filteredItems.length === 0 && searchQuery && (
          <div className="text-xs text-neutral-500 px-2 py-1">Aucun résultat</div>
        )}
      </div>
    ) : (
      <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto text-sm">
        <button
          type="button"
          className={cn(
            'px-2 py-1 rounded-full text-xs border border-black/10 dark:border-white/10 transition',
            !value ? 'bg-white/15 border-white/20 text-white' : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
          )}
          onClick={() => {
            onRelationChange(property, currentItem, null);
            setSearchQuery('');
            close();
          }}
        >
          Aucun
        </button>
        {filteredItems.map((ti: any) => {
          const selected = value === ti.id;
          return (
            <button
              key={ti.id}
              type="button"
              className={cn(
                'px-2 py-1 rounded-full text-xs border border-black/10 dark:border-white/10 transition',
                selected ? 'font-semibold' : 'hover:bg-black/10 dark:hover:bg-white/10'
              )}
              style={selected ? { backgroundColor: 'rgba(139,92,246,0.16)', borderColor: 'rgba(139,92,246,0.35)', color: '#a78bfa' } : { borderColor: 'rgba(255,255,255,0.08)' }}
              onClick={() => {
                onRelationChange(property, currentItem, ti.id);
                setSearchQuery('');
                close();
              }}
            >
              {getItemLabel(ti)}
            </button>
          );
        })}
        {filteredItems.length === 0 && searchQuery && (
          <div className="text-xs text-neutral-500 px-2 py-1">Aucun résultat</div>
        )}
      </div>
    );

  return (
    <div className={cn("flex items-center gap-2 justify-end ", className)}>
      <div className="flex gap-1 flex-1 min-w-0 justify-end flex-wrap max-w-[200px] overflow-hidden max-h-[100px] overflow-y-auto">
        {visibleSelectedIds.map((id: string) => {
          const it = targetItems.find((ti: any) => ti.id === id);
          const targetItemForNavigation = it || targetCollection?.items?.find((ti: any) => ti.id === id) || null;
          const label = it ? getItemLabel(it) : id;
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
              {onNavigateToRelatedItem ? (
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-0.5 truncate",
                    targetItemForNavigation ? "hover:underline" : "opacity-60 cursor-default"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!targetItemForNavigation) return;
                    onNavigateToRelatedItem(targetItemForNavigation, targetCollection, property.name);
                  }}
                >
                  <span className="truncate">{label}</span>
                  <Icons.ArrowRight size={9} className="shrink-0 opacity-60" />
                </button>
              ) : (
                <span className="truncate">{label}</span>
              )}
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
        {hiddenSelectedCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 bg-black/5 dark:bg-white/5">
            +{hiddenSelectedCount}
          </span>
        )}
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
          {({ close }) => (
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
                  {availableTemplates.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10">
                        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Créer depuis un template</span>
                      </div>
                      <div className="space-y-1">
                        {availableTemplates.map((tpl: any, index: number) => {
                          // Trouver la propriété source dans la collection actuelle pour afficher la condition
                          const whenProp = currentItem?.__collectionId ? 
                            collections?.find((c: any) => c.id === currentItem.__collectionId)?.properties?.find((p: any) => p.id === tpl.when.fieldId) : 
                            null;
                          const conditionText = whenProp ? `${whenProp.name} = ${tpl.when.value}` : tpl.when.value;
                          
                          return (
                            <button
                              key={index}
                              onClick={() => {
                                // Commencer avec toutes les valeurs des templates
                                const templateData: any = initializeWithTemplates();
                                // Évaluer et ajouter les valeurs spécifiques de ce template
                                const targetProp = targetCollection?.properties?.find((p: any) => p.id === tpl.targetFieldId);
                                if (targetProp) {
                                  templateData[tpl.targetFieldId] = evaluateTemplateValue(tpl.value, targetProp.type);
                                }
                                // Ajouter la condition when
                                templateData[tpl.when.fieldId] = tpl.when.value;
                                
                                // Mettre à jour les deux états synchroniquement
                                setNewItemData(templateData);
                                setIsCreating(true);
                              }}
                              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded text-sm text-neutral-700 dark:text-white"
                            >
                              <div className="flex items-center gap-2">
                                <Icons.Sparkles size={14} />
                                <span className="text-xs">{conditionText}</span>
                              </div>
                              <Icons.Plus size={12} />
                            </button>
                          );
                        })}
                      </div>
                      <div className="pt-2 border-t border-black/10 dark:border-white/10">
                        <button
                          onClick={() => {
                            const initialData = initializeWithTemplates();
                            setNewItemData(initialData);
                            setIsCreating(true);
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded text-sm text-neutral-700 dark:text-white"
                        >
                          <Icons.Plus size={14} />
                          Créer sans template
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        const initialData = initializeWithTemplates();
                        setNewItemData(initialData);
                        setIsCreating(true);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded text-sm text-neutral-700 dark:text-white"
                    >
                      <Icons.Plus size={14} />
                      Créer nouveau
                    </button>
                  )}
                  {renderSearchList(close)}
                </>
              )}
            </div>
          )}
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

function normalizeSegmentsForCompare(segments: any[]) {
  return (segments || [])
    .map((seg: any) => {
      const startDate = new Date(seg.start || seg.__eventStart);
      const endDate = new Date(seg.end || seg.__eventEnd);
      return {
        label: seg.label || '',
        start: Number.isNaN(startDate.getTime()) ? '' : startDate.toISOString(),
        end: Number.isNaN(endDate.getTime()) ? '' : endDate.toISOString(),
      };
    })
    .sort((a: any, b: any) => {
      const keyA = `${a.label}|${a.start}|${a.end}`;
      const keyB = `${b.label}|${b.start}|${b.end}`;
      return keyA.localeCompare(keyB);
    });
}

function areSegmentsEquivalent(left: any[], right: any[]) {
  return JSON.stringify(normalizeSegmentsForCompare(left || [])) === JSON.stringify(normalizeSegmentsForCompare(right || []));
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
  onNavigateToRelatedItem,
  forceRichEditor = false,
  maxVisible
}) => {
  const sizeClasses = {
    xs: 'text-[10px] h-7',
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
    const selectedValues: string[] = normalizeRelationIds(value);
    return (
      <LightMultiSelect
        options={property.options || []}
        values={selectedValues}
        onChange={onChange}
        className={className}
        sizeClass={sizeClasses}
        disabled={readOnly}
        maxVisible={maxVisible}
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
    const [segmentApplyDialog, setSegmentApplyDialog] = useState<{ autoSegments: any[]; latestItem: any } | null>(null);
    const baselineItemRef = useRef<any>(null);
    const latestItemRef = useRef<any>(null);
    const selectedDate = value && !isNaN(new Date(value).getTime()) ? new Date(value) : undefined;
    const durationKey = `${property.id}_duration`;
    const currentDuration = currentItem?.[durationKey] || property.defaultDuration || 1;
    const dateGranularity = property.dateGranularity || 'full';
    const includeDuration = property.includeDuration !== false;

    const handleEventUpdate = useCallback((propId: string, val: any) => {
      const baseItem = latestItemRef.current || currentItem || {};
      const updated = { ...baseItem, [propId]: val };
      latestItemRef.current = updated;
      if (propId === property.id && typeof onChange === 'function') {
        onChange(val);
      }
      if (typeof onRelationChange === 'function') {
        // Always send the date field value as 3rd arg to avoid consumers
        // writing a duration number into the date field.
        onRelationChange(property, updated, updated[property.id]);
      }
    }, [currentItem, onChange, onRelationChange, property]);

    const handleDatePopoverOpenChange = useCallback((nextOpen: boolean) => {
      if (nextOpen) {
        baselineItemRef.current = currentItem ? { ...currentItem } : null;
        latestItemRef.current = currentItem ? { ...currentItem } : null;
        setOpen(true);
        return;
      }

      setOpen(false);

      if (!includeDuration || dateGranularity !== 'full' || !collection || !currentItem) return;

      const baseline = baselineItemRef.current || currentItem;
      const latest = latestItemRef.current || currentItem;
      if (!baseline || !latest) return;

      const dateChanged = JSON.stringify(baseline[property.id] ?? null) !== JSON.stringify(latest[property.id] ?? null);
      const durationChanged = JSON.stringify(baseline[durationKey] ?? null) !== JSON.stringify(latest[durationKey] ?? null);
      if (!dateChanged && !durationChanged) return;

      const manualSegments = (latest._eventSegments || []).filter((seg: any) => seg.label === property.name);
      const autoSegments = calculateSegmentsClient(latest, collection).filter((seg: any) => seg.label === property.name);
      const hasDiff = !areSegmentsEquivalent(manualSegments, autoSegments);

      if (autoSegments.length > 0 && hasDiff && !readOnly) {
        setSegmentApplyDialog({ autoSegments, latestItem: latest });
      }
    }, [collection, currentItem, dateGranularity, durationKey, includeDuration, property, readOnly]);

    // Fonction pour formater la date selon la granularité (importée depuis groupingUtils)
    const formatDateForDisplay = (date: Date) => {
      if (!date || isNaN(date.getTime())) return '';
      return formatDateByGranularity(date.toISOString(), dateGranularity);
    };

    const getTimeOptions = () => {
      const options = [];
      const minHour = Math.max(0, Math.floor(workDayStart - 1));
      const maxHour = Math.min(23, Math.ceil(workDayEnd + 1));
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
    // Utiliser selectedDate (déjà validé) pour éviter le crash si value est une
    // string non-ISO comme "2026" (venant du groupContext d'un champ date/year)
    const currentTime = selectedDate ? format(selectedDate, 'HH:mm') : `${String(workDayStart).padStart(2, '0')}:00`;
    const isValidDate = (d: Date) => !Number.isNaN(d.getTime());
    const getSafeWorkingDate = () => {
      const latestValue = latestItemRef.current?.[property.id];
      const sourceValue = latestValue ?? value;
      const parsed = sourceValue ? new Date(sourceValue) : new Date();
      if (isValidDate(parsed)) return parsed;
      const fallback = new Date();
      fallback.setHours(9, 0, 0, 0);
      return fallback;
    };

    return (
      <>
      <Popover open={open} onOpenChange={handleDatePopoverOpenChange}>
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
            {value ? formatDateForDisplay(selectedDate!) : (
              dateGranularity === 'month' ? 'Choisir un mois' :
              dateGranularity === 'month-year' ? 'Choisir un mois et une année' :
              dateGranularity === 'year' ? 'Choisir une année' :
              'Choisir une date et heure'
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-background dark:bg-neutral-900 border-neutral-700" align="start">
          <div className="flex flex-row gap-4 p-3">
            {includeDuration && onRelationChange && currentItem && dateGranularity === 'full' && (
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
            {dateGranularity === 'month' ? (
              <div className="flex flex-col gap-2 p-2 min-w-[200px]">
                <label className="block text-xs font-medium text-neutral-400">Sélectionner un mois</label>
                <select
                  value={selectedDate ? selectedDate.getMonth() : new Date().getMonth()}
                  onChange={(e) => {
                    const month = parseInt(e.target.value);
                    if (!Number.isFinite(month)) return;
                    const year = selectedDate ? selectedDate.getFullYear() : new Date().getFullYear();
                    const date = new Date(year, month, 1, 9, 0, 0, 0);
                    if (!isValidDate(date)) return;
                    handleEventUpdate(property.id, date.toISOString());
                  }}
                  className="w-full px-3 py-2 bg-background dark:bg-neutral-800/50 border border-white/10 rounded text-sm text-black dark:text-white"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{format(new Date(2000, i, 1), 'MMMM', { locale: fr })}</option>
                  ))}
                </select>
              </div>
            ) : dateGranularity === 'month-year' ? (
              <div className="flex flex-col gap-2 p-2 min-w-[200px]">
                <label className="block text-xs font-medium text-neutral-400">Sélectionner un mois et une année</label>
                <select
                  value={selectedDate ? selectedDate.getMonth() : new Date().getMonth()}
                  onChange={(e) => {
                    const month = parseInt(e.target.value);
                    if (!Number.isFinite(month)) return;
                    const year = selectedDate ? selectedDate.getFullYear() : new Date().getFullYear();
                    const date = new Date(year, month, 1, 9, 0, 0, 0);
                    if (!isValidDate(date)) return;
                    handleEventUpdate(property.id, date.toISOString());
                  }}
                  className="w-full px-3 py-2 bg-background dark:bg-neutral-800/50 border border-white/10 rounded text-sm text-black dark:text-white"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>{format(new Date(2000, i, 1), 'MMMM', { locale: fr })}</option>
                  ))}
                </select>
                <select
                  value={selectedDate ? selectedDate.getFullYear() : new Date().getFullYear()}
                  onChange={(e) => {
                    const year = parseInt(e.target.value);
                    if (!Number.isFinite(year)) return;
                    const month = selectedDate ? selectedDate.getMonth() : new Date().getMonth();
                    const date = new Date(year, month, 1, 9, 0, 0, 0);
                    if (!isValidDate(date)) return;
                    handleEventUpdate(property.id, date.toISOString());
                  }}
                  className="w-full px-3 py-2 bg-background dark:bg-neutral-800/50 border border-white/10 rounded text-sm text-black dark:text-white"
                >
                  {Array.from({ length: 21 }, (_, i) => 2020 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            ) : dateGranularity === 'year' ? (
              <div className="flex flex-col gap-2 p-2 min-w-[200px]">
                <label className="block text-xs font-medium text-neutral-400">Sélectionner une année</label>
                <select
                  value={selectedDate ? selectedDate.getFullYear() : new Date().getFullYear()}
                  onChange={(e) => {
                    const year = parseInt(e.target.value);
                    if (!Number.isFinite(year)) return;
                    const date = new Date(year, 0, 1, 9, 0, 0, 0);
                    if (!isValidDate(date)) return;
                    handleEventUpdate(property.id, date.toISOString());
                  }}
                  className="w-full px-3 py-2 bg-background dark:bg-neutral-800/50 border border-white/10 rounded text-sm text-black dark:text-white"
                >
                  {Array.from({ length: 21 }, (_, i) => 2020 + i).map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      const baseDateValue = latestItemRef.current?.[property.id] ?? value;
                      const existingDate = baseDateValue ? new Date(baseDateValue) : null;
                      if (existingDate && !isNaN(existingDate.getTime())) {
                        date.setHours(existingDate.getHours(), existingDate.getMinutes());
                      } else {
                        date.setHours(9, 0);
                      }
                      if (!isValidDate(date)) return;
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
                      const parsedHours = parseInt(hours);
                      const parsedMinutes = parseInt(minutes);
                      if (!Number.isFinite(parsedHours) || !Number.isFinite(parsedMinutes)) return;
                      const d = getSafeWorkingDate();
                      d.setHours(parsedHours, parsedMinutes, 0, 0);
                      if (!isValidDate(d)) return;
                      handleEventUpdate(property.id, d.toISOString());
                    }}
                    className="w-full h-50 text-center bg-background text-black dark:bg-neutral-900 dark:text-white border-l border-white/10 text-lg focus:border-violet-500 focus:outline-none overflow-y-scroll"
                    size={9}
                    style={{ WebkitAppearance: 'none', appearance: 'none' }}
                  >
                    {timeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {segmentApplyDialog && (
        <div
          className="fixed inset-0 z-[420] bg-black/60 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setSegmentApplyDialog(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-base font-semibold text-foreground">Appliquer les plages calculees ?</div>
            <div className="mt-2 text-sm text-muted-foreground">
              Les plages auto sont differentes des plages personnalisees. Voulez-vous appliquer les plages calculees maintenant ?
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSegmentApplyDialog(null)}
                className="px-3 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              >
                Garder mes plages
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!segmentApplyDialog) return;
                  const propName = property.name;
                  const latest = segmentApplyDialog.latestItem || currentItem || {};
                  const otherSegments = (latest._eventSegments || []).filter((seg: any) => seg.label !== propName);
                  const merged = {
                    ...latest,
                    _eventSegments: [...otherSegments, ...segmentApplyDialog.autoSegments],
                    _preserveEventSegments: false,
                  };
                  if (typeof onChange === 'function') onChange(merged[property.id]);
                  if (typeof onRelationChange === 'function') onRelationChange(property, merged, merged[property.id]);
                  setSegmentApplyDialog(null);
                }}
                className="px-3 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
              >
                Appliquer les plages auto
              </button>
            </div>
          </div>
        </div>
      )}
      </>
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
      const rawValue = nameField ? it[nameField.id] : it.name;

      if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim();
        return trimmed || 'Sans titre';
      }

      if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
        return String(rawValue);
      }

      if (rawValue && typeof rawValue === 'object') {
        const candidate = rawValue.name ?? rawValue.label ?? rawValue.title ?? rawValue.value ?? rawValue.appid ?? rawValue.id;
        if (candidate !== null && candidate !== undefined && String(candidate).trim()) {
          return String(candidate);
        }
      }

      return 'Sans titre';
    }, [targetCollection]);
    const getItemLabel = useCallback((it: any) => getItemName(it), [getItemName]);

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
        getItemLabel={getItemLabel}
        onRelationChange={onRelationChange ?? (() => {})}
        readOnly={readOnly}
        className={className}
        size={size}
        onNavigateToCollection={onNavigateToCollection}
        onNavigateToRelatedItem={onNavigateToRelatedItem}
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

  // Steam
  if (property.type === 'steam') {
    return (
      <SteamPropertyField
        value={value || ''}
        onChange={onChange}
        disabled={readOnly}
      />
    );
  }

  // Number
  if (property.type === 'number') {
    const isCalculated = property.numberMode === 'calculated' || Boolean(property.calculation);
    return (
      <NumberInput
        value={value}
        onChange={onChange}
        sizeClasses={sizeClasses}
        className={className}
        readOnly={readOnly || isCalculated}
        prefix={property.numberPrefix}
        suffix={property.numberSuffix}
      />
    );
  }

  // URL
  if (property.type === 'url') {
    return <UrlInput value={value || ''} onChange={onChange} sizeClasses={sizeClasses} className={className} readOnly={readOnly} />;
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