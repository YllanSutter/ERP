import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import './field-row.css';

export function FieldRow({ label, icon, actions, required, children, className, labelId, htmlFor, inline = false }: {
  inline?: boolean;
  label: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  labelId?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn('field-row group/template', inline && 'field-row-inline', className)}>
      <div className="field-row-heading">
        <label className="field-row-label" id={labelId} htmlFor={htmlFor}>
          {icon}<span>{label}{required && <span className="ml-1 text-destructive">*</span>}</span>
        </label>
        {actions}
      </div>
      <div className="field-row-value">{children}</div>
    </div>
  );
}
