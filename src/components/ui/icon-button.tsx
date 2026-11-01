import * as React from 'react';
import { Button, type ButtonProps } from './button';
import { cn } from '@/lib/utils';

type IconButtonProps = ButtonProps & {
  label: string;
};

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, className, size = 'icon', variant = 'ghost', ...props }, ref) => (
    <Button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      size={size}
      variant={variant}
      className={cn('shrink-0', className)}
      {...props}
    />
  ),
);
IconButton.displayName = 'IconButton';

export { IconButton };
