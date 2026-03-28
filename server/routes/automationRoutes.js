/**
 * automationRoutes.js
 * CRUD REST pour les automations d'une organisation.
 *
 * GET    /api/automations          → liste toutes les automations
 * POST   /api/automations          → crée une automation
 * PATCH  /api/automations/:id      → met à jour partiellement une automation
 * DELETE /api/automations/:id      → supprime une automation
 */

import { randomUUID } from 'crypto';

export const registerAutomationRoutes = ({ app, requireAuth, requirePermission, pool }) => {

  // ── GET /api/automations ───────────────────────────────────────────────────
  app.get('/api/automations', requireAuth, async (req, res) => {
    try {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });

      const result = await pool.query(
        `SELECT id, name, enabled, trigger_data, actions_data, created_at, updated_at
         FROM automations
         WHERE organization_id = $1
         ORDER BY created_at ASC`,
        [organizationId]
      );

      const automations = result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        enabled: row.enabled,
        trigger: typeof row.trigger_data === 'string' ? JSON.parse(row.trigger_data) : row.trigger_data,
        actions: typeof row.actions_data === 'string' ? JSON.parse(row.actions_data) : row.actions_data,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return res.json(automations);
    } catch (err) {
      console.error('GET /api/automations error', err);
      return res.status(500).json({ error: 'Failed to load automations' });
    }
  });

  // ── POST /api/automations ──────────────────────────────────────────────────
  app.post('/api/automations', requireAuth, requirePermission('can_write'), async (req, res) => {
    try {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });

      const { name = 'Nouvelle automation', enabled = true, trigger = {}, actions = [] } = req.body ?? {};

      const id = randomUUID();
      await pool.query(
        `INSERT INTO automations (id, organization_id, name, enabled, trigger_data, actions_data)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, organizationId, name, enabled, JSON.stringify(trigger), JSON.stringify(actions)]
      );

      return res.status(201).json({ id, name, enabled, trigger, actions });
    } catch (err) {
      console.error('POST /api/automations error', err);
      return res.status(500).json({ error: 'Failed to create automation' });
    }
  });

  // ── PATCH /api/automations/:id ─────────────────────────────────────────────
  app.patch('/api/automations/:id', requireAuth, requirePermission('can_write'), async (req, res) => {
    try {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });

      const { id } = req.params;
      const existing = await pool.query(
        'SELECT * FROM automations WHERE id = $1 AND organization_id = $2',
        [id, organizationId]
      );
      if (existing.rowCount === 0) return res.status(404).json({ error: 'Automation not found' });

      const row = existing.rows[0];
      const prev = {
        name: row.name,
        enabled: row.enabled,
        trigger: typeof row.trigger_data === 'string' ? JSON.parse(row.trigger_data) : row.trigger_data,
        actions: typeof row.actions_data === 'string' ? JSON.parse(row.actions_data) : row.actions_data,
      };

      const body = req.body ?? {};
      const next = {
        name:    body.name    !== undefined ? body.name    : prev.name,
        enabled: body.enabled !== undefined ? body.enabled : prev.enabled,
        trigger: body.trigger !== undefined ? body.trigger : prev.trigger,
        actions: body.actions !== undefined ? body.actions : prev.actions,
      };

      await pool.query(
        `UPDATE automations
         SET name = $1, enabled = $2, trigger_data = $3, actions_data = $4, updated_at = NOW()
         WHERE id = $5 AND organization_id = $6`,
        [next.name, next.enabled, JSON.stringify(next.trigger), JSON.stringify(next.actions), id, organizationId]
      );

      return res.json({ id, ...next });
    } catch (err) {
      console.error('PATCH /api/automations/:id error', err);
      return res.status(500).json({ error: 'Failed to update automation' });
    }
  });

  // ── DELETE /api/automations/:id ────────────────────────────────────────────
  app.delete('/api/automations/:id', requireAuth, requirePermission('can_write'), async (req, res) => {
    try {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });

      const { id } = req.params;
      const result = await pool.query(
        'DELETE FROM automations WHERE id = $1 AND organization_id = $2',
        [id, organizationId]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Automation not found' });

      return res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/automations/:id error', err);
      return res.status(500).json({ error: 'Failed to delete automation' });
    }
  });
};
