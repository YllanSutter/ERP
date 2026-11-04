import type { ComponentType } from 'react';
import type { Collection, Item } from '@/lib/types';
import type { ViewDefinition } from './views/viewTypes';
import type { DashboardConfig } from './dashboardTypes';

export interface DashboardRendererProps {
  dashboard: DashboardConfig | null;
  collections: Collection[];
  views?: Record<string, ViewDefinition[]>;
  onUpdate: (patch: Partial<DashboardConfig>) => void;
  onEdit?: (item: Item) => void;
  onViewDetail?: (item: Item) => void;
  onShowNewItemModal?: (collection: Collection, item?: Item) => void;
}

export interface DashboardRegistration {
  type: string;
  label: string;
  Renderer: ComponentType<DashboardRendererProps>;
}

const registrations: DashboardRegistration[] = [];

export function registerDashboard(registration: DashboardRegistration): () => void {
  const existingIndex = registrations.findIndex((entry) => entry.type === registration.type);
  if (existingIndex >= 0) registrations.splice(existingIndex, 1);
  registrations.push(registration);
  return () => {
    const index = registrations.indexOf(registration);
    if (index >= 0) registrations.splice(index, 1);
  };
}

export function getDashboardRegistration(type = 'default'): DashboardRegistration | undefined {
  return registrations.find((registration) => registration.type === type);
}

export function getDashboardRegistrations(): DashboardRegistration[] {
  return [...registrations];
}
