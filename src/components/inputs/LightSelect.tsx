import IconPicker from './IconPicker';
import ColorPicker from './ColorPicker';
import React from 'react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { normalizeRelationIds } from '@/lib/utils/relationUtils';
import { getSelectionLimit, toggleLimitedSelection } from '@/lib/utils/selectionLimit';
import { normalizeSearch } from '@/lib/utils/recentItems';
import { findMatchingOption, optionLabel, optionValue, type SelectOption } from '@/lib/utils/selectOptions';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type OptionType = SelectOption;
interface LightSelectBaseProps {
  options: OptionType[];
  placeholder?: string;
  sizeClass?: string;
  className?: string;
  disabled?: boolean;
  getOptionLabel?: (option: OptionType) => string;
  onCreateOption?: (label: string, select: (value: string) => void, appearance?: { color?: string; icon?: string }) => void;
}
interface LightSelectSingleProps extends LightSelectBaseProps {
  multiple?: false; value: string; onChange: (value: string) => void;
  values?: never; maxVisible?: never;
}
interface LightSelectMultiProps extends LightSelectBaseProps {
  multiple: true; values: string[]; onChange: (values: string[]) => void;
  value?: never; maxVisible?: number; maxValues?: number;
}
export type LightSelectProps = LightSelectSingleProps | LightSelectMultiProps;

