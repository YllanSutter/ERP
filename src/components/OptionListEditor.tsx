import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { OptionType } from '@/components/inputs/LightSelect';
import IconPicker from '@/components/IconPicker';
import ColorPicker from '@/components/ColorPicker';

interface OptionListEditorProps {
  options: OptionType[];
  onChange: (opts: OptionType[]) => void;
}

const defaultColor = '#8b5cf6';
const defaultIcon = 'Tag';

export const OptionListEditor: React.FC<OptionListEditorProps> = ({ options, onChange }) => {
  const [newOptionValue, setNewOptionValue] = useState('');
  const [newOptionColor, setNewOptionColor] = useState(defaultColor);
  const [newOptionIcon, setNewOptionIcon] = useState<string>(defaultIcon);
  const [showIconPopover, setShowIconPopover] = useState(false);
  const [showColorPopover, setShowColorPopover] = useState(false);

  const addOption = () => {
    if (!newOptionValue.trim()) return;
    const next = [...options, { value: newOptionValue.trim(), color: newOptionColor, icon: newOptionIcon }];
    onChange(next);
    setNewOptionValue('');
    setNewOptionColor(defaultColor);
    setNewOptionIcon(defaultIcon);
  };

  const removeOption = (index: number) => {
    const next = options.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-neutral-300">Options</label>
      <div className="space-y-2">
        {options.map((opt, index) => {
          const optValue = typeof opt === 'string' ? opt : opt.value;
          const optColor = typeof opt === 'string' ? defaultColor : (opt.color || defaultColor);
          const iconName = typeof opt === 'string' ? null : (opt.icon || null);
          const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
          return (
            <div key={index} className="flex items-center gap-2">
              {OptIcon && <OptIcon size={16} />}
              <div className="w-6 h-6 rounded border border-white/20" style={{ backgroundColor: optColor }} />
              <span className="flex-1 text-sm text-neutral-300">{optValue}</span>
              <button
                onClick={() => removeOption(index)}
                className="p-1 hover:bg-red-500/20 rounded text-red-400"
              >
                <Icons.X size={16} />
              </button>
            </div>
          );
        })}
        {options.length === 0 && (
          <div className="text-xs text-neutral-500 px-1">Aucune option</div>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={newOptionValue}
            onChange={(e) => setNewOptionValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addOption()}
            placeholder="Nouvelle option"
            className="flex-1 px-3 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
          />
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowIconPopover((v) => !v)}
              className="px-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-300 text-sm"
              title="Choisir une icône"
            >Icône</button>
            {showIconPopover && (
              <div className="absolute z-[1000] right-0 mt-2 w-[280px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                <IconPicker value={newOptionIcon} onChange={(val) => { setNewOptionIcon(val); setShowIconPopover(false); }} mode="all" />
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColorPopover((v) => !v)}
              className="px-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-300 text-sm"
              title="Choisir une couleur"
            >Couleur</button>
            {showColorPopover && (
              <div className="absolute z-[1000] right-0 mt-2 w-[280px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                <ColorPicker value={newOptionColor} onChange={(val) => { setNewOptionColor(val); setShowColorPopover(false); }} />
              </div>
            )}
          </div>
          <button
            onClick={addOption}
            className="px-3 py-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/50 rounded-lg text-violet-300 text-sm transition-colors"
          >
            <Icons.Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OptionListEditor;
