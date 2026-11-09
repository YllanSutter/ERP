import { randomUUID } from 'node:crypto';
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

export const listBackups = async () => {
  await ensureBackupDir();
  const entries = await fs.promises.readdir(BACKUP_DIR);
  const backups = [];
  for (const entry of entries) {
    const fullPath = path.join(BACKUP_DIR, entry);
    const stat = await fs.promises.lstat(fullPath);
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

export const pruneBackups = async () => {
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

const pdfDirectories = ['templates', 'saved'];
let backupOperation = Promise.resolve();

const serializeBackupOperation = (operation) => {
  const result = backupOperation.then(operation);
  backupOperation = result.catch(() => {});
  return result;
};

export const createDbBackup = (label = '') => serializeBackupOperation(async () => {
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
    for (const directory of pdfDirectories) {
      const source = path.join(PDF_STORAGE_DIR, directory);
      const destination = path.join(staging, 'pdf', directory);
      const existing = await fs.promises.lstat(source).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      if (existing) await fs.promises.cp(source, destination, { recursive: true });
      else await fs.promises.mkdir(destination, { recursive: true });
    }
    const archive = path.join(staging, 'backup.tar');
    await execFileAsync('tar', ['-cf', archive, '-C', staging, 'database.sql', 'pdf']);
    await fs.promises.chmod(archive, 0o600);
    await fs.promises.rename(archive, filePath);
  } finally {
    await fs.promises.rm(staging, { recursive: true, force: true });
  }

  await pruneBackups();
  const stat = await fs.promises.stat(filePath);
  return { name: filename, size: stat.size, createdAt: stat.mtime };
});

const restoreSql = async (filePath) => {
  const { args, env } = connectionOptions();
  await execFileAsync('psql', [
    ...args, '-X', '--single-transaction', '-v', 'ON_ERROR_STOP=1',
    '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;', '-f', filePath,
  ], { env });
};

const restoreBundle = async (filePath) => {
  await fs.promises.mkdir(PDF_STORAGE_DIR, { recursive: true });
  const staging = await fs.promises.mkdtemp(path.join(PDF_STORAGE_DIR, '.restore-'));
  const moved = [];
  let preserveStaging = false;
  try {
    await execFileAsync('tar', ['-xf', filePath, '-C', staging]);
    if (!(await fs.promises.lstat(path.join(staging, 'pdf'))).isDirectory()) throw new Error('Invalid backup PDF directory');
    const database = path.join(staging, 'database.sql');
    if (!(await fs.promises.lstat(database)).isFile()) throw new Error('Invalid backup database');
    for (const directory of pdfDirectories) {
      const source = path.join(staging, 'pdf', directory);
      if (!(await fs.promises.lstat(source)).isDirectory()) throw new Error('Invalid backup PDF directory');
      const entries = await fs.promises.readdir(source, { withFileTypes: true });
      if (entries.some((entry) => !entry.isFile())) throw new Error('Invalid backup PDF file');
    }
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
  if (ext === '.sql') return restoreSql(filePath);

  const { args, env } = connectionOptions();
  await execFileAsync('pg_restore', [
    ...args, '--single-transaction', '--clean', '--if-exists', '--no-owner', '--no-privileges', filePath,
  ], { env });
});
