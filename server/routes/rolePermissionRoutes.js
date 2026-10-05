export const registerRolePermissionRoutes = ({ app, appContext }) => {
  const {
    pool, uuidv4, requireAuth, requirePermission, requireBaseAdminOrPermission,
    logAudit, getAdminRoleForOrganization, countOrganizationAdmins, upsertPermission,
  } = appContext;
  app.get('/api/roles', requireAuth, requireBaseAdminOrPermission('can_manage_permissions'), async (_req, res) => {
    const organizationId = _req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });
    const roles = await pool.query('SELECT * FROM roles WHERE organization_id = $1', [organizationId]);
    res.json(roles.rows);
  });

  app.post('/api/roles', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
    const organizationId = req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const roleId = uuidv4();
    await pool.query(
      'INSERT INTO roles (id, organization_id, name, description, is_system) VALUES ($1, $2, $3, $4, false)',
      [roleId, organizationId, name, description || null]
    );
    await logAudit(req.auth?.user?.id, 'role.create', 'role', roleId, { name });
    res.json({ ok: true, id: roleId });
  });

  app.post('/api/user_roles', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
    const organizationId = req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });
    const { userId, roleId, action } = req.body;
    if (!userId || !roleId) return res.status(400).json({ error: 'userId and roleId required' });

    const roleCheck = await pool.query('SELECT id FROM roles WHERE id = $1 AND organization_id = $2', [roleId, organizationId]);
    if (!roleCheck.rowCount) return res.status(404).json({ error: 'role not found in active organization' });

    if (action === 'remove') {
      const adminRole = await getAdminRoleForOrganization(organizationId);
      if (adminRole?.id === roleId) {
        const targetHasAdminRole = await pool.query(
          'SELECT 1 FROM user_roles WHERE organization_id = $1 AND user_id = $2 AND role_id = $3 LIMIT 1',
          [organizationId, userId, roleId]
        );
        if (targetHasAdminRole.rowCount) {
          const adminCount = await countOrganizationAdmins(organizationId);
          if (adminCount <= 1) {
            return res.status(400).json({ error: 'cannot remove last admin from organization' });
          }
        }
      }
      await pool.query('DELETE FROM user_roles WHERE organization_id = $1 AND user_id = $2 AND role_id = $3', [organizationId, userId, roleId]);
      await logAudit(req.auth?.user?.id, 'user_roles.remove', 'user', userId, { roleId });
    } else {
      await pool.query(
        'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [organizationId, userId]
      );
      await pool.query(
        'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [organizationId, userId, roleId]
      );
      await logAudit(req.auth?.user?.id, 'user_roles.add', 'user', userId, { roleId });
    }
    res.json({ ok: true });
  });

  app.get('/api/permissions', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
    const organizationId = _req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });
    const perms = await pool.query('SELECT * FROM permissions WHERE organization_id = $1', [organizationId]);
    res.json(perms.rows);
  });

  app.post('/api/permissions', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
    const organizationId = req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });
    const perm = req.body || {};
    if (!perm.role_id) return res.status(400).json({ error: 'role_id required' });
    const roleCheck = await pool.query('SELECT id FROM roles WHERE id = $1 AND organization_id = $2', [perm.role_id, organizationId]);
    if (!roleCheck.rowCount) return res.status(404).json({ error: 'role not found in active organization' });
    const result = await upsertPermission({ ...perm, organization_id: organizationId });
    await logAudit(req.auth?.user?.id, 'permission.upsert', 'permission', perm.role_id, perm);
    res.json(result);
  });
};
