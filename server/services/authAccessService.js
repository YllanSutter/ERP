export const createAuthAccessService = ({
  pool,
  jwt,
  JWT_SECRET,
  TOKEN_EXPIRES,
  getUserOrganizations,
  ensureDefaultOrganization,
  ensureAppStateForOrganization,
  ensureSystemRolesForOrganization,
}) => {
  const signToken = (userId) => {
    return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
  };

  const setAuthCookie = (res, token) => {
    res.cookie('access_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  };

  const clearAuthCookie = (res) => {
    res.clearCookie('access_token');
  };

  const resolveActiveOrganization = async (userId, requestedOrganizationId = null) => {
    const organizations = await getUserOrganizations(userId);
    if (!organizations.length) {
      const fallbackOrgId = await ensureDefaultOrganization(userId);
      const fallbackOrgs = await getUserOrganizations(userId);
      return {
        organizations: fallbackOrgs,
        activeOrganization: fallbackOrgs.find((org) => org.id === fallbackOrgId) || fallbackOrgs[0] || null,
      };
    }

    if (requestedOrganizationId) {
      const requested = organizations.find((org) => org.id === requestedOrganizationId);
      if (requested) {
        return { organizations, activeOrganization: requested };
      }
    }

    return { organizations, activeOrganization: organizations[0] };
  };

  const loadUserContext = async (userId, impersonateRoleId = null, requestedOrganizationId = null) => {
    const userRes = await pool.query('SELECT id, email, name, user_preferences FROM users WHERE id = $1', [userId]);
    if (!userRes.rowCount) return null;

    const orgContext = await resolveActiveOrganization(userId, requestedOrganizationId);
    const activeOrganizationId = orgContext.activeOrganization?.id || null;
    if (activeOrganizationId) {
      await ensureAppStateForOrganization(activeOrganizationId);
      await ensureSystemRolesForOrganization(activeOrganizationId);
    }

    if (!activeOrganizationId) {
      return {
        user: userRes.rows[0],
        roles: [],
        permissions: [],
        impersonatedRoleId: null,
        organizations: orgContext.organizations,
        activeOrganization: null,
      };
    }

    const rolesRes = await pool.query(
      `SELECT r.*
       FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = $1
         AND ur.organization_id = $2
         AND r.organization_id = $2`,
      [userId, activeOrganizationId]
    );

    // If impersonation is requested, restrict to that role for permissions/roles
    const roleIds = impersonateRoleId
      ? [impersonateRoleId]
      : rolesRes.rows.map((r) => r.id);

    const permsRes = roleIds.length
      ? await pool.query(
        'SELECT * FROM permissions WHERE organization_id = $1 AND role_id = ANY($2)',
        [activeOrganizationId, roleIds]
      )
      : { rows: [] };

    return {
      user: userRes.rows[0],
      roles: impersonateRoleId ? rolesRes.rows.filter((r) => r.id === impersonateRoleId) : rolesRes.rows,
      permissions: permsRes.rows,
      impersonatedRoleId: impersonateRoleId,
      organizations: orgContext.organizations,
      activeOrganization: orgContext.activeOrganization,
    };
  };

  const requireAuth = async (req, res, next) => {
    try {
      const token = req.cookies.auth_token || req.cookies.access_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
      if (!token) {
        return res.status(401).json({ error: 'Unauthenticated' });
      }
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (e) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      const rawOrganizationId = req.headers['x-organization-id'] || req.cookies.active_organization_id || null;
      const requestedOrganizationId = Array.isArray(rawOrganizationId)
        ? rawOrganizationId[0]
        : rawOrganizationId
          ? String(rawOrganizationId)
          : null;
      const baseCtx = await loadUserContext(decoded.sub, null, requestedOrganizationId);
      if (!baseCtx) return res.status(401).json({ error: 'Invalid user' });

      const isAdmin = baseCtx.roles.some((r) => r.name === 'admin');
      const impersonateRoleId = req.cookies.impersonate_role_id || req.headers['x-impersonate-role-id'] || null;

      if (impersonateRoleId && isAdmin) {
        // Vérifier que le rôle existe toujours
        const roleCheck = await pool.query(
          'SELECT id FROM roles WHERE id = $1 AND organization_id = $2',
          [impersonateRoleId, baseCtx.activeOrganization?.id || null]
        );
        if (roleCheck.rows.length === 0) {
          req.auth = { ...baseCtx, baseRoles: baseCtx.roles, baseIsAdmin: isAdmin };
          return next();
        }
        const impCtx = await loadUserContext(decoded.sub, impersonateRoleId, requestedOrganizationId);
        req.auth = {
          ...(impCtx || baseCtx),
          baseRoles: baseCtx.roles,
          baseIsAdmin: isAdmin,
        };
      } else {
        req.auth = { ...baseCtx, baseRoles: baseCtx.roles, baseIsAdmin: isAdmin };
      }
      return next();
    } catch (err) {
      console.error('Auth error', err);
      return res.status(401).json({ error: 'Unauthenticated' });
    }
  };

  const hasPermission = (ctx, scope, action) => {
    if (!ctx) return false;
    const flag = action;
    const isAdmin = ctx.roles.some((r) => r.name === 'admin');
    if (isAdmin) return true;

    // Priority: field > item > collection > global
    const perms = ctx.permissions || [];

    if (scope.field_id) {
      const match = perms.find(
        (p) => p.field_id === scope.field_id && p.item_id === scope.item_id && p.collection_id === scope.collection_id
      );
      if (match) return Boolean(match[flag]);
    }

    if (scope.item_id) {
      const match = perms.find(
        (p) => p.item_id === scope.item_id && p.collection_id === scope.collection_id && p.field_id === null
      );
      if (match) return Boolean(match[flag]);
    }

    if (scope.collection_id) {
      const match = perms.find((p) => p.collection_id === scope.collection_id && p.item_id === null && p.field_id === null);
      if (match) return Boolean(match[flag]);
    }

    const globalMatch = perms.find((p) => p.collection_id === null && p.item_id === null && p.field_id === null);
    if (globalMatch) return Boolean(globalMatch[flag]);

    return false;
  };

  const requirePermission = (action, scopeBuilder = () => ({})) => {
    return (req, res, next) => {
      const scope = scopeBuilder(req);
      if (hasPermission(req.auth, scope, action)) return next();
      return res.status(403).json({ error: 'Forbidden' });
    };
  };

  const requireBaseAdminOrPermission = (action, scopeBuilder = () => ({})) => {
    return (req, res, next) => {
      if (req.auth?.baseIsAdmin) return next();
      const scope = scopeBuilder(req);
      if (hasPermission(req.auth, scope, action)) return next();
      return res.status(403).json({ error: 'Forbidden' });
    };
  };

  return {
    signToken,
    setAuthCookie,
    clearAuthCookie,
    loadUserContext,
    requireAuth,
    hasPermission,
    requirePermission,
    requireBaseAdminOrPermission,
  };
};
