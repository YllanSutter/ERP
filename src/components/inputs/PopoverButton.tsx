import { SettingsSheet, SettingsBody, SettingsFooter } from '@/components/ui/settings-panel';
import { Button } from '@/components/ui/button';
import { newestFirst, normalizeSearch } from '@/lib/utils/recentItems';
import { normalizeRelationIds } from '@/lib/utils/relationUtils';
import React from 'react';
import * as Icons from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { OptionTags } from './OptionTags';

interface PopoverButtonProps {
  icon?: 'Plus' | 'List' | 'Search'; // Icône à afficher
  title?: string;
  children: React.ReactNode | ((helpers: { close: () => void }) => React.ReactNode);
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  isAbsolute?: boolean;
  size?: number;
  top?: number;
  right?: number;
}

export const PopoverButton: React.FC<PopoverButtonProps> = ({
  icon = 'Plus',
  title,
  children,
  className,
  contentClassName,
  disabled = false,
  isAbsolute = false,
  size = 10,
  top = 0.25,
  right = 0.7
}) => {
  const IconComponent = (Icons as any)[icon];
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);
  const content = typeof children === 'function' ? children({ close }) : children;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "p-1  hover:bg-black/10 text-neutral-900 dark:hover:bg-white/5 dark:text-neutral-200  opacity-30 hover:opacity-100 transition-all duration-300",
            !disabled && "cursor-pointer",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          style={isAbsolute ? { top: `${top}rem`, right: `${right}rem` } : undefined}
          title={title}
        >
          {IconComponent && <IconComponent size={size} />}
        </button>
      </PopoverTrigger>
      <PopoverContent 
          className={cn(
            "p-2 bg-white text-neutral-700 border border-black/10 dark:bg-neutral-900 dark:text-neutral-200 dark:border-white/10 z-[201] pointer-events-auto -mt-2",
            contentClassName
          )}
        >
        {content}
      </PopoverContent>
    </Popover>
  );
};

interface LinkedItemsViewerProps {
  isSourceMany: boolean;
  value: any;
  targetItems: any[];
  targetCollection: any;
  getItemName: (item: any) => string;
  onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
  targetCollectionId: string;
  top?: number;
  right?: number;
}

export const LinkedItemsViewer: React.FC<LinkedItemsViewerProps> = ({
  value,
  targetItems,
  targetCollection,
  getItemName,
  onNavigateToCollection,
  targetCollectionId,
}) => {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const formatCell = (val: any, prop: any, item: any) => {
    if (val == null || val === '') return '-';
    switch (prop.type) {
      case 'date':
        try { return format(new Date(val), 'dd MMM yyyy', { locale: fr }); } catch { return String(val); }
      case 'date_range':
        return val?.start && val?.end ? `${format(new Date(val.start), 'dd MMM yyyy', { locale: fr })} - ${format(new Date(val.end), 'dd MMM yyyy', { locale: fr })}` : '-';
      case 'checkbox':
        return val ? '✓' : '✗';
      case 'url':
        return (<a href={val} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{val}</a>);
      case 'select':
      case 'multiselect':
      case 'multi_select':
        return <OptionTags options={prop.options || []} value={val} />;
      case 'relation': {
        const ids = normalizeRelationIds(val);
        const collectionId = prop.relation?.targetCollectionId;
        if (!onNavigateToCollection || !collectionId || !ids.length) return `${ids.length} lié(s)`;
        const label = `Ouvrir ${prop.name} liés à ${getItemName(item)}`;
        return (
          <button type="button" aria-label={label} title={label}
            className="inline-flex max-w-full items-center gap-1.5 rounded px-1 py-0.5 -ml-1 text-brand-700 transition hover:bg-brand-500/10 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 dark:text-brand-300"
            onClick={() => { setOpen(false); onNavigateToCollection(collectionId, ids); }}>
            <span>{ids.length} lié(s)</span><Icons.ArrowUpRight size={12} className="shrink-0" aria-hidden="true" />
          </button>
        );
      }
      default:
        return String(val);
    }
  };

  const linkedIds = normalizeRelationIds(value);
  const linkedItems = newestFirst(targetItems).filter((ti: any) => linkedIds.includes(ti.id) && normalizeSearch(getItemName(ti)).includes(normalizeSearch(query)));

  return (
    <SettingsSheet nested fitContent open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); setQuery(''); }}
      title={targetCollection?.name || 'Relations'} description={`${linkedIds.length} élément(s) lié(s)`} icon={Icons.Link2}
      trigger={
        <button type="button" title="Lire les détails des relations" aria-label="Lire les détails des relations" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Icons.PanelRightOpen size={14} />
        </button>
      }>
        <div className="shrink-0 border-b px-4 py-2">
          <label className="flex items-center gap-2 rounded-md border bg-transparent px-2">
            <Icons.Search size={16} className="text-muted-foreground" />
            <input aria-label="Filtrer les éléments liés" placeholder="Filtrer les éléments liés…" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 w-full bg-transparent py-1.5 text-xs outline-none" />
          </label>
        </div>
        <SettingsBody className="space-y-4">
          {!linkedItems.length && <p className="py-12 text-center text-sm text-muted-foreground">{query ? 'Aucun résultat.' : 'Aucun élément lié pour le moment.'}</p>}
          {linkedItems.map((it: any) => (
            <article key={it.id} className="rounded-xl border bg-background shadow-sm">
              <h3 className="border-b px-5 py-4 text-base font-semibold break-words">{getItemName(it)}</h3>
              <dl className="divide-y px-5">
                {(targetCollection?.properties || []).filter((p: any) => p.id !== 'name' && p.name !== 'Nom').map((p: any) => (
                  <div key={p.id} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-5">
                    <dt className="text-xs font-medium text-muted-foreground sm:pt-0.5">{p.name}</dt>
                    <dd className="min-w-0 whitespace-pre-wrap break-words text-sm leading-relaxed">{formatCell(it[p.id], p, it)}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </SettingsBody>
        {onNavigateToCollection && <SettingsFooter>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); onNavigateToCollection(targetCollectionId, linkedIds); }}>
            Ouvrir dans la collection <Icons.ArrowUpRight size={16} />
          </Button>
        </SettingsFooter>}
    </SettingsSheet>
  );
};
