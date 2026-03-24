/**
 * Plugin Steam - Manifest de configuration
 * 
 * Ce plugin vide sert de template pour créer de nouveaux plugins.
 * Il est actuellement inactif et ne fait rien.
 */

import { PluginManifest } from '../types';

export const steamPluginManifest: PluginManifest = {
  id: 'steam',
  name: 'Steam Integration',
  version: '1.0.0',
  description: 'Intégration Steam avec autocomplete de jeux et import de prix ITAD',
  icon: '🎮',
  enabled: false,
  config: {
    // Configuration pour les colonnes de prix
    priceSaleColumn: undefined, // ID de la colonne pour les prix soldés
    priceRegularColumn: undefined, // ID de la colonne pour les prix réguliers
    priceBlackMarketColumn: undefined, // ID de la colonne pour les prix du marché gris
    itadCountry: 'FR', // Pays pour les prix ITAD
    itadShops: [61], // IDs des boutiques (61 = Steam)
    itadCapacity: 3 // Nombre de résultats à retourner
  }
};
