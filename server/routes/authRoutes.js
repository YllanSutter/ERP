import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { authPayloadSchema } from '../../shared/validation.js';

const loginRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const registerRateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });

export const registerAuthRoutes = ({ app, appContext }) => {
  const { logger, pool, bcrypt, requireAuth, signToken, setAuthCookie, clearAuthCookie, loadUserContext, createLocalUser } = appContext;
  app.post('/api/auth/register', registerRateLimiter, async (req, res) => {
    try {
      const { email, password, name } = authPayloadSchema.parse(req.body || {});
      const userId = await createLocalUser({ email: email.toLowerCase(), password, name });
      const token = signToken(userId);
      setAuthCookie(res, token);
      const ctx = await loadUserContext(userId);
      return res.json({ user: ctx?.user || null, roles: ctx?.roles || [] });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Invalid registration payload', details: err.issues });
      }
      if (err.message === 'email_exists') {
        return res.status(400).json({ error: 'email already registered' });
      }
      logger.error('Register failed', err);
      return res.status(500).json({ error: 'Register failed' });
    }
  });

  app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
    try {
      const { email, password } = authPayloadSchema.omit({ name: true }).parse(req.body || {});
      const userRes = await pool.query('SELECT * FROM users WHERE email = $1 AND provider = $2', [email.toLowerCase(), 'local']);
      if (!userRes.rowCount) return res.status(401).json({ error: 'Invalid credentials' });
      const user = userRes.rows[0];
      const ok = await bcrypt.compare(password, user.password_hash || '');
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
      const token = signToken(user.id);
      setAuthCookie(res, token);
      const ctx = await loadUserContext(user.id);
      return res.json({ user: ctx?.user || null, roles: ctx?.roles || [] });
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Invalid login payload', details: err.issues });
      }
      logger.error('Login failed', err);
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
  app.post('/api/auth/logout', (_req, res) => {
    clearAuthCookie(res);
    res.clearCookie('impersonate_role_id');
    res.clearCookie('active_organization_id');
    res.json({ ok: true });
  });
};
