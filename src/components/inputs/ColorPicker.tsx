import React, { useState } from 'react';
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

const RECENT_COLORS_KEY = 'erp:recent-colors';
const normalizeColor = (color: string) => {
  const raw = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) return '#' + raw.slice(1).split('').map((char) => char + char).join('').toLowerCase();
  return null;
};
const readRecentColors = (): string[] => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(RECENT_COLORS_KEY) || '[]');
    return Array.isArray(saved) ? [...new Set(saved.filter((color): color is string => typeof color === 'string').map(normalizeColor).filter((color): color is string => Boolean(color)))].slice(0, 16) : [];
  } catch { return []; }
};

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, className }) => {
  const [draft, setDraft] = useState<string | null>(null);
  const [recentColors, setRecentColors] = useState(readRecentColors);
  const currentColor = normalizeColor(value || '') || '#8b5cf6';
  const rememberColor = (raw: string) => {
    const color = normalizeColor(raw);
    if (!color) return;
    const next = [color, ...readRecentColors().filter((entry) => entry !== color)].slice(0, 16);
    setRecentColors(next);
    try { window.localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next)); } catch { /* Color selection remains available without storage. */ }
  };
  const chooseColor = (color: string) => { onChange(color); rememberColor(color); };
  const commitDraft = () => {
    const color = normalizeColor(draft ?? value ?? '');
    if (color) chooseColor(color);
    setDraft(null);
  };
  const swatch = (color: string, label: string) => <button type="button" key={color}
    onClick={() => chooseColor(color)} aria-label={label} aria-pressed={currentColor === color}
    className={cn('w-full aspect-square rounded-md border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      currentColor === color ? 'border-foreground scale-110' : 'border-black/10 dark:border-white/10')}
    style={{ backgroundColor: color }} title={label} />;

  return (
    <div className={cn('w-full min-w-0 space-y-3 rounded-lg bg-background p-3 text-foreground', className)}>
      <div className="flex min-w-0 items-center gap-3">
        <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border shadow-sm"
          style={{ backgroundColor: currentColor }} title="Choisir une couleur librement">
          <input type="color" value={currentColor} aria-label="Choisir une couleur librement"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(event) => onChange(event.target.value)} onBlur={(event) => rememberColor(event.target.value)} />
        </label>
        <label className="grid min-w-0 flex-1 gap-1 text-xs text-muted-foreground">
          Code hexadécimal
          <input type="text" value={draft ?? value ?? ''} aria-label="Code hexadécimal" maxLength={7} spellCheck={false}
            onChange={(event) => setDraft(event.target.value)} onBlur={commitDraft}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitDraft(); } }}
            placeholder="#8b5cf6"
            className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-2 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Cliquez sur la couleur pour ouvrir le sélecteur.</p>
      {recentColors.length > 0 && <div className="space-y-2">
        <p className="text-xs font-medium">Couleurs récentes</p>
        <div className="grid grid-cols-8 gap-2">{recentColors.map((color) => swatch(color, `Réutiliser ${color}`))}</div>
      </div>}
      <div className="space-y-2">
        <p className="text-xs font-medium">Palette</p>
        <div className="grid grid-cols-8 gap-2">{predefinedColors.map((color) => swatch(color.value, color.name))}</div>
      </div>
    </div>
  );
};

export default ColorPicker;
