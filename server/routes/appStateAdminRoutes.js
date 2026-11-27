import { encryptStateSecrets } from '../services/secretFieldService.js';
import { buildHistoryEvents, insertHistoryEvents } from '../services/historyService.js';
import { organizationRoom } from '../services/socketPresence.js';

export const registerAppStateAdminRoutes = ({ app, appContext }) => {
  const {
    logger,
    isSiteCreator,
    requireAuth,
    pool,
    upsertPermission,
    withDatabaseMaintenance,
    ensureSystemRolesForOrganization,
    getRoleByNameInOrganization,
    uuidv4,
  } = appContext;
  app.get('/api/appstate/access', requireAuth, async (req, res) => {
    try {
      return res.json({ canManageGlobalState: await isSiteCreator(req.auth.user.id) });
    } catch (err) {
      logger.error({ err }, 'Failed to load global transfer access');
      return res.status(500).json({ error: 'Impossible de vérifier les droits d’import/export global.' });
    }
  });

  // --- Export/Import app_state (admin only) ---
  // --- Export/Import global state (admin only) ---
  app.get('/api/appstate', requireAuth, async (req, res) => {
    const rawScope = req.query?.scope;
    const scope = rawScope === 'global' ? 'global' : 'organization';

    const isOrgAdmin = req.auth.roles.some((r) => r.name === 'admin');

    try {
    if (scope === 'global' && !await isSiteCreator(req.auth.user.id)) {
      return res.status(403).json({ error: 'Export global réservé au compte principal.' });
    }
    if (scope === 'organization' && !isOrgAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

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
            `SELECT u.id, u.email, u.name, u.provider, u.created_at
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
      logger.error('Failed to export global state', err);
      res.status(500).json({ error: 'Failed to export global state' });
    }
  });

  app.post('/api/appstate', requireAuth, async (req, res) => {
    const rawScope = req.query?.scope;
    const scope = rawScope === 'global' ? 'global' : 'organization';

    const isOrgAdmin = req.auth.roles.some((r) => r.name === 'admin');

    try {
    if (scope === 'global' && !await isSiteCreator(req.auth.user.id)) {
      return res.status(403).json({ error: 'Import global réservé au compte principal.' });
    }
    if (scope === 'organization' && !isOrgAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

      if (req.body?.scope && req.body.scope !== scope) {
        return res.status(400).json({ error: 'Le périmètre du fichier ne correspond pas à celui de l’import.' });
      }
      const { users, app_state, organizations, organization_members, roles, permissions, user_roles } = req.body || {};
      if (!Array.isArray(users) || !Array.isArray(app_state) || !Array.isArray(roles) || !Array.isArray(permissions) || !Array.isArray(user_roles)) {
        return res.status(400).json({ error: 'Invalid import format' });
      }

      if (scope === 'organization') {
        const organizationId = req.auth.activeOrganization?.id;
        if (!organizationId) return res.status(400).json({ error: 'No active organization' });

        if (app_state.length !== 1) {
          return res.status(400).json({ error: 'Le fichier doit contenir les données d’une seule organisation.' });
        }
        let importedState;
        let importedStateObject;
        try {
          const raw = app_state[0]?.data;
          const state = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!Array.isArray(state?.collections)) throw new Error('Missing collections');
          importedStateObject = state;
          importedState = JSON.stringify(encryptStateSecrets(state));
        } catch {
          return res.status(400).json({ error: 'Les données de l’organisation sont invalides.' });
        }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SELECT id FROM organizations WHERE id = $1 FOR UPDATE', [organizationId]);
          const existingStateResult = await client.query('SELECT data FROM app_state WHERE organization_id = $1 FOR UPDATE', [organizationId]);
          const previousState = existingStateResult.rows[0]?.data ? JSON.parse(existingStateResult.rows[0].data) : { collections: [], views: {} };
          const historyEvents = buildHistoryEvents(previousState, importedStateObject, {
            actor: req.auth.user, source: 'import', mutationId: uuidv4(),
          });
          const userIdMap = new Map();
          const roleIdMap = new Map();

          // Upsert users (nécessaire si un membre importé n'existe pas encore localement)
          for (const user of users) {
            const existingUserRes = await client.query(
              'SELECT id FROM users WHERE id = $1 OR email = $2 ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END LIMIT 1',
              [user.id, user.email]
            );

            if (existingUserRes.rowCount > 0) {
              const persistedUserId = existingUserRes.rows[0].id;
              // User identity and credentials are shared by all organizations.
              // An organization import only reconnects memberships to existing accounts.
              userIdMap.set(user.id, persistedUserId);
            } else {
              await client.query(
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
          await client.query('DELETE FROM user_roles WHERE organization_id = $1', [organizationId]);
          await client.query('DELETE FROM permissions WHERE organization_id = $1', [organizationId]);
          await client.query('DELETE FROM roles WHERE organization_id = $1', [organizationId]);
          await client.query('DELETE FROM organization_members WHERE organization_id = $1', [organizationId]);

          // Membres : ceux importés + l'utilisateur courant (anti lock-out)
          const importedMemberIds = new Set(
            (Array.isArray(organization_members) ? organization_members : [])
              .map((m) => userIdMap.get(m?.user_id) || m?.user_id)
              .filter(Boolean)
          );
          importedMemberIds.add(req.auth.user.id);

          for (const memberUserId of importedMemberIds) {
            await client.query(
              'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [organizationId, memberUserId]
            );
          }

          for (const role of roles) {
            const roleRes = await client.query(
              `INSERT INTO roles (id, organization_id, name, description, is_system)
               VALUES ($1,$2,$3,$4,$5)
               ON CONFLICT (organization_id, name) DO UPDATE SET
                 description = EXCLUDED.description,
                 is_system = EXCLUDED.is_system
               RETURNING id`,
              [uuidv4(), organizationId, role.name, role.description, role.is_system]
            );
            roleIdMap.set(role.id, roleRes.rows[0].id);
          }

          for (const perm of permissions) {
            await upsertPermission({
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
            }, client);
          }

          await client.query(
            `INSERT INTO app_state (user_id, organization_id, data)
             VALUES ($1, $2, $3)
             ON CONFLICT (organization_id) DO UPDATE SET
               user_id = EXCLUDED.user_id,
               data = EXCLUDED.data,
               version = app_state.version + 1`,
            [req.auth.user.id, organizationId, importedState]
          );
          await insertHistoryEvents(client, organizationId, historyEvents);

          for (const ur of user_roles) {
            await client.query(
              'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
              [organizationId, userIdMap.get(ur.user_id) || ur.user_id, roleIdMap.get(ur.role_id) || ur.role_id]
            );
          }

          await ensureSystemRolesForOrganization(organizationId, client);
          // L'administrateur qui lance la restauration conserve son accès.
          const adminRole = await getRoleByNameInOrganization(organizationId, 'admin', client);
          await client.query(
            'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [organizationId, req.auth.user.id, adminRole.rows[0].id]
          );

          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
        if (global.io) global.io.to(organizationRoom(organizationId)).emit('stateUpdated', {
          organizationId, source: 'history.updated',
        });
        return res.json({ ok: true, scope });
      }

      if (!Array.isArray(organizations) || !Array.isArray(organization_members) ||
          !users.some(user => user.id === req.auth.user.id)) {
        return res.status(400).json({ error: 'Le fichier global doit contenir les organisations, leurs membres et le compte principal.' });
      }
      await withDatabaseMaintenance(req, async () => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          // Respecter les dépendances sans désactiver les contraintes de la base.
          await client.query('DELETE FROM user_roles');
          await client.query('DELETE FROM permissions');
          await client.query('DELETE FROM roles');
          await client.query('DELETE FROM app_state');
          await client.query('DELETE FROM organization_members');
          await client.query('DELETE FROM organizations');
          await client.query('DELETE FROM users');
          // Réinsérer dans l'ordre des dépendances
          for (const user of users) {
            await client.query(
              'INSERT INTO users (id, email, name, provider, provider_id, password_hash, created_at, favorite_views, favorite_items, user_preferences) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
              [user.id, user.email, user.name, user.provider, user.provider_id, user.password_hash, user.created_at, user.favorite_views || [], user.favorite_items || [], user.user_preferences || {}]
            );
          }
          if (Array.isArray(organizations)) {
            for (const org of organizations) {
              await client.query(
                'INSERT INTO organizations (id, name, owner_user_id, created_at, accent_color) VALUES ($1,$2,$3,$4,$5)',
                [org.id, org.name, org.owner_user_id || null, org.created_at || new Date().toISOString(), /^#[0-9a-f]{6}$/i.test(org.accent_color) ? org.accent_color : null]
              );
            }
          }
          if (Array.isArray(organization_members)) {
            for (const member of organization_members) {
              await client.query(
                'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2)',
                [member.organization_id, member.user_id]
              );
            }
          }
          for (const role of roles) {
            await client.query(
              'INSERT INTO roles (id, organization_id, name, description, is_system) VALUES ($1,$2,$3,$4,$5)',
              [role.id, role.organization_id || null, role.name, role.description, role.is_system]
            );
          }
          for (const perm of permissions) {
            await client.query(
              'INSERT INTO permissions (id, organization_id, role_id, collection_id, item_id, field_id, can_read, can_write, can_delete, can_manage_fields, can_manage_views, can_manage_permissions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
              [perm.id, perm.organization_id || null, perm.role_id, perm.collection_id, perm.item_id, perm.field_id, perm.can_read, perm.can_write, perm.can_delete, perm.can_manage_fields, perm.can_manage_views, perm.can_manage_permissions]
            );
          }
          for (const row of app_state) {
            await client.query(
              'INSERT INTO app_state (id, user_id, organization_id, data) VALUES ($1, $2, $3, $4)',
              [
                row.id,
                row.user_id || null,
                row.organization_id || null,
                JSON.stringify(encryptStateSecrets(typeof row.data === 'string' ? JSON.parse(row.data) : row.data)),
              ]
            );
          }
          await client.query(`SELECT setval(pg_get_serial_sequence('app_state', 'id'),
            GREATEST(COALESCE((SELECT MAX(id) FROM app_state), 0) + 1, 1), false)`);
          for (const ur of user_roles) {
            await client.query(
              'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3)',
              [ur.organization_id || null, ur.user_id, ur.role_id]
            );
          }
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      });
      res.json({ ok: true, scope });
    } catch (err) {
      logger.error('Failed to import app state', err);
      res.status(500).json({ error: scope === 'organization'
        ? 'Échec de l’import. Les données locales n’ont pas été remplacées.'
        : 'Failed to import global state' });
    }
  });
};
