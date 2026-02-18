import React from 'react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { OptionType } from './LightSelect';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/tiptap-ui-primitive/tooltip';
import { PopoverButton } from './PopoverButton';

interface LightMultiSelectProps {
  options: OptionType[];
  values: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
  sizeClass?: string;
  className?: string;
  disabled?: boolean;
  getOptionLabel?: (opt: OptionType) => string;
  maxVisible?: number;
}

const getOptionValue = (opt: OptionType) => typeof opt === 'string' ? opt : opt.value;
const getOptionColor = (opt: OptionType) => typeof opt === 'string' ? '#8b5cf6' : (opt.color || '#8b5cf6');
const getOptionIcon = (opt: OptionType) => typeof opt === 'string' ? null : (opt.icon || null);

export const LightMultiSelect: React.FC<LightMultiSelectProps> = ({ options, values, onChange, placeholder = 'Aucun', sizeClass = 'text-sm h-8', className, disabled = false, getOptionLabel, maxVisible }) => {
  const selectedValues: string[] = Array.isArray(values) ? values : (values ? [values] : []);
  const MAX_VISIBLE = typeof maxVisible === 'number' ? maxVisible : 2;

  // Fonction pour retirer un tag
  const removeValue = (val: string) => {
    onChange(selectedValues.filter((v) => v !== val));
  };

  // Fonction pour ajouter ou retirer une valeur depuis la popover
  const toggleValue = (val: string) => {
    if (selectedValues.includes(val)) {
      removeValue(val);
    } else {
      onChange([...selectedValues, val]);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', sizeClass, className)}>
      <div
        className="flex gap-1 flex-1 overflow-x-auto whitespace-nowrap min-w-0"
        style={{ maxWidth: 320 }}
      >
        {selectedValues.length === 0 && (
          <span className="text-xs text-neutral-500 items-center flex">{placeholder}</span>
        )}
        {selectedValues.slice(0, MAX_VISIBLE).map((val) => {
          const opt = options.find((o) => getOptionValue(o) === val);
          const color = opt ? getOptionColor(opt) : '#8b5cf6';
          const iconName = opt ? getOptionIcon(opt) : null;
          const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
          const label = opt ? (getOptionLabel ? getOptionLabel(opt) : (typeof opt === 'string' ? opt : (opt.label || opt.value))) : val;
          return (
            <span
              key={val}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[xs] font-medium bg-white/10 border border-white/10 hover:bg-white/20 transition cursor-pointer group"
              style={{ backgroundColor: `${color}22`, borderColor: `${color}55` }}
            >
              {OptIcon && <OptIcon size={13} className="opacity-80" />}
              <span className="text-xs">{label}</span>
              <button
                type="button"
                className="ml-1 text-neutral-700 hover:text-red-800 dark:text-white dark:hover:text-red-400 rounded-full p-0.5 -mr-1 group-hover:opacity-100 opacity-60 transition"
                onClick={() => removeValue(val)}
                tabIndex={-1}
                aria-label={`Retirer ${label}`}
              >
                <Icons.X size={12} />
              </button>
            </span>
          );
        })}
        {selectedValues.length > MAX_VISIBLE && (
          <Tooltip delay={200}>
            <TooltipTrigger asChild>
              <span
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 border border-white/10 cursor-default select-none"
                tabIndex={0}
                style={{ outline: 'none' }}
              >
                +{selectedValues.length - MAX_VISIBLE} 
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="max-w-xs whitespace-pre-line text-xs">
                {selectedValues.slice(MAX_VISIBLE).map(val => {
                  const opt = options.find((o) => getOptionValue(o) === val);
                  return opt ? (getOptionLabel ? getOptionLabel(opt) : (typeof opt === 'string' ? opt : (opt.label || opt.value))) : val;
                }).join(', ')}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {!disabled && (
        <PopoverButton
          icon="Plus"
          title="Ajouter / gérer"
          isAbsolute
          size={14}
          contentClassName="w-64"
        >
          <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
            {options.map((opt) => {
              const optValue = getOptionValue(opt);
              const optColor = getOptionColor(opt);
              const iconName = getOptionIcon(opt);
              const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
              const checked = selectedValues.includes(optValue);
              const label = getOptionLabel ? getOptionLabel(opt) : (typeof opt === 'string' ? opt : (opt.label || opt.value));
              return (
                <button
                  key={optValue}
                  type="button"
                  className={cn(
                    'px-2 py-1 rounded-full text-xs border transition flex items-center gap-1',
                    checked ? 'font-semibold' : 'hover:bg-black/10 dark:hover:bg-white/10'
                  )}
                  style={checked ? { backgroundColor: `${optColor}22`, borderColor: `${optColor}55`, color: optColor } : {  }}
                  onClick={() => toggleValue(optValue)}
                >
                  {OptIcon && <OptIcon size={12} className="opacity-80" />}
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
            {options.length === 0 && (
              <div className="text-xs text-neutral-500 px-2 py-1">Aucune option</div>
            )}
          </div>
        </PopoverButton>
      )}
    </div>
  );
};
