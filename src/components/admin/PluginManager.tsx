import React, { useState, useEffect } from 'react';
import { pluginManager, PluginManifest, PluginContext, getAllAvailablePlugins } from '@/lib/plugins';
import { useAuth } from '@/auth/AuthProvider';
import { Power, Settings } from 'lucide-react';
import SteamPluginConfig from './SteamPluginConfig';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface PluginManagerProps {
  organizationId: string;
  collectionProperties?: any[];
}

export const PluginManagerUI: React.FC<PluginManagerProps> = ({ organizationId, collectionProperties = [] }) => {
  const { user } = useAuth();
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [activePlugins, setActivePlugins] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [configPluginId, setConfigPluginId] = useState<string | null>(null);

  useEffect(() => {
    loadPlugins();
    // Log au montage
    console.log('[PluginManagerUI] Component mounted, organizationId:', organizationId);
  }, [organizationId]);

  const loadPlugins = async () => {
    try {
      const allPluginsData = getAllAvailablePlugins();
      const manifests = allPluginsData.map(p => p.manifest);
      setPlugins(manifests);
      console.log('[PluginManagerUI] Loaded plugins:', manifests);

      const active = new Set(pluginManager.getActivePlugins(organizationId).map(p => p.id));

      // Merge with persisted state from DB to avoid stale UI after refresh
      const response = await fetch(`${API_URL}/plugins/config/${organizationId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const persisted = await response.json() as Record<string, { enabled?: boolean }>;
        Object.entries(persisted).forEach(([pluginId, cfg]) => {
          if (cfg?.enabled) active.add(pluginId);
          else active.delete(pluginId);
        });
      }

      setActivePlugins(active);
    } catch (error) {
      console.error('[PluginManagerUI] Error loading plugins:', error);
    }
  };

  const handleTogglePlugin = async (pluginId: string) => {
    if (!user) return;

    const isActive = activePlugins.has(pluginId);
    setLoading(prev => ({ ...prev, [pluginId]: true }));

    try {
      const context: PluginContext = {
        organizationId,
        userId: user.id,
        api: {
          getOrganizationData: () => ({}),
          updateOrganizationConfig: async () => {},
          registerHook: (hookName, callback) => {
            pluginManager.registerHook(hookName, callback);
          },
          unregisterHook: (hookName, callback) => {
            pluginManager.unregisterHook(hookName, callback);
          },
          emit: (eventName, data) => {
            window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
          }
        }
      };

      if (isActive) {
        await pluginManager.disablePlugin(organizationId, pluginId);
        setActivePlugins(prev => {
          const updated = new Set(prev);
          updated.delete(pluginId);
          return updated;
        });
      } else {
        await pluginManager.enablePlugin(organizationId, pluginId, context);
        setActivePlugins(prev => new Set(prev).add(pluginId));
      }

      // Save to database
      const newState = !isActive;
      const response = await fetch(`/api/plugins/config/${organizationId}/${pluginId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled: newState,
          config: pluginManager.getPluginConfig(organizationId, pluginId) || {}
        })
      });

      if (!response.ok) {
        console.error('Failed to save plugin config:', await response.text());
      }
    } catch (error) {
      console.error('Error toggling plugin:', error);
    } finally {
      setLoading(prev => ({ ...prev, [pluginId]: false }));
    }
  };

  return (
    <div className="space-y-2">
      {plugins.length === 0 ? (
        <div className="rounded-lg bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 p-3 text-center text-neutral-500 text-xs">
          Aucun plugin disponible
        </div>
      ) : (
        <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
          {plugins.map(plugin => (
            <div key={plugin.id} className="rounded-lg bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  {plugin.icon && (
                    <span className="text-lg mt-0.5 flex-shrink-0">{plugin.icon}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{plugin.name}</div>
                    <div className="text-xs text-neutral-500">v{plugin.version}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Power
                    className={`w-3.5 h-3.5 transition-colors ${
                      activePlugins.has(plugin.id)
                        ? 'text-green-500'
                        : 'text-gray-400'
                    }`}
                  />
                </div>
              </div>

              <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-3">{plugin.description}</p>

              <div className="flex gap-2">
                <button
                  onClick={() => handleTogglePlugin(plugin.id)}
                  disabled={loading[plugin.id]}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition ${
                    activePlugins.has(plugin.id)
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  } disabled:opacity-60`}
                >
                  {loading[plugin.id] ? (
                    <span>⏳</span>
                  ) : activePlugins.has(plugin.id) ? (
                    'Désactiver'
                  ) : (
                    'Activer'
                  )}
                </button>
                <button
                  onClick={() => setConfigPluginId(plugin.id)}
                  className="px-2 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs text-neutral-600 dark:text-white flex items-center gap-1 disabled:opacity-60 transition"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {configPluginId === 'steam' && (
        <SteamPluginConfig
          organizationId={organizationId}
          properties={collectionProperties}
          onClose={() => setConfigPluginId(null)}
        />
      )}
    </div>
  );
};

export default PluginManagerUI;
