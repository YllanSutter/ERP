import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingsDialog, SettingsBody, SettingsFooter } from '@/components/ui/settings-panel';
import { invalidateSteamGamesList } from './steamUtils';
import { refreshSteamImages } from './steamImages';
import { bundleRequest } from './bundleApi';
import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { pluginManager } from '@/lib/plugins';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface SteamPluginConfigProps {
  organizationId: string;
  collectionId?: string;
  properties?: any[];
  onClose: () => void;
  onSave?: (config: Record<string, any>) => void;
}

export const SteamPluginConfig: React.FC<SteamPluginConfigProps> = ({
  organizationId,
  collectionId,
  properties = [],
  onClose,
  onSave,
}) => {
  const [config, setConfig] = useState({
    bundlesPublicByDefault: false,
    priceSaleColumn: '',
    priceRegularColumn: '',
    priceBlackMarketColumn: '',
    itadCountry: 'FR',
    itadShops: [61],
    itadCapacity: 3,
  });

  const [saving, setSaving] = useState(false);
  const [maintenance, setMaintenance] = useState<'catalogue' | 'images' | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceError, setMaintenanceError] = useState('');
  const runMaintenance = async (operation: 'catalogue' | 'images') => {
    setMaintenance(operation);
    setMaintenanceMessage('');
    setMaintenanceError('');
    try {
      if (operation === 'catalogue') {
        const result = await bundleRequest('games/refresh', { method: 'POST' });
        invalidateSteamGamesList();
        setMaintenanceMessage(`${result.count} jeux Steam mis à jour.`);
      } else {
        await refreshSteamImages();
        setMaintenanceMessage('Cache des images actualisé. Les images affichées sont rechargées.');
      }
    } catch (error) {
      setMaintenanceError(error instanceof Error ? error.message : String(error));
    } finally {
      setMaintenance(null);
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      // 1) cache local plugin manager
      const currentConfig = pluginManager.getPluginConfig(organizationId, 'steam');
      setConfig((prev) => ({ ...prev, ...currentConfig }));

      // 2) source de vérité DB
      try {
        const res = await fetch(`${API_URL}/plugins/config/${organizationId}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const allConfigs = (await res.json()) as Record<string, { config?: Record<string, any> }>;
        const persisted = allConfigs?.steam?.config;
        if (persisted && typeof persisted === 'object') {
          setConfig((prev) => ({ ...prev, ...persisted }));
          pluginManager.updatePluginConfig(organizationId, 'steam', persisted);
        }
      } catch (error) {
        console.error('Error loading steam config:', error);
      }
    };

    loadConfig();
  }, [organizationId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/plugins/config/${organizationId}/steam`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled: pluginManager.isPluginActive(organizationId, 'steam'),
          config,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      pluginManager.updatePluginConfig(organizationId, 'steam', config);
      window.dispatchEvent(new Event('steam-config-changed'));
      onSave?.(config);
      onClose();
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Impossible de sauvegarder la configuration du plugin Steam.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsDialog open title="Configuration Steam" description="Catalogue, images, bundles et prix ITAD." onOpenChange={(open) => { if (!open && !saving) onClose(); }}>

        <SettingsBody className="space-y-4">
          <p className="text-sm text-neutral-500">
            Définissez les rôles Jeux et Bundles dans les paramètres de chaque collection existante.
          </p>
          <fieldset className="space-y-2 border-b border-black/10 dark:border-white/10 pb-4">
            <legend className="settings-section-title">Catalogue et images Steam</legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!maintenance}
                className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => void runMaintenance('catalogue')}
              >
                {maintenance === 'catalogue'
                  ? 'Mise à jour en cours…'
                  : 'Mettre à jour la liste Steam'}
              </button>
              <button
                type="button"
                disabled={!!maintenance}
                className="rounded border px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => void runMaintenance('images')}
              >
                {maintenance === 'images' ? 'Actualisation…' : 'Actualiser les images'}
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              La liste est mise à jour depuis Steam (clé serveur STEAM_API_KEY requise). Les images
              manquantes utilisent l’URL actuelle fournie par Steam ; actualiser vide leur cache et
              relance leur chargement.
            </p>
            {maintenanceMessage && (
              <p role="status" className="text-sm text-green-600">
                {maintenanceMessage}
              </p>
            )}
            {maintenanceError && (
              <p role="alert" className="text-sm text-red-500">
                {maintenanceError}
              </p>
            )}
          </fieldset>
          <fieldset className="space-y-2 border-b border-black/10 dark:border-white/10 pb-4">
            <legend className="settings-section-title">Visibilité des bundles</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.bundlesPublicByDefault === true}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, bundlesPublicByDefault: e.target.checked }))
                }
              />
              Bundles publics par défaut
            </label>
            <p className="text-xs text-neutral-500">
              Les nouveaux bundles créés ou importés seront publiés après leur sauvegarde. Les
              bundles existants gardent leur visibilité. Les publications sont actualisées
              automatiquement quand le bundle ou ses jeux changent ; seuls les jeux ayant un Steam
              App ID valide sont partagés.
            </p>
          </fieldset>
          <div>
            <label className="text-sm font-medium mb-2 block">Colonne Prix Soldé</label>
            <Select
              value={config.priceSaleColumn || '__unset__'}
              onValueChange={(selectedValue) => setConfig((prev) => ({ ...prev, priceSaleColumn: selectedValue === '__unset__' ? '' : selectedValue }))}
            >
              <SelectTrigger aria-label="Colonne Prix soldé" className="h-8 min-w-0 text-xs"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent className="p-1">
                <SelectItem value="__unset__">Aucune sélection</SelectItem>
                {properties.map((prop) => (
                  <SelectItem key={prop.id} value={prop.id}>
                    {prop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Colonne Prix Régulier</label>
            <Select
              value={config.priceRegularColumn || '__unset__'}
              onValueChange={(selectedValue) =>
                setConfig((prev) => ({ ...prev, priceRegularColumn: selectedValue === '__unset__' ? '' : selectedValue }))
              }
            >
              <SelectTrigger aria-label="Colonne Prix régulier" className="h-8 min-w-0 text-xs"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent className="p-1">
                <SelectItem value="__unset__">Aucune sélection</SelectItem>
                {properties.map((prop) => (
                  <SelectItem key={prop.id} value={prop.id}>
                    {prop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Colonne Prix Marché Gris (optionnel)
            </label>
            <Select
              value={config.priceBlackMarketColumn || '__unset__'}
              onValueChange={(selectedValue) =>
                setConfig((prev) => ({ ...prev, priceBlackMarketColumn: selectedValue === '__unset__' ? '' : selectedValue }))
              }
            >
              <SelectTrigger aria-label="Colonne Prix marché gris" className="h-8 min-w-0 text-xs"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent className="p-1">
                <SelectItem value="__unset__">Aucune sélection</SelectItem>
                {properties.map((prop) => (
                  <SelectItem key={prop.id} value={prop.id}>
                    {prop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-white/10 pt-4">
            <label className="text-sm font-medium mb-2 block">Pays ITAD</label>
            <input
              type="text"
              value={config.itadCountry}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, itadCountry: e.target.value.toUpperCase() }))
              }
              placeholder="FR"
              className="w-full px-3 py-2 rounded border border-white/10 bg-white dark:bg-neutral-900 text-sm"
              maxLength={2}
            />
            <p className="text-xs text-neutral-500 mt-1">Code pays ISO (FR, EN, DE, etc.)</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Boutiques ITAD</label>
            <input
              type="text"
              value={config.itadShops.join(', ')}
              onChange={(e) => {
                const shops = e.target.value
                  .split(',')
                  .map((s) => parseInt(s.trim()))
                  .filter((n) => !isNaN(n));
                setConfig((prev) => ({ ...prev, itadShops: shops }));
              }}
              placeholder="61"
              className="w-full px-3 py-2 rounded border border-white/10 bg-white dark:bg-neutral-900 text-sm"
            />
            <p className="text-xs text-neutral-500 mt-1">
              IDs des boutiques (61=Steam). Séparées par des virgules.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Capacité ITAD</label>
            <input
              type="number"
              value={config.itadCapacity}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, itadCapacity: parseInt(e.target.value) || 3 }))
              }
              min={1}
              max={20}
              className="w-full px-3 py-2 rounded border border-white/10 bg-white dark:bg-neutral-900 text-sm"
            />
            <p className="text-xs text-neutral-500 mt-1">Nombre de résultats à retourner par jeu</p>
          </div>
        </SettingsBody>

        <SettingsFooter>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-medium transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Save size={16} />
            Enregistrer
          </button>
        </SettingsFooter>
    </SettingsDialog>
  );
};

export default SteamPluginConfig;
