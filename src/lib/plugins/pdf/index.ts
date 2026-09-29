/**
 * Plugin PDF (frontend)
 *
 * - Enregistre les métadonnées du plugin
 * - Expose l'action `getPropertyTypes` (comme le plugin Steam) pour montrer
 *   qu'un plugin peut enrichir les types de propriétés
 * - Fournit des actions réutilisables (détection de champs, résolution des
 *   valeurs avec priorité aux modifications manuelles)
 */

import { Plugin } from '../types';
import { pdfPluginManifest } from './manifest';
import { detectPdfFields, resolvePdfValues, loadPdfBytes } from './pdfUtils';

export const pdfPlugin: Plugin = {
  manifest: pdfPluginManifest,

  async initialize() {
    console.log('[PDF Plugin] Initialized');
  },

  async destroy() {
    console.log('[PDF Plugin] Destroyed');
  },

  hooks: {
    'item:details:sections': {
      name: 'Item Details Sections',
      description: 'Ajoute la section PDF dans NewItemModal (rendu dédié)',
    },
  },

  actions: {
    getPropertyTypes: {
      name: 'Get Property Types',
      description: 'Expose les types de propriétés ajoutés par le plugin',
      handler: async () => {
        return [
          { value: 'pdf', label: 'PDF (Formulaire)' },
          { value: 'password', label: 'Password (masqué)' },
        ];
      },
    },

    detectFields: {
      name: 'Detect PDF Fields',
      description: 'Détecte les champs modifiables (AcroForm) d un modèle PDF',
      handler: async (templateId: string) => {
        const bytes = await loadPdfBytes('template', templateId);
        return detectPdfFields(bytes);
      },
    },

    resolveValues: {
      name: 'Resolve PDF Values',
      description:
        "Calcule les valeurs des champs PDF depuis le mapping, en donnant la priorité aux modifications manuelles de l'utilisateur",
      handler: async (params: Parameters<typeof resolvePdfValues>[0]) => {
        return resolvePdfValues(params);
      },
    },
  },
};

export { pdfPluginManifest };
