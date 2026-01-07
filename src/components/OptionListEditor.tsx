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
  const [openIconIndex, setOpenIconIndex] = useState<number | null>(null);
  const [openColorIndex, setOpenColorIndex] = useState<number | null>(null);

  const normalizeOption = (opt: OptionType): OptionType => {
    if (typeof opt === 'string') return { value: opt, color: defaultColor, icon: defaultIcon };
    return {
      value: opt.value,
      color: opt.color || defaultColor,
      icon: opt.icon || defaultIcon
    };
  };

  const normalizedOptions = options.map(normalizeOption);

  const addOption = () => {
    if (!newOptionValue.trim()) return;
    const next = [...normalizedOptions, { value: newOptionValue.trim(), color: newOptionColor, icon: newOptionIcon }];
    onChange(next);
    setNewOptionValue('');
    setNewOptionColor(defaultColor);
    setNewOptionIcon(defaultIcon);
  };

  const removeOption = (index: number) => {
    const next = normalizedOptions.filter((_, i) => i !== index);
    onChange(next);
  };

  const updateOption = (index: number, partial: Partial<OptionType>) => {
    const next = normalizedOptions.map((opt, i) => (i === index ? { ...opt, ...partial } : opt));
    onChange(next);
  };

  const moveOption = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= normalizedOptions.length) return;
    const next = [...normalizedOptions];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-neutral-300">Options</label>
      <div className="space-y-2">
        {normalizedOptions.map((opt, index) => {
          const OptIcon = (Icons as any)[opt.icon] || null;
          return (
            <div key={`${opt.value}-${index}`} className="flex items-center gap-2 p-2 bg-neutral-800/50 border border-white/10 rounded-lg">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveOption(index, -1)}
                  className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"
                  disabled={index === 0}
                  title="Monter"
                >
                  <Icons.ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => moveOption(index, 1)}
                  className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"
                  disabled={index === normalizedOptions.length - 1}
                  title="Descendre"
                >
                  <Icons.ChevronDown size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpenIconIndex(openIconIndex === index ? null : index)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white"
                  title="Choisir une icône"
                >
                  {OptIcon ? <OptIcon size={18} /> : <Icons.Tag size={18} />}
                </button>
                {openIconIndex === index && (
                  <div className="absolute z-[1200] mt-2 w-[280px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                    <IconPicker
                      value={opt.icon || defaultIcon}
                      onChange={(val) => { updateOption(index, { icon: val }); setOpenIconIndex(null); }}
                      mode="all"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setOpenColorIndex(openColorIndex === index ? null : index)}
                  className="w-9 h-9 rounded-lg border border-white/10"
                  style={{ backgroundColor: opt.color || defaultColor }}
                  title="Choisir une couleur"
                />
                {openColorIndex === index && (
                  <div className="absolute z-[1200] mt-2 w-[280px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                    <ColorPicker
                      value={opt.color || defaultColor}
                      onChange={(val) => { updateOption(index, { color: val }); setOpenColorIndex(null); }}
                    />
                  </div>
                )}
              </div>

              <input
                type="text"
                value={opt.value}
                onChange={(e) => updateOption(index, { value: e.target.value })}
                className="flex-1 px-3 py-2 bg-neutral-900/60 border border-white/10 rounded-lg text-white text-sm placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
              />

              <button
                onClick={() => removeOption(index)}
                className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
                title="Supprimer"
              >
                <Icons.X size={16} />
              </button>
            </div>
          );
        })}
        {normalizedOptions.length === 0 && (
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
              className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-300"
              title="Choisir une icône"
            >
              {(Icons as any)[newOptionIcon] ? React.createElement((Icons as any)[newOptionIcon], { size: 18 }) : <Icons.Tag size={18} />}
            </button>
            {showIconPopover && (
              <div className="absolute z-[1200] right-0 mt-2 w-[280px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                <IconPicker value={newOptionIcon} onChange={(val) => { setNewOptionIcon(val); setShowIconPopover(false); }} mode="all" />
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColorPopover((v) => !v)}
              className="w-10 h-10 rounded-lg border border-white/10"
              style={{ backgroundColor: newOptionColor }}
              title="Choisir une couleur"
            />
            {showColorPopover && (
              <div className="absolute z-[1200] right-0 mt-2 w-[280px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
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
