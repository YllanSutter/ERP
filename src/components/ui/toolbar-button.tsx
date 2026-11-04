import * as React from 'react';
import { Button, type ButtonProps } from './button';
import { cn } from '@/lib/utils';

type ToolbarButtonProps = ButtonProps & {
  active?: boolean;
};

const ToolbarButton = React.forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  ({ active = false, className, variant = 'ghost', size = 'sm', ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        'gap-[var(--view-control-gap)] rounded-[var(--view-control-radius)] text-xs lg:text-sm',
        active && 'bg-brand-500/15 text-brand-700 dark:text-brand-300',
        className,
      )}
      {...props}
    />
  ),
);
ToolbarButton.displayName = 'ToolbarButton';

export { ToolbarButton };
