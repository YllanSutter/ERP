import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, ChevronDown } from 'lucide-react';
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
  // Relations support
  collections?: any[];
  currentItem?: any;
  onRelationChange?: (property: any, item: any, value: any) => void;
  onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
}

const EditableProperty: React.FC<EditablePropertyProps> = ({
  property,
  value,
  onChange,
  size = 'md',
  isNameField = false,
  onViewDetail,
  className,
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

  // Si c'est le champ nom et qu'on a un callback de détail, afficher comme un lien
  if (isNameField && onViewDetail) {
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
    const getOptionValue = (opt: any) => typeof opt === 'string' ? opt : opt.value;
    const getOptionColor = (opt: any) => typeof opt === 'string' ? '#8b5cf6' : (opt.color || '#8b5cf6');
    const getOptionIcon = (opt: any) => typeof opt === 'string' ? null : (opt.icon || null);
    const selectedOption = property.options?.find((opt: any) => getOptionValue(opt) === value);
    const selectedColor = selectedOption ? getOptionColor(selectedOption) : '#8b5cf6';
    const selectedIconName = selectedOption ? getOptionIcon(selectedOption) : null;
    const SelectedIcon = selectedIconName ? (Icons as any)[selectedIconName] || null : null;

    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex flex-wrap gap-1 flex-1">
          {selectedOption ? (
            <span className="px-2 py-0.5 text-xs rounded bg-white/10 border border-white/10 inline-flex items-center gap-2" style={{ borderColor: `${selectedColor}55` }}>
              {SelectedIcon && <SelectedIcon size={12} />}
              <span>{getOptionValue(selectedOption)}</span>
            </span>
          ) : (
            <span className="text-xs text-neutral-500">Aucun</span>
          )}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-neutral-200"
              title="Choisir"
            >
              <Icons.Plus size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2 bg-neutral-900 border-neutral-700" align="start">
            <div className="space-y-1 max-h-64 overflow-y-auto text-sm">
              <button
                className="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-neutral-300"
                onClick={() => onChange('')}
              >
                Aucun
              </button>
              {property.options?.map((opt: any) => {
                const optValue = getOptionValue(opt);
                const optColor = getOptionColor(opt);
                const iconName = getOptionIcon(opt);
                const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
                return (
                  <button
                    key={optValue}
                    className="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-neutral-100 flex items-center gap-2"
                    onClick={() => onChange(optValue)}
                  >
                    {OptIcon && <OptIcon size={12} />}
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: optColor }} />
                    <span className="truncate">{optValue}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Multi-select - puces + bouton + avec cases à cocher
  if (property.type === 'multi_select') {
    const getOptionValue = (opt: any) => typeof opt === 'string' ? opt : opt.value;
    const getOptionColor = (opt: any) => typeof opt === 'string' ? '#8b5cf6' : (opt.color || '#8b5cf6');
    const getOptionIcon = (opt: any) => typeof opt === 'string' ? null : (opt.icon || null);
    const selectedValues: string[] = Array.isArray(value) ? value : (value ? [value] : []);

    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex flex-wrap gap-1 flex-1">
          {selectedValues.map((val: string) => {
            const opt = property.options?.find((o: any) => getOptionValue(o) === val);
            const color = opt ? getOptionColor(opt) : '#8b5cf6';
            const iconName = opt ? getOptionIcon(opt) : null;
            const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
            return (
              <span key={val} className="px-2 py-0.5 text-xs rounded bg-white/10 border border-white/10 inline-flex items-center gap-2" style={{ borderColor: `${color}55` }}>
                {OptIcon && <OptIcon size={12} />}
                <span>{val}</span>
              </span>
            );
          })}
          {selectedValues.length === 0 && (
            <span className="text-xs text-neutral-500">Aucun</span>
          )}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-neutral-200"
              title="Ajouter / gérer"
            >
              <Icons.Plus size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 bg-neutral-900 border-neutral-700" align="start">
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {property.options?.map((opt: any) => {
                const optValue = getOptionValue(opt);
                const optColor = getOptionColor(opt);
                const iconName = getOptionIcon(opt);
                const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
                const checked = selectedValues.includes(optValue);
                return (
                  <label key={optValue} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selectedValues, optValue]
                          : selectedValues.filter((v) => v !== optValue);
                        onChange(next);
                      }}
                    />
                    {OptIcon && <OptIcon size={12} />}
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: optColor }} />
                    <span className="truncate">{optValue}</span>
                  </label>
                );
              })}
              {(property.options || []).length === 0 && (
                <div className="text-xs text-neutral-500 px-2 py-1">Aucune option</div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  // Checkbox - toujours affiché
  if (property.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={value || false}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 cursor-pointer"
      />
    );
  }

  // Date - toujours affiché
  if (property.type === 'date') {
    const [open, setOpen] = useState(false);
    const selectedDate = value ? new Date(value) : undefined;
    
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "w-full px-2 py-1 bg-transparent border border-transparent text-left text-white hover:border-white/10 rounded transition-colors flex items-center gap-2",
              sizeClasses[size],
              !value && "text-neutral-600",
              className
            )}
          >
            <CalendarIcon size={14} className="opacity-50" />
            {value ? format(selectedDate!, 'dd MMM yyyy', { locale: fr }) : 'Choisir une date'}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-700" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              onChange(date ? format(date, 'yyyy-MM-dd') : '');
              setOpen(false);
            }}
            initialFocus
            className="bg-neutral-900 text-white"
          />
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
    const targetItems = targetCollection?.items || [];

    const isSourceMany = relationType === 'one_to_many' || relationType === 'many_to_many';

    // Popovers en mode non contrôlé (ouverture au clic simple)

    const getItemName = (it: any) => {
      const nameField = targetCollection?.properties?.find((p: any) => p.id === 'name' || p.name === 'Nom');
      return nameField ? it[nameField.id] || 'Sans titre' : it.name || 'Sans titre';
    };

    // Vue de liste via icône
    const ViewerButton = (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-neutral-300",
              sizeClasses[size]
            )}
            title="Voir les éléments liés"
          >
            <Icons.List size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[720px] p-2 bg-neutral-900 border-neutral-700" align="start">
          <div className="text-sm text-neutral-300 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between px-2 pb-2 border-b border-white/10">
              <span className="text-xs text-neutral-400">{targetCollection?.name}</span>
              {onNavigateToCollection && (
                <button
                  className="text-xs text-cyan-300 hover:text-cyan-200 hover:underline"
                  onClick={() => {
                    const linkedIds = isSourceMany ? (Array.isArray(value) ? value : []) : (value ? [value] : []);
                    onNavigateToCollection(targetCollectionId, linkedIds);
                  }}
                >
                  Ouvrir la collection
                </button>
              )}
            </div>
            <table className="w-full text-left text-xs">
              <thead className="text-neutral-500 sticky top-0 bg-neutral-900">
                <tr>
                  {(targetCollection?.properties || []).map((p: any) => (
                    <th key={p.id} className="py-1 px-2 font-semibold">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const linkedIds = isSourceMany ? (Array.isArray(value) ? value : []) : (value ? [value] : []);
                  const linkedItems = targetItems.filter((ti: any) => linkedIds.includes(ti.id));
                  if (linkedItems.length === 0) {
                    return (
                      <tr>
                        <td className="py-2 px-2 text-neutral-500" colSpan={(targetCollection?.properties || []).length || 1}>Aucun</td>
                      </tr>
                    );
                  }
                  const formatCell = (val: any, prop: any) => {
                    if (val == null || val === '') return '-';
                    switch (prop.type) {
                      case 'date':
                        try { return format(new Date(val), 'dd MMM yyyy', { locale: fr }); } catch { return String(val); }
                      case 'date_range':
                        return val?.start && val?.end ? `${format(new Date(val.start), 'dd MMM yyyy', { locale: fr })} - ${format(new Date(val.end), 'dd MMM yyyy', { locale: fr })}` : '-';
                      case 'checkbox':
                        return val ? '✓' : '✗';
                      case 'url':
                        return (<a href={val} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{val}</a>);
                      case 'multi_select':
                        return Array.isArray(val) ? val.join(', ') : String(val);
                      case 'relation':
                        return Array.isArray(val) ? `${val.length} lié(s)` : (val ? '1 lié' : '-');
                      default:
                        return String(val);
                    }
                  };
                  return linkedItems.map((it: any) => (
                    <tr key={it.id} className="hover:bg-white/5">
                      {(targetCollection?.properties || []).map((p: any) => (
                        <td key={p.id} className="py-1 px-2">
                          {p.id === 'name' || p.name === 'Nom' ? getItemName(it) : formatCell(it[p.id], p)}
                        </td>
                      ))}
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </PopoverContent>
      </Popover>
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
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-neutral-200"
                title="Ajouter / changer"
              >
                <Icons.Plus size={14} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 bg-neutral-900 border-neutral-700" align="start">
              <div className="space-y-1 max-h-64 overflow-y-auto text-sm">
                <button
                  className="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-neutral-300"
                  onClick={() => onRelationChange(property, currentItem, null)}
                >
                  Aucun
                </button>
                {targetItems.map((ti: any) => (
                  <button
                    key={ti.id}
                    className="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-neutral-100"
                    onClick={() => onRelationChange(property, currentItem, ti.id)}
                  >
                    {getItemName(ti)}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {ViewerButton}
        </div>
      );
    }

    // Sélection multiple via popover + chips
    const selectedIds = Array.isArray(value) ? value : [];
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
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-neutral-200"
              title="Ajouter / gérer"
            >
              <Icons.Plus size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 bg-neutral-900 border-neutral-700" align="start">
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {targetItems.map((ti: any) => {
                const checked = selectedIds.includes(ti.id);
                return (
                  <label key={ti.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selectedIds, ti.id]
                          : selectedIds.filter((id: string) => id !== ti.id);
                        onRelationChange(property, currentItem, next);
                      }}
                    />
                    <span className="truncate">{getItemName(ti)}</span>
                  </label>
                );
              })}
              {targetItems.length === 0 && (
                <div className="text-xs text-neutral-500 px-2 py-1">Aucun élément dans la collection</div>
              )}
            </div>
          </PopoverContent>
        </Popover>
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
        className={cn(
          "w-full px-2 py-1 bg-transparent border border-transparent text-white placeholder-neutral-600 focus:border-white/10 focus:outline-none transition-colors",
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

  return (
    <input
      type={inputType}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={value ? '' : '-'}
      className={cn(
        "w-full px-2 py-1 bg-transparent border border-transparent text-white placeholder-neutral-600 focus:border-white/10 focus:outline-none transition-colors",
        sizeClasses[size],
        className
      )}
    />
  );
};

export default EditableProperty;
