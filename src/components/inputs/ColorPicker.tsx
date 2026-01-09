import React from 'react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}

const predefinedColors = [
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Rose', value: '#ec4899' },
  { name: 'Jaune', value: '#eab308' },
  { name: 'Vert', value: '#22c55e' },
  { name: 'Bleu', value: '#3b82f6' },
  { name: 'Rouge', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Emeraude', value: '#10b981' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose foncé', value: '#f43f5e' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Ambre', value: '#f59e0b' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Pourpre', value: '#a855f7' },
  { name: 'Fuchsia', value: '#d946ef' },
];

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, className }) => {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-3">
        <div 
          className="w-12 h-12 rounded-lg border-2 border-white/20 shadow-lg"
          style={{ backgroundColor: value || '#8b5cf6' }}
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#8b5cf6"
          className="flex-1 px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-neutral-500 focus:border-violet-500 focus:outline-none font-mono"
        />
      </div>

      <div className="grid grid-cols-8 gap-2">
        {predefinedColors.map((color) => (
          <button
            key={color.value}
            onClick={() => onChange(color.value)}
            className={cn(
              "w-full aspect-square rounded-lg transition-all hover:scale-110 border-2",
              value === color.value
                ? 'border-white scale-110'
                : 'border-transparent'
            )}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
      </div>
    </div>
  );
};

export default ColorPicker;
