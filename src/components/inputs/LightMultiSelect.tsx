import React from 'react';
import * as Icons from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { OptionType } from './LightSelect';

interface LightMultiSelectProps {
  options: OptionType[];
  values: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
  sizeClass?: string;
  className?: string;
}

const getOptionValue = (opt: OptionType) => typeof opt === 'string' ? opt : opt.value;
const getOptionColor = (opt: OptionType) => typeof opt === 'string' ? '#8b5cf6' : (opt.color || '#8b5cf6');
const getOptionIcon = (opt: OptionType) => typeof opt === 'string' ? null : (opt.icon || null);

export const LightMultiSelect: React.FC<LightMultiSelectProps> = ({ options, values, onChange, placeholder = 'Aucun', sizeClass = 'text-sm h-8', className }) => {
  const selectedValues: string[] = Array.isArray(values) ? values : (values ? [values] : []);

  return (
    <div className={cn('flex items-center gap-2', sizeClass, className)}>
      <div className="flex flex-wrap gap-1 flex-1">
        {selectedValues.map((val) => {
          const opt = options.find((o) => getOptionValue(o) === val);
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
          <span className="text-xs text-neutral-500">{placeholder}</span>
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
            {options.map((opt) => {
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
            {options.length === 0 && (
              <div className="text-xs text-neutral-500 px-2 py-1">Aucune option</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
