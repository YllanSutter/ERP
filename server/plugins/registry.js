const serverPlugins = [];

export const registerServerPlugin = (plugin) => {
  if (!plugin || typeof plugin.register !== 'function') {
    throw new Error('[Server Plugins] Invalid plugin: expected { id, register() }');
  }

  const id = String(plugin.id || '').trim();
  if (!id) {
    throw new Error('[Server Plugins] Plugin id is required');
  }

  if (serverPlugins.some((p) => p.id === id)) {
    return;
  }

  serverPlugins.push({ ...plugin, id });
};

export const getServerPlugins = () => [...serverPlugins];

export const mountServerPlugins = ({ app, deps }) => {
  for (const plugin of serverPlugins) {
    try {
      plugin.register({ app, deps });
      console.log(`[Server Plugins] Mounted: ${plugin.id}`);
    } catch (error) {
      console.error(`[Server Plugins] Failed to mount ${plugin.id}:`, error);
    }
  }
};
