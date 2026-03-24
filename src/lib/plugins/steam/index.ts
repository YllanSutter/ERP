/**
 * Plugin Steam
 * 
 * Intégration Steam avec :
 * - Type de propriété custom pour la recherche de jeux
 * - Import de prix depuis ITAD
 */

import { Plugin, PluginContext } from '../types';
import { steamPluginManifest } from './manifest';

const API_URL = import.meta.env.VITE_API_URL || '/api';

let steamToolbarHook: ((data: any) => any) | null = null;

export const steamPlugin: Plugin = {
  manifest: steamPluginManifest,

  /**
   * Appelé lors de l'activation du plugin
   */
  async initialize(context: PluginContext) {
    console.log('[Steam Plugin] Initialization started for organization:', context.organizationId);
    
    // Enregistrer le hook pour ajouter le bouton ITAD au tableau
    steamToolbarHook = async (data: any) => {
      return {
        id: 'steam-import-itad',
        label: 'Importer depuis ITAD',
        icon: '⬇️',
        onClick: (items: any[]) => handleImportFromItad(context, items),
        color: 'blue'
      };
    };
    context.api.registerHook('table:toolbar:buttons', steamToolbarHook);
    
    console.log('[Steam Plugin] Initialization completed');
  },

  /**
   * Appelé lors de la désactivation du plugin
   */
  async destroy() {
    if (steamToolbarHook) {
      // unregister via api not available here; map cleanup handled by manager lifecycle guards
      steamToolbarHook = null;
    }

    console.log('[Steam Plugin] Cleaning up...');
    console.log('[Steam Plugin] Cleanup completed');
  },

  /**
   * Hooks disponibles que ce plugin peut utiliser
   */
  hooks: {
    'property:register': {
      name: 'Register Custom Property Type',
      description: 'Enregistrer un nouveau type de propriété'
    },
    'table:toolbar:buttons': {
      name: 'Table Toolbar Buttons',
      description: 'Ajouter des boutons à la barre d\'outils du tableau'
    }
  },

  /**
   * Actions disponibles que ce plugin expose
   */
  actions: {
    'getSteamGamesList': {
      name: 'Get Steam Games List',
      description: 'Récupère la liste des jeux Steam',
      handler: async () => {
        try {
          const response = await fetch('/steamList.json');
          if (!response.ok) throw new Error('Failed to load steam list');
          return await response.json();
        } catch (error) {
          console.error('[Steam Plugin] Error loading steam list:', error);
          return [];
        }
      }
    },

    'getPropertyTypes': {
      name: 'Get Property Types',
      description: 'Expose les types de propriétés ajoutés par le plugin',
      handler: async () => {
        return [
          { value: 'steam', label: 'Steam (Autocomplete)' }
        ];
      }
    },

    'importFromItad': {
      name: 'Import Prices from ITAD',
      description: 'Importe les prix depuis IsThereAnyDeal',
      handler: async (organizationId: string, itemIds: string[], config: any) => {
        return await handleImportFromItad(
          { organizationId, userId: '', api: {} as any },
          itemIds,
          config
        );
      }
    },

    'updatePluginConfig': {
      name: 'Update Plugin Config',
      description: 'Met à jour la configuration du plugin',
      handler: async (organizationId: string, config: Record<string, any>) => {
        // Cette action sera traitée par le manager
        return { success: true, config };
      }
    }
  }
};

/**
 * Importe les prix depuis ITAD
 */
async function handleImportFromItad(
  context: PluginContext,
  items: any[],
  config?: any
): Promise<any> {
  try {
    console.log('[Steam Plugin] Starting ITAD import for', items.length, 'items');
    
    const itemIds = items.map(item => item.id || item);
    const response = await fetch(`${API_URL}/plugins/steam/import-prices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        itemIds,
        organizationId: context.organizationId,
        config: config || {}
      })
    });

    if (!response.ok) {
      throw new Error(`Import failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[Steam Plugin] Import completed:', result);
    
    return result;
  } catch (error) {
    console.error('[Steam Plugin] Import error:', error);
    throw error;
  }
}

export { steamPluginManifest };
