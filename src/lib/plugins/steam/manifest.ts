/**
 * Plugin Steam - Manifest de configuration
 * 
 * Ce plugin vide sert de template pour créer de nouveaux plugins.
 * Il est actuellement inactif et ne fait rien.
 */

import { PluginManifest } from '../types';

export const steamPluginManifest: PluginManifest = {
  id: 'steam',
  name: 'Steam Plugin',
  version: '1.0.0',
  description: 'Un plugin vide pour démarrer - À personnaliser selon vos besoins',
  icon: '🎮',
  enabled: false,
  config: {
    // Ajoutez les options de configuration par défaut ici
  }
};
