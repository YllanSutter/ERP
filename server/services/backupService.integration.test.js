import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { bootstrapDatabase } from './dbBootstrap.js';
const exec = promisify(execFile);

test('PostgreSQL backup/restore preserves data, upgrades old schemas and rolls back failures', { skip: process.env.RUN_BACKUP_INTEGRATION !== '1' }, async (t) => {
  // Always create our own cluster. Never consume the application's database environment.
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'erp-backup-integration-'));
  const data = path.join(root, 'pgdata');
  let started = false; let pool;
  try {
    await exec('initdb', ['-D', data, '-U', 'backup_test', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
    await exec('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-k ${root} -p 55440 -c listen_addresses=''`, '-w', 'start']);
    started = true;
    Object.assign(process.env, { DATABASE_PUBLIC_URL: '', PGHOST: root, PGPORT: '55440', PGUSER: 'backup_test', PGDATABASE: 'postgres', BACKUP_DIR: path.join(root, 'backups'), PDF_PLUGIN_STORAGE_DIR: path.join(root, 'pdf'), BACKUP_RETENTION_DAYS: '0' });
    pool = new pg.Pool({ host: root, port: 55440, user: 'backup_test', database: 'postgres' });
    const { createDbBackup, restoreDbBackup, listBackups, compatibleRestoreSql } = await import('./backupService.js');
    const bootstrap = () => bootstrapDatabase({ pool, ensureDefaultOrganization: async () => {} });
    await bootstrap();
    await pool.query(`
      INSERT INTO users (id,email,name,provider,password_hash) VALUES ('00000000-0000-0000-0000-000000000001','test@example.invalid','Test','local','test-hash');
      INSERT INTO organizations (id,name,owner_user_id) VALUES ('00000000-0000-0000-0000-000000000002','Test','00000000-0000-0000-0000-000000000001');
      INSERT INTO organization_members VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');
      INSERT INTO roles (id,organization_id,name,is_system) VALUES ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','admin',true);
      INSERT INTO user_roles VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002');
      INSERT INTO app_state (organization_id,data) VALUES ('00000000-0000-0000-0000-000000000002','original');
    `);
    for (const directory of ['templates', 'saved']) await fs.mkdir(path.join(root, 'pdf', directory), { recursive: true });
    const pdf = path.join(root, 'pdf', 'templates', 'example.pdf');
    await fs.writeFile(pdf, '%PDF-original');
    const sqlFile = path.join(root, 'backups', 'legacy.sql');
    const args = ['-h', root, '-p', '55440', '-U', 'backup_test', '-d', 'postgres'];
    const readData = async () => (await pool.query('SELECT data FROM app_state')).rows[0].data;
    const setData = value => pool.query('UPDATE app_state SET data=$1', [value]);
    let snapshot;

    await t.test('creates a complete checksummed SQL and PDF archive and restores it', async () => {
      snapshot = await createDbBackup('verification');
      assert.ok(snapshot.size > 0);
      const file = path.join(root, 'backups', snapshot.name);
      const { stdout } = await exec('tar', ['-tf', file]);
      assert.match(stdout, /manifest.json/); assert.match(stdout, /database.sql/); assert.match(stdout, /example.pdf/);
      await setData('changed'); await fs.writeFile(pdf, '%PDF-changed');
      await restoreDbBackup(snapshot.name);
      assert.equal(await readData(), 'original');
      assert.equal(await fs.readFile(pdf, 'utf8'), '%PDF-original');
      assert.ok((await listBackups()).some(backup => backup.name.includes('pre-restore')));
    });
    await t.test('upgrades missing login columns and plugin tables before committing a legacy SQL restore', async () => {
      await pool.query('ALTER TABLE organizations DROP COLUMN accent_color; ALTER TABLE users DROP COLUMN user_preferences; ALTER TABLE app_state DROP COLUMN version; DROP TABLE steam_public_bundles;');
      await exec('pg_dump', [...args, '--no-owner', '--no-privileges', '--file', sqlFile]);
      await bootstrap(); await setData('current');
      await restoreDbBackup('legacy.sql');
      await pool.query('SELECT user_preferences FROM users; SELECT accent_color FROM organizations; SELECT version FROM app_state; SELECT id FROM steam_public_bundles;');
      assert.equal(await readData(), 'original');
      const user = await pool.query("SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.name='admin'");
      assert.equal(user.rowCount, 1);
    });
    await t.test('restores custom pg_dump archives through the same transactional upgrades', async () => {
      await exec('pg_dump', [...args, '-Fc', '--file', path.join(root, 'backups', 'legacy.dump')]);
      await setData('changed'); await restoreDbBackup('legacy.dump');
      assert.equal(await readData(), 'original');
    });
    await t.test('SQL errors roll back the schema and data instead of leaving an empty database', async () => {
      const sql = await fs.readFile(sqlFile, 'utf8');
      await fs.writeFile(path.join(root, 'backups', 'invalid.sql'), `${sql}\nSELECT 1/0;\n`);
      await setData('must survive');
      await assert.rejects(restoreDbBackup('invalid.sql'));
      assert.equal(await readData(), 'must survive');
      await pool.query('SELECT user_preferences FROM users; SELECT accent_color FROM organizations;');
    });
    await t.test('corrupted files are rejected before changing the database or PDFs', async () => {
      const staging = path.join(root, 'corrupt'); await fs.mkdir(staging);
      await exec('tar', ['-xf', path.join(root, 'backups', snapshot.name), '-C', staging]);
      await fs.writeFile(path.join(staging, 'pdf/templates/example.pdf'), 'corrupted');
      await exec('tar', ['-cf', path.join(root, 'backups', 'corrupt.tar'), '-C', staging, 'database.sql', 'pdf', 'manifest.json']);
      await assert.rejects(restoreDbBackup('corrupt.tar'), /corrompue/);
      assert.equal(await readData(), 'must survive');
      assert.equal(await fs.readFile(pdf, 'utf8'), '%PDF-original');
    });
    await t.test('an SQL failure after PDF installation restores the previous PDFs too', async () => {
      const staging = path.join(root, 'bad-sql'); await fs.mkdir(staging);
      await exec('tar', ['-xf', path.join(root, 'backups', snapshot.name), '-C', staging]);
      await fs.appendFile(path.join(staging, 'database.sql'), '\nSELECT 1/0;\n');
      await exec('tar', ['-cf', path.join(root, 'backups', 'bad-sql.tar'), '-C', staging, 'database.sql', 'pdf']);
      await fs.writeFile(pdf, '%PDF-current');
      await assert.rejects(restoreDbBackup('bad-sql.tar'));
      assert.equal(await readData(), 'must survive');
      assert.equal(await fs.readFile(pdf, 'utf8'), '%PDF-current');
    });
    await t.test('a failed dump does not publish a partial backup', async () => {
      const before = (await listBackups()).map(backup => backup.name);
      process.env.PGHOST = path.join(root, 'no-server');
      try { await assert.rejects(createDbBackup('failure')); } finally { process.env.PGHOST = root; }
      assert.deepEqual((await listBackups()).map(backup => backup.name), before);
      assert.ok(!(await fs.readdir(path.join(root, 'backups'))).some(name => name.startsWith('.backup-')));
    });
    await t.test('organization recovery preserves every row and PDF of other organizations and all global accounts', async () => {
      const { createOrganizationBackup, restoreOrganizationBackup } = await import('./organizationBackupService.js');
      const { ensureSiteCreator, isSiteCreator } = await import('./siteOwnerAccess.js');
      const a = '00000000-0000-0000-0000-000000000002';
      const b = '00000000-0000-0000-0000-000000000004';
      const actor = '00000000-0000-0000-0000-000000000001';
      await ensureSiteCreator(pool);
      await pool.query(`
        INSERT INTO organizations (id,name) VALUES ('${b}','Other organization');
        INSERT INTO app_state (organization_id,data) VALUES ('${b}','{"collections":[],"marker":"B"}');
      `);
      const aState = JSON.stringify({ collections: [], marker: 'A-backup' });
      await setData(aState); // Set the distinct B value again below.
      await pool.query('UPDATE app_state SET data=$1 WHERE organization_id=$2',[JSON.stringify({collections:[],marker:'B'}),b]);
      const aPdf = path.join(root,'pdf','templates','org-a.pdf');
      const bPdf = path.join(root,'pdf','templates','org-b.pdf');
      await fs.writeFile(aPdf,'%PDF-A-backup'); await fs.writeFile(bPdf,'%PDF-B');
      await fs.writeFile(aPdf.replace('.pdf','.meta.json'),JSON.stringify({id:'org-a',organizationId:a}));
      await fs.writeFile(bPdf.replace('.pdf','.meta.json'),JSON.stringify({id:'org-b',organizationId:b}));
      const snapshot = await createOrganizationBackup({pool,organizationId:a,label:'org-test'});
      const staging = path.join(root,'org-inspect'); await fs.mkdir(staging);
      await exec('tar',['-xf',path.join(root,'backups',snapshot.name),'-C',staging]);
      const json = JSON.parse(await fs.readFile(path.join(staging,'organization.json'),'utf8'));
      assert.equal(json.tables.users,undefined);
      assert.ok(!JSON.stringify(json).includes('test-hash'));
      assert.deepEqual((await fs.readdir(path.join(staging,'pdf','templates'))).sort(),['org-a.meta.json','org-a.pdf']);
      await pool.query('UPDATE app_state SET data=$1 WHERE organization_id=$2',[JSON.stringify({collections:[],marker:'A-current'}),a]);
      await fs.writeFile(aPdf,'%PDF-A-current');
      const beforeB = (await pool.query('SELECT * FROM app_state WHERE organization_id=$1',[b])).rows;
      const users = (await pool.query('SELECT * FROM users ORDER BY id')).rows;
      await restoreOrganizationBackup({pool,name:snapshot.name,organizationId:a,actorUserId:actor});
      assert.equal((await pool.query('SELECT data FROM app_state WHERE organization_id=$1',[a])).rows[0].data,aState);
      assert.deepEqual((await pool.query('SELECT * FROM app_state WHERE organization_id=$1',[b])).rows,beforeB);
      assert.deepEqual((await pool.query('SELECT * FROM users ORDER BY id')).rows,users);
      assert.equal(await fs.readFile(aPdf,'utf8'),'%PDF-A-backup');
      assert.equal(await fs.readFile(bPdf,'utf8'),'%PDF-B');
      assert.equal(await isSiteCreator(pool,actor),true);
      await assert.rejects(restoreOrganizationBackup({pool,name:snapshot.name,organizationId:b,actorUserId:actor}),/autre organisation/);
      // Validly packaged but invalid SQL rows must roll back only A as well.
      const { createBackupArchive } = await import('./backupArchive.js');
      const invalidName = `org-backup-${a}-invalid.tar`;
      json.tables.permissions.push({ id:'00000000-0000-0000-0000-000000000099', organization_id:a, role_id:'00000000-0000-0000-0000-000000000098' });
      await fs.writeFile(path.join(staging,'organization.json'),JSON.stringify(json));
      await createBackupArchive(staging,path.join(root,'backups',invalidName),'organization.json',{scope:'organization',organizationId:a});
      await pool.query('UPDATE app_state SET data=$1 WHERE organization_id=$2',[JSON.stringify({collections:[],marker:'keep after failure'}),a]);
      const beforeFailure = (await pool.query('SELECT * FROM app_state ORDER BY id')).rows;
      await assert.rejects(restoreOrganizationBackup({pool,name:invalidName,organizationId:a,actorUserId:actor}));
      assert.deepEqual((await pool.query('SELECT * FROM app_state ORDER BY id')).rows,beforeFailure);
      assert.deepEqual((await pool.query('SELECT * FROM users ORDER BY id')).rows,users);
      // A filesystem error after installing one PDF also rolls back A's SQL and PDFs.
      await fs.writeFile(aPdf,'%PDF-must-survive');
      const rename = fs.rename;
      fs.rename = async (from,to) => {
        if (String(from).includes('.org-restore-') && String(from).endsWith('/pdf/templates/org-a.pdf')) throw new Error('simulated PDF installation failure');
        return rename(from,to);
      };
      try { await assert.rejects(restoreOrganizationBackup({pool,name:snapshot.name,organizationId:a,actorUserId:actor}),/simulated PDF/); }
      finally { fs.rename = rename; }
      assert.deepEqual((await pool.query('SELECT * FROM app_state ORDER BY id')).rows,beforeFailure);
      assert.equal(await fs.readFile(aPdf,'utf8'),'%PDF-must-survive');
      assert.equal(await fs.readFile(bPdf,'utf8'),'%PDF-B');
      // A later imported/created account with an older date cannot take site ownership.
      await pool.query("INSERT INTO users(id,email,created_at) VALUES ('00000000-0000-0000-0000-000000000009','older@example.invalid','2000-01-01')");
      await ensureSiteCreator(pool);
      assert.equal(await isSiteCreator(pool,actor),true);
      assert.equal(await isSiteCreator(pool,'00000000-0000-0000-0000-000000000009'),false);
    });
    await t.test('a scheduled run creates both organization archives and the full database archive', async () => {
      const { createScopedBackupOperations } = await import('./backupScheduler.js');
      const { createOrganizationBackup } = await import('./organizationBackupService.js');
      const operations = createScopedBackupOperations({ pool, listBackups, createDbBackup,
        createOrganizationBackup: (organizationId,label) => createOrganizationBackup({pool,organizationId,label}),
      });
      assert.deepEqual(await operations.listBackups(),[]); // B has no separate backup yet.
      await operations.createBackup('scheduled-check');
      const coverage = await operations.listBackups();
      assert.equal(coverage.length,3);
      assert.equal(coverage.filter(backup=>backup.scope==='database').length,1);
      assert.equal(coverage.filter(backup=>backup.scope==='organization').length,2);
      assert.ok(coverage.every(backup=>backup.name.includes('scheduled-check')));
    });
    await t.test('retention keeps the latest complete backup and the latest backup of each organization', async () => {
      const all = await listBackups();
      const expected = new Map();
      for (const [index,backup] of all.entries()) {
        const group = `${backup.scope}:${backup.organizationId || ''}`;
        if (!expected.has(group)) expected.set(group,backup.name);
        const old = new Date(Date.now()-2*86400000-index*1000);
        await fs.utimes(path.join(root,'backups',backup.name),old,old);
      }
      process.env.BACKUP_RETENTION_DAYS='1';
      const { pruneBackups } = await import('./backupService.js?retention-test');
      await pruneBackups();
      assert.deepEqual((await listBackups()).map(backup=>backup.name).sort(),[...expected.values()].sort());
      process.env.BACKUP_RETENTION_DAYS='0';
    });
    await t.test('the PostgreSQL 17 timeout setting is removed only for older servers', () => {
      const sql = 'SET transaction_timeout = 0;\nSELECT 42;\n';
      assert.equal(compatibleRestoreSql(sql, 150000), 'SELECT 42;\n');
      assert.equal(compatibleRestoreSql(sql, 180000), sql);
    });
  } finally {
    if (pool) await pool.end();
    if (started) await exec('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    await fs.rm(root, { recursive: true, force: true });
  }
});
