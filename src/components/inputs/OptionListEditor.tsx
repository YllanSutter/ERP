import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import type { OptionType } from './LightSelect';
import IconPicker from './IconPicker';
import ColorPicker from './ColorPicker';
import DraggableList from './DraggableList';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { findMatchingOption } from '@/lib/utils/selectOptions';
import { cn } from '@/lib/utils';

interface OptionListEditorProps {
  options: OptionType[];
  onChange: (options: OptionType[]) => void;
}
const defaultColor = '#8b5cf6';
const defaultIcon = 'Tag';

export const OptionListEditor: React.FC<OptionListEditorProps> = ({ options, onChange }) => {
  const [name, setName] = useState('');
  const [newIcon, setNewIcon] = useState(defaultIcon);
  const [newColor, setNewColor] = useState(defaultColor);
  const [newIconOpen, setNewIconOpen] = useState(false);
  const [newColorOpen, setNewColorOpen] = useState(false);
  const [iconIndex, setIconIndex] = useState<number | null>(null);
  const [colorIndex, setColorIndex] = useState<number | null>(null);
  const normalized = options.map(option => typeof option === 'string'
    ? { value: option, label: option, color: defaultColor, icon: defaultIcon }
    : { ...option, label: option.label || option.value, color: option.color || defaultColor, icon: option.icon || defaultIcon });
  const duplicate = Boolean(name.trim() && findMatchingOption(options, name));
  const add = () => {
    const label = name.trim();
    if (!label || duplicate) return;
    onChange([...options, { value: label, label, color: newColor, icon: newIcon }]);
    setName('');
  };
  const update = (index: number, partial: Partial<{ label: string; color: string; icon: string }>) => onChange(options.map((option, i) => i === index ? { ...normalized[i], ...partial } : option));
  const NewIcon = (Icons as any)[newIcon] || Icons.Tag;
  const control = 'flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500';
  return <div className="space-y-2">
    <div className="flex flex-nowrap items-center gap-2 border-b border-border/60 pb-2">
      <span className="shrink-0 text-xs font-medium">Options <span className="text-[10px] font-normal text-muted-foreground">{options.length}</span></span>
      <input aria-label="Nom de la nouvelle option" value={name} onChange={event => setName(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); add(); } }}
        placeholder="Ajouter une option…" className="h-7 min-w-0 flex-1 rounded-md bg-muted/40 px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-brand-500" />
      <Popover open={newIconOpen} onOpenChange={setNewIconOpen}>
        <PopoverTrigger asChild><button type="button" className={control} aria-label="Icône de la nouvelle option" title="Icône de la nouvelle option" style={{ color: newColor }}><NewIcon size={13} /></button></PopoverTrigger>
        <PopoverContent className="z-[450] w-72 p-2"><IconPicker value={newIcon} mode="all" onChange={icon => { setNewIcon(icon); setNewIconOpen(false); }} /></PopoverContent>
      </Popover>
      <Popover open={newColorOpen} onOpenChange={setNewColorOpen}>
        <PopoverTrigger asChild><button type="button" className={control} aria-label="Couleur de la nouvelle option" title="Couleur de la nouvelle option"><span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: newColor }} /></button></PopoverTrigger>
        <PopoverContent className="z-[450] w-72 p-2"><ColorPicker value={newColor} onClose={() => setNewColorOpen(false)} onChange={setNewColor} /></PopoverContent>
      </Popover>
      <button type="button" className={cn(control, 'disabled:opacity-30')} disabled={!name.trim() || duplicate} onClick={add}
        aria-label="Ajouter l’option" title={duplicate ? 'Cette option existe déjà' : 'Ajouter · Entrée'}><Icons.Plus size={14} /></button>
    </div>
    <DraggableList items={normalized.map((option, index) => ({ ...option, _index: index }))} getId={option => option.value}
      onReorder={reordered => onChange(reordered.map(({ _index, ...option }) => option))}
      renderItem={(option, { isDragging }) => {
        const Icon = (Icons as any)[option.icon] || Icons.Tag;
        return <div className={cn('flex min-w-0 items-center gap-1 rounded-md py-0.5 hover:bg-muted/30', isDragging && 'bg-muted')}>
          <Icons.GripVertical size={12} className="shrink-0 cursor-grab text-muted-foreground/50" />
          <Popover open={iconIndex === option._index} onOpenChange={open => setIconIndex(open ? option._index : null)}>
            <PopoverTrigger asChild><button type="button" className={control} aria-label={`Icône de ${option.label}`} title="Changer l’icône" style={{ color: option.color }}><Icon size={12} /></button></PopoverTrigger>
            <PopoverContent className="z-[450] w-72 p-2"><IconPicker value={option.icon} mode="all" onChange={icon => { update(option._index, { icon }); setIconIndex(null); }} /></PopoverContent>
          </Popover>
          <input aria-label={`Libellé de ${option.value}`} value={option.label} onChange={event => update(option._index, { label: event.target.value })}
            className="h-7 min-w-0 flex-1 rounded-full border px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
            style={{ backgroundColor: `${option.color}10`, borderColor: `${option.color}30` }} />
          <Popover open={colorIndex === option._index} onOpenChange={open => setColorIndex(open ? option._index : null)}>
            <PopoverTrigger asChild><button type="button" className={control} aria-label={`Couleur de ${option.label}`} title="Changer la couleur"><span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: option.color }} /></button></PopoverTrigger>
            <PopoverContent className="z-[450] w-72 p-2"><ColorPicker value={option.color} onClose={() => setColorIndex(null)} onChange={color => update(option._index, { color })} /></PopoverContent>
          </Popover>
          <button type="button" className={cn(control, 'hover:text-red-500')} aria-label={`Supprimer ${option.label}`} title="Supprimer l’option" onClick={() => onChange(options.filter((_, index) => index !== option._index))}><Icons.X size={12} /></button>
        </div>;
      }} />
    {!options.length && <p className="py-2 text-xs text-muted-foreground">Saisissez un nom puis appuyez sur Entrée.</p>}
  </div>;
};
export default OptionListEditor;
