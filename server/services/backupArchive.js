import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
export const pdfDirectories = ['templates', 'saved'];
const checksum = async (file) => createHash('sha256').update(await fs.readFile(file)).digest('hex');
export async function bundlePdfFiles(staging) {
  const files = [];
  for (const directory of pdfDirectories) {
    const entries = await fs.readdir(path.join(staging, 'pdf', directory), { withFileTypes: true });
    if (entries.some(entry => !entry.isFile())) throw new Error('Invalid backup PDF file');
    for (const entry of entries) files.push(`pdf/${directory}/${entry.name}`);
  }
  return files;
}
export async function createBackupArchive(staging, destination, rootFile, metadata) {
  const files = {};
  for (const relative of [rootFile, ...await bundlePdfFiles(staging)]) files[relative] = await checksum(path.join(staging, relative));
  await fs.writeFile(path.join(staging, 'manifest.json'), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), ...metadata, files }));
  const archive = path.join(staging, 'backup.tar');
  await exec('tar', ['-cf', archive, '-C', staging, rootFile, 'pdf', 'manifest.json']);
  await fs.chmod(archive, 0o600);
  await fs.rename(archive, destination);
}
export async function extractBackupArchive(file, staging, rootFile, { requireManifest = false } = {}) {
  const { stdout: listing } = await exec('tar', ['-tf', file]);
  const entries = listing.trim().split('\n');
  if (entries.some(entry => entry.startsWith('/') || entry.split('/').includes('..') ||
      !(entry === rootFile || entry === 'manifest.json' || /^(pdf\/?|pdf\/(templates|saved)(\/[^/]+)?\/?)$/.test(entry)))) throw new Error('Archive de sauvegarde invalide.');
  const { stdout: types } = await exec('tar', ['-tvf', file]);
  if (types.trim().split('\n').some(line => !['-', 'd'].includes(line[0]))) throw new Error('Archive contenant des liens non autorisés.');
  await exec('tar', ['-xf', file, '-C', staging]);
  if (!(await fs.lstat(path.join(staging, rootFile))).isFile()) throw new Error('Sauvegarde invalide.');
  const expected = [rootFile, ...await bundlePdfFiles(staging)].sort();
  const manifestPath = path.join(staging, 'manifest.json');
  const exists = await fs.stat(manifestPath).catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (!exists) {
    if (requireManifest) throw new Error('Manifeste de sauvegarde absent.');
    return null;
  }
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (manifest.version !== 1) throw new Error('Version de sauvegarde non prise en charge.');
  if (JSON.stringify(Object.keys(manifest.files || {}).sort()) !== JSON.stringify(expected)) throw new Error('Sauvegarde incomplète.');
  for (const relative of expected) {
    if (await checksum(path.join(staging, relative)) !== manifest.files[relative]) throw new Error('Sauvegarde corrompue.');
  }
  return manifest;
}
