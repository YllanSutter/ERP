import type { ViewRegistration } from './viewTypes';

const pluginRegistrations = new Map<string, ViewRegistration>();

export function registerPluginView(pluginId: string, registration: ViewRegistration): void {
  if (!pluginId.trim()) throw new Error('A plugin view requires a plugin id');
  if (!registration.type.trim()) throw new Error(`Plugin "${pluginId}" registered a view without a type`);
  const existing = pluginRegistrations.get(registration.type);
  if (existing && existing.pluginId !== pluginId) {
    throw new Error(`A view with type "${registration.type}" is already registered`);
  }
  pluginRegistrations.set(registration.type, registration);
}

export function unregisterPluginViews(pluginId: string): void {
  for (const [type, registration] of pluginRegistrations) {
    if (registration.pluginId === pluginId) pluginRegistrations.delete(type);
  }
}

export function getPluginViewRegistrations(): ViewRegistration[] {
  return Array.from(pluginRegistrations.values());
}
