import React from 'react';
import { getViewRegistration } from '@/lib/views';
import type { ViewRendererProps } from '@/lib/views';

interface ViewRendererHostProps extends ViewRendererProps {
  className?: string;
}

export const ViewRendererHost: React.FC<ViewRendererHostProps> = ({ className, ...props }) => {
  const Renderer = getViewRegistration(props.view.type).Renderer;
  if (!Renderer) return null;

  return (
    <div className={className}>
      <Renderer {...props} />
    </div>
  );
};
