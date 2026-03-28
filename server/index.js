import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pkg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import { registerPluginConfigRoutes } from './routes/pluginConfigRoutes.js';
import { registerBackupRoutes } from './routes/backupRoutes.js';
import { registerStateRoutes } from './routes/stateRoutes.js';
import { registerAccessRoutes } from './routes/accessRoutes.js';
import { registerAppStateAdminRoutes } from './routes/appStateAdminRoutes.js';
import { loadBuiltinServerPlugins } from './plugins/builtin.js';
import { mountServerPlugins } from './plugins/registry.js';
import {
  BACKUP_INTERVAL_MINUTES,
  createDbBackup,
  pruneBackups,
  listBackups,
  restoreDbBackup,
  resolveBackupPath,
  formatBackupError,
} from './services/backupService.js';
import { bootstrapDatabase } from './services/dbBootstrap.js';
import { setupSocketPresence } from './services/socketPresence.js';
import {
  DEFAULT_CALENDAR_CONFIG,
  getCalendarConfigForUser,
  shouldRecalculateSegments,
  calculateEventSegments,
} from './services/calendarSegmentsService.js';
import { registerAutomationRoutes } from './routes/automationRoutes.js';
import { createAuditLogger } from './services/auditService.js';
import { createAuthAccessService } from './services/authAccessService.js';
import { createUserOrganizationService } from './services/userOrganizationService.js';
import {
  sanitizeMappedOrganizations,
  buildImportPreviewOrganizations,
  applyOrganizationNameOverride,
} from './services/importPreviewService.js';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const TOKEN_EXPIRES = process.env.JWT_EXPIRES || '7d';

const INITIAL_APP_STATE = {
  collections: [],
  views: {},
  dashboards: [],
  dashboardSort: 'created',
  dashboardFilters: {},
  favorites: { views: [], items: [] }
};

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
app.use(express.json({ limit: '20mb' }));

// --- DB bootstrap -------------------------------------------------------
const bootstrap = async () => {
  await bootstrapDatabase({ pool, ensureDefaultOrganization });
};

const getRoleByNameInOrganization = async (organizationId, roleName) => {
  return pool.query('SELECT id FROM roles WHERE organization_id = $1 AND name = $2 LIMIT 1', [organizationId, roleName]);
};

