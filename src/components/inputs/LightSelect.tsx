import React from 'react';
import * as Icons from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

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
          <span className="px-2 py-0.5 text-xs rounded bg-white/10 inline-flex items-center gap-2" style={{ backgroundColor: `${selectedColor}15` }}>
            {SelectedIcon && <SelectedIcon size={12} />}
            <span>{getOptionValue(selectedOption)}</span>
          </span>
        ) : (
          <span className="text-xs text-neutral-500">{placeholder}</span>
        )}
      </div>
      {!disabled && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-neutral-200"
              title="Choisir"
            >
              <Icons.Plus size={14} />
            </button>
          </PopoverTrigger>
        <PopoverContent className="w-56 p-2 bg-neutral-900 border-neutral-700 z-[400]" align="start">
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
      )}
    </div>
  );
};
