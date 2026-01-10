import React from 'react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { PopoverButton } from './PopoverButton';

export type OptionType = string | { value: string; color?: string; icon?: string };

interface LightSelectProps {
  options: OptionType[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  sizeClass?: string;
  className?: string;
  disabled?: boolean;
}

const getOptionValue = (opt: OptionType) => typeof opt === 'string' ? opt : opt.value;
const getOptionColor = (opt: OptionType) => typeof opt === 'string' ? '#8b5cf6' : (opt.color || '#8b5cf6');
const getOptionIcon = (opt: OptionType) => typeof opt === 'string' ? null : (opt.icon || null);

export const LightSelect: React.FC<LightSelectProps> = ({ options, value, onChange, placeholder = 'Aucun', sizeClass = 'text-sm h-8', className, disabled = false }) => {
  const selectedOption = options.find((opt) => getOptionValue(opt) === value);
  const selectedColor = selectedOption ? getOptionColor(selectedOption) : '#8b5cf6';
  const selectedIconName = selectedOption ? getOptionIcon(selectedOption) : null;
  const SelectedIcon = selectedIconName ? (Icons as any)[selectedIconName] || null : null;

  return (
    <div className={cn('flex items-center gap-2', sizeClass, className)}>
      <div className="flex flex-wrap gap-1 flex-1">
        {selectedOption ? (
          <span
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 border border-white/10 hover:bg-white/20 transition cursor-pointer group"
            style={{ backgroundColor: `${selectedColor}22`, borderColor: `${selectedColor}55` }}
          >
            {SelectedIcon && <SelectedIcon size={13} className="opacity-80" />}
            <span>{getOptionValue(selectedOption)}</span>
            <button
              type="button"
              className="ml-1 text-neutral-400 hover:text-red-400 rounded-full p-0.5 -mr-1 group-hover:opacity-100 opacity-60 transition"
              onClick={() => onChange("")}
              tabIndex={-1}
              aria-label={`Retirer ${getOptionValue(selectedOption)}`}
            >
              <Icons.X size={12} />
            </button>
          </span>
        ) : (
          <span className="text-xs text-neutral-500">{placeholder}</span>
        )}
      </div>
      {!disabled && (
        <PopoverButton
          icon="Plus"
          title="Ajouter / gérer"
          isAbsolute
          size={14}
          contentClassName="w-56"
        >
          <div className="space-y-1 max-h-64 overflow-y-auto text-sm">
            <button
              className="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-neutral-300"
              onClick={() => onChange('')}
            >
              Aucun
            </button>
            {options.map((opt) => {
              const optValue = getOptionValue(opt);
              const optColor = getOptionColor(opt);
              const iconName = getOptionIcon(opt);
              const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
              return (
                <button
                  key={optValue}
                  className="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-neutral-100 flex items-center gap-2"
                  onClick={() => onChange(optValue)}
                  style={{ color: optColor }}
                >
                  {OptIcon && <OptIcon size={12} />}
                  <span className="truncate text-white">{optValue}</span>
                </button>
              );
            })}
          </div>
        </PopoverButton>
      )}
    </div>
  );
};
