import { createBackupArchive, extractBackupArchive, pdfDirectories } from './backupArchive.js';
import { randomUUID } from 'node:crypto';
import { getDatabaseRestoreSql } from './dbBootstrap.js';
import { PDF_STORAGE_DIR } from '../plugins/pdf/index.js';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');
const BACKUP_RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 14);
export const BACKUP_INTERVAL_MINUTES = Number(process.env.BACKUP_INTERVAL_MINUTES ?? 1440);

const ensureBackupDir = async () => {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
};

const toSafeLabel = (label) => {
  if (!label) return '';
  return String(label).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
};

export const resolveBackupPath = (name) => {
  const safeName = path.basename(String(name || ''));
  if (!safeName || safeName !== name || safeName === '.' || safeName === '..') return null;
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

export const backupScope = (name) => {
  const match = /^org-backup-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-/i.exec(name);
  return match ? { scope: 'organization', organizationId: match[1] } : { scope: 'database' };
};

export const getBackupDirectory = async () => { await ensureBackupDir(); return BACKUP_DIR; };

export const listBackups = async () => {
  await ensureBackupDir();
  const entries = await fs.promises.readdir(BACKUP_DIR);
  const backups = [];
  for (const entry of entries) {
    if (!/\.(tar|sql|dump|backup)$/i.test(entry)) continue;
    const fullPath = path.join(BACKUP_DIR, entry);
    const stat = await fs.promises.lstat(fullPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (!stat?.isFile()) continue;
    backups.push({
      ...backupScope(entry),
      name: entry,
      size: stat.size,
      createdAt: stat.mtime,
    });
  }
  backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return backups;
};

export const pruneBackups = async () => {
  if (!Number.isFinite(BACKUP_RETENTION_DAYS) || BACKUP_RETENTION_DAYS <= 0) return;
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const backups = await listBackups();
  const kept = new Set();
  for (const backup of backups) {
    const group = `${backup.scope}:${backup.organizationId || ''}`;
    if (!kept.has(group)) { kept.add(group); continue; }
    const createdAt = new Date(backup.createdAt).getTime();
    if (createdAt < cutoff) {
      const fullPath = resolveBackupPath(backup.name);
      if (fullPath) {
        await fs.promises.unlink(fullPath);
      }
    }
  }
};

export const formatBackupError = (err) => {
  const stderr = typeof err?.stderr === 'string' ? err.stderr.trim() : '';
  const stdout = typeof err?.stdout === 'string' ? err.stdout.trim() : '';

  if (err?.code === 'ENOENT') {
    return 'pg_dump introuvable sur le serveur. Installez postgresql-client (ou ajoutez pg_dump au PATH).';
  }

  if (stderr) return stderr;
  if (stdout) return stdout;
  if (err?.message) return String(err.message);
  return 'Erreur inconnue lors de la création de la sauvegarde.';
};

const connectionOptions = () => {
  const db = getDbConnection();
  if (db.type === 'url') return { args: ['--dbname', db.value], env: process.env };
  const { host, port, user, database, password } = db.value;
  return {
    args: ['-h', String(host), '-p', String(port), '-U', String(user), '-d', String(database)],
    env: { ...process.env, PGPASSWORD: String(password || '') },
  };
};

let backupOperation = Promise.resolve();

export const serializeBackupOperation = (operation) => {
  const result = backupOperation.then(operation);
  backupOperation = result.catch(() => {});
  return result;
};

const createDbBackupInternal = async (label = '', { prune = true, requireAppTables = true } = {}) => {
  await ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeLabel = toSafeLabel(label);
  const filename = `db-backup-${timestamp}-${randomUUID()}${safeLabel ? `-${safeLabel}` : ''}.tar`;
  const filePath = path.join(BACKUP_DIR, filename);
  const staging = await fs.promises.mkdtemp(path.join(BACKUP_DIR, '.backup-'));
  try {
    const { args, env } = connectionOptions();
    await execFileAsync('pg_dump', [
      ...args, '-F', 'p', '--no-owner', '--no-privileges', '--file', path.join(staging, 'database.sql'),
    ], { env });
    await validateSqlBackup(path.join(staging, 'database.sql'), { requireAppTables });
    for (const directory of pdfDirectories) {
      const source = path.join(PDF_STORAGE_DIR, directory);
      const destination = path.join(staging, 'pdf', directory);
      const existing = await fs.promises.lstat(source).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      if (existing) await fs.promises.cp(source, destination, { recursive: true });
      else await fs.promises.mkdir(destination, { recursive: true });
    }
    await createBackupArchive(staging, filePath, 'database.sql', { scope: 'database' });
  } finally {
    await fs.promises.rm(staging, { recursive: true, force: true });
  }

  if (prune) await pruneBackups();
  const stat = await fs.promises.stat(filePath);
  return { name: filename, size: stat.size, createdAt: stat.mtime };
};

export const createDbBackup = (label = '') => serializeBackupOperation(() => createDbBackupInternal(label));

const validateSqlBackup = async (file, { requireAppTables = true } = {}) => {
  const sql = await fs.promises.readFile(file, 'utf8');
  if (!sql.includes('-- PostgreSQL database dump complete')) throw new Error('Sauvegarde SQL incomplète.');
  if (!requireAppTables) return;
  for (const table of ['users', 'roles', 'user_roles', 'permissions', 'app_state']) {
    if (!sql.includes(`CREATE TABLE public.${table} (`)) throw new Error(`Sauvegarde incompatible : table ${table} absente.`);
  }
};

export const compatibleRestoreSql = (sql, serverVersion) => Number(serverVersion) < 170000
  ? sql.replace(/^SET transaction_timeout = 0;\r?\n/m, '') : sql;

const restoreSql = async (filePath) => {
  await validateSqlBackup(filePath);
  const migration = `${filePath}.migration.sql`;
  try {
    await fs.promises.writeFile(migration, await getDatabaseRestoreSql(), { mode: 0o600 });
    const { args, env } = connectionOptions();
    const { stdout } = await execFileAsync('psql', [...args, '-X', '-At', '-c', 'SHOW server_version_num'], { env });
    const sql = await fs.promises.readFile(filePath, 'utf8');
    await fs.promises.writeFile(filePath, compatibleRestoreSql(sql, stdout.trim()), { mode: 0o600 });
    await execFileAsync('psql', [
      ...args, '-X', '--single-transaction', '-v', 'ON_ERROR_STOP=1',
      '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;', '-f', filePath, '-f', migration,
    ], { env, maxBuffer: 16 * 1024 * 1024 });
  } finally {
    await fs.promises.rm(migration, { force: true });
  }
};

const restoreBundle = async (filePath) => {
  await fs.promises.mkdir(PDF_STORAGE_DIR, { recursive: true });
  const staging = await fs.promises.mkdtemp(path.join(PDF_STORAGE_DIR, '.restore-'));
  const moved = [];
  let preserveStaging = false;
  try {
    const manifest = await extractBackupArchive(filePath, staging, 'database.sql');
    if (manifest?.scope && manifest.scope !== 'database') throw new Error('Cette sauvegarde n’est pas une sauvegarde complète.');
    const database = path.join(staging, 'database.sql');
    await validateSqlBackup(database);
    await createDbBackupInternal('pre-restore', { prune: false, requireAppTables: false });
    for (const directory of pdfDirectories) {
      const destination = path.join(PDF_STORAGE_DIR, directory);
      const previous = path.join(staging, `previous-${directory}`);
      let hadPrevious = true;
      try {
        await fs.promises.rename(destination, previous);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        hadPrevious = false;
      }
      const swap = { destination, previous, hadPrevious, installed: false };
      moved.push(swap);
      await fs.promises.rename(path.join(staging, 'pdf', directory), destination);
      swap.installed = true;
    }
    await restoreSql(database);
  } catch (error) {
    try {
      for (const { destination, previous, hadPrevious, installed } of moved.reverse()) {
        if (installed) await fs.promises.rm(destination, { recursive: true });
        if (hadPrevious) await fs.promises.rename(previous, destination);
      }
    } catch (rollbackError) {
      preserveStaging = true;
      throw new AggregateError([error, rollbackError], `PDF rollback failed. Recovery files remain in ${staging}`, { cause: rollbackError });
    }
    throw error;
  } finally {
    if (!preserveStaging) await fs.promises.rm(staging, { recursive: true, force: true });
  }
};

export const restoreDbBackup = (name) => serializeBackupOperation(async () => {
  const filePath = resolveBackupPath(name);
  if (!filePath) throw new Error('Invalid backup name');
  if (!(await fs.promises.lstat(filePath)).isFile()) throw new Error('Invalid backup file');
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.tar') return restoreBundle(filePath);
  // Normalize legacy PostgreSQL archives to SQL so upgrades share the restore transaction.
  const staging = await fs.promises.mkdtemp(path.join(await ensureStagingRoot(), '.restore-'));
  try {
    const database = path.join(staging, 'database.sql');
    if (ext === '.sql') await fs.promises.copyFile(filePath, database);
    else if (['.dump', '.backup'].includes(ext)) {
      await execFileAsync('pg_restore', ['--no-owner', '--no-privileges', '--file', database, filePath]);
    } else throw new Error('Format de sauvegarde non pris en charge.');
    await validateSqlBackup(database);
    await createDbBackupInternal('pre-restore', { prune: false, requireAppTables: false });
    await restoreSql(database);
  } finally {
    await fs.promises.rm(staging, { recursive: true, force: true });
  }
});

const ensureStagingRoot = async () => {
  await ensureBackupDir();
  return BACKUP_DIR;
};
