/**
 * Gestionnaire de plugins pour les organisations
 */

import { Plugin, PluginManifest, PluginContext, OrganizationPlugins } from './types';

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private activePlugins: Set<string> = new Set();
  private organizationConfigs: Map<string, OrganizationPlugins> = new Map();
  private hooks: Map<string, Set<Function>> = new Map();

  /**
   * Enregistre un plugin
   */
  registerPlugin(plugin: Plugin) {
    this.plugins.set(plugin.manifest.id, plugin);
  }

  /**
   * Active un plugin pour une organisation
   */
  async enablePlugin(organizationId: string, pluginId: string, context: PluginContext) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    const key = `${organizationId}:${pluginId}`;
    
    if (plugin.initialize) {
      await plugin.initialize(context);
    }

    this.activePlugins.add(key);
    this.updateOrganizationConfig(organizationId, pluginId, true);
  }

  /**
   * Désactive un plugin pour une organisation
   */
  async disablePlugin(organizationId: string, pluginId: string) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" not found`);
    }

    const key = `${organizationId}:${pluginId}`;

    if (plugin.destroy) {
      await plugin.destroy();
    }

    this.activePlugins.delete(key);
    this.updateOrganizationConfig(organizationId, pluginId, false);
  }

  /**
   * Vérifie si un plugin est actif pour une organisation
   */
  isPluginActive(organizationId: string, pluginId: string): boolean {
    return this.activePlugins.has(`${organizationId}:${pluginId}`);
  }

  /**
   * Retourne tous les plugins disponibles
   */
  getAllPlugins(): PluginManifest[] {
    return Array.from(this.plugins.values()).map(p => p.manifest);
  }

  /**
   * Retourne les plugins actifs pour une organisation
   */
  getActivePlugins(organizationId: string): PluginManifest[] {
    const plugins = Array.from(this.plugins.values());
    return plugins
      .filter(p => this.isPluginActive(organizationId, p.manifest.id))
      .map(p => p.manifest);
  }

  /**
   * Met à jour la configuration d'un plugin
   */
  updatePluginConfig(organizationId: string, pluginId: string, config: Record<string, any>) {
    const key = organizationId;
    const orgConfig = this.organizationConfigs.get(key) || {
      organizationId,
      plugins: [],
      enabledPlugins: [],
      pluginConfigs: {}
    };

    orgConfig.pluginConfigs[pluginId] = config;
    this.organizationConfigs.set(key, orgConfig);
  }

  /**
   * Récupère la configuration d'un plugin
   */
  getPluginConfig(organizationId: string, pluginId: string): Record<string, any> {
    const orgConfig = this.organizationConfigs.get(organizationId);
    return orgConfig?.pluginConfigs?.[pluginId] || {};
  }

  /**
   * Exécute une action de plugin
   */
  async executePluginAction(
    organizationId: string,
    pluginId: string,
    actionName: string,
    args: any[]
  ): Promise<any> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.actions || !plugin.actions[actionName]) {
      throw new Error(`Action "${actionName}" not found in plugin "${pluginId}"`);
    }

    if (!this.isPluginActive(organizationId, pluginId)) {
      throw new Error(`Plugin "${pluginId}" is not active`);
    }

    return await plugin.actions[actionName].handler(...args);
  }

  /**
   * Enregistre un hook personnalisé
   */
  registerHook(hookName: string, callback: Function) {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, new Set());
    }
    this.hooks.get(hookName)!.add(callback);
  }

  /**
   * Désenregistre un hook
   */
  unregisterHook(hookName: string, callback: Function) {
    const hooks = this.hooks.get(hookName);
    if (hooks) {
      hooks.delete(callback);
    }
  }

  /**
   * Déclenche un hook
   */
  async fireHook(hookName: string, data: any): Promise<any[]> {
    const hooks = this.hooks.get(hookName);
    if (!hooks) return [];

    const results: any[] = [];
    for (const callback of hooks) {
      try {
        const result = await callback(data);
        results.push(result);
      } catch (error) {
        console.error(`Error in hook "${hookName}":`, error);
      }
    }
    return results;
  }

  /**
   * Met à jour la configuration de l'organisation pour un plugin
   */
  private updateOrganizationConfig(organizationId: string, pluginId: string, enabled: boolean) {
    const key = organizationId;
    const orgConfig = this.organizationConfigs.get(key) || {
      organizationId,
      plugins: [],
      enabledPlugins: [],
      pluginConfigs: {}
    };

    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      // Ajouter le plugin à la liste s'il n'existe pas
      if (!orgConfig.plugins.find(p => p.id === pluginId)) {
        orgConfig.plugins.push(plugin.manifest);
      }

      // Ajouter/retirer de la liste des plugins activés
      if (enabled) {
        if (!orgConfig.enabledPlugins.includes(pluginId)) {
          orgConfig.enabledPlugins.push(pluginId);
        }
      } else {
        orgConfig.enabledPlugins = orgConfig.enabledPlugins.filter(id => id !== pluginId);
      }

      this.organizationConfigs.set(key, orgConfig);
    }
  }

  /**
   * Récupère la configuration d'une organisation
   */
  getOrganizationPluginConfig(organizationId: string): OrganizationPlugins | undefined {
    return this.organizationConfigs.get(organizationId);
  }

  /**
   * Initialise les plugins d'une organisation à partir d'une configuration sauvegardée
   */
  async initializeOrganizationPlugins(
    organizationId: string,
    config: OrganizationPlugins,
    context: PluginContext
  ) {
    this.organizationConfigs.set(organizationId, config);

    for (const pluginId of config.enabledPlugins) {
      const plugin = this.plugins.get(pluginId);
      if (plugin && plugin.initialize) {
        try {
          await plugin.initialize(context);
          this.activePlugins.add(`${organizationId}:${pluginId}`);
        } catch (error) {
          console.error(`Failed to initialize plugin "${pluginId}":`, error);
        }
      }
    }
  }
}

// Singleton instance
export const pluginManager = new PluginManager();
