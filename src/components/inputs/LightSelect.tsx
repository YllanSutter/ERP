import React from 'react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeRelationIds } from '@/lib/utils/relationUtils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/tiptap-ui-primitive/tooltip';
import { PopoverButton } from './PopoverButton';

export type OptionType = string | { value: string; label?: string; color?: string; icon?: string };

const getOptionValue = (opt: OptionType) => typeof opt === 'string' ? opt : opt.value;
const getOptionColor = (opt: OptionType) => typeof opt === 'string' ? '#8b5cf6' : (opt.color || '#8b5cf6');
const getOptionIcon = (opt: OptionType) => typeof opt === 'string' ? null : (opt.icon || null);
const defaultGetOptionLabel = (opt: OptionType) => typeof opt === 'string' ? opt : (opt.label || opt.value);

interface LightSelectBaseProps {
  options: OptionType[];
  placeholder?: string;
  sizeClass?: string;
  className?: string;
  disabled?: boolean;
  getOptionLabel?: (opt: OptionType) => string;
}

interface LightSelectSingleProps extends LightSelectBaseProps {
  multiple?: false;
  value: string;
  onChange: (val: string) => void;
  values?: never;
  maxVisible?: never;
}

interface LightSelectMultiProps extends LightSelectBaseProps {
  multiple: true;
  values: string[];
  onChange: (vals: string[]) => void;
  value?: never;
  maxVisible?: number;
}

export type LightSelectProps = LightSelectSingleProps | LightSelectMultiProps;

export const LightSelect: React.FC<LightSelectProps> = (props) => {
  const { options, placeholder = 'Aucun', sizeClass = 'text-sm h-8', className, disabled = false, getOptionLabel: getOptLabel } = props;

  const resolveLabel = (opt: OptionType) => getOptLabel ? getOptLabel(opt) : defaultGetOptionLabel(opt);

  if (props.multiple) {
    const { values, onChange, maxVisible } = props;
    const selectedValues = normalizeRelationIds(values);
    const MAX_VISIBLE = typeof maxVisible === 'number' ? maxVisible : 2;

    const removeValue = (val: string) => onChange(selectedValues.filter(v => v !== val));
    const toggleValue = (val: string) => {
      if (selectedValues.includes(val)) removeValue(val);
      else onChange([...selectedValues, val]);
    };

    return (
      <div className={cn('flex items-center gap-2', sizeClass, className)}>
        <div className="flex gap-1 flex-1 overflow-x-auto whitespace-nowrap min-w-0" style={{ maxWidth: 320 }}>
          {selectedValues.length === 0 && (
            <span className="text-neutral-500 items-center flex text-[9px]">{placeholder}</span>
          )}
          {selectedValues.slice(0, MAX_VISIBLE).map((val) => {
            const opt = options.find(o => getOptionValue(o) === val);
            const color = opt ? getOptionColor(opt) : '#8b5cf6';
            const iconName = opt ? getOptionIcon(opt) : null;
            const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
            const label = opt ? resolveLabel(opt) : val;
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
                    const opt = options.find(o => getOptionValue(o) === val);
                    return opt ? resolveLabel(opt) : val;
                  }).join(', ')}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {!disabled && (
          <PopoverButton icon="Plus" title="Ajouter / gérer" isAbsolute size={14} contentClassName="w-64 z-[401]">
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
              {options.map((opt) => {
                const optValue = getOptionValue(opt);
                const optColor = getOptionColor(opt);
                const iconName = getOptionIcon(opt);
                const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
                const checked = selectedValues.includes(optValue);
                const label = resolveLabel(opt);
                return (
                  <button
                    key={optValue}
                    type="button"
                    className={cn(
                      'px-2 py-1 rounded-full text-xs border transition flex items-center gap-1',
                      checked ? 'font-semibold' : 'hover:bg-black/10 dark:hover:bg-white/10'
                    )}
                    style={checked ? { backgroundColor: `${optColor}22`, borderColor: `${optColor}55`, color: optColor } : {}}
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
  }

  // Mode single
  const { value, onChange } = props;
  const selectedOption = options.find(opt => getOptionValue(opt) === value);
  const selectedLabel = selectedOption ? resolveLabel(selectedOption) : '';
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
            <span>{selectedLabel}</span>
            <button
              type="button"
              className="ml-1 text-neutral-700 hover:text-red-800 dark:text-white dark:hover:text-red-400 rounded-full p-0.5 -mr-1 group-hover:opacity-100 opacity-60 transition"
              onClick={() => onChange('')}
              tabIndex={-1}
              aria-label={`Retirer ${selectedLabel}`}
            >
              <Icons.X size={12} />
            </button>
          </span>
        ) : (
          <span className="text-xs text-neutral-500">{placeholder}</span>
        )}
      </div>
      {!disabled && (
        <PopoverButton icon="Plus" title="Ajouter / gérer" isAbsolute size={14} contentClassName="w-64">
          {({ close }) => (
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
              <button
                type="button"
                className={cn(
                  'px-2 py-1 rounded-full text-xs border border-black/10 dark:border-white/10 transition',
                  !value ? 'bg-white/15 border-white/20 text-white' : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
                )}
                onClick={() => { onChange(''); close(); }}
              >
                Aucun
              </button>
              {options.map((opt) => {
                const optValue = getOptionValue(opt);
                const optColor = getOptionColor(opt);
                const iconName = getOptionIcon(opt);
                const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
                const selected = optValue === value;
                const label = resolveLabel(opt);
                return (
                  <button
                    key={optValue}
                    type="button"
                    className={cn(
                      'px-2 py-1 rounded-full text-xs border transition flex items-center gap-1',
                      selected ? 'font-semibold' : 'hover:bg-black/10 dark:hover:bg-white/10'
                    )}
                    style={selected ? { backgroundColor: `${optColor}22`, borderColor: `${optColor}55`, color: optColor } : { borderColor: 'rgba(255,255,255,0.08)' }}
                    onClick={() => { onChange(optValue); close(); }}
                  >
                    {OptIcon && <OptIcon size={12} className="opacity-80" />}
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </PopoverButton>
      )}
    </div>
  );
};
