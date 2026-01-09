// Vercel API handler - this gets called for all /api/* requests
// Using CommonJS for better Vercel compatibility

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pkg from 'pg';

const { Pool } = pkg;

const app = express();

// Configuration
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'dev-secret';
const TOKEN_EXPIRES = process.env.JWT_EXPIRES || '7d';

// Database
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      }
    : {
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'erp_db',
      }
);

// Middleware
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

// Bootstrap flag
let bootstrapped = false;

// Bootstrap database
const bootstrap = async () => {
  if (bootstrapped) return;

  try {
    // Create tables
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

    await pool.query(`DROP INDEX IF EXISTS permissions_unique_idx;`);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS permissions_unique_idx 
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

    // Setup roles
    const systemRoles = [
      { name: 'admin', description: 'Full access', is_system: true },
      { name: 'editor', description: 'Read/Write/Delete', is_system: true },
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

    bootstrapped = true;
  } catch (err) {
    console.error('Bootstrap error:', err.message);
    bootstrapped = true; // Mark as done to avoid infinite loops
  }
};

// Auth endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    await bootstrap();
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rowCount) return res.status(400).json({ error: 'email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await pool.query(
      'INSERT INTO users (id, email, name, provider, password_hash) VALUES ($1, $2, $3, $4, $5)',
      [userId, email.toLowerCase(), name || 'User', 'local', passwordHash]
    );

    const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
    res.cookie('access_token', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ ok: true, user: { id: userId, email, name } });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: 'Register failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    await bootstrap();
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const userRes = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (!userRes.rowCount) return res.status(401).json({ error: 'Invalid credentials' });

    const user = userRes.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
    res.cookie('access_token', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const token = req.cookies.access_token;
    if (!token) return res.status(401).json({ error: 'Unauthenticated' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userRes = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [decoded.sub]);
    if (!userRes.rowCount) return res.status(401).json({ error: 'User not found' });

    res.json({ user: userRes.rows[0] });
  } catch (err) {
    console.error('Auth check error:', err.message);
    res.status(401).json({ error: 'Unauthenticated' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('access_token');
  res.json({ ok: true });
});

// Health check
app.get('/api', (req, res) => {
  res.json({ ok: true, message: 'API is running' });
});

app.get('/', (req, res) => {
  res.json({ ok: true, message: 'API is running' });
});

export default app;
