import React from 'react';
import * as Icons from 'lucide-react';
import { normalizeRelationIds } from '@/lib/utils/relationUtils';
import { cn } from '@/lib/utils';
import type { OptionType } from './LightSelect';

const optionValue = (option: OptionType) => typeof option === 'string' ? option : option.value;
const optionLabel = (option: OptionType) => typeof option === 'string' ? option : option.label || option.value;
const optionColor = (option: OptionType) => typeof option === 'string' ? '#8b5cf6' : option.color || '#8b5cf6';
const optionIcon = (option: OptionType) => typeof option === 'string' ? null : option.icon || null;

interface OptionTagsProps {
  options: OptionType[];
  value: unknown;
  className?: string;
  prominent?: boolean;
  borderless?: boolean;
}

export const OptionTags: React.FC<OptionTagsProps> = ({ options, value, className, prominent = false, borderless = false }) => {
  const values = normalizeRelationIds(value);
  if (!values.length) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {values.map((valueId) => {
        const option = options.find((candidate) => optionValue(candidate) === valueId);
        const label = option ? optionLabel(option) : valueId;
        const color = option ? optionColor(option) : '#8b5cf6';
        const iconName = option ? optionIcon(option) : null;
        const Icon = iconName ? (Icons as any)[iconName] : null;
        return (
          <span
            key={valueId}
            className={`inline-flex items-center gap-1 rounded-full ${borderless ? '' : 'border'} px-2 py-0.5 text-xs font-semibold ${prominent ? `shadow-lg ${borderless ? '' : 'ring-1 ring-black/30'} text-white` : ''}`}
            style={{ backgroundColor: `${color}${prominent ? 'e6' : '22'}`, borderColor: borderless ? 'transparent' : `${color}${prominent ? 'ff' : '55'}`, color: prominent ? '#fff' : color }}
          >
            {Icon && <Icon size={12} aria-hidden="true" />}
            {label}
          </span>
        );
      })}
    </div>
  );
};
