import React from 'react';
import * as Icons from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PopoverButtonProps {
  icon?: 'Plus' | 'List' | 'Search'; // Icône à afficher
  title?: string;
  children: React.ReactNode;
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
  size = 13,
  top = 0.25,
  right = 0.7
}) => {
  const IconComponent = (Icons as any)[icon];
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "p-1 hover:bg-black/10 text-neutral-900 dark:hover:bg-white/5 dark:text-neutral-200  opacity-30 hover:opacity-100 transition-all duration-300",
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
        className={cn("p-2 bg-neutral-900 border-neutral-700 z-[300] pointer-events-auto", contentClassName)}
      >
        {children}
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
  isSourceMany,
  value,
  targetItems,
  targetCollection,
  getItemName,
  onNavigateToCollection,
  targetCollectionId,
  top = 0.25,
  right = 0.25
}) => {
  const formatCell = (val: any, prop: any) => {
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
      case 'multi_select':
        return Array.isArray(val) ? val.join(', ') : String(val);
      case 'relation':
        return Array.isArray(val) ? `${val.length} lié(s)` : (val ? '1 lié' : '-');
      default:
        return String(val);
    }
  };

  const linkedIds = isSourceMany ? (Array.isArray(value) ? value : []) : (value ? [value] : []);
  const linkedItems = targetItems.filter((ti: any) => linkedIds.includes(ti.id));

  return (
    <PopoverButton
      icon="List"
      title="Voir les éléments liés"
      size={10}
      isAbsolute={true}
      className="-ml-2"
      contentClassName="w-[720px]"
      top={top}
      right={right}
    >
      <div className="text-sm text-neutral-300 max-h-80 overflow-y-auto">
        <div className="flex items-center justify-between px-2 pb-2 border-b border-white/10">
          <span className="text-xs text-neutral-400">{targetCollection?.name}</span>
          {onNavigateToCollection && (
            <button
              className="text-xs text-cyan-300 hover:text-cyan-200 hover:underline"
              onClick={() => {
                onNavigateToCollection(targetCollectionId, linkedIds);
              }}
            >
              Ouvrir la collection
            </button>
          )}
        </div>
        <table className="w-full text-left text-xs">
          <thead className="text-neutral-500 sticky top-0 bg-neutral-900">
            <tr>
              {(targetCollection?.properties || []).map((p: any) => (
                <th key={p.id} className="py-1 px-2 font-semibold">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linkedItems.length === 0 ? (
              <tr>
                <td className="py-2 px-2 text-neutral-500" colSpan={(targetCollection?.properties || []).length || 1}>Aucun</td>
              </tr>
            ) : (
              linkedItems.map((it: any) => (
                <tr key={it.id} className="hover:bg-white/5">
                  {(targetCollection?.properties || []).map((p: any) => (
                    <td key={p.id} className="py-1 px-2">
                      {p.id === 'name' || p.name === 'Nom' ? getItemName(it) : formatCell(it[p.id], p)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PopoverButton>
  );
};
