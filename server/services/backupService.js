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
export const BACKUP_INTERVAL_MINUTES = Number(process.env.BACKUP_INTERVAL_MINUTES) || 1440;

const ensureBackupDir = async () => {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
};

const toSafeLabel = (label) => {
  if (!label) return '';
  return String(label).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
};

export const resolveBackupPath = (name) => {
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

export const listBackups = async () => {
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

export const createDbBackup = async (label = '') => {
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

export const restoreDbBackup = async (name) => {
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
