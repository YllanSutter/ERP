import { pluginManager } from './PluginManager';

export interface PluginPropertyTypeOption {
  value: string;
  label: string;
}

const isValidOption = (entry: any): entry is PluginPropertyTypeOption => {
  return Boolean(
    entry
    && typeof entry === 'object'
    && typeof entry.value === 'string'
    && entry.value.trim()
    && typeof entry.label === 'string'
    && entry.label.trim()
  );
};

export async function getPluginPropertyTypeOptions(organizationId?: string | null): Promise<PluginPropertyTypeOption[]> {
  if (!organizationId) return [];

  const activePlugins = pluginManager.getActivePlugins(organizationId);
  const flattened: any[] = [];

  for (const manifest of activePlugins) {
    const plugin = pluginManager.getPluginDefinition(manifest.id);
    const action = plugin?.actions?.getPropertyTypes;
    if (!action?.handler) continue;

    try {
      const result = await action.handler({ organizationId, pluginId: manifest.id });
      if (Array.isArray(result)) flattened.push(...result);
      else flattened.push(result);
    } catch (error) {
      console.error(`Failed to resolve property types for plugin "${manifest.id}":`, error);
    }
  }

  const uniqueByValue = new Map<string, PluginPropertyTypeOption>();
  for (const entry of flattened) {
    if (!isValidOption(entry)) continue;
    if (!uniqueByValue.has(entry.value)) {
      uniqueByValue.set(entry.value, { value: entry.value, label: entry.label });
    }
  }

  return Array.from(uniqueByValue.values());
}
