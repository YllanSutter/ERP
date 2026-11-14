import React, { useState } from 'react';
import ColorPicker, { COLOR_PICKER_SURFACE_CLASS } from '@/components/inputs/ColorPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { normalizeColor } from '@/lib/utils/colorUtils';
import { cn } from '@/lib/utils';

export default function ColorField({ value, onChange, readOnly, className }: {
  value: unknown; onChange: (value: string | null) => void; readOnly?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const color = normalizeColor(value);
  const preview = <span className="inline-flex min-w-0 items-center gap-2 text-xs">
    <span className="size-4 shrink-0 rounded border border-border" style={{ backgroundColor: color || 'transparent' }} />
    <span className="truncate font-mono">{color || 'Aucune couleur'}</span>
  </span>;
  if (readOnly) return <span className={cn('inline-flex', className)}>{preview}</span>;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="ghost" size="sm" className={cn('h-auto justify-start px-1 py-1', className)} aria-label="Modifier la couleur">{preview}</Button></PopoverTrigger>
    <PopoverContent className={cn(COLOR_PICKER_SURFACE_CLASS, 'overflow-hidden p-0')} align="start">
      <ColorPicker value={color || ''} onChange={onChange} onClose={() => setOpen(false)} />
      <div className="border-t border-border p-2"><Button type="button" variant="ghost" size="sm" disabled={!color}
        onClick={() => { onChange(null); setOpen(false); }}>Effacer la couleur</Button></div>
    </PopoverContent>
  </Popover>;
}
