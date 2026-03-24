/**
 * Types et interfaces pour le système de plugins
 */

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  icon?: string;
  enabled?: boolean;
  config?: Record<string, any>;
}

export interface Plugin {
  manifest: PluginManifest;
  initialize?: (context: PluginContext) => void | Promise<void>;
  destroy?: () => void | Promise<void>;
  hooks?: PluginHooks;
  actions?: PluginActions;
}

export interface PluginContext {
  organizationId: string;
  userId: string;
  api: PluginAPI;
}

export interface PluginAPI {
  getOrganizationData: () => any;
  updateOrganizationConfig: (config: Record<string, any>) => Promise<void>;
  registerHook: (hookName: string, callback: Function) => void;
  unregisterHook: (hookName: string, callback: Function) => void;
  emit: (eventName: string, data: any) => void;
}

export interface PluginHooks {
  [key: string]: {
    name: string;
    description: string;
  };
}

export interface PluginActions {
  [key: string]: {
    name: string;
    description: string;
    handler: Function;
  };
}

export interface OrganizationPlugins {
  organizationId: string;
  plugins: PluginManifest[];
  enabledPlugins: string[];
  pluginConfigs: Record<string, Record<string, any>>;
}
