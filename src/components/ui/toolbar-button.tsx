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
        active && 'bg-accent text-accent-foreground',
        className,
      )}
      {...props}
    />
  ),
);
ToolbarButton.displayName = 'ToolbarButton';

export { ToolbarButton };
