import React from 'react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { OptionType } from './LightSelect';
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
}

const getOptionValue = (opt: OptionType) => typeof opt === 'string' ? opt : opt.value;
const getOptionColor = (opt: OptionType) => typeof opt === 'string' ? '#8b5cf6' : (opt.color || '#8b5cf6');
const getOptionIcon = (opt: OptionType) => typeof opt === 'string' ? null : (opt.icon || null);

export const LightMultiSelect: React.FC<LightMultiSelectProps> = ({ options, values, onChange, placeholder = 'Aucun', sizeClass = 'text-sm h-8', className, disabled = false, getOptionLabel }) => {
  const selectedValues: string[] = Array.isArray(values) ? values : (values ? [values] : []);

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
      {!disabled && (
        <PopoverButton
          icon="Plus"
          title="Ajouter / gérer"
          isAbsolute
          size={14}
          contentClassName="w-64"
        >
          <div className="space-y-1 max-h-64 overflow-y-auto">
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
                    'flex items-center gap-2 w-full px-2 py-1 rounded text-sm transition',
                    checked
                      ? 'bg-violet-600/20 text-violet-200 font-semibold'
                      : 'hover:bg-white/10 text-white'
                  )}
                  style={checked ? { backgroundColor: `${optColor}22`, color: optColor } : {}}
                  onClick={() => toggleValue(optValue)}
                >
                  <span className={cn('inline-flex items-center justify-center w-4 h-4 rounded-full border', checked ? 'bg-violet-500 border-violet-400' : 'bg-white/5 border-white/20')}
                    style={checked ? { backgroundColor: optColor, borderColor: optColor } : {}}>
                    {checked && <Icons.Check size={12} className="text-white" />}
                  </span>
                  {OptIcon && <OptIcon size={13} className="opacity-80" />}
                  <span className="truncate flex-1 text-left">{label}</span>
                </button>
              );
            })}
            {options.length === 0 && (
              <div className="text-xs text-neutral-500 px-2 py-1">Aucune option</div>
            )}
          </div>
        </PopoverButton>
      )}
      <div className="flex  gap-1 flex-1">
        {selectedValues.length === 0 && (
          <span className="text-xs text-neutral-500 items-center flex">{placeholder}</span>
        )}
        {selectedValues.map((val) => {
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
      </div>
    </div>
  );
};
