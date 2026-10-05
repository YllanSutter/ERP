import { mergePreferences } from './routeHelpers.js';

export const registerUserAccessRoutes = ({ app, appContext }) => {
  const {
    logger, pool, bcrypt, requireAuth, requirePermission, requireBaseAdminOrPermission,
    logAudit, wouldRemoveLastOrganizationAdmin,
  } = appContext;
  app.get('/api/organization/members', requireAuth, requireBaseAdminOrPermission('can_manage_permissions'), async (req, res) => {
    const organizationId = req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });

    const members = await pool.query(
      `SELECT u.id, u.email, u.name, u.provider,
              COALESCE(json_agg(ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), '[]') as role_ids
       FROM organization_members om
       INNER JOIN users u ON u.id = om.user_id
       LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.organization_id = om.organization_id
       WHERE om.organization_id = $1
       GROUP BY u.id
       ORDER BY u.email ASC`,
      [organizationId]
    );

    return res.json(members.rows);
  });

  app.get('/api/organization/member-candidates', requireAuth, requireBaseAdminOrPermission('can_manage_permissions'), async (req, res) => {
    const organizationId = req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });

    const candidates = await pool.query(
      `SELECT u.id, u.email, u.name, u.provider
       FROM users u
       WHERE NOT EXISTS (
         SELECT 1
         FROM organization_members om
         WHERE om.organization_id = $1
           AND om.user_id = u.id
       )
       ORDER BY u.email ASC`,
      [organizationId]
    );

    return res.json(candidates.rows);
  });

  app.post('/api/organization/members', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
    const organizationId = req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });

    const userId = String(req.body?.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (!userCheck.rowCount) return res.status(404).json({ error: 'user not found' });

    await pool.query(
      'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [organizationId, userId]
    );
    await logAudit(req.auth?.user?.id, 'organization_members.add', 'organization', organizationId, { userId });
    return res.json({ ok: true });
  });

  app.delete('/api/organization/members/:userId', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
    const organizationId = req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });

    const userId = String(req.params.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (req.auth?.user?.id === userId) return res.status(400).json({ error: 'cannot remove own membership' });

    const removingLastAdmin = await wouldRemoveLastOrganizationAdmin(organizationId, userId);
    if (removingLastAdmin) {
      return res.status(400).json({ error: 'cannot remove last admin from organization' });
    }

    await pool.query('DELETE FROM user_roles WHERE organization_id = $1 AND user_id = $2', [organizationId, userId]);
    const del = await pool.query('DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2', [organizationId, userId]);
    if (!del.rowCount) return res.status(404).json({ error: 'member not found' });

    await logAudit(req.auth?.user?.id, 'organization_members.remove', 'organization', organizationId, { userId });
    return res.json({ ok: true });
  });

  app.get('/api/users', requireAuth, requireBaseAdminOrPermission('can_manage_permissions'), async (_req, res) => {
    const organizationId = _req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });
    const users = await pool.query(
      `SELECT u.id, u.email, u.name, u.provider,
              COALESCE(u.user_preferences, '{}'::jsonb) AS user_preferences,
              COALESCE(json_agg(ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), '[]') as role_ids
       FROM users u
       INNER JOIN organization_members om ON om.user_id = u.id AND om.organization_id = $1
       LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.organization_id = $1
       GROUP BY u.id`,
      [organizationId]
    );
    res.json(users.rows);
  });

  app.patch('/api/users/:id/preferences', requireAuth, async (req, res) => {
    try {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });

      const userId = String(req.params.id || '').trim();
      if (!userId) return res.status(400).json({ error: 'user id required' });

      const isSelf = req.auth?.user?.id === userId;
      const canManagePermissions = Boolean(
        req.auth?.permissions?.some((perm) => perm?.can_manage_permissions) ||
        req.auth?.roles?.some((role) => role?.name === 'admin') ||
        req.auth?.baseRoles?.some((role) => role?.name === 'admin')
      );
      if (!isSelf && !canManagePermissions) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const membership = await pool.query(
        'SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
        [organizationId, userId]
      );
      if (!membership.rowCount) {
        return res.status(404).json({ error: 'user not found in active organization' });
      }

      const payload = req.body?.preferences;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return res.status(400).json({ error: 'preferences object required' });
      }

      const currentUserRes = await pool.query(
        `SELECT COALESCE(user_preferences, '{}'::jsonb) AS user_preferences
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [userId]
      );
      if (!currentUserRes.rowCount) return res.status(404).json({ error: 'user not found' });

      const currentPreferences = currentUserRes.rows[0]?.user_preferences || {};

      // Normaliser UNIQUEMENT les valeurs fournis dans le payload
      const normalized = {};
      if (typeof payload.accentColor === 'string') {
        normalized.accentColor = payload.accentColor;
      }
      if (typeof payload.workStart === 'string') {
        normalized.workStart = payload.workStart;
      }
      if (typeof payload.workEnd === 'string') {
        normalized.workEnd = payload.workEnd;
      }
      if (typeof payload.breakStart === 'string') {
        normalized.breakStart = payload.breakStart;
      }
      if (typeof payload.breakEnd === 'string') {
        normalized.breakEnd = payload.breakEnd;
      }
      if (typeof payload.timezone === 'string') {
        normalized.timezone = payload.timezone;
      }
      if (payload.weekStartsOn === 'sunday' || payload.weekStartsOn === 'monday') {
        normalized.weekStartsOn = payload.weekStartsOn;
      }
      if (['compact', 'comfortable', 'spacious'].includes(payload.density)) {
        normalized.density = payload.density;
      }
      if (typeof payload.notificationsEnabled === 'boolean') {
        normalized.notificationsEnabled = payload.notificationsEnabled;
      }

      // Fusionner les valeurs normalisées avec les préférences existantes
      const nextPreferences = mergePreferences(currentPreferences, normalized);

      const updated = await pool.query(
        `UPDATE users
         SET user_preferences = $1::jsonb
         WHERE id = $2
         RETURNING id, COALESCE(user_preferences, '{}'::jsonb) AS user_preferences`,
        [JSON.stringify(nextPreferences), userId]
      );
      if (!updated.rowCount) return res.status(404).json({ error: 'user not found' });

      await logAudit(req.auth?.user?.id, 'user.preferences.update', 'user', userId, { userId });
      return res.json({ ok: true, user: updated.rows[0] });
    } catch (err) {
      logger.error('Update user preferences failed', err);
      return res.status(500).json({ error: 'Update user preferences failed' });
    }
  });

  app.patch('/api/users/:id/password', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
    try {
      const userId = req.params.id;
      const { password } = req.body || {};

      if (!password || typeof password !== 'string' || password.trim().length < 6) {
        return res.status(400).json({ error: 'password must be at least 6 characters' });
      }

      const userRes = await pool.query('SELECT id, provider FROM users WHERE id = $1', [userId]);
      if (!userRes.rowCount) return res.status(404).json({ error: 'user not found' });
      if (userRes.rows[0].provider && userRes.rows[0].provider !== 'local') {
        return res.status(400).json({ error: 'password update not allowed for non-local user' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
      await logAudit(req.auth?.user?.id, 'user.password.update', 'user', userId, { userId });
      return res.json({ ok: true });
    } catch (err) {
      logger.error('Update password failed', err);
      return res.status(500).json({ error: 'Update password failed' });
    }
  });

  app.delete('/api/users/:id', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
    try {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });

      const userId = req.params.id;
      if (req.auth?.user?.id === userId) {
        return res.status(400).json({ error: 'cannot delete own account' });
      }

      const deletingLastAdmin = await wouldRemoveLastOrganizationAdmin(organizationId, userId);
      if (deletingLastAdmin) {
        return res.status(400).json({ error: 'cannot delete last admin from organization' });
      }

      const userRes = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (!userRes.rowCount) return res.status(404).json({ error: 'user not found' });

      await pool.query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      await logAudit(req.auth?.user?.id, 'user.delete', 'user', userId, { userId });
      return res.json({ ok: true });
    } catch (err) {
      logger.error('Delete user failed', err);
      return res.status(500).json({ error: 'Delete user failed' });
    }
  });
};
