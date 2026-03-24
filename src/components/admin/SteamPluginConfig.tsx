import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
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
  onSave
}) => {
  const [config, setConfig] = useState({
    priceSaleColumn: '',
    priceRegularColumn: '',
    priceBlackMarketColumn: '',
    itadCountry: 'FR',
    itadShops: [61],
    itadCapacity: 3
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      // 1) cache local plugin manager
      const currentConfig = pluginManager.getPluginConfig(organizationId, 'steam');
      setConfig(prev => ({ ...prev, ...currentConfig }));

      // 2) source de vérité DB
      try {
        const res = await fetch(`${API_URL}/plugins/config/${organizationId}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const allConfigs = await res.json() as Record<string, { config?: Record<string, any> }>;
        const persisted = allConfigs?.steam?.config;
        if (persisted && typeof persisted === 'object') {
          setConfig(prev => ({ ...prev, ...persisted }));
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
      pluginManager.updatePluginConfig(organizationId, 'steam', config);

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold">Configuration Steam Plugin</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="text-sm font-medium mb-2 block">Colonne Prix Soldé</label>
            <select
              value={config.priceSaleColumn}
              onChange={(e) => setConfig(prev => ({ ...prev, priceSaleColumn: e.target.value }))}
              className="w-full px-3 py-2 rounded border border-white/10 bg-white dark:bg-neutral-900 text-sm"
            >
              <option value="">-- Sélectionner --</option>
              {properties.map((prop) => (
                <option key={prop.id} value={prop.id}>
                  {prop.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Colonne Prix Régulier</label>
            <select
              value={config.priceRegularColumn}
              onChange={(e) => setConfig(prev => ({ ...prev, priceRegularColumn: e.target.value }))}
              className="w-full px-3 py-2 rounded border border-white/10 bg-white dark:bg-neutral-900 text-sm"
            >
              <option value="">-- Sélectionner --</option>
              {properties.map((prop) => (
                <option key={prop.id} value={prop.id}>
                  {prop.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Colonne Prix Marché Gris (optionnel)</label>
            <select
              value={config.priceBlackMarketColumn}
              onChange={(e) => setConfig(prev => ({ ...prev, priceBlackMarketColumn: e.target.value }))}
              className="w-full px-3 py-2 rounded border border-white/10 bg-white dark:bg-neutral-900 text-sm"
            >
              <option value="">-- Sélectionner --</option>
              {properties.map((prop) => (
                <option key={prop.id} value={prop.id}>
                  {prop.name}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-white/10 pt-4">
            <label className="text-sm font-medium mb-2 block">Pays ITAD</label>
            <input
              type="text"
              value={config.itadCountry}
              onChange={(e) => setConfig(prev => ({ ...prev, itadCountry: e.target.value.toUpperCase() }))}
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
                const shops = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                setConfig(prev => ({ ...prev, itadShops: shops }));
              }}
              placeholder="61"
              className="w-full px-3 py-2 rounded border border-white/10 bg-white dark:bg-neutral-900 text-sm"
            />
            <p className="text-xs text-neutral-500 mt-1">IDs des boutiques (61=Steam). Séparées par des virgules.</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Capacité ITAD</label>
            <input
              type="number"
              value={config.itadCapacity}
              onChange={(e) => setConfig(prev => ({ ...prev, itadCapacity: parseInt(e.target.value) || 3 }))}
              min={1}
              max={20}
              className="w-full px-3 py-2 rounded border border-white/10 bg-white dark:bg-neutral-900 text-sm"
            />
            <p className="text-xs text-neutral-500 mt-1">Nombre de résultats à retourner par jeu</p>
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-medium transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Save size={16} />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default SteamPluginConfig;
