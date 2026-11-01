import React from 'react';
import { cn } from '@/lib/utils';

interface ViewShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared layout boundary for every collection view.
 *
 * Navigation and renderer-specific content stay inside this shell so spacing,
 * overflow and responsive behavior are controlled in one place.
 */
const ViewShell: React.FC<ViewShellProps> = ({ children, className }) => (
  <div className={cn('flex min-h- min-w-0 flex-1 flex-col overflow-hidden', className)}>
    {children}
  </div>
);

export default ViewShell;
