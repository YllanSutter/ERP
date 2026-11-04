import React, { useState, useEffect } from 'react';
import { pluginManager, PluginManifest, PluginContext, getAllAvailablePlugins } from '@/lib/plugins';
import { useAuth } from '@/auth/AuthProvider';
import { Settings } from 'lucide-react';
import { IconButton } from '@/components/ui/icon-button';
import { Switch } from '@/components/ui/switch';
import SteamPluginConfig from './SteamPluginConfig';
import PdfPluginConfigUI from './PdfPluginConfig';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface PluginManagerProps {
  organizationId: string;
  collectionProperties?: any[];
  collections?: any[];
}

export const PluginManagerUI: React.FC<PluginManagerProps> = ({ organizationId, collectionProperties = [], collections = [] }) => {
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
        <ul className="divide-y divide-border rounded-lg border border-border">
          {plugins.map((plugin) => (
            <li key={plugin.id} className="flex items-center gap-2 px-2 py-1.5 sm:px-3">
              {plugin.icon && <span className="shrink-0 text-base" aria-hidden="true">{plugin.icon}</span>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold">{plugin.name}</span>
                  <span className="text-xs text-muted-foreground">v{plugin.version}</span>
                </div>
                <p className="text-xs text-muted-foreground">{plugin.description}</p>
              </div>
              <Switch
                aria-label={`Activer ${plugin.name}`}
                checked={activePlugins.has(plugin.id)}
                disabled={loading[plugin.id]}
                onCheckedChange={() => handleTogglePlugin(plugin.id)}
              />
              <IconButton label={`Configurer ${plugin.name}`} className="size-8" onClick={() => setConfigPluginId(plugin.id)}>
                <Settings />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      {configPluginId === 'steam' && (
        <SteamPluginConfig
          organizationId={organizationId}
          properties={collectionProperties}
          onClose={() => setConfigPluginId(null)}
        />
      )}

      {configPluginId === 'pdf' && (
        <PdfPluginConfigUI
          organizationId={organizationId}
          collections={collections}
          onClose={() => setConfigPluginId(null)}
        />
      )}
    </div>
  );
};

export default PluginManagerUI;
