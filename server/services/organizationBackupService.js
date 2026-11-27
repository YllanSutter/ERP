import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PDF_STORAGE_DIR } from '../plugins/pdf/index.js';
import { createBackupArchive, extractBackupArchive, bundlePdfFiles, pdfDirectories } from './backupArchive.js';
import { backupScope, getBackupDirectory, resolveBackupPath, serializeBackupOperation, pruneBackups } from './backupService.js';

const tables = {
  browser_state: ['organization_id', 'owner_key', 'key', 'value'],
  history_events: ['id', 'organization_id', 'entity_type', 'collection_id', 'entity_id', 'entity_label', 'entity_label_field_id', 'action', 'before_values', 'after_values', 'actor_id', 'actor_name', 'source', 'mutation_id', 'created_at'],
  organization_members: ['organization_id', 'user_id'],
  roles: ['id', 'organization_id', 'name', 'description', 'is_system'],
  permissions: ['id', 'organization_id', 'role_id', 'collection_id', 'item_id', 'field_id', 'can_read', 'can_write', 'can_delete', 'can_manage_fields', 'can_manage_views', 'can_manage_permissions'],
  user_roles: ['organization_id', 'user_id', 'role_id'],
  plugin_configs: ['organization_id', 'plugin_id', 'enabled', 'config', 'created_at', 'updated_at'],
  automations: ['id', 'organization_id', 'name', 'enabled', 'trigger_data', 'actions_data', 'nodes_data', 'edges_data', 'created_at', 'updated_at'],
  automation_runs: ['id', 'organization_id', 'automation_id', 'status', 'details', 'created_at'],
  pdf_plugin_saved_pdfs: ['id', 'organization_id', 'collection_id', 'item_id', 'template_id', 'storage_key', 'values', 'created_at', 'updated_at'],
  steam_public_bundles: ['id', 'organization_id', 'bundle_id', 'snapshot', 'updated_at'],
};
const jsonColumns = new Set(['config', 'trigger_data', 'actions_data', 'nodes_data', 'edges_data', 'details', 'values', 'snapshot', 'before_values', 'after_values']);
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const exists = file => fs.lstat(file).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });

async function organizationPdfFiles(root, organizationId) {
  const files = [];
  for (const directory of pdfDirectories) {
    const folder = path.join(root, directory);
    const entries = await fs.readdir(folder).catch(error => { if (error.code !== 'ENOENT') throw error; return []; });
    for (const filename of entries.filter(name => name.endsWith('.meta.json'))) {
      const metaFile = path.join(folder, filename);
      if (!(await fs.lstat(metaFile)).isFile()) throw new Error('Métadonnées PDF invalides.');
      const meta = JSON.parse(await fs.readFile(metaFile, 'utf8'));
      if (meta.organizationId !== organizationId) continue;
      const pdf = filename.replace(/\.meta\.json$/, '.pdf');
      if (!(await exists(path.join(folder, pdf)))?.isFile()) throw new Error('Un PDF de l’organisation est manquant.');
      files.push(`${directory}/${filename}`, `${directory}/${pdf}`);
    }
  }
  return files;
}

async function createOrganizationBackupInternal(pool, organizationId, label = '', { prune = true } = {}) {
  if (!isUuid(organizationId)) throw new Error('Organisation invalide.');
  const directory = await getBackupDirectory();
  const staging = await fs.mkdtemp(path.join(directory, '.org-backup-'));
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const organization = (await client.query('SELECT id, name, accent_color FROM organizations WHERE id=$1', [organizationId])).rows[0];
    if (!organization) throw new Error('Organisation introuvable.');
    const snapshot = { version: 1, scope: 'organization', organizationId, organization, tables: {} };
    for (const table of [...Object.keys(tables), 'app_state']) {
      snapshot.tables[table] = (await client.query(`SELECT * FROM ${table} WHERE organization_id=$1`, [organizationId])).rows;
    }
    await client.query('COMMIT');
    // Global account records and credentials are deliberately absent from organization backups.
    await fs.writeFile(path.join(staging, 'organization.json'), JSON.stringify(snapshot), { mode: 0o600 });
    for (const subdirectory of pdfDirectories) await fs.mkdir(path.join(staging, 'pdf', subdirectory), { recursive: true });
    for (const relative of await organizationPdfFiles(PDF_STORAGE_DIR, organizationId)) {
      await fs.copyFile(path.join(PDF_STORAGE_DIR, relative), path.join(staging, 'pdf', relative));
    }
    const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 60);
    const name = `org-backup-${organizationId}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}${safeLabel ? `-${safeLabel}` : ''}.tar`;
    const file = path.join(directory, name);
    await createBackupArchive(staging, file, 'organization.json', { scope: 'organization', organizationId });
    if (prune) await pruneBackups();
    const stat = await fs.stat(file);
    return { name, ...backupScope(name), size: stat.size, createdAt: stat.mtime };
  } catch (error) {
    await client?.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client?.release();
    await fs.rm(staging, { recursive: true, force: true });
  }
}

