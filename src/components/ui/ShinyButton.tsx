import React from 'react';
import { cn } from '@/lib/utils';

interface ShinyButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

const ShinyButton: React.FC<ShinyButtonProps> = ({
  children,
  className,
  onClick,
  type = 'button',
  disabled,
}) => {
  return (
    <button
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white',
        'shadow-sm transition-colors hover:bg-brand-700 active:bg-brand-800',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:opacity-60 disabled:pointer-events-none',
        className
      )}
    >
      {children}
    </button>
  );
};

export default ShinyButton;
