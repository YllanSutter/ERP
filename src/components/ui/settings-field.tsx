import * as React from 'react';
import { cn } from '@/lib/utils';

interface SettingsFieldProps {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
}

function SettingsField({ label, children, className, labelClassName }: SettingsFieldProps) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className={cn('block text-[10px] font-medium uppercase tracking-wide text-muted-foreground', labelClassName)}>{label}</span>
      {children}
    </label>
  );
}

export { SettingsField };
