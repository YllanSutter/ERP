import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pkg from 'pg';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const TOKEN_EXPIRES = process.env.JWT_EXPIRES || '7d';
const execFileAsync = promisify(execFile);

// PostgreSQL connection pool
let pool;
if (process.env.DATABASE_PUBLIC_URL) {
  // Use DATABASE_PUBLIC_URL directly (Railway/production)
  pool = new Pool({
    connectionString: process.env.DATABASE_PUBLIC_URL,
  });
} else {
  // Use individual environment variables (local development)
  pool = new Pool({
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres',
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: process.env.PGPORT || process.env.DB_PORT || 5432,
    database: process.env.PGDATABASE || process.env.DB_NAME || 'erp_db',
  });
}

// --- Backup configuration ----------------------------------------------
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
const BACKUP_RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 14);
const BACKUP_INTERVAL_MINUTES = Number(process.env.BACKUP_INTERVAL_MINUTES || 0);

const ensureBackupDir = async () => {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
};

const toSafeLabel = (label) => {
  if (!label) return '';
  return String(label).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
};

const resolveBackupPath = (name) => {
  const safeName = path.basename(String(name || ''));
  if (!safeName || safeName !== name) return null;
  const fullPath = path.resolve(BACKUP_DIR, safeName);
  if (!fullPath.startsWith(path.resolve(BACKUP_DIR))) return null;
  return fullPath;
};

const getDbConnection = () => {
  if (process.env.DATABASE_PUBLIC_URL) {
    return { type: 'url', value: process.env.DATABASE_PUBLIC_URL };
  }
  return {
    type: 'params',
    value: {
      user: process.env.PGUSER || process.env.DB_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres',
      host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
      port: process.env.PGPORT || process.env.DB_PORT || 5432,
      database: process.env.PGDATABASE || process.env.DB_NAME || 'erp_db',
    },
  };
};

const listBackups = async () => {
  await ensureBackupDir();
  const entries = await fs.promises.readdir(BACKUP_DIR);
  const backups = [];
  for (const entry of entries) {
    const fullPath = path.join(BACKUP_DIR, entry);
    const stat = await fs.promises.stat(fullPath);
    if (!stat.isFile()) continue;
    backups.push({
      name: entry,
      size: stat.size,
      createdAt: stat.mtime,
    });
  }
  backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return backups;
};

const pruneBackups = async () => {
  if (!Number.isFinite(BACKUP_RETENTION_DAYS) || BACKUP_RETENTION_DAYS <= 0) return;
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const backups = await listBackups();
  for (const backup of backups) {
    const createdAt = new Date(backup.createdAt).getTime();
    if (createdAt < cutoff) {
      const fullPath = resolveBackupPath(backup.name);
      if (fullPath) {
        await fs.promises.unlink(fullPath);
      }
    }
  }
};

const createDbBackup = async (label = '') => {
  await ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeLabel = toSafeLabel(label);
  const filename = `db-backup-${timestamp}${safeLabel ? `-${safeLabel}` : ''}.sql`;
  const filePath = path.join(BACKUP_DIR, filename);

  const db = getDbConnection();
  const args = ['-F', 'p', '--no-owner', '--no-privileges', '--file', filePath];
  let env = { ...process.env };
  if (db.type === 'url') {
    args.push('--dbname', db.value);
  } else {
    args.push('-h', String(db.value.host));
    args.push('-p', String(db.value.port));
    args.push('-U', String(db.value.user));
    args.push('-d', String(db.value.database));
    env = { ...env, PGPASSWORD: String(db.value.password || '') };
  }

  await execFileAsync('pg_dump', args, { env });
  await pruneBackups();

  const stat = await fs.promises.stat(filePath);
  return {
    name: filename,
    size: stat.size,
    createdAt: stat.mtime,
  };
};

