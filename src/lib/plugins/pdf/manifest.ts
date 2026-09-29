/**
 * Plugin PDF - Manifest
 *
 * Permet de lier un modèle PDF (avec champs de formulaire AcroForm) à une
 * collection : prévisualisation, remplissage automatique depuis les champs
 * des objets de la collection, édition manuelle (prioritaire), sauvegarde
 * par objet et téléchargement.
 */

import { PluginManifest } from '../types';

export const pdfPluginManifest: PluginManifest = {
  id: 'pdf',
  name: 'PDF Forms',
  version: '1.0.0',
  description:
    'Liez un modèle PDF à vos collections : détection des champs modifiables, mapping vers les propriétés des objets, prévisualisation / remplissage / édition / sauvegarde dans NewItemModal',
  icon: '📄',
  enabled: false,
  config: {
    // Modèle PDF lié au plugin (uploadé via les paramètres du plugin)
    templateId: null as string | null,
    templateName: null as string | null,
    // Collections pour lesquelles le bloc PDF est affiché dans NewItemModal
    enabledCollectionIds: [] as string[],
    // Mapping par collection : { [collectionId]: { [champPdf]: proprieteId | '' } }
    mappings: {} as Record<string, Record<string, string>>,
    // Les valeurs éditées manuellement dans le modal écrasent les valeurs mappées
    manualOverride: true,
  },
};