const ensureSystemRolesForOrganization = async (organizationId) => {
  if (!organizationId) return;
  const systemRoles = [
    { name: 'admin', description: 'Full access', is_system: true },
    { name: 'editor', description: 'Read/Write/Delete, manage fields/views', is_system: true },
    { name: 'viewer', description: 'Read-only', is_system: true },
  ];

  for (const role of systemRoles) {
    const existing = await pool.query('SELECT id FROM roles WHERE organization_id = $1 AND name = $2', [organizationId, role.name]);
    if (existing.rowCount === 0) {
      await pool.query(
        'INSERT INTO roles (id, organization_id, name, description, is_system) VALUES ($1, $2, $3, $4, $5)',
        [uuidv4(), organizationId, role.name, role.description, role.is_system]
      );
    }
  }

  // Ensure default permissions for system roles
  const admin = await getRoleByNameInOrganization(organizationId, 'admin');
  if (admin.rowCount) {
    await upsertPermission({
      organization_id: organizationId,
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

  const editor = await getRoleByNameInOrganization(organizationId, 'editor');
  if (editor.rowCount) {
    await upsertPermission({
      organization_id: organizationId,
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

  const viewer = await getRoleByNameInOrganization(organizationId, 'viewer');
  if (viewer.rowCount) {
    await upsertPermission({
      organization_id: organizationId,
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

const syncAppStateIdSequence = async () => {
  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('app_state', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM app_state), 0) + 1, 1),
      false
    );
  `);
};

const ensureAppStateForOrganization = async (organizationId) => {
  if (!organizationId) return;
  const state = await pool.query('SELECT id FROM app_state WHERE organization_id = $1', [organizationId]);
  if (!state.rowCount) {
    await syncAppStateIdSequence();
    await pool.query(
      'INSERT INTO app_state (organization_id, data) VALUES ($1, $2)',
      [organizationId, JSON.stringify(INITIAL_APP_STATE)]
    );
  }
};

const ensureDefaultOrganization = async (ownerUserId) => {
  if (!ownerUserId) return null;

  let orgRes = await pool.query('SELECT id, name FROM organizations ORDER BY created_at ASC, id ASC LIMIT 1');
  if (!orgRes.rowCount) {
    const orgId = uuidv4();
    await pool.query(
      'INSERT INTO organizations (id, name, owner_user_id) VALUES ($1, $2, $3)',
      [orgId, 'Organisation principale', ownerUserId]
    );
    orgRes = { rowCount: 1, rows: [{ id: orgId, name: 'Organisation principale' }] };
  }

  const organizationId = orgRes.rows[0].id;
  await pool.query(
    'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [organizationId, ownerUserId]
  );

  await pool.query(
    'UPDATE app_state SET organization_id = $1 WHERE organization_id IS NULL',
    [organizationId]
  );

  await pool.query(
    'UPDATE roles SET organization_id = $1 WHERE organization_id IS NULL',
    [organizationId]
  );
  await pool.query(
    'UPDATE user_roles SET organization_id = $1 WHERE organization_id IS NULL',
    [organizationId]
  );
  await pool.query(
    'UPDATE permissions SET organization_id = $1 WHERE organization_id IS NULL',
    [organizationId]
  );

  await ensureSystemRolesForOrganization(organizationId);

  await ensureAppStateForOrganization(organizationId);
  return organizationId;
};

const upsertPermission = async (perm) => {
  const result = await pool.query(
    `INSERT INTO permissions (id, organization_id, role_id, collection_id, item_id, field_id, can_read, can_write, can_delete, can_manage_fields, can_manage_views, can_manage_permissions)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (organization_id, role_id, COALESCE(collection_id, ''), COALESCE(item_id, ''), COALESCE(field_id, ''))
     DO UPDATE SET can_read = EXCLUDED.can_read, can_write = EXCLUDED.can_write, can_delete = EXCLUDED.can_delete,
                   can_manage_fields = EXCLUDED.can_manage_fields, can_manage_views = EXCLUDED.can_manage_views,
                   can_manage_permissions = EXCLUDED.can_manage_permissions
     RETURNING *;
    `,
    [
      perm.id || uuidv4(),
      perm.organization_id,
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

const {
  getAdminRoleForOrganization,
  countOrganizationAdmins,
  isUserAdminInOrganization,
  wouldRemoveLastOrganizationAdmin,
  createLocalUser,
  getUserOrganizations,
} = createUserOrganizationService({
  pool,
  bcrypt,
  uuidv4,
  ensureDefaultOrganization,
  ensureSystemRolesForOrganization,
  getRoleByNameInOrganization,
});

const {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  loadUserContext,
  requireAuth,
  hasPermission,
  requirePermission,
  requireBaseAdminOrPermission,
} = createAuthAccessService({
  pool,
  jwt,
  JWT_SECRET,
  TOKEN_EXPIRES,
  getUserOrganizations,
  ensureDefaultOrganization,
  ensureAppStateForOrganization,
  ensureSystemRolesForOrganization,
});

// --- Segment calculation function (shared logic) ---
const logAudit = createAuditLogger({ pool, uuidv4 });

// --- Routes: health -----------------------------------------------------
app.get('/api', (_req, res) => {
  res.json({ ok: true, message: 'API server is running' });
});

registerAccessRoutes({
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
});

// --- DB Backups (admin only) ------------------------------------------
registerBackupRoutes({
  app,
  requireAuth,
  logAudit,
  backup: {
    listBackups,
    createDbBackup,
    restoreDbBackup,
    resolveBackupPath,
    formatBackupError,
  },
});

// --- State routes (protected + filtered) -------------------------------
registerAppStateAdminRoutes({
  app,
  requireAuth,
  pool,
  upsertPermission,
  syncAppStateIdSequence,
  ensureSystemRolesForOrganization,
  countOrganizationAdmins,
  getAdminRoleForOrganization,
  ensureAppStateForOrganization,
});

registerStateRoutes({
  app,
  requireAuth,
  requirePermission,
  pool,
  hasPermission,
  INITIAL_APP_STATE,
  syncAppStateIdSequence,
  getCalendarConfigForUser,
  shouldRecalculateSegments,
  calculateEventSegments,
  logAudit,
  defaultCalendarConfig: DEFAULT_CALENDAR_CONFIG,
});

registerAutomationRoutes({ app, requireAuth, requirePermission, pool });

// Serve static files from the dist folder
app.use(express.static(path.join(__dirname, '../dist')));

// --- Plugin Configuration Management -----------------------------------
registerPluginConfigRoutes({ app, requireAuth, pool });

// --- Server plugin mounts (route injection point) ----------------------
loadBuiltinServerPlugins();
mountServerPlugins({
  app,
  deps: {
    requireAuth,
    hasPermission,
    pool,
    syncAppStateIdSequence,
  },
});

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
    if (BACKUP_INTERVAL_MINUTES > 0 && !isNaN(BACKUP_INTERVAL_MINUTES)) {
      const intervalMs = BACKUP_INTERVAL_MINUTES * 60 * 1000;
      console.log(`[BACKUP] Sauvegardes automatiques toutes les ${BACKUP_INTERVAL_MINUTES} minutes`);
      setInterval(async () => {
        try {
          await createDbBackup('auto');
        } catch (err) {
          console.error('[BACKUP] Échec sauvegarde automatique', err);
        }
      }, intervalMs);
    } else {
      console.log('[BACKUP] Sauvegardes automatiques désactivées');
    }

    // Nettoyage initial des anciennes sauvegardes
    try {
      await pruneBackups();
    } catch (err) {
      console.error('[BACKUP] Échec du nettoyage initial', err);
    }

    // --- Gestion utilisateurs connectés ---
    setupSocketPresence({
      io,
      pool,
      jwt,
      jwtSecret: JWT_SECRET,
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