export const LightSelect: React.FC<LightSelectProps> = (props) => {
  const { options, placeholder = 'Aucun', className, sizeClass = 'text-sm h-8', disabled, onCreateOption } = props;
  const [open, setOpen] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState('');
  const [newIcon, setNewIcon] = React.useState('Tag');
  const [newColor, setNewColor] = React.useState('#8b5cf6');
  const [iconOpen, setIconOpen] = React.useState(false);
  const [colorOpen, setColorOpen] = React.useState(false);
  const NewIcon = (Icons as any)[newIcon] || Icons.Tag;
  const resolveLabel = props.getOptionLabel || optionLabel;
  const selected = props.multiple ? normalizeRelationIds(props.values) : props.value ? [props.value] : [];
  const limit = props.multiple ? getSelectionLimit(props.maxValues) : 1;
  const atLimit = props.multiple && limit !== undefined && limit > 1 && selected.length >= limit;
  const visibleCount = props.multiple ? Math.max(0, props.maxVisible ?? 2) : 1;
  const filtered = options.filter(option => normalizeSearch(`${resolveLabel(option)} ${optionValue(option)}`).includes(normalizeSearch(query)));
  const existing = findMatchingOption(options, query);
  const canCreate = Boolean(onCreateOption && query.trim() && !existing && !atLimit);
  const close = () => { setOpen(false); setQuery(''); };
  const choose = (value: string) => {
    if (props.multiple) {
      props.onChange(toggleLimitedSelection(selected, value, limit));
      setQuery('');
      searchRef.current?.focus();
      if (limit === 1) close();
    } else { props.onChange(value); close(); }
  };
  const create = () => {
    if (!canCreate) return;
    onCreateOption?.(query.trim(), choose, { icon: newIcon, color: newColor });
  };
  const colorOf = (option?: OptionType) => typeof option === 'object' ? option.color || '#8b5cf6' : '#8b5cf6';
  const badgeClass = 'inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 transition-colors';
  return (
    <Popover open={open && !disabled} onOpenChange={next => { setOpen(next); setQuery(''); }}>
      <div className={cn('flex min-w-0 items-center gap-1', sizeClass, className)}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {!selected.length && (disabled ? <span className="text-xs text-muted-foreground">{placeholder}</span> :
            <PopoverTrigger asChild><button type="button" className="rounded px-1 py-0.5 text-xs text-muted-foreground hover:bg-muted" aria-label="Choisir une option">{placeholder}</button></PopoverTrigger>)}
          {selected.slice(0, visibleCount).map(value => {
            const option = options.find(option => optionValue(option) === value);
            const label = option ? resolveLabel(option) : value;
            const color = colorOf(option);
            const Icon = typeof option === 'object' && option.icon ? (Icons as any)[option.icon] : null;
            return <span key={value} className={badgeClass} style={{ backgroundColor: `${color}15`, borderColor: `${color}40` }}>
              <button type="button" disabled={disabled} title={label} className="inline-flex min-w-0 items-center gap-1 disabled:cursor-default" onClick={() => setOpen(true)} aria-label={`Changer ${label}`}>
                {Icon && <Icon size={11} className="shrink-0 opacity-75" />}<span className="truncate">{label}</span>
              </button>
              {!disabled && <button type="button" aria-label={`Retirer ${label}`} className="rounded-full opacity-50 transition hover:opacity-100 focus-visible:opacity-100" onClick={() => {
                if (props.multiple) props.onChange(selected.filter(entry => entry !== value)); else props.onChange('');
              }}><Icons.X size={10} /></button>}
            </span>;
          })}
          {selected.length > visibleCount && <button type="button" disabled={disabled} onClick={() => setOpen(true)} title={selected.slice(visibleCount).map(value => {
            const option = options.find(option => optionValue(option) === value); return option ? resolveLabel(option) : value;
          }).join(', ')} className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">+{selected.length - visibleCount}</button>}
        </div>
        {!disabled && <PopoverTrigger asChild><button type="button" aria-label="Ajouter ou modifier les options" title="Ajouter ou modifier les options" className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"><Icons.Plus size={12} /></button></PopoverTrigger>}
      </div>
      <PopoverContent align="end" className="z-[401] w-80 max-w-[calc(100vw-1rem)] space-y-2 p-2">
        <div className="flex flex-nowrap items-center gap-1 border-b border-border/60 pb-1.5">
          <Icons.Search size={12} className="shrink-0 text-muted-foreground" />
          <input ref={searchRef} aria-label="Rechercher ou créer une option" placeholder={onCreateOption ? 'Rechercher ou créer…' : 'Rechercher…'} value={query} onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
              event.preventDefault();
              if (existing) choose(optionValue(existing));
              else if (canCreate) create();
              else if (filtered[0] && !atLimit) choose(optionValue(filtered[0]));
            }}
            className="h-7 min-w-0 flex-1 bg-transparent text-xs outline-none" />
          {props.multiple && <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground" title={atLimit ? 'Limite atteinte' : 'Options sélectionnées'}>{selected.length}{limit ? `/${limit}` : ''}</span>}
          {onCreateOption && <>
            <Popover open={iconOpen} onOpenChange={setIconOpen}>
              <PopoverTrigger asChild><button type="button" title="Icône de la nouvelle option" aria-label="Icône de la nouvelle option" className="flex h-7 w-6 shrink-0 items-center justify-center rounded hover:bg-muted" style={{ color: newColor }}><NewIcon size={12} /></button></PopoverTrigger>
              <PopoverContent className="z-[450] w-72 p-2"><IconPicker value={newIcon} mode="all" onChange={icon => { setNewIcon(icon); setIconOpen(false); }} /></PopoverContent>
            </Popover>
            <Popover open={colorOpen} onOpenChange={setColorOpen}>
              <PopoverTrigger asChild><button type="button" title="Couleur de la nouvelle option" aria-label="Couleur de la nouvelle option" className="flex h-7 w-6 shrink-0 items-center justify-center rounded hover:bg-muted"><span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: newColor }} /></button></PopoverTrigger>
              <PopoverContent className="z-[450] w-72 p-2"><ColorPicker value={newColor} onClose={() => setColorOpen(false)} onChange={setNewColor} /></PopoverContent>
            </Popover>
          </>}
          {onCreateOption && <button type="button" disabled={!canCreate} onClick={create} title={query.trim() ? `Créer « ${query.trim()} »` : 'Saisissez le nom de la nouvelle option'} aria-label="Créer et sélectionner l’option" className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-30"><Icons.Plus size={13} /></button>}
          <button type="button" onClick={close} title="Terminé" aria-label="Terminer la sélection" className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"><Icons.Check size={13} /></button>
        </div>
        <div className="flex max-h-48 flex-wrap content-start gap-1.5 overflow-y-auto p-0.5" aria-label="Options">
          {!props.multiple && props.value && !query && <button type="button" onClick={() => { props.onChange(''); close(); }} className={cn(badgeClass, 'border-border text-muted-foreground hover:bg-muted')}>Aucun</button>}
          {filtered.map(option => {
            const value = optionValue(option);
            const checked = selected.includes(value);
            const color = colorOf(option);
            const Icon = typeof option === 'object' && option.icon ? (Icons as any)[option.icon] : null;
            return <button key={value} type="button" aria-pressed={checked} title={resolveLabel(option)} disabled={!checked && atLimit}
              className={cn(badgeClass, 'min-w-0 disabled:cursor-not-allowed disabled:opacity-35 hover:brightness-95', checked ? 'font-medium' : 'text-foreground/80')}
              style={{ backgroundColor: checked ? `${color}22` : `${color}08`, borderColor: checked ? `${color}65` : `${color}25` }} onClick={() => choose(value)}>
              {checked ? <Icons.Check size={10} className="shrink-0" /> : Icon ? <Icon size={10} className="shrink-0" /> : null}<span className="truncate">{resolveLabel(option)}</span>
            </button>;
          })}
          {!filtered.length && <p className="w-full py-2 text-xs text-muted-foreground">{canCreate ? 'Entrée ou + pour créer cette option.' : atLimit ? 'Retirez une option pour en ajouter une autre.' : 'Aucune option.'}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
};
