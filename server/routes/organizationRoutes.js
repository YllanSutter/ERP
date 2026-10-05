import { createOrganizationFromImportedState } from './routeHelpers.js';

export const registerOrganizationRoutes = ({ app, appContext }) => {
  const {
    logger, pool, uuidv4, requireAuth, logAudit, sanitizeMappedOrganizations,
    buildImportPreviewOrganizations, applyOrganizationNameOverride,
    ensureSystemRolesForOrganization, getRoleByNameInOrganization, syncAppStateIdSequence,
    getUserOrganizations, ensureAppStateForOrganization, isUserAdminInOrganization,
    ensureDefaultOrganization,
  } = appContext;
  const createImportedOrganization = (ownerUserId, name, state) => createOrganizationFromImportedState(appContext, ownerUserId, name, state);
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
        const createdOrg = await createImportedOrganization(req.auth.user.id, org.name, org.state);
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
      logger.error('Import organizations failed', err);
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
      logger.error('Import preview failed', err);
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
      logger.error('Create organization failed', err);
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
      logger.error('Rename organization failed', err);
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
      logger.error('Delete organization failed', err);
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
};