const restoreDbBackup = async (name) => {
  const filePath = resolveBackupPath(name);
  if (!filePath) throw new Error('Invalid backup name');
  const db = getDbConnection();
  const ext = path.extname(filePath).toLowerCase();
  let env = { ...process.env };

  if (db.type === 'url') {
    if (ext === '.sql') {
      await execFileAsync('psql', ['--dbname', db.value, '-v', 'ON_ERROR_STOP=1', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'], { env });
      await execFileAsync('psql', ['--dbname', db.value, '-v', 'ON_ERROR_STOP=1', '-f', filePath], { env });
    } else {
      await execFileAsync('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', db.value, filePath], { env });
    }
    return;
  }

  env = { ...env, PGPASSWORD: String(db.value.password || '') };
  if (ext === '.sql') {
    await execFileAsync(
      'psql',
      ['-h', String(db.value.host), '-p', String(db.value.port), '-U', String(db.value.user), '-d', String(db.value.database), '-v', 'ON_ERROR_STOP=1', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'],
      { env }
    );
    await execFileAsync(
      'psql',
      ['-h', String(db.value.host), '-p', String(db.value.port), '-U', String(db.value.user), '-d', String(db.value.database), '-v', 'ON_ERROR_STOP=1', '-f', filePath],
      { env }
    );
  } else {
    await execFileAsync(
      'pg_restore',
      ['--clean', '--if-exists', '--no-owner', '--no-privileges', '-h', String(db.value.host), '-p', String(db.value.port), '-U', String(db.value.user), '-d', String(db.value.database), filePath],
      { env }
    );
  }
};

// CORS configuration - allow same-origin or CLIENT_ORIGIN
app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    // Allow CLIENT_ORIGIN
    if (origin === CLIENT_ORIGIN) return callback(null, true);
    // In production, also allow same-origin requests
    callback(null, true);
  }, 
  credentials: true 
}));
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

  // Ajout des colonnes favorite_views et favorite_items si manquantes
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='favorite_views') THEN
        ALTER TABLE users ADD COLUMN favorite_views TEXT[] DEFAULT ARRAY[]::TEXT[];
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='favorite_items') THEN
        ALTER TABLE users ADD COLUMN favorite_items TEXT[] DEFAULT ARRAY[]::TEXT[];
      END IF;
    END$$;
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
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      UNIQUE(user_id)
    );
  `);

  await ensureSystemRoles();

  // État initial complet pour app_state
  const initialState = {
    collections: [],
    views: {},
    dashboards: [],
    dashboardSort: 'created',
    dashboardFilters: {},
    favorites: { views: [], items: [] }
  };
  // Vérifier s'il existe déjà une entrée app_state
  const stateExists = await pool.query('SELECT 1 FROM app_state LIMIT 1');
    if (stateExists.rowCount === 0) {
      // Insérer l'état seulement s'il existe au moins un utilisateur
      const userRes = await pool.query('SELECT id FROM users LIMIT 1');
      if (userRes.rowCount > 0) {
        const userId = userRes.rows[0].id;
        await pool.query(
          'INSERT INTO app_state (user_id, data) VALUES ($1, $2)',
          [userId, JSON.stringify(initialState)]
        );
      }
    }
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
    // Création automatique de l'app_state pour le premier utilisateur
    const stateExists = await pool.query('SELECT 1 FROM app_state LIMIT 1');
    if (stateExists.rowCount === 0) {
      const initialState = {
        collections: [],
        views: {},
        dashboards: [],
        dashboardSort: 'created',
        dashboardFilters: {},
        favorites: { views: [], items: [] }
      };
      await pool.query(
        'INSERT INTO app_state (user_id, data) VALUES ($1, $2)',
        [userId, JSON.stringify(initialState)]
      );
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

// --- Segment calculation function (shared logic) ---
const breakStart = 12;
const breakEnd = 13;
const workDayStart = 9;
const workDayEnd = 17;

const normalizeComparableValue = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const getDateProperties = (collection) => {
  if (!collection || !Array.isArray(collection.properties)) return [];
  return collection.properties.filter((prop) => prop.type === 'date');
};

const areAllSegmentsModified = (prevItem, nextItem) => {
  const prevSegments = Array.isArray(prevItem?._eventSegments) ? prevItem._eventSegments : [];
  const nextSegments = Array.isArray(nextItem?._eventSegments) ? nextItem._eventSegments : [];

  if (prevSegments.length === 0 || nextSegments.length === 0) return false;
  if (prevSegments.length !== nextSegments.length) return false;

  return nextSegments.every((segment, index) => {
    const prevSegment = prevSegments[index];
    const prevStart = normalizeComparableValue(prevSegment?.start);
    const prevEnd = normalizeComparableValue(prevSegment?.end);
    const nextStart = normalizeComparableValue(segment?.start);
    const nextEnd = normalizeComparableValue(segment?.end);
    return prevStart !== nextStart || prevEnd !== nextEnd;
  });
};

const hasDateOrDurationChange = (prevItem, nextItem, collection, prevCollection) => {
  const dateProps = getDateProperties(collection);
  const prevProps = Array.isArray(prevCollection?.properties) ? prevCollection.properties : [];

  for (const prop of dateProps) {
    const dateKey = prop.id;
    const durationKey = `${prop.id}_duration`;

    const prevDate = normalizeComparableValue(prevItem?.[dateKey]);
    const nextDate = normalizeComparableValue(nextItem?.[dateKey]);
    if (prevDate !== nextDate) return true;

    const prevHasDuration = prevItem && Object.prototype.hasOwnProperty.call(prevItem, durationKey);
    const nextHasDuration = nextItem && Object.prototype.hasOwnProperty.call(nextItem, durationKey);

    const prevDuration = prevHasDuration ? normalizeComparableValue(prevItem[durationKey]) : null;
    const nextDuration = nextHasDuration ? normalizeComparableValue(nextItem[durationKey]) : null;
    if (prevDuration !== nextDuration) return true;

    if (!prevHasDuration && !nextHasDuration) {
      const prevProp = prevProps.find((p) => p.id === prop.id);
      const prevDefault = normalizeComparableValue(prevProp?.defaultDuration ?? null);
      const nextDefault = normalizeComparableValue(prop?.defaultDuration ?? null);
      if (prevDefault !== nextDefault) return true;
    }
  }

  return false;
};

const shouldRecalculateSegments = (prevItem, nextItem, collection, prevCollection) => {
  if (!nextItem) return true;
  if (!Array.isArray(nextItem._eventSegments) || nextItem._eventSegments.length === 0) return true;
  if (!prevItem) return true;

  if (hasDateOrDurationChange(prevItem, nextItem, collection, prevCollection)) return true;

  if (nextItem?._preserveEventSegments) {
    if (areAllSegmentsModified(prevItem, nextItem)) return true;
    return false;
  }

  return false;
};

/**
 * Calcule les segments de temps pour un item sur une période de jours de travail
 */
function calculateEventSegments(item, collection) {
  if (!collection || !collection.properties) return item;
  
  const segments = [];
  
  collection.properties.forEach((prop) => {
    if (prop.type === 'date' && item[prop.id]) {
      const durationKey = `${prop.id}_duration`;
      let duration = undefined;
      
      if (Object.prototype.hasOwnProperty.call(item, durationKey)) {
        duration = Number(item[durationKey]);
      } else if (prop.defaultDuration !== undefined && prop.defaultDuration !== null) {
        duration = Number(prop.defaultDuration);
      }
      
      // Si pas de durée valide, on ne génère pas de segment
      if (duration === undefined || isNaN(duration) || duration <= 0) {
        return;
      }
      
      // Décale la date au lundi si samedi/dimanche
      let startDate = item[prop.id];
      let startDateObj = new Date(startDate);
      
      if (startDateObj.getDay() === 6) { // samedi
        startDateObj.setDate(startDateObj.getDate() + 2);
        startDateObj.setHours(0, 0, 0, 0);
        startDate = startDateObj.toISOString();
      } else if (startDateObj.getDay() === 0) { // dimanche
        startDateObj.setDate(startDateObj.getDate() + 1);
        startDateObj.setHours(0, 0, 0, 0);
        startDate = startDateObj.toISOString();
      }
      
      // Appelle la fonction de découpe
      const segs = splitEventByWorkdaysServer(
        { startDate, durationHours: duration },
        { startCal: workDayStart, endCal: workDayEnd, breakStart, breakEnd }
      );
      
      segs.forEach(seg => {
        segments.push({
          start: seg.__eventStart instanceof Date ? seg.__eventStart.toISOString() : seg.__eventStart,
          end: seg.__eventEnd instanceof Date ? seg.__eventEnd.toISOString() : seg.__eventEnd,
          label: prop.name,
        });
      });
    }
  });
  
  return { ...item, _eventSegments: segments };
}

/**
 * Découpe un événement sur plusieurs jours ouvrés (version serveur)
 */
function splitEventByWorkdaysServer(item, opts) {
  const { startCal, endCal, breakStart, breakEnd } = opts;
  const start = new Date(item.startDate || item.start);
  
  let durationMs = 0;
  if (item.durationHours) {
    durationMs = item.durationHours * 60 * 60 * 1000;
  }
  
  if (!start || isNaN(start.getTime()) || durationMs <= 0) {
    return [];
  }
  
  const events = [];
  let remainingMs = durationMs;
  let current = new Date(start);
  
  while (remainingMs > 0) {
    // Saute les weekends
    while (current.getDay() === 0 || current.getDay() === 6) {
      current.setDate(current.getDate() + 1);
      current.setHours(startCal, 0, 0, 0);
    }
    
    // Définit les bornes de la journée
    let dayStart = new Date(current);
    let dayEnd = new Date(current);
    dayStart.setHours(startCal, 0, 0, 0);
    dayEnd.setHours(endCal, 0, 0, 0);
    
    let segmentStart = new Date(Math.max(dayStart.getTime(), current.getTime()));
    
    let pauseStart = new Date(current);
    pauseStart.setHours(breakStart, 0, 0, 0);
    let pauseEnd = new Date(current);
    pauseEnd.setHours(breakEnd, 0, 0, 0);
    
    // Matin (avant pause)
    if (segmentStart < pauseStart && segmentStart < dayEnd && remainingMs > 0) {
      let segmentEnd = new Date(Math.min(pauseStart.getTime(), segmentStart.getTime() + remainingMs));
      const segmentDuration = segmentEnd.getTime() - segmentStart.getTime();
      
      events.push({
        __eventStart: new Date(segmentStart),
        __eventEnd: new Date(segmentEnd),
      });
      
      remainingMs -= segmentDuration;
      segmentStart = new Date(pauseEnd);
    }
    
    // Après-midi (après pause)
    if (segmentStart < dayEnd && remainingMs > 0) {
      let segmentEnd = new Date(Math.min(dayEnd.getTime(), segmentStart.getTime() + remainingMs));
      const segmentDuration = segmentEnd.getTime() - segmentStart.getTime();
      
      if (segmentDuration > 0) {
        events.push({
          __eventStart: new Date(segmentStart),
          __eventEnd: new Date(segmentEnd),
        });
        remainingMs -= segmentDuration;
      }
    }
    
    // Passe au jour suivant
    current.setDate(current.getDate() + 1);
    current.setHours(startCal, 0, 0, 0);
  }
  
  return events;
}

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
app.get('/api', (_req, res) => {
  res.json({ ok: true, message: 'API server is running' });
});

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
  res.json({
    user: req.auth.user,
    roles: req.auth.roles,
    baseRoles: req.auth.baseRoles || req.auth.roles,
    permissions: req.auth.permissions || [],
    impersonatedRoleId: req.auth.impersonatedRoleId || null,
  });
});

app.post('/api/auth/impersonate', requireAuth, async (req, res) => {
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

app.post('/api/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.clearCookie('impersonate_role_id');
  res.json({ ok: true });
});

// --- Users / Roles / Permissions ---------------------------------------
app.get('/api/users', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
  const users = await pool.query(
    `SELECT u.id, u.email, u.name, u.provider, COALESCE(json_agg(ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), '[]') as role_ids
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     GROUP BY u.id`
  );
  res.json(users.rows);
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
    const userId = req.params.id;
    if (req.auth?.user?.id === userId) {
      return res.status(400).json({ error: 'cannot delete own account' });
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

app.get('/api/roles', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
  const roles = await pool.query('SELECT * FROM roles');
  res.json(roles.rows);
});

app.post('/api/roles', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const roleId = uuidv4();
  await pool.query('INSERT INTO roles (id, name, description, is_system) VALUES ($1, $2, $3, false)', [roleId, name, description || null]);
  await logAudit(req.auth?.user?.id, 'role.create', 'role', roleId, { name });
  res.json({ ok: true, id: roleId });
});

app.post('/api/user_roles', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
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

app.get('/api/permissions', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
  const perms = await pool.query('SELECT * FROM permissions');
  res.json(perms.rows);
});

app.post('/api/permissions', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  const perm = req.body || {};
  if (!perm.role_id) return res.status(400).json({ error: 'role_id required' });
  const result = await upsertPermission(perm);
  await logAudit(req.auth?.user?.id, 'permission.upsert', 'permission', perm.role_id, perm);
  res.json(result);
});

// --- DB Backups (admin only) ------------------------------------------
app.get('/api/db/backups', requireAuth, async (req, res) => {
  const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const backups = await listBackups();
    return res.json(backups);
  } catch (err) {
    console.error('Failed to list backups', err);
    return res.status(500).json({ error: 'Failed to list backups' });
  }
});

app.post('/api/db/backups', requireAuth, async (req, res) => {
  const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const label = req.body?.label || '';
    const backup = await createDbBackup(label);
    await logAudit(req.auth?.user?.id, 'db.backup.create', 'backup', backup.name, backup);
    return res.json({ ok: true, backup });
  } catch (err) {
    console.error('Failed to create backup', err);
    return res.status(500).json({ error: 'Failed to create backup' });
  }
});

app.get('/api/db/backups/:name', requireAuth, async (req, res) => {
  const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const filePath = resolveBackupPath(req.params.name);
  if (!filePath) return res.status(400).json({ error: 'Invalid backup name' });
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    await logAudit(req.auth?.user?.id, 'db.backup.download', 'backup', req.params.name, {});
    return res.download(filePath);
  } catch (err) {
    console.error('Failed to download backup', err);
    return res.status(404).json({ error: 'Backup not found' });
  }
});

app.delete('/api/db/backups/:name', requireAuth, async (req, res) => {
  const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const filePath = resolveBackupPath(req.params.name);
  if (!filePath) return res.status(400).json({ error: 'Invalid backup name' });
  try {
    await fs.promises.unlink(filePath);
    await logAudit(req.auth?.user?.id, 'db.backup.delete', 'backup', req.params.name, {});
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete backup', err);
    return res.status(404).json({ error: 'Backup not found' });
  }
});

app.post('/api/db/backups/:name/restore', requireAuth, async (req, res) => {
  const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const filePath = resolveBackupPath(req.params.name);
  if (!filePath) return res.status(400).json({ error: 'Invalid backup name' });
  try {
    await restoreDbBackup(req.params.name);
    await logAudit(req.auth?.user?.id, 'db.backup.restore', 'backup', req.params.name, {});
    if (global.io) {
      global.io.emit('stateUpdated', { userId: req.auth?.user?.id || null, source: 'db.restore' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to restore backup', err);
    return res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// --- State routes (protected + filtered) -------------------------------

// --- Export/Import app_state (admin only) ---
// --- Export/Import global state (admin only) ---
app.get('/api/appstate', requireAuth, async (req, res) => {
  // Seuls les admins peuvent exporter tout l'état
  const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const users = (await pool.query('SELECT * FROM users ORDER BY id ASC')).rows;
    const app_state = (await pool.query('SELECT * FROM app_state ORDER BY id ASC')).rows;
    const roles = (await pool.query('SELECT * FROM roles ORDER BY id ASC')).rows;
    const permissions = (await pool.query('SELECT * FROM permissions ORDER BY id ASC')).rows;
    const user_roles = (await pool.query('SELECT * FROM user_roles ORDER BY user_id, role_id ASC')).rows;
    res.json({ users, app_state, roles, permissions, user_roles });
  } catch (err) {
    console.error('Failed to export global state', err);
    res.status(500).json({ error: 'Failed to export global state' });
  }
});

app.post('/api/appstate', requireAuth, async (req, res) => {
  // Seuls les admins peuvent importer tout l'état
  const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const { users, app_state, roles, permissions, user_roles } = req.body || {};
    if (!Array.isArray(users) || !Array.isArray(app_state) || !Array.isArray(roles) || !Array.isArray(permissions) || !Array.isArray(user_roles)) {
      return res.status(400).json({ error: 'Invalid import format' });
    }
    // Désactiver les contraintes FK temporairement
    await pool.query('SET session_replication_role = replica;');
    // Vider toutes les tables dans l'ordre inverse des dépendances
    await pool.query('DELETE FROM user_roles');
    await pool.query('DELETE FROM permissions');
    await pool.query('DELETE FROM roles');
    await pool.query('DELETE FROM app_state');
    await pool.query('DELETE FROM users');
    // Réinsérer dans l'ordre des dépendances
    for (const user of users) {
      await pool.query(
        'INSERT INTO users (id, email, name, provider, provider_id, password_hash, created_at, favorite_views, favorite_items) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [user.id, user.email, user.name, user.provider, user.provider_id, user.password_hash, user.created_at, user.favorite_views || [], user.favorite_items || []]
      );
    }
    for (const role of roles) {
      await pool.query(
        'INSERT INTO roles (id, name, description, is_system) VALUES ($1,$2,$3,$4)',
        [role.id, role.name, role.description, role.is_system]
      );
    }
    for (const perm of permissions) {
      await pool.query(
        'INSERT INTO permissions (id, role_id, collection_id, item_id, field_id, can_read, can_write, can_delete, can_manage_fields, can_manage_views, can_manage_permissions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        [perm.id, perm.role_id, perm.collection_id, perm.item_id, perm.field_id, perm.can_read, perm.can_write, perm.can_delete, perm.can_manage_fields, perm.can_manage_views, perm.can_manage_permissions]
      );
    }
    for (const row of app_state) {
      await pool.query(
        'INSERT INTO app_state (id, user_id, data) VALUES ($1, $2, $3)',
        [row.id, row.user_id, row.data]
      );
    }
    for (const ur of user_roles) {
      await pool.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
        [ur.user_id, ur.role_id]
      );
    }
    // Réactiver les contraintes FK
    await pool.query('SET session_replication_role = DEFAULT;');
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to import global state', err);
    // Toujours réactiver les contraintes FK en cas d'erreur
    await pool.query('SET session_replication_role = DEFAULT;');
    res.status(500).json({ error: 'Failed to import global state' });
  }
});
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

app.get('/api/state', requireAuth, async (req, res) => {
  try {
    const userId = req.auth.user.id;
    // Récupérer l'état utilisateur (collections, views, etc.)
    const userStateResult = await pool.query('SELECT data FROM app_state LIMIT 1');
    const userData = userStateResult.rows.length > 0 ? JSON.parse(userStateResult.rows[0].data) : {};
    // Récupérer les favoris de l'utilisateur
    const userResult = await pool.query('SELECT favorite_views, favorite_items FROM users WHERE id = $1', [userId]);
    const favorites = userResult.rows.length > 0 ? {
      views: userResult.rows[0].favorite_views || [],
      items: userResult.rows[0].favorite_items || []
    } : { views: [], items: [] };
    // Combiner l'état utilisateur et les favoris
    const state = { ...userData, favorites };
    const filtered = filterStateForUser(state, req.auth);
    return res.json(filtered);
  } catch (err) {
    console.error('Failed to load state', err);
    return res.status(500).json({ error: 'Failed to load state' });
  }
});

app.post('/api/state', requireAuth, async (req, res) => {
  try {
    const payload = req.body ?? {};
    const userId = req.auth.user.id;
    // Séparer les favoris du reste de l'état
    const { favorites, ...stateData } = payload;
    const collections = stateData.collections || [];

    const prevStateResult = await pool.query('SELECT data FROM app_state LIMIT 1');
    const prevState = prevStateResult.rows.length > 0 ? JSON.parse(prevStateResult.rows[0].data) : {};
    const prevCollections = Array.isArray(prevState.collections) ? prevState.collections : [];
    const prevCollectionsById = new Map(prevCollections.map((col) => [col.id, col]));
    
    // IMPORTANT: Recalculer les segments côté serveur pour chaque item
    // Cela garantit que les segments sont TOUJOURS en accord avec les champs date/durée
    const processedCollections = collections.map((col) => {
      if (!col.items) return col;

      const prevCol = prevCollectionsById.get(col.id);
      const prevItems = Array.isArray(prevCol?.items) ? prevCol.items : [];
      const prevItemsById = new Map(prevItems.map((item) => [item.id, item]));

      const processedItems = col.items.map((item) => {
        const prevItem = prevItemsById.get(item.id);

        if (!shouldRecalculateSegments(prevItem, item, col, prevCol)) {
          const preservedSegments = Array.isArray(item._eventSegments)
            ? item._eventSegments
            : Array.isArray(prevItem?._eventSegments)
              ? prevItem._eventSegments
              : [];
          return { ...item, _eventSegments: preservedSegments };
        }

        // Recalcule _eventSegments basé sur les champs date/durée de la collection
        return calculateEventSegments(item, col);
      });
      
      return { ...col, items: processedItems };
    });
    
    // Vérifier les permissions pour les collections
    for (const col of processedCollections) {
      if (!hasPermission(req.auth, { collection_id: col.id }, 'can_write')) {
        return res.status(403).json({ error: `Forbidden to write collection ${col.id}` });
      }
    }
    
    // Sauvegarder l'état utilisateur (avec segments recalculés) dans app_state
    const stateDataWithSegments = { ...stateData, collections: processedCollections };
    const stateStr = JSON.stringify(stateDataWithSegments);
    
    // Upsert : si la ligne existe, update, sinon insert
    const updateRes = await pool.query('UPDATE app_state SET data = $1', [stateStr]);
    if (updateRes.rowCount === 0) {
      await pool.query('INSERT INTO app_state (data) VALUES ($1)', [stateStr]);
    }
    
    // Sauvegarder les favoris de l'utilisateur
    const favoriteViews = favorites?.views || [];
    const favoriteItems = favorites?.items || [];
    await pool.query(
      'UPDATE users SET favorite_views = $1, favorite_items = $2 WHERE id = $3',
      [favoriteViews, favoriteItems, userId]
    );
    await logAudit(userId, 'state.save', 'app_state', userId, { collections: processedCollections.length });
    
    // Émettre l'événement socket.io pour le hot reload, avec l'id de l'utilisateur auteur
    if (global.io) {
      // console.log('[SOCKET] Emission de stateUpdated à tous les clients (userId: ' + userId + ')');
      global.io.emit('stateUpdated', { userId });
    }
    
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to save state', err);
    return res.status(500).json({ error: 'Failed to save state' });
  }
});

// --- Audit -------------------------------------------------------------
app.get('/api/audit', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
  const logs = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
  res.json(logs.rows);
});

// Serve static files from the dist folder
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all: serve index.html for any non-API routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// --- Bootstrap and start -----------------------------------------------
let serverInstance;
(async () => {
  try {
    await bootstrap();
    serverInstance = app.listen(PORT, () => {});
    // Initialisation socket.io
    const io = new SocketIOServer(serverInstance, {
      cors: { origin: CLIENT_ORIGIN, credentials: true }
    });
    global.io = io;

    // Sauvegardes automatiques (optionnelles)
    if (BACKUP_INTERVAL_MINUTES > 0) {
      const intervalMs = BACKUP_INTERVAL_MINUTES * 60 * 1000;
      setInterval(async () => {
        try {
          await createDbBackup('auto');
        } catch (err) {
          console.error('[BACKUP] Échec sauvegarde automatique', err);
        }
      }, intervalMs);
    }

    // Nettoyage initial des anciennes sauvegardes
    try {
      await pruneBackups();
    } catch (err) {
      console.error('[BACKUP] Échec du nettoyage initial', err);
    }

    // --- Gestion utilisateurs connectés ---
    // Map socket.id -> user info
    const connectedUsers = new Map();

    // Helper pour envoyer la liste à tous
    function broadcastUsers() {
      const users = Array.from(connectedUsers.values());
      io.emit('usersConnected', users);
    }

    io.on('connection', async (socket) => {
        // Identification par événement 'identify' (plus fiable que le cookie)
        let user = null;
        socket.on('identify', async (payload) => {
          if (payload && payload.id && payload.name) {
            user = { id: payload.id, name: payload.name };
            connectedUsers.set(socket.id, user);
            broadcastUsers();
          }
        });

        // (Optionnel) fallback cookie pour compatibilité ancienne version
        try {
          const cookie = socket.handshake.headers.cookie || '';
          // Accepte auth_token OU access_token
          let match = cookie.match(/auth_token=([^;]+)/);
          if (!match) {
            match = cookie.match(/access_token=([^;]+)/);
          }
          if (match) {
            const token = match[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [decoded.id]);
            if (result.rowCount) {
              user = result.rows[0];
              connectedUsers.set(socket.id, user);
              broadcastUsers();
            }
          }
        } catch (e) {
        }

        socket.on('whoIsConnected', () => {
          broadcastUsers();
        });

        socket.on('disconnect', () => {
          connectedUsers.delete(socket.id);
          broadcastUsers();
        });
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

// Better error logging
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
