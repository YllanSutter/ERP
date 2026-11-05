import * as React from 'react';
import { SettingsLabel } from './settings-panel';
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
      <SettingsLabel className={labelClassName}>{label}</SettingsLabel>
      {children}
    </label>
  );
}

export { SettingsField };
