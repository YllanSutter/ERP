export const registerPluginConfigRoutes = ({ app, requireAuth, pool }) => {
  // GET plugin config for an organization
  app.get('/api/plugins/config/:organizationId', requireAuth, async (req, res) => {
    try {
      const { organizationId } = req.params;

      // Verify user is in organization
      const checkMember = await pool.query(
        'SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
        [organizationId, req.auth.user.id]
      );
      if (checkMember.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Get all plugin configs for this organization
      const result = await pool.query(
        'SELECT plugin_id, enabled, config FROM plugin_configs WHERE organization_id = $1 ORDER BY plugin_id',
        [organizationId]
      );

      // Convert to map format
      const configs = {};
      result.rows.forEach((row) => {
        configs[row.plugin_id] = {
          enabled: row.enabled,
          config: row.config,
        };
      });

      res.json(configs);
    } catch (error) {
      console.error('[Plugins] GET config error:', error);
      res.status(500).json({ error: 'Failed to load plugin config' });
    }
  });

  // POST/PUT plugin config for an organization
  app.post('/api/plugins/config/:organizationId/:pluginId', requireAuth, async (req, res) => {
    try {
      const { organizationId, pluginId } = req.params;
      const { enabled, config } = req.body;

      // Verify user is in organization
      const checkMember = await pool.query(
        'SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
        [organizationId, req.auth.user.id]
      );
      if (checkMember.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Upsert plugin config
      const result = await pool.query(
        `INSERT INTO plugin_configs (organization_id, plugin_id, enabled, config, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (organization_id, plugin_id)
         DO UPDATE SET enabled = $3, config = $4, updated_at = NOW()
         RETURNING plugin_id, enabled, config`,
        [organizationId, pluginId, enabled || false, JSON.stringify(config || {})]
      );

      res.json({
        plugin_id: result.rows[0].plugin_id,
        enabled: result.rows[0].enabled,
        config: result.rows[0].config,
      });
    } catch (error) {
      console.error('[Plugins] POST config error:', error);
      res.status(500).json({ error: 'Failed to save plugin config' });
    }
  });
};
