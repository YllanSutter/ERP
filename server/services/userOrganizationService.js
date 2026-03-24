export const createUserOrganizationService = ({
  pool,
  bcrypt,
  uuidv4,
  ensureDefaultOrganization,
  ensureSystemRolesForOrganization,
  getRoleByNameInOrganization,
}) => {
  const getAdminRoleForOrganization = async (organizationId) => {
    if (!organizationId) return null;
    const adminRoleRes = await pool.query(
      'SELECT id FROM roles WHERE organization_id = $1 AND name = $2 LIMIT 1',
      [organizationId, 'admin']
    );
    if (!adminRoleRes.rowCount) return null;
    return adminRoleRes.rows[0];
  };

  const countOrganizationAdmins = async (organizationId) => {
    const adminRole = await getAdminRoleForOrganization(organizationId);
    if (!adminRole?.id) return 0;
    const countRes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM user_roles WHERE organization_id = $1 AND role_id = $2',
      [organizationId, adminRole.id]
    );
    return Number(countRes.rows[0]?.count || 0);
  };

  const isUserAdminInOrganization = async (organizationId, userId) => {
    const adminRole = await getAdminRoleForOrganization(organizationId);
    if (!adminRole?.id) return false;
    const row = await pool.query(
      'SELECT 1 FROM user_roles WHERE organization_id = $1 AND user_id = $2 AND role_id = $3 LIMIT 1',
      [organizationId, userId, adminRole.id]
    );
    return row.rowCount > 0;
  };

  const wouldRemoveLastOrganizationAdmin = async (organizationId, userId) => {
    const userIsAdmin = await isUserAdminInOrganization(organizationId, userId);
    if (!userIsAdmin) return false;
    const totalAdmins = await countOrganizationAdmins(organizationId);
    return totalAdmins <= 1;
  };

  const createLocalUser = async ({ email, password, name }) => {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount) {
      throw new Error('email_exists');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    await pool.query(
      'INSERT INTO users (id, email, name, provider, password_hash) VALUES ($1, $2, $3, $4, $5)',
      [userId, email, name || email.split('@')[0] || 'Utilisateur', 'local', passwordHash]
    );

    const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
    if (Number(totalUsers.rows[0].count) === 1) {
      const defaultOrgId = await ensureDefaultOrganization(userId);
      const admin = await getRoleByNameInOrganization(defaultOrgId, 'admin');
      if (admin.rowCount) {
        await pool.query(
          'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [defaultOrgId, userId, admin.rows[0].id]
        );
      }
    } else {
      const defaultOrg = await pool.query('SELECT id FROM organizations ORDER BY created_at ASC, id ASC LIMIT 1');
      if (defaultOrg.rowCount) {
        const defaultOrgId = defaultOrg.rows[0].id;
        await ensureSystemRolesForOrganization(defaultOrgId);
        await pool.query(
          'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [defaultOrgId, userId]
        );
        const viewer = await getRoleByNameInOrganization(defaultOrgId, 'viewer');
        if (viewer.rowCount) {
          await pool.query(
            'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [defaultOrgId, userId, viewer.rows[0].id]
          );
        }
      } else {
        const defaultOrgId = await ensureDefaultOrganization(userId);
        const viewer = await getRoleByNameInOrganization(defaultOrgId, 'viewer');
        if (viewer.rowCount) {
          await pool.query(
            'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [defaultOrgId, userId, viewer.rows[0].id]
          );
        }
      }
    }

    return userId;
  };

  const getUserOrganizations = async (userId) => {
    const orgsRes = await pool.query(
      `SELECT o.id, o.name, o.created_at, o.owner_user_id
       FROM organizations o
       INNER JOIN organization_members om ON om.organization_id = o.id
       WHERE om.user_id = $1
       ORDER BY o.created_at ASC, o.name ASC`,
      [userId]
    );
    return orgsRes.rows;
  };

  return {
    getAdminRoleForOrganization,
    countOrganizationAdmins,
    isUserAdminInOrganization,
    wouldRemoveLastOrganizationAdmin,
    createLocalUser,
    getUserOrganizations,
  };
};
