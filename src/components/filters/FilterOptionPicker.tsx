import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  values: string[];
  multiple?: boolean;
  compact?: boolean;
  placeholder?: string;
  label: string;
  onChange: (values: string[]) => void;
}

export default function FilterOptionPicker({ options, values, multiple = false, compact = false, placeholder = 'Choisir une valeur', label, onChange }: Props) {
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
          <CommandList>
            <CommandEmpty>Aucun résultat</CommandEmpty>
            <CommandGroup>
              {available.map((option) => {
                const checked = values.includes(option.value);
                return (
                  <CommandItem key={option.value} value={option.value} keywords={[option.label]}
                    aria-label={`${checked ? 'Retirer' : 'Choisir'} ${option.label}`}
                    onSelect={() => {
                      onChange(multiple
                        ? checked ? values.filter((value) => value !== option.value) : [...values, option.value]
                        : checked ? [] : [option.value]);
                      if (!multiple) setOpen(false);
                    }} className="gap-2 py-2">
                    <span aria-hidden="true" className={cn('grid size-4 shrink-0 place-items-center rounded border', checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                      {checked && <Check size={11} />}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
