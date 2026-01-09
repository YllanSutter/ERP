import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const TOKEN_EXPIRES = process.env.JWT_EXPIRES || '7d';

// PostgreSQL connection pool (supports Supabase via DATABASE_URL)
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }, // Supabase needs SSL
      }
    : {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'erp_db',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
);

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

// --- DB bootstrap -------------------------------------------------------
const bootstrap = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      provider TEXT,
      provider_id TEXT,
      password_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT FALSE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY,
      role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
      collection_id TEXT,
      item_id TEXT,
      field_id TEXT,
      can_read BOOLEAN DEFAULT FALSE,
      can_write BOOLEAN DEFAULT FALSE,
      can_delete BOOLEAN DEFAULT FALSE,
      can_manage_fields BOOLEAN DEFAULT FALSE,
      can_manage_views BOOLEAN DEFAULT FALSE,
      can_manage_permissions BOOLEAN DEFAULT FALSE
    );
  `);

  // Drop old constraint if exists
  await pool.query(`
    DO $$ 
    BEGIN
      ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_role_id_collection_id_item_id_field_id_key;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `);

  // Drop old index if exists
  await pool.query(`DROP INDEX IF EXISTS permissions_unique_idx;`);

  // Clean up duplicates - keep only the most recent one
  await pool.query(`
    DELETE FROM permissions p1
    WHERE EXISTS (
      SELECT 1 FROM permissions p2
      WHERE p2.role_id = p1.role_id
        AND COALESCE(p2.collection_id, '') = COALESCE(p1.collection_id, '')
        AND COALESCE(p2.item_id, '') = COALESCE(p1.item_id, '')
        AND COALESCE(p2.field_id, '') = COALESCE(p1.field_id, '')
        AND p2.id > p1.id
    );
  `);

  // Create unique index with COALESCE
  await pool.query(`
    CREATE UNIQUE INDEX permissions_unique_idx 
    ON permissions (role_id, COALESCE(collection_id, ''), COALESCE(item_id, ''), COALESCE(field_id, ''));
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL
    );
  `);

  await ensureSystemRoles();
};

const ensureSystemRoles = async () => {
  const systemRoles = [
    { name: 'admin', description: 'Full access', is_system: true },
    { name: 'editor', description: 'Read/Write/Delete, manage fields/views', is_system: true },
    { name: 'viewer', description: 'Read-only', is_system: true },
  ];

  for (const role of systemRoles) {
    const existing = await pool.query('SELECT id FROM roles WHERE name = $1', [role.name]);
    if (existing.rowCount === 0) {
      await pool.query(
        'INSERT INTO roles (id, name, description, is_system) VALUES ($1, $2, $3, $4)',
        [uuidv4(), role.name, role.description, role.is_system]
      );
    }
  }

  // Ensure default permissions for system roles
  const admin = await pool.query('SELECT id FROM roles WHERE name = $1', ['admin']);
  if (admin.rowCount) {
    await upsertPermission({
      role_id: admin.rows[0].id,
      collection_id: null,
      item_id: null,
      field_id: null,
      can_read: true,
      can_write: true,
      can_delete: true,
      can_manage_fields: true,
      can_manage_views: true,
      can_manage_permissions: true,
    });
  }

  const editor = await pool.query('SELECT id FROM roles WHERE name = $1', ['editor']);
  if (editor.rowCount) {
    await upsertPermission({
      role_id: editor.rows[0].id,
      collection_id: null,
      item_id: null,
      field_id: null,
      can_read: true,
      can_write: true,
      can_delete: true,
      can_manage_fields: true,
      can_manage_views: true,
      can_manage_permissions: false,
    });
  }

  const viewer = await pool.query('SELECT id FROM roles WHERE name = $1', ['viewer']);
  if (viewer.rowCount) {
    await upsertPermission({
      role_id: viewer.rows[0].id,
      collection_id: null,
      item_id: null,
      field_id: null,
      can_read: true,
      can_write: false,
      can_delete: false,
      can_manage_fields: false,
      can_manage_views: false,
      can_manage_permissions: false,
    });
  }
};

const upsertPermission = async (perm) => {
  const result = await pool.query(
    `INSERT INTO permissions (id, role_id, collection_id, item_id, field_id, can_read, can_write, can_delete, can_manage_fields, can_manage_views, can_manage_permissions)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (role_id, COALESCE(collection_id, ''), COALESCE(item_id, ''), COALESCE(field_id, ''))
     DO UPDATE SET can_read = EXCLUDED.can_read, can_write = EXCLUDED.can_write, can_delete = EXCLUDED.can_delete,
                   can_manage_fields = EXCLUDED.can_manage_fields, can_manage_views = EXCLUDED.can_manage_views,
                   can_manage_permissions = EXCLUDED.can_manage_permissions
     RETURNING *;
    `,
    [
      perm.id || uuidv4(),
      perm.role_id,
      perm.collection_id || null,
      perm.item_id || null,
      perm.field_id || null,
      !!perm.can_read,
      !!perm.can_write,
      !!perm.can_delete,
      !!perm.can_manage_fields,
      !!perm.can_manage_views,
      !!perm.can_manage_permissions,
    ]
  );
  return result.rows[0];
};

// --- Auth helpers -------------------------------------------------------
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
    // Premier utilisateur = admin
    const admin = await pool.query('SELECT id FROM roles WHERE name = $1', ['admin']);
    if (admin.rowCount) {
      await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, admin.rows[0].id]);
    }
  } else {
    // Utilisateurs suivants = viewer par défaut
    const viewer = await pool.query('SELECT id FROM roles WHERE name = $1', ['viewer']);
    if (viewer.rowCount) {
      await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, viewer.rows[0].id]);
    }
  }

  return userId;
};

// --- Middleware ---------------------------------------------------------
const loadUserContext = async (userId, impersonateRoleId = null) => {
  const userRes = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [userId]);
  if (!userRes.rowCount) return null;
  const rolesRes = await pool.query(
    'SELECT r.* FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1',
    [userId]
  );

  // If impersonation is requested, restrict to that role for permissions/roles
  const roleIds = impersonateRoleId
    ? [impersonateRoleId]
    : rolesRes.rows.map((r) => r.id);

  const permsRes = await pool.query(
    'SELECT * FROM permissions WHERE role_id = ANY($1)',
    [roleIds]
  );

  return {
    user: userRes.rows[0],
    roles: impersonateRoleId ? rolesRes.rows.filter((r) => r.id === impersonateRoleId) : rolesRes.rows,
    permissions: permsRes.rows,
    impersonatedRoleId: impersonateRoleId,
  };
};

const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies.access_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) return res.status(401).json({ error: 'Unauthenticated' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const baseCtx = await loadUserContext(decoded.sub);
    if (!baseCtx) return res.status(401).json({ error: 'Invalid user' });

    const isAdmin = baseCtx.roles.some((r) => r.name === 'admin');
    const impersonateRoleId = req.cookies.impersonate_role_id || null;

    if (impersonateRoleId && isAdmin) {
      const impCtx = await loadUserContext(decoded.sub, impersonateRoleId);
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

const logAudit = async (userId, action, targetType, targetId, details = {}) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), userId || null, action, targetType || null, targetId || null, details]
    );
  } catch (err) {
    console.error('Failed to log audit', err);
  }
};

// --- Routes: health -----------------------------------------------------
app.get('/', (_req, res) => {
  res.json({ ok: true, message: 'API server is running' });
});

// --- Auth routes --------------------------------------------------------
app.post('/auth/register', async (req, res) => {
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

app.post('/auth/login', async (req, res) => {
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

app.get('/auth/me', requireAuth, async (req, res) => {
  res.json({
    user: req.auth.user,
    roles: req.auth.roles,
    baseRoles: req.auth.baseRoles || req.auth.roles,
    permissions: req.auth.permissions || [],
    impersonatedRoleId: req.auth.impersonatedRoleId || null,
  });
});

app.post('/auth/impersonate', requireAuth, async (req, res) => {
  // Only real admins can impersonate (use base roles)
  const isAdmin = (req.auth.baseRoles || req.auth.roles || []).some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const { roleId } = req.body || {};

  if (!roleId) {
    // Clear impersonation
    res.clearCookie('impersonate_role_id');
    return res.json({ ok: true, impersonatedRoleId: null });
  }

  const roleRes = await pool.query('SELECT id FROM roles WHERE id = $1', [roleId]);
  if (!roleRes.rowCount) return res.status(404).json({ error: 'role not found' });

  res.cookie('impersonate_role_id', roleId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  });
  return res.json({ ok: true, impersonatedRoleId: roleId });
});

app.post('/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.clearCookie('impersonate_role_id');
  res.json({ ok: true });
});

// --- Users / Roles / Permissions ---------------------------------------
app.get('/users', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
  const users = await pool.query(
    `SELECT u.id, u.email, u.name, u.provider, COALESCE(json_agg(ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), '[]') as role_ids
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     GROUP BY u.id`
  );
  res.json(users.rows);
});

app.get('/roles', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
  const roles = await pool.query('SELECT * FROM roles');
  res.json(roles.rows);
});

app.post('/roles', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const roleId = uuidv4();
  await pool.query('INSERT INTO roles (id, name, description, is_system) VALUES ($1, $2, $3, false)', [roleId, name, description || null]);
  await logAudit(req.auth?.user?.id, 'role.create', 'role', roleId, { name });
  res.json({ ok: true, id: roleId });
});

app.post('/user_roles', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  const { userId, roleId, action } = req.body;
  if (!userId || !roleId) return res.status(400).json({ error: 'userId and roleId required' });
  if (action === 'remove') {
    await pool.query('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
    await logAudit(req.auth?.user?.id, 'user_roles.remove', 'user', userId, { roleId });
  } else {
    await pool.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, roleId]);
    await logAudit(req.auth?.user?.id, 'user_roles.add', 'user', userId, { roleId });
  }
  res.json({ ok: true });
});

app.get('/permissions', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
  const perms = await pool.query('SELECT * FROM permissions');
  res.json(perms.rows);
});

app.post('/permissions', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  const perm = req.body || {};
  if (!perm.role_id) return res.status(400).json({ error: 'role_id required' });
  const result = await upsertPermission(perm);
  await logAudit(req.auth?.user?.id, 'permission.upsert', 'permission', perm.role_id, perm);
  res.json(result);
});

// --- State routes (protected + filtered) -------------------------------
const filterStateForUser = (data, ctx) => {
  if (!data || !data.collections) return data;
  const filteredCollections = (data.collections || []).map((col) => {
    const canReadCollection = hasPermission(ctx, { collection_id: col.id }, 'can_read');
    const visibleProps = (col.properties || []).filter((prop) =>
      hasPermission(ctx, { collection_id: col.id, field_id: prop.id }, 'can_read')
    );
    if (!canReadCollection) {
      // allow per-item read
      const allowedItems = (col.items || []).filter((item) =>
        hasPermission(ctx, { collection_id: col.id, item_id: item.id }, 'can_read')
      );
      if (allowedItems.length === 0) return null;
      return { ...col, properties: visibleProps, items: allowedItems };
    }
    // Field-level filtering (hide values user cannot read)
    const items = (col.items || []).map((item) => {
      const canReadItem = hasPermission(ctx, { collection_id: col.id, item_id: item.id }, 'can_read') || canReadCollection;
      if (!canReadItem) return null;
      let next = { ...item };
      visibleProps.forEach((prop) => {
        // Field-level check: a false at field scope must hide the value even if item/collection/global allow read
        const canReadField = hasPermission(ctx, { collection_id: col.id, item_id: item.id, field_id: prop.id }, 'can_read');
        if (!canReadField) {
          next = { ...next };
          delete next[prop.id];
        }
      });
      return next;
    }).filter(Boolean);
    return { ...col, properties: visibleProps, items };
  }).filter(Boolean);
  return { ...data, collections: filteredCollections };
};

app.get('/state', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT data FROM app_state WHERE id = 1');
    if (result.rows.length === 0) return res.json({});
    const parsed = JSON.parse(result.rows[0].data);
    const filtered = filterStateForUser(parsed, req.auth);
    return res.json(filtered);
  } catch (err) {
    console.error('Failed to load state', err);
    return res.status(500).json({ error: 'Failed to load state' });
  }
});

app.post('/state', requireAuth, async (req, res) => {
  try {
    const payload = req.body ?? {};
    const collections = payload.collections || [];
    for (const col of collections) {
      if (!hasPermission(req.auth, { collection_id: col.id }, 'can_write')) {
        return res.status(403).json({ error: `Forbidden to write collection ${col.id}` });
      }
    }

    const dataStr = JSON.stringify(payload);
    const updateResult = await pool.query('UPDATE app_state SET data = $1 WHERE id = 1', [dataStr]);
    if (updateResult.rowCount === 0) {
      await pool.query('INSERT INTO app_state (id, data) VALUES (1, $1)', [dataStr]);
    }
    await logAudit(req.auth?.user?.id, 'state.save', 'app_state', '1', { collections: collections.length });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to save state', err);
    return res.status(500).json({ error: 'Failed to save state' });
  }
});

// --- Audit -------------------------------------------------------------
app.get('/audit', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
  const logs = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
  res.json(logs.rows);
});

// --- Bootstrap and start -----------------------------------------------
(async () => {
  try {
    await bootstrap();
    app.listen(PORT, () => {
      console.log(`API server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to bootstrap server', err);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});
