import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
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
}

const EditableProperty: React.FC<EditablePropertyProps> = ({
  property,
  value,
  onChange,
  size = 'md',
  isNameField = false,
  onViewDetail,
  className
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

  // Select - toujours affiché
  if (property.type === 'select') {
    const getOptionValue = (opt: any) => typeof opt === 'string' ? opt : opt.value;
    const getOptionColor = (opt: any) => typeof opt === 'string' ? '#8b5cf6' : (opt.color || '#8b5cf6');
    const getOptionIcon = (opt: any) => typeof opt === 'string' ? null : (opt.icon || null);
    const selectedOption = property.options?.find((opt: any) => getOptionValue(opt) === value);
    const selectedColor = selectedOption ? getOptionColor(selectedOption) : '#8b5cf6';
    const selectedIconName = selectedOption ? getOptionIcon(selectedOption) : null;
    const SelectedIcon = selectedIconName ? (Icons as any)[selectedIconName] || null : null;

    return (
      <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger
            className={cn(
              "w-full bg-neutral-800/50 border-white/10 hover:border-violet-500/50 text-white transition-colors",
              sizeClasses[size],
              className
            )}
            style={{ borderLeftColor: selectedColor, borderLeftWidth: '3px' }}
          >
            <div className="flex items-center gap-2 w-full">
              {SelectedIcon && <SelectedIcon size={14} />}
              <span>{selectedOption ? getOptionValue(selectedOption) : 'Sélectionner...'}</span>
            </div>
          </SelectTrigger>
        <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
          {property.options?.map((opt: any) => {
            const optValue = getOptionValue(opt);
            const optColor = getOptionColor(opt);
            const iconName = getOptionIcon(opt);
            const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
            return (
              <SelectItem 
                key={optValue} 
                value={optValue} 
                className="focus:bg-violet-500/20 focus:text-white"
              >
                <div className="flex items-center gap-2">
                  {OptIcon && <OptIcon size={14} />}
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: optColor }} />
                  <span>{optValue}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
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
