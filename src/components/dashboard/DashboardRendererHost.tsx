import React, { lazy, Suspense } from 'react';
import type { DashboardRendererProps } from '@/lib/dashboardRegistry';
import { registerDashboard } from '@/lib/dashboardRegistry';

const DashboardView = lazy(() => import('./DashboardView'));

const DashboardRenderer: React.FC<DashboardRendererProps> = (props) => (
  <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Chargement…</div>}>
    <DashboardView {...props} />
  </Suspense>
);

export const defaultDashboardRegistration = {
  type: 'default',
  label: 'Dashboard',
  Renderer: DashboardRenderer,
};

registerDashboard(defaultDashboardRegistration);
