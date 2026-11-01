import React from 'react';
import DashboardView from './DashboardView';
import type { DashboardRendererProps } from '@/lib/dashboardRegistry';
import { registerDashboard } from '@/lib/dashboardRegistry';

const DashboardRenderer: React.FC<DashboardRendererProps> = (props) => <DashboardView {...props} />;

export const defaultDashboardRegistration = {
  type: 'default',
  label: 'Dashboard',
  Renderer: DashboardRenderer,
};

registerDashboard(defaultDashboardRegistration);
