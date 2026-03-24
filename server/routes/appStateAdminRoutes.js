export const registerAppStateAdminRoutes = ({
  app,
  requireAuth,
  pool,
  upsertPermission,
  syncAppStateIdSequence,
  ensureSystemRolesForOrganization,
  countOrganizationAdmins,
  getAdminRoleForOrganization,
  ensureAppStateForOrganization,
}) => {
  // --- Export/Import app_state (admin only) ---
  // --- Export/Import global state (admin only) ---
  app.get('/api/appstate', requireAuth, async (req, res) => {
    const rawScope = req.query?.scope;
    const scope = rawScope === 'global' ? 'global' : 'organization';

    const isOrgAdmin = req.auth.roles.some((r) => r.name === 'admin');
    const isBaseAdmin = !!req.auth.baseIsAdmin;

    if (scope === 'global' && !isBaseAdmin) {
      return res.status(403).json({ error: 'Forbidden: global export requires base admin' });
    }
    if (scope === 'organization' && !isOrgAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      if (scope === 'organization') {
        const organizationId = req.auth.activeOrganization?.id;
        if (!organizationId) return res.status(400).json({ error: 'No active organization' });

        const organization = (
          await pool.query('SELECT * FROM organizations WHERE id = $1', [organizationId])
        ).rows[0] || null;

        const organization_members = (
          await pool.query('SELECT * FROM organization_members WHERE organization_id = $1 ORDER BY user_id ASC', [organizationId])
        ).rows;

        const users = (
          await pool.query(
            `SELECT u.*
             FROM users u
             INNER JOIN organization_members om ON om.user_id = u.id
             WHERE om.organization_id = $1
             ORDER BY u.id ASC`,
            [organizationId]
          )
        ).rows;

        const app_state = (
          await pool.query('SELECT * FROM app_state WHERE organization_id = $1 ORDER BY id ASC', [organizationId])
        ).rows;

        const roles = (
          await pool.query('SELECT * FROM roles WHERE organization_id = $1 ORDER BY id ASC', [organizationId])
        ).rows;

        const permissions = (
          await pool.query('SELECT * FROM permissions WHERE organization_id = $1 ORDER BY id ASC', [organizationId])
        ).rows;

        const user_roles = (
          await pool.query('SELECT * FROM user_roles WHERE organization_id = $1 ORDER BY user_id, role_id ASC', [organizationId])
        ).rows;

        return res.json({
          scope,
          organization,
          users,
          app_state,
          roles,
          permissions,
          user_roles,
          organization_members,
        });
      }

      const users = (await pool.query('SELECT * FROM users ORDER BY id ASC')).rows;
      const app_state = (await pool.query('SELECT * FROM app_state ORDER BY id ASC')).rows;
      const organizations = (await pool.query('SELECT * FROM organizations ORDER BY created_at ASC, id ASC')).rows;
      const organization_members = (await pool.query('SELECT * FROM organization_members ORDER BY organization_id, user_id ASC')).rows;
      const roles = (await pool.query('SELECT * FROM roles ORDER BY id ASC')).rows;
      const permissions = (await pool.query('SELECT * FROM permissions ORDER BY id ASC')).rows;
      const user_roles = (await pool.query('SELECT * FROM user_roles ORDER BY user_id, role_id ASC')).rows;
      res.json({ scope, users, app_state, organizations, organization_members, roles, permissions, user_roles });
    } catch (err) {
      console.error('Failed to export global state', err);
      res.status(500).json({ error: 'Failed to export global state' });
    }
  });

  app.post('/api/appstate', requireAuth, async (req, res) => {
    const rawScope = req.query?.scope;
    const scope = rawScope === 'global' ? 'global' : 'organization';

    const isOrgAdmin = req.auth.roles.some((r) => r.name === 'admin');
    const isBaseAdmin = !!req.auth.baseIsAdmin;

    if (scope === 'global' && !isBaseAdmin) {
      return res.status(403).json({ error: 'Forbidden: global import requires base admin' });
    }
    if (scope === 'organization' && !isOrgAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const { users, app_state, organizations, organization_members, roles, permissions, user_roles } = req.body || {};
      if (!Array.isArray(users) || !Array.isArray(app_state) || !Array.isArray(roles) || !Array.isArray(permissions) || !Array.isArray(user_roles)) {
        return res.status(400).json({ error: 'Invalid import format' });
      }

      if (scope === 'organization') {
        const organizationId = req.auth.activeOrganization?.id;
        if (!organizationId) return res.status(400).json({ error: 'No active organization' });

        const userIdMap = new Map();
        const roleIdMap = new Map();

        // Upsert users (nécessaire si un membre importé n'existe pas encore localement)
        for (const user of users) {
          const existingUserRes = await pool.query(
            'SELECT id FROM users WHERE id = $1 OR email = $2 ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END LIMIT 1',
            [user.id, user.email]
          );

          if (existingUserRes.rowCount > 0) {
            const persistedUserId = existingUserRes.rows[0].id;
            await pool.query(
              `UPDATE users SET
                 email = $2,
                 name = $3,
                 provider = $4,
                 provider_id = $5,
                 password_hash = $6,
                 created_at = $7,
                 favorite_views = $8,
                 favorite_items = $9,
                 user_preferences = $10
               WHERE id = $1`,
              [
                persistedUserId,
                user.email,
                user.name,
                user.provider,
                user.provider_id,
                user.password_hash,
                user.created_at,
                user.favorite_views || [],
                user.favorite_items || [],
                user.user_preferences || {}
              ]
            );
            userIdMap.set(user.id, persistedUserId);
          } else {
            await pool.query(
              'INSERT INTO users (id, email, name, provider, provider_id, password_hash, created_at, favorite_views, favorite_items, user_preferences) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
              [
                user.id,
                user.email,
                user.name,
                user.provider,
                user.provider_id,
                user.password_hash,
                user.created_at,
                user.favorite_views || [],
                user.favorite_items || [],
                user.user_preferences || {}
              ]
            );
            userIdMap.set(user.id, user.id);
          }
        }

        // Nettoyage strict de l'organisation active uniquement
        await pool.query('DELETE FROM user_roles WHERE organization_id = $1', [organizationId]);
        await pool.query('DELETE FROM permissions WHERE organization_id = $1', [organizationId]);
        await pool.query('DELETE FROM roles WHERE organization_id = $1', [organizationId]);
        await pool.query('DELETE FROM app_state WHERE organization_id = $1', [organizationId]);
        await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [organizationId]);

        // Membres : ceux importés + l'utilisateur courant (anti lock-out)
        const importedMemberIds = new Set(
          (Array.isArray(organization_members) ? organization_members : [])
            .map((m) => userIdMap.get(m?.user_id) || m?.user_id)
            .filter(Boolean)
        );
        importedMemberIds.add(req.auth.user.id);

        for (const memberUserId of importedMemberIds) {
          await pool.query(
            'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [organizationId, memberUserId]
          );
        }

        for (const role of roles) {
          const roleRes = await pool.query(
            `INSERT INTO roles (id, organization_id, name, description, is_system)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (organization_id, name) DO UPDATE SET
               description = EXCLUDED.description,
               is_system = EXCLUDED.is_system
             RETURNING id`,
            [role.id, organizationId, role.name, role.description, role.is_system]
          );
          roleIdMap.set(role.id, roleRes.rows[0].id);
        }

        for (const perm of permissions) {
          await upsertPermission({
            id: perm.id,
            organization_id: organizationId,
            role_id: roleIdMap.get(perm.role_id) || perm.role_id,
            collection_id: perm.collection_id,
            item_id: perm.item_id,
            field_id: perm.field_id,
            can_read: perm.can_read,
            can_write: perm.can_write,
            can_delete: perm.can_delete,
            can_manage_fields: perm.can_manage_fields,
            can_manage_views: perm.can_manage_views,
            can_manage_permissions: perm.can_manage_permissions,
          });
        }

        for (const row of app_state) {
          await pool.query(
            `INSERT INTO app_state (id, user_id, organization_id, data)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (organization_id) DO UPDATE SET
               user_id = EXCLUDED.user_id,
               data = EXCLUDED.data`,
            [row.id, userIdMap.get(row.user_id) || row.user_id || null, organizationId, row.data]
          );
        }

        await syncAppStateIdSequence();

        for (const ur of user_roles) {
          await pool.query(
            'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [organizationId, userIdMap.get(ur.user_id) || ur.user_id, roleIdMap.get(ur.role_id) || ur.role_id]
          );
        }

        // Assure l'existence des rôles système + 1 admin minimum
        await ensureSystemRolesForOrganization(organizationId);
        const hasAdmin = await countOrganizationAdmins(organizationId);
        if (hasAdmin === 0) {
          const adminRole = await getAdminRoleForOrganization(organizationId);
          if (adminRole?.id) {
            await pool.query(
              'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
              [organizationId, req.auth.user.id, adminRole.id]
            );
          }
        }

        await ensureAppStateForOrganization(organizationId);
        return res.json({ ok: true, scope });
      }

      // Désactiver les contraintes FK temporairement
      await pool.query('SET session_replication_role = replica;');
      // Vider toutes les tables dans l'ordre inverse des dépendances
      await pool.query('DELETE FROM organization_members');
      await pool.query('DELETE FROM organizations');
      await pool.query('DELETE FROM user_roles');
      await pool.query('DELETE FROM permissions');
      await pool.query('DELETE FROM roles');
      await pool.query('DELETE FROM app_state');
      await pool.query('DELETE FROM users');
      // Réinsérer dans l'ordre des dépendances
      for (const user of users) {
        await pool.query(
          'INSERT INTO users (id, email, name, provider, provider_id, password_hash, created_at, favorite_views, favorite_items, user_preferences) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [user.id, user.email, user.name, user.provider, user.provider_id, user.password_hash, user.created_at, user.favorite_views || [], user.favorite_items || [], user.user_preferences || {}]
        );
      }
      if (Array.isArray(organizations)) {
        for (const org of organizations) {
          await pool.query(
            'INSERT INTO organizations (id, name, owner_user_id, created_at) VALUES ($1,$2,$3,$4)',
            [org.id, org.name, org.owner_user_id || null, org.created_at || new Date().toISOString()]
          );
        }
      }
      if (Array.isArray(organization_members)) {
        for (const member of organization_members) {
          await pool.query(
            'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2)',
            [member.organization_id, member.user_id]
          );
        }
      }
      for (const role of roles) {
        await pool.query(
          'INSERT INTO roles (id, organization_id, name, description, is_system) VALUES ($1,$2,$3,$4,$5)',
          [role.id, role.organization_id || null, role.name, role.description, role.is_system]
        );
      }
      for (const perm of permissions) {
        await pool.query(
          'INSERT INTO permissions (id, organization_id, role_id, collection_id, item_id, field_id, can_read, can_write, can_delete, can_manage_fields, can_manage_views, can_manage_permissions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          [perm.id, perm.organization_id || null, perm.role_id, perm.collection_id, perm.item_id, perm.field_id, perm.can_read, perm.can_write, perm.can_delete, perm.can_manage_fields, perm.can_manage_views, perm.can_manage_permissions]
        );
      }
      for (const row of app_state) {
        await pool.query(
          'INSERT INTO app_state (id, user_id, organization_id, data) VALUES ($1, $2, $3, $4)',
          [row.id, row.user_id || null, row.organization_id || null, row.data]
        );
      }
      await syncAppStateIdSequence();
      for (const ur of user_roles) {
        await pool.query(
          'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3)',
          [ur.organization_id || null, ur.user_id, ur.role_id]
        );
      }
      // Réactiver les contraintes FK
      await pool.query('SET session_replication_role = DEFAULT;');
      res.json({ ok: true, scope });
    } catch (err) {
      console.error('Failed to import global state', err);
      // Toujours réactiver les contraintes FK en cas d'erreur
      await pool.query('SET session_replication_role = DEFAULT;');
      res.status(500).json({ error: 'Failed to import global state' });
    }
  });
};
