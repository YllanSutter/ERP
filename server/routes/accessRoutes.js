export const registerAccessRoutes = ({
  app,
  pool,
  uuidv4,
  bcrypt,
  requireAuth,
  requirePermission,
  requireBaseAdminOrPermission,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  loadUserContext,
  createLocalUser,
  logAudit,
  sanitizeMappedOrganizations,
  buildImportPreviewOrganizations,
  applyOrganizationNameOverride,
  INITIAL_APP_STATE,
  ensureSystemRolesForOrganization,
  getRoleByNameInOrganization,
  syncAppStateIdSequence,
  getUserOrganizations,
  ensureAppStateForOrganization,
  isUserAdminInOrganization,
  ensureDefaultOrganization,
  wouldRemoveLastOrganizationAdmin,
  getAdminRoleForOrganization,
  countOrganizationAdmins,
  upsertPermission,
}) => {
  const createOrganizationFromImportedState = async (ownerUserId, organizationName, state) => {
    const orgId = uuidv4();
    const trimmedName = String(organizationName || '').trim() || `Organisation importée ${new Date().toLocaleDateString('fr-FR')}`;
    const safeState = state && typeof state === 'object'
      ? state
      : { ...INITIAL_APP_STATE };

    await pool.query(
      'INSERT INTO organizations (id, name, owner_user_id) VALUES ($1, $2, $3)',
      [orgId, trimmedName, ownerUserId]
    );
    await pool.query(
      'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [orgId, ownerUserId]
    );

    await ensureSystemRolesForOrganization(orgId);
    const adminRole = await getRoleByNameInOrganization(orgId, 'admin');
    if (adminRole.rowCount) {
      await pool.query(
        'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [orgId, ownerUserId, adminRole.rows[0].id]
      );
    }

    await syncAppStateIdSequence();
    await pool.query(
      `INSERT INTO app_state (organization_id, user_id, data)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         data = EXCLUDED.data`,
      [orgId, ownerUserId, JSON.stringify(safeState)]
    );

    return { id: orgId, name: trimmedName };
  };

  // --- Auth routes --------------------------------------------------------
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });
      const userId = await createLocalUser({ email: String(email).trim().toLowerCase(), password, name });
      const token = signToken(userId);
      setAuthCookie(res, token);
      const ctx = await loadUserContext(userId);
      return res.json({ user: ctx?.user || null, roles: ctx?.roles || [] });
    } catch (err) {
      if (err.message === 'email_exists') {
        return res.status(400).json({ error: 'email already registered' });
      }
      console.error('Register failed', err);
      return res.status(500).json({ error: 'Register failed' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ error: 'email and password required' });
      const userRes = await pool.query('SELECT * FROM users WHERE email = $1 AND provider = $2', [String(email).trim().toLowerCase(), 'local']);
      if (!userRes.rowCount) return res.status(401).json({ error: 'Invalid credentials' });
      const user = userRes.rows[0];
      const ok = await bcrypt.compare(password, user.password_hash || '');
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = signToken(user.id);
      setAuthCookie(res, token);
      const ctx = await loadUserContext(user.id);
      return res.json({ user: ctx?.user || null, roles: ctx?.roles || [] });
    } catch (err) {
      console.error('Login failed', err);
      return res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req, res) => {
    if (req.auth.activeOrganization?.id) {
      res.cookie('active_organization_id', req.auth.activeOrganization.id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    res.json({
      user: req.auth.user,
      roles: req.auth.roles,
      baseRoles: req.auth.baseRoles || req.auth.roles,
      permissions: req.auth.permissions || [],
      impersonatedRoleId: req.auth.impersonatedRoleId || null,
      organizations: req.auth.organizations || [],
      activeOrganizationId: req.auth.activeOrganization?.id || null,
    });
  });

  app.post('/api/auth/impersonate', requireAuth, async (req, res) => {
    const isAdmin = (req.auth.baseRoles || req.auth.roles || []).some((r) => r.name === 'admin');
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { roleId } = req.body || {};

    if (!roleId) {
      res.clearCookie('impersonate_role_id');
      return res.json({ ok: true, impersonatedRoleId: null });
    }

    const roleRes = await pool.query(
      'SELECT id FROM roles WHERE id = $1 AND organization_id = $2',
      [roleId, req.auth.activeOrganization?.id || null]
    );
    if (!roleRes.rowCount) return res.status(404).json({ error: 'role not found' });

    res.cookie('impersonate_role_id', roleId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({ ok: true, impersonatedRoleId: roleId });
  });

  app.post('/api/import/organizations', requireAuth, async (req, res) => {
    try {
      const isBaseAdmin = !!req.auth.baseIsAdmin;
      if (!isBaseAdmin) {
        return res.status(403).json({ error: 'Forbidden: import requires base admin' });
      }

      const manualMapped = sanitizeMappedOrganizations(req.body?.mappedOrganizations || []);
      const format = String(req.body?.format || '').toLowerCase();
      let parsedOrganizations = manualMapped.length
        ? manualMapped
        : buildImportPreviewOrganizations({ format, body: req.body });

      parsedOrganizations = applyOrganizationNameOverride(parsedOrganizations, req.body?.organizationName || '');

      if (!manualMapped.length && !['csv', 'json'].includes(format)) {
        return res.status(400).json({ error: 'Invalid format. Expected json or csv.' });
      }

      if (!Array.isArray(parsedOrganizations) || parsedOrganizations.length === 0) {
        return res.status(400).json({ error: 'Aucune organisation exploitable trouvée dans le fichier.' });
      }

      const created = [];
      for (const org of parsedOrganizations) {
        if (!org?.state || !Array.isArray(org.state.collections) || org.state.collections.length === 0) {
          continue;
        }
        const createdOrg = await createOrganizationFromImportedState(req.auth.user.id, org.name, org.state);
        created.push(createdOrg);
        await logAudit(req.auth?.user?.id, 'organization.import', 'organization', createdOrg.id, {
          source: manualMapped.length ? 'manual-mapped' : format,
          name: createdOrg.name,
        });
      }

      if (!created.length) {
        return res.status(400).json({ error: 'Import vide: aucune organisation créée.' });
      }

      return res.status(201).json({ ok: true, createdCount: created.length, organizations: created });
    } catch (err) {
      console.error('Import organizations failed', err);
      return res.status(500).json({ error: 'Import organizations failed' });
    }
  });

  app.post('/api/import/organizations/preview', requireAuth, async (req, res) => {
    try {
      const isBaseAdmin = !!req.auth.baseIsAdmin;
      if (!isBaseAdmin) {
        return res.status(403).json({ error: 'Forbidden: import preview requires base admin' });
      }

      const format = String(req.body?.format || '').toLowerCase();
      if (!['csv', 'json'].includes(format)) {
        return res.status(400).json({ error: 'Invalid format. Expected json or csv.' });
      }

      const organizations = applyOrganizationNameOverride(
        buildImportPreviewOrganizations({ format, body: req.body }),
        req.body?.organizationName || ''
      );
      if (!organizations.length) {
        return res.status(400).json({ error: 'Aucune organisation exploitable trouvée dans le fichier.' });
      }

      return res.json({ ok: true, organizations });
    } catch (err) {
      console.error('Import preview failed', err);
      return res.status(500).json({ error: 'Import preview failed' });
    }
  });

  app.get('/api/organizations', requireAuth, async (req, res) => {
    const organizations = req.auth.organizations || [];
    return res.json({ organizations, activeOrganizationId: req.auth.activeOrganization?.id || null });
  });

  app.post('/api/organizations', requireAuth, async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ error: 'name required' });

      const orgId = uuidv4();
      await pool.query(
        'INSERT INTO organizations (id, name, owner_user_id) VALUES ($1, $2, $3)',
        [orgId, name, req.auth.user.id]
      );
      await pool.query(
        'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [orgId, req.auth.user.id]
      );
      await ensureSystemRolesForOrganization(orgId);
      const adminRole = await getRoleByNameInOrganization(orgId, 'admin');
      if (adminRole.rowCount) {
        await pool.query(
          'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [orgId, req.auth.user.id, adminRole.rows[0].id]
        );
      }
      await ensureAppStateForOrganization(orgId);
      await logAudit(req.auth?.user?.id, 'organization.create', 'organization', orgId, { name });

      res.cookie('active_organization_id', orgId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      const organizations = await getUserOrganizations(req.auth.user.id);
      return res.status(201).json({
        ok: true,
        organization: organizations.find((o) => o.id === orgId) || null,
        organizations,
        activeOrganizationId: orgId,
      });
    } catch (err) {
      console.error('Create organization failed', err);
      return res.status(500).json({ error: 'Create organization failed' });
    }
  });

  app.patch('/api/organizations/:id', requireAuth, async (req, res) => {
    try {
      const organizationId = String(req.params.id || '').trim();
      const name = String(req.body?.name || '').trim();
      if (!organizationId) return res.status(400).json({ error: 'organizationId required' });
      if (!name) return res.status(400).json({ error: 'name required' });

      const organization = await pool.query(
        'SELECT id, owner_user_id FROM organizations WHERE id = $1 LIMIT 1',
        [organizationId]
      );
      if (!organization.rowCount) return res.status(404).json({ error: 'organization not found' });

      const isOwner = String(organization.rows[0].owner_user_id || '') === String(req.auth.user.id || '');
      const isOrgAdmin = await isUserAdminInOrganization(organizationId, req.auth.user.id);
      const canManage = !!req.auth.baseIsAdmin || isOwner || isOrgAdmin;
      if (!canManage) return res.status(403).json({ error: 'Forbidden' });

      const updated = await pool.query(
        'UPDATE organizations SET name = $2 WHERE id = $1 RETURNING id, name, owner_user_id, created_at',
        [organizationId, name]
      );

      await logAudit(req.auth?.user?.id, 'organization.rename', 'organization', organizationId, { name });

      const organizations = await getUserOrganizations(req.auth.user.id);
      return res.json({
        ok: true,
        organization: updated.rows[0],
        organizations,
        activeOrganizationId: req.auth.activeOrganization?.id || organizations[0]?.id || null,
      });
    } catch (err) {
      console.error('Rename organization failed', err);
      return res.status(500).json({ error: 'Rename organization failed' });
    }
  });

  app.delete('/api/organizations/:id', requireAuth, async (req, res) => {
    try {
      const organizationId = String(req.params.id || '').trim();
      if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

      const organization = await pool.query(
        'SELECT id, owner_user_id FROM organizations WHERE id = $1 LIMIT 1',
        [organizationId]
      );
      if (!organization.rowCount) return res.status(404).json({ error: 'organization not found' });

      const isOwner = String(organization.rows[0].owner_user_id || '') === String(req.auth.user.id || '');
      const isOrgAdmin = await isUserAdminInOrganization(organizationId, req.auth.user.id);
      const canManage = !!req.auth.baseIsAdmin || isOwner || isOrgAdmin;
      if (!canManage) return res.status(403).json({ error: 'Forbidden' });

      const userOrganizations = await getUserOrganizations(req.auth.user.id);
      const belongsToUser = userOrganizations.some((org) => org.id === organizationId);
      if (belongsToUser && userOrganizations.length <= 1) {
        return res.status(400).json({ error: 'Vous devez conserver au moins une organisation.' });
      }

      await pool.query('DELETE FROM app_state WHERE organization_id = $1', [organizationId]);
      const deleted = await pool.query('DELETE FROM organizations WHERE id = $1 RETURNING id, name', [organizationId]);
      if (!deleted.rowCount) return res.status(404).json({ error: 'organization not found' });

      await logAudit(req.auth?.user?.id, 'organization.delete', 'organization', organizationId, {
        name: deleted.rows[0]?.name || null,
      });

      let organizations = await getUserOrganizations(req.auth.user.id);
      if (!organizations.length) {
        const fallbackOrgId = await ensureDefaultOrganization(req.auth.user.id);
        organizations = await getUserOrganizations(req.auth.user.id);
        if (fallbackOrgId) {
          res.cookie('active_organization_id', fallbackOrgId, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
          });
        }
      }

      const currentActiveId = req.auth.activeOrganization?.id || null;
      const nextActiveId = currentActiveId && currentActiveId !== organizationId
        ? currentActiveId
        : organizations[0]?.id || null;

      if (nextActiveId) {
        res.cookie('active_organization_id', nextActiveId, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }
      res.clearCookie('impersonate_role_id');

      return res.json({ ok: true, organizations, activeOrganizationId: nextActiveId });
    } catch (err) {
      console.error('Delete organization failed', err);
      return res.status(500).json({ error: 'Delete organization failed' });
    }
  });

  app.post('/api/organizations/switch', requireAuth, async (req, res) => {
    const organizationId = String(req.body?.organizationId || '').trim();
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const allowed = (req.auth.organizations || []).some((org) => org.id === organizationId);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    res.cookie('active_organization_id', organizationId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.clearCookie('impersonate_role_id');

    return res.json({ ok: true, activeOrganizationId: organizationId });
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearAuthCookie(res);
    res.clearCookie('impersonate_role_id');
    res.clearCookie('active_organization_id');
    res.json({ ok: true });
  });

  // --- Users / Roles / Permissions ---------------------------------------
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

  app.patch('/api/users/:id/preferences', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
    try {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });

      const userId = String(req.params.id || '').trim();
      if (!userId) return res.status(400).json({ error: 'user id required' });

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

      const normalized = {
        accentColor: typeof payload.accentColor === 'string' ? payload.accentColor : '#06b6d4',
        workStart: typeof payload.workStart === 'string' ? payload.workStart : '09:00',
        workEnd: typeof payload.workEnd === 'string' ? payload.workEnd : '18:00',
        breakStart: typeof payload.breakStart === 'string' ? payload.breakStart : '12:30',
        breakEnd: typeof payload.breakEnd === 'string' ? payload.breakEnd : '13:30',
        timezone: typeof payload.timezone === 'string' ? payload.timezone : 'Europe/Paris',
        weekStartsOn: payload.weekStartsOn === 'sunday' ? 'sunday' : 'monday',
        density: ['compact', 'comfortable', 'spacious'].includes(payload.density) ? payload.density : 'comfortable',
        notificationsEnabled: Boolean(payload.notificationsEnabled),
      };

      const updated = await pool.query(
        `UPDATE users
         SET user_preferences = $1::jsonb
         WHERE id = $2
         RETURNING id, COALESCE(user_preferences, '{}'::jsonb) AS user_preferences`,
        [JSON.stringify(normalized), userId]
      );
      if (!updated.rowCount) return res.status(404).json({ error: 'user not found' });

      await logAudit(req.auth?.user?.id, 'user.preferences.update', 'user', userId, { userId });
      return res.json({ ok: true, user: updated.rows[0] });
    } catch (err) {
      console.error('Update user preferences failed', err);
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

      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
      await logAudit(req.auth?.user?.id, 'user.password.update', 'user', userId, { userId });
      return res.json({ ok: true });
    } catch (err) {
      console.error('Update password failed', err);
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
      console.error('Delete user failed', err);
      return res.status(500).json({ error: 'Delete user failed' });
    }
  });

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
