import React, { Suspense } from 'react';
import { getViewRegistration } from '@/lib/views';
import type { ViewRendererProps } from '@/lib/views';

interface ViewRendererHostProps extends ViewRendererProps {
  className?: string;
  fallback?: React.ReactNode;
}

export const ViewRendererHost: React.FC<ViewRendererHostProps> = ({ className, fallback = null, ...props }) => {
  const Renderer = getViewRegistration(props.view.type).Renderer;
  if (!Renderer) return <>{fallback}</>;

  return (
    <div className={className}>
      <Suspense fallback={<div role="status" className="p-4 text-sm text-muted-foreground">Chargement de la vue…</div>}><Renderer {...props} /></Suspense>
    </div>
  );
};
