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
import { triggerAutomations } from '../services/automationService.js';
import { decryptStateSecrets } from '../services/secretFieldService.js';

export const registerAutomationRoutes = ({ app, appContext }) => {
  const { logger, requireAuth, requirePermission, pool, calculateEventSegments, defaultCalendarConfig } = appContext;

  app.post('/api/automations/:id/preview', requireAuth, requirePermission('can_write'), async (req, res) => {
    try {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });
      const { itemId } = req.body || {};
      if (!itemId) return res.status(400).json({ error: 'Choisis un item de test.' });
      const autoResult = await pool.query(
        'SELECT id, name, enabled, trigger_data, actions_data FROM automations WHERE id=$1 AND organization_id=$2',
        [req.params.id, organizationId]
      );
      if (!autoResult.rowCount) return res.status(404).json({ error: 'Automation not found' });
      const row = autoResult.rows[0];
      const automation = {
        id: row.id,
        name: row.name,
        enabled: true,
        trigger: typeof row.trigger_data === 'string' ? JSON.parse(row.trigger_data) : row.trigger_data,
        actions: typeof row.actions_data === 'string' ? JSON.parse(row.actions_data) : row.actions_data,
      };
      const stateResult = await pool.query('SELECT data FROM app_state WHERE organization_id=$1 LIMIT 1', [organizationId]);
      if (!stateResult.rowCount) return res.status(404).json({ error: 'State not found' });
      const original = decryptStateSecrets(JSON.parse(stateResult.rows[0].data), { preserveUnreadable: true });
      const collection = original.collections?.find((entry) => entry.id === automation.trigger.collectionId);
      const sample = collection?.items?.find((item) => item.id === itemId);
      if (!sample) return res.status(404).json({ error: 'Item de test introuvable.' });
      const simulated = structuredClone(original);
      let previous = structuredClone(sample);
      if (automation.trigger.type === 'item_updated' && automation.trigger.watchFields?.length) {
        const watchedField = automation.trigger.watchFields[0];
        previous[watchedField] = `__preview_previous_${randomUUID()}__`;
      }
      await triggerAutomations({
        eventType: automation.trigger.type,
        collectionId: automation.trigger.collectionId,
        triggerItem: structuredClone(sample),
        prevItem: previous,
        state: simulated,
        automations: [automation],
        pool,
        organizationId,
        calculateEventSegments,
        getDefaultCalendarConfig: () => defaultCalendarConfig,
        dryRun: true,
      });
      const changes = [];
      for (const nextCollection of simulated.collections || []) {
        const beforeCollection = original.collections?.find((entry) => entry.id === nextCollection.id);
        const beforeIds = new Set((beforeCollection?.items || []).map((item) => item.id));
        for (const item of nextCollection.items || []) {
          if (!beforeIds.has(item.id)) changes.push({ type: 'created', collection: nextCollection.name, item: item.name || item.id });
          else {
            const before = beforeCollection.items.find((entry) => entry.id === item.id);
            if (JSON.stringify(before) !== JSON.stringify(item)) changes.push({ type: 'updated', collection: nextCollection.name, item: item.name || item.id });
          }
        }
      }
      return res.json({ changes, matched: changes.length > 0, message: changes.length ? null : 'Aucun changement simulé. Vérifie les conditions et les valeurs des actions.' });
    } catch (err) {
      logger.error('POST /api/automations/:id/preview error', err);
      return res.status(500).json({ error: err.message || 'Échec de la simulation' });
    }
  });

  app.get('/api/automations/:id/runs', requireAuth, async (req, res) => {
    try {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });
      const result = await pool.query(
        `SELECT id, status, details, created_at FROM automation_runs
         WHERE organization_id = $1 AND automation_id = $2
         ORDER BY created_at DESC LIMIT 30`,
        [organizationId, req.params.id]
      );
      return res.json(result.rows.map((row) => ({
        id: row.id,
        status: row.status,
        details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
        createdAt: row.created_at,
      })));
    } catch (err) {
      logger.error('GET /api/automations/:id/runs error', err);
      return res.status(500).json({ error: 'Failed to load automation runs' });
    }
  });

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
      logger.error('GET /api/automations error', err);
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
      logger.error('POST /api/automations error', err);
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
      logger.error('PATCH /api/automations/:id error', err);
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
      logger.error('DELETE /api/automations/:id error', err);
      return res.status(500).json({ error: 'Failed to delete automation' });
    }
  });
};
