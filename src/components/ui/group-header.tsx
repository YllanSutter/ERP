import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface GroupHeaderProps extends Omit<React.ComponentProps<typeof Button>, 'children'> {
  label: React.ReactNode;
  count?: number;
  collapsible?: boolean;
  expanded?: boolean;
}

const GroupHeader = React.forwardRef<HTMLButtonElement, GroupHeaderProps>(
  ({ label, count, collapsible = true, expanded = true, className, ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      variant="ghost"
      aria-expanded={collapsible ? expanded : undefined}
      className={cn(
        'h-auto w-full justify-start gap-2 px-2 py-[var(--view-group-spacing)] text-left',
        collapsible ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : 'cursor-default',
        className,
      )}
      {...props}
    >
      {collapsible && <ChevronRight size={18} className={cn('transition-transform', expanded && 'rotate-90')} />}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
      {typeof count === 'number' && <span className="text-xs text-neutral-500">{count}</span>}
    </Button>
  ),
);
GroupHeader.displayName = 'GroupHeader';

export { GroupHeader };
