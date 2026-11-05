import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { getSelectionLimit, toggleLimitedSelection } from '@/lib/utils/selectionLimit';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  values: string[];
  multiple?: boolean;
  maxValues?: number;
  compact?: boolean;
  placeholder?: string;
  label: string;
  onChange: (values: string[]) => void;
}

export default function FilterOptionPicker({ options, values, multiple = false, maxValues, compact = false, placeholder = 'Choisir une valeur', label, onChange }: Props) {
  const limit = getSelectionLimit(maxValues) ?? (multiple ? undefined : 1);
  const radio = limit === 1;
  const [open, setOpen] = useState(false);
  const available = [...options, ...values.filter((value) => !options.some((option) => option.value === value))
    .map((value) => ({ value, label: value }))];
  const labels = values.map((value) => available.find((option) => option.value === value)?.label ?? value);
  const summary = labels.length > 2 ? `${labels[0]} +${labels.length - 1}` : labels.join(', ');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} title={labels.join(', ') || placeholder}
          className={cn('flex min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-background text-left text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            compact ? 'h-7 max-w-48 border-transparent bg-transparent px-1 text-xs' : 'min-h-9 w-full px-3 py-1.5 text-sm')}>
          <span className={cn('truncate', !summary && 'text-muted-foreground')}>{summary || placeholder}</span>
          <ChevronDown size={12} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput autoFocus aria-label={`Rechercher · ${label}`} placeholder="Rechercher…" />
          <CommandList role={radio ? 'radiogroup' : undefined} aria-label={label}>
            <CommandEmpty>Aucun résultat</CommandEmpty>
            <CommandGroup>
              {available.map((option) => {
                const checked = values.includes(option.value);
                return (
                  <CommandItem key={option.value} value={option.value} keywords={[option.label]}
                    role={radio ? 'radio' : undefined}
                    aria-checked={radio ? checked : undefined}
                    aria-label={`${checked && !radio ? 'Retirer' : 'Choisir'} ${option.label}`}
                    disabled={!checked && limit !== undefined && limit > 1 && values.length >= limit}
                    onSelect={() => {
                      onChange(toggleLimitedSelection(values, option.value, limit));
                      if (radio) setOpen(false);
                    }} className="gap-2 py-2">
                    <span aria-hidden="true" className={cn('grid size-4 shrink-0 place-items-center border', radio ? 'rounded-full' : 'rounded',
                      checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                      {checked && (radio ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : <Check size={11} />)}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {(values.length > 0 || limit !== undefined) && (
            <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5 text-xs text-muted-foreground">
              <span>{limit === undefined ? `${values.length} sélectionnée(s)` : `${values.length} / ${limit} valeur(s)`}</span>
              {values.length > 0 && (
                <button type="button" className="rounded px-2 py-1 hover:bg-accent hover:text-foreground"
                  onClick={() => { onChange([]); setOpen(false); }}>Effacer</button>
              )}
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
