/**
 * Registre central de tous les plugins disponibles
 * 
 * Chaque plugin doit être enregistré ici pour être disponible dans l'application.
 */

import { Plugin } from './types';
import { steamPlugin } from './steam';
import { pluginManager } from './PluginManager';

/**
 * Registre des plugins
 */
const AVAILABLE_PLUGINS: Plugin[] = [
  steamPlugin,
  // Ajoutez d'autres plugins ici
];

/**
 * Initialise le registre en enregistrant tous les plugins disponibles
 */
export function initializePluginRegistry() {
  AVAILABLE_PLUGINS.forEach(plugin => {
    pluginManager.registerPlugin(plugin);
  });
  
  console.log(`[Plugin Registry] ${AVAILABLE_PLUGINS.length} plugin(s) registered`);
}

/**
 * Récupère un plugin par son ID
 */
export function getPluginById(id: string): Plugin | undefined {
  return AVAILABLE_PLUGINS.find(p => p.manifest.id === id);
}

/**
 * Récupère tous les plugins disponibles
 */
export function getAllAvailablePlugins(): Plugin[] {
  return AVAILABLE_PLUGINS;
}
