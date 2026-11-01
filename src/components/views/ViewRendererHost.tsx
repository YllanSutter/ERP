import React from 'react';
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
      <Renderer {...props} />
    </div>
  );
};
