/**
 * Plugin PDF - Hook client global
 *
 * Récupère la configuration du plugin pdf :
 *  - depuis le cache local du PluginManager (si dispo)
 *  - sinon directement depuis l'API (persistance DB), ce qui garantit que la
 *    config est disponible même si le bootstrap des plugins n'a pas tourné
 *    dans la session courante.
 */

import { useEffect, useState } from 'react';
import { pluginManager } from '@/lib/plugins';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface PdfFieldMapping {
  propertyId: string;
  customText?: string;
}

export type PdfMappingEntry = string | PdfFieldMapping;

export function getPdfMappingPropertyId(entry: PdfMappingEntry | undefined): string {
  return typeof entry === 'string' ? entry : entry?.propertyId || '';
}

export interface PdfPluginConfig {
  templateId: string | null;
  templateName: string | null;
  enabledCollectionIds: string[];
  mappings: Record<string, Record<string, PdfMappingEntry>>;
  manualOverride: boolean;
}

export const DEFAULT_PDF_CONFIG: PdfPluginConfig = {
  templateId: null,
  templateName: null,
  enabledCollectionIds: [],
  mappings: {},
  manualOverride: true,
};

export function normalizePdfConfig(raw: any): PdfPluginConfig {
  return {
    templateId: raw?.templateId ?? null,
    templateName: raw?.templateName ?? null,
    enabledCollectionIds: Array.isArray(raw?.enabledCollectionIds) ? raw.enabledCollectionIds : [],
    mappings: raw?.mappings && typeof raw.mappings === 'object' ? raw.mappings : {},
    manualOverride: raw?.manualOverride !== false,
  };
}

export function usePdfPluginConfig(organizationId?: string | null): PdfPluginConfig | null {
  const [config, setConfig] = useState<PdfPluginConfig | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!organizationId) {
        setConfig(null);
        return;
      }

      // 1) Cache local du gestionnaire de plugins
      try {
        if (pluginManager.getAllPlugins().some((p) => p.id === 'pdf')) {
          const local = pluginManager.getPluginConfig(organizationId, 'pdf');
          if (local && Object.keys(local).length > 0) {
            if (!cancelled) setConfig(normalizePdfConfig(local));
            return;
          }
        }
      } catch {
        /* plugin manager non initialisé — on retombe sur l'API */
      }

      // 2) Persistance serveur
      try {
        const res = await fetch(`${API_URL}/plugins/config/${organizationId}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const all = await res.json();
        const entry = all?.pdf;
        if (!cancelled) {
          if (entry && entry.enabled !== false && entry.config) {
            setConfig(normalizePdfConfig(entry.config));
          } else if (entry && entry.enabled === false) {
            setConfig(null);
          }
        }
      } catch (error) {
        console.warn('[PDF Plugin] Chargement de la config impossible:', error);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return config;
}
