import React from 'react';

export type AccessPanelProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
};

type PanelFrameProps = AccessPanelProps & {
  accentClass?: string;
};

const PanelFrame = ({ children, title, description, className = '', accentClass = 'border-black/10 dark:border-white/5' }: PanelFrameProps) => (
  <section className={`rounded-xl border ${accentClass} bg-white/5 p-4 ${className}`}>
    {(title || description) && (
      <header className="mb-3">
        {title && <h4 className="font-semibold">{title}</h4>}
        {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
      </header>
    )}
    {children}
  </section>
);

export const DataTransferPanel = (props: AccessPanelProps) => (
  <PanelFrame {...props} accentClass="border-blue-500/20" />
);

export const OrganizationPanel = (props: AccessPanelProps) => (
  <PanelFrame {...props} accentClass="border-cyan-500/20" />
);

export const PermissionsPanel = (props: AccessPanelProps) => (
  <PanelFrame {...props} accentClass="border-violet-500/20" />
);

export const UsersPanel = (props: AccessPanelProps) => (
  <PanelFrame {...props} accentClass="border-emerald-500/20" />
);

export const ImportMappingPanel = (props: AccessPanelProps) => (
  <div className={`fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 ${props.className || ''}`}>
    {props.children}
  </div>
);