export const createOrganizationBackup = ({ pool, organizationId, label }) => serializeBackupOperation(
  () => createOrganizationBackupInternal(pool, organizationId, label)
);

export const restoreOrganizationBackup = ({ pool, name, organizationId, actorUserId }) => serializeBackupOperation(async () => {
  if (!isUuid(organizationId) || backupScope(name).organizationId !== organizationId) throw new Error('Cette sauvegarde appartient à une autre organisation.');
  const file = resolveBackupPath(name);
  if (!file || !(await fs.lstat(file)).isFile()) throw new Error('Sauvegarde introuvable.');
  await fs.mkdir(PDF_STORAGE_DIR, { recursive: true });
  const staging = await fs.mkdtemp(path.join(PDF_STORAGE_DIR, '.org-restore-'));
  let client; let transaction = false; let preserveStaging = false;
  const moved = []; const installed = [];
  try {
    const manifest = await extractBackupArchive(file, staging, 'organization.json', { requireManifest: true });
    const snapshot = JSON.parse(await fs.readFile(path.join(staging, 'organization.json'), 'utf8'));
    if (manifest.scope !== 'organization' || manifest.organizationId !== organizationId || snapshot.scope !== 'organization' ||
        snapshot.version !== 1 || snapshot.organizationId !== organizationId || snapshot.organization?.id !== organizationId) throw new Error('Périmètre de sauvegarde incompatible.');
    snapshot.tables.browser_state ??= []; // Archives created before database-backed UI state.
    snapshot.tables.history_events ??= []; // Archives created before item and collection history.
    snapshot.tables.automation_runs ??= []; // Archives created before execution history.
    snapshot.tables.automations = (snapshot.tables.automations || []).map(row => ({ ...row, nodes_data: row.nodes_data || [], edges_data: row.edges_data || [] }));
    for (const table of [...Object.keys(tables), 'app_state']) {
      if (!Array.isArray(snapshot.tables?.[table]) || snapshot.tables[table].some(row => row.organization_id !== organizationId)) throw new Error('Données de sauvegarde hors organisation.');
    }
    if (snapshot.tables.app_state.length > 1) throw new Error('État de l’organisation invalide.');
    const restoredState = snapshot.tables.app_state[0]?.data || JSON.stringify({ collections: [], views: {}, dashboards: [] });
    if (!Array.isArray(JSON.parse(restoredState).collections)) throw new Error('État de l’organisation invalide.');
    const incoming = await organizationPdfFiles(path.join(staging, 'pdf'), organizationId);
    const allFiles = (await bundlePdfFiles(staging)).map(file => file.slice(4)).sort();
    if (JSON.stringify([...incoming].sort()) !== JSON.stringify(allFiles)) throw new Error('PDF hors organisation dans la sauvegarde.');
    const current = await organizationPdfFiles(PDF_STORAGE_DIR, organizationId);
    const owned = new Set(current);
    for (const relative of incoming) {
      if (await exists(path.join(PDF_STORAGE_DIR, relative)) && !owned.has(relative)) throw new Error('Un fichier PDF appartient déjà à une autre organisation.');
    }
    await createOrganizationBackupInternal(pool, organizationId, 'pre-restore', { prune: false });
    client = await pool.connect();
    await client.query('BEGIN'); transaction = true;
    const organization = await client.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE', [organizationId]);
    if (!organization.rowCount) throw new Error('Organisation introuvable.');
    const users = new Set((await client.query('SELECT id FROM users')).rows.map(user => user.id));
    if (!users.has(actorUserId)) throw new Error('Compte administrateur introuvable.');
    for (const table of ['browser_state', 'history_events', 'permissions', 'user_roles', 'roles', 'organization_members', 'plugin_configs', 'automation_runs', 'automations', 'pdf_plugin_saved_pdfs', 'steam_public_bundles']) {
      await client.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    }
    for (const [table, columns] of Object.entries(tables)) {
      for (const row of snapshot.tables[table]) {
        if (row.user_id && !users.has(row.user_id)) continue;
        const safeRow = table === 'history_events' && row.actor_id && !users.has(row.actor_id) ? { ...row, actor_id: null } : row;
        const values = columns.map(column => jsonColumns.has(column) ? JSON.stringify(safeRow[column] ?? null) : safeRow[column] ?? null);
        await client.query(`INSERT INTO ${table} (${columns.map(column => `"${column}"`).join(',')}) VALUES (${values.map((_, index) => `$${index + 1}`).join(',')})`, values);
      }
    }
    await client.query('UPDATE organizations SET name=$2, accent_color=$3 WHERE id=$1', [organizationId, snapshot.organization.name, snapshot.organization.accent_color || null]);
    await client.query(`INSERT INTO app_state (organization_id,user_id,data) VALUES ($1,$2,$3)
      ON CONFLICT (organization_id) DO UPDATE SET data=EXCLUDED.data, user_id=EXCLUDED.user_id, version=app_state.version+1`, [organizationId, actorUserId, restoredState]);
    // The admin initiating recovery keeps their membership and administrative access.
    await client.query('INSERT INTO organization_members (organization_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [organizationId, actorUserId]);
    let admin = (await client.query("SELECT id FROM roles WHERE organization_id=$1 AND name='admin'", [organizationId])).rows[0];
    if (!admin) {
      admin = { id: randomUUID() };
      await client.query("INSERT INTO roles (id,organization_id,name,is_system) VALUES ($1,$2,'admin',true)", [admin.id, organizationId]);
    }
    await client.query('INSERT INTO user_roles (organization_id,user_id,role_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [organizationId, actorUserId, admin.id]);
    for (const relative of current) {
      const previous = path.join(staging, 'previous', relative);
      await fs.mkdir(path.dirname(previous), { recursive: true });
      await fs.rename(path.join(PDF_STORAGE_DIR, relative), previous);
      moved.push(relative);
    }
    for (const relative of incoming) {
      await fs.mkdir(path.dirname(path.join(PDF_STORAGE_DIR, relative)), { recursive: true });
      await fs.rename(path.join(staging, 'pdf', relative), path.join(PDF_STORAGE_DIR, relative));
      installed.push(relative);
    }
    await client.query('COMMIT'); transaction = false;
  } catch (error) {
    let databaseRollbackError;
    if (transaction) {
      try { await client.query('ROLLBACK'); }
      catch (rollbackError) { databaseRollbackError = rollbackError; preserveStaging = true; }
    }
    try {
      for (const relative of installed.reverse()) await fs.rm(path.join(PDF_STORAGE_DIR, relative), { force: true });
      for (const relative of moved.reverse()) await fs.rename(path.join(staging, 'previous', relative), path.join(PDF_STORAGE_DIR, relative));
    } catch (rollbackError) {
      preserveStaging = true;
      throw new AggregateError([error, rollbackError], `Échec de récupération PDF. Fichiers conservés dans ${staging}`, { cause: rollbackError });
    }
    if (databaseRollbackError) throw new AggregateError([error, databaseRollbackError], `Vérifiez la base. Fichiers de récupération conservés dans ${staging}`, { cause: error });
    throw error;
  } finally {
    client?.release();
    if (!preserveStaging) await fs.rm(staging, { recursive: true, force: true });
  }
});
