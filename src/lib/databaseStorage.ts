import { legacyStorageScope } from '../../shared/legacyStorageScope.js';
/** PostgreSQL is authoritative; these maps only live for the current session. */
const API = import.meta.env.VITE_API_URL || '/api';
let context = '';
let preferenceTag: string | null = null;
let values = new Map<string, string>();
let confirmed = new Map<string, string>();
let pending = new Map<string, string | null>();
let sending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> | undefined;
let generation = 0;
let mutation = 0;
let revision = 0;
let businessPending = false;
export const hasUnsavedDatabaseChanges = () => pending.size > 0 || sending.size > 0 || businessPending;
export const isDatabaseStorageReady = () => Boolean(context);
export function setBusinessPersistencePending(value: boolean) { if (businessPending !== value) { businessPending = value; notify(); } }
const listeners = new Set<() => void>();
let legacyClaims: Record<string, string> = {};
function notify() { revision++; for (const listener of listeners) listener(); }
export const subscribeDatabaseStorage = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const databaseStorageRevision = () => revision;
export const getLegacyClaims = () => legacyClaims;
export const getDraftRecoveries = () => [...values].filter(([key]) => key.startsWith('erp-draft-recovery:')).flatMap(([key, value]) => {
  try { return [{ key, ...JSON.parse(value) }]; } catch { return []; }
});
function accept(entries: Record<string, string | null>, remote = false, partial = false, preferencesOnly = false) {
  const changed: string[] = [];
  const keys = partial ? Object.keys(entries) : [...new Set([...values.keys(), ...Object.keys(entries)])].filter(key => !preferencesOnly || !key.startsWith('erp-item-versions:'));
  for (const key of keys) {
    const next = entries[key] ?? undefined;
    if (next === undefined) confirmed.delete(key); else confirmed.set(key, next);
    if (pending.has(key) || sending.has(key)) continue;
    if (values.get(key) === next) continue;
    if (next === undefined) values.delete(key); else values.set(key, next);
    changed.push(key);
  }
  if (changed.length) {
    notify();
    if (remote && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('erp-database-state-changed', { detail: { keys: changed } }));
      if (changed.some(key => key.startsWith('erp-item-versions:'))) window.dispatchEvent(new Event('erp-item-history-changed'));
      for (const key of changed) {
        if (typeof StorageEvent !== 'undefined') window.dispatchEvent(new StorageEvent('storage', { key, newValue: values.get(key) ?? null }));
        window.dispatchEvent(new CustomEvent('erp:grouping-selection-change', { detail: { key, value: values.get(key) ?? null } }));
      }
    }
  }
}
function reportFailure() {
  window.dispatchEvent(new CustomEvent('erp-persistence-error', { detail: 'Sauvegarde en base impossible. Les modifications restent dans cet onglet et seront réessayées.' }));
}
const organization = () => context.split('/')[1];
export async function flushDatabaseStorage(): Promise<void> {
  if (saving) { await saving; if (pending.size) return flushDatabaseStorage(); return; }
  if (!context || !pending.size) return;
  const batch = new Map(pending);
  const currentGeneration = generation;
  const organizationId = organization();
  const expected = Object.fromEntries([...batch.keys()].map(key => [key, confirmed.get(key) ?? null]));
  pending.clear();
  sending = new Set(batch.keys());
  saving = (async () => {
    try {
      const body = JSON.stringify({ entries: Object.fromEntries(batch), expected, organizationId, delta: true, userId: context.split('/')[0] });
      const response = await fetch(`${API}/browser-state`, {
        method: 'PATCH', credentials: 'include', keepalive: new TextEncoder().encode(body).length < 60000, signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!response.ok) throw new Error('Database save failed');
      const data = await response.json();
      if (currentGeneration !== generation) return;
      sending.clear();
      if (data.entries) accept(data.entries, true, data.partial === true);
      else for (const [key, value] of batch) { if (value === null) confirmed.delete(key); else confirmed.set(key, value); }
      if (!pending.size) window.dispatchEvent(new Event('erp-persistence-saved'));
    } catch (error) {
      if (currentGeneration === generation) {
        sending.clear();
        for (const [key, value] of batch) if (!pending.has(key)) pending.set(key, value);
        reportFailure();
        timer = setTimeout(() => { void flushDatabaseStorage().catch(() => {}); }, 5000);
      }
      throw error;
    }
  })();
  try { await saving; } finally { saving = undefined; if (currentGeneration === generation) notify(); }
}
export function clearDatabaseStorage() {
  generation++; mutation++; preferenceTag = null;
  businessPending = false;
  context = ''; values = new Map(); confirmed = new Map(); pending = new Map(); sending = new Set(); legacyClaims = {};
  clearTimeout(timer); notify();
}
async function importEntries(entries: Record<string, string>, claimUnscoped = false) {
  if (!Object.keys(entries).length) return;
  const ownGeneration = generation;
  const result = await fetch(`${API}/browser-state/import`, {
    method: 'POST', credentials: 'include', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries, organizationId: organization(), userId: context.split('/')[0], delta: true, claimUnscoped }),
  });
  if (!result.ok) throw new Error('Legacy import failed');
  const saved = await result.json();
  if (ownGeneration !== generation) throw new Error('Session changed during import');
  accept(saved.entries, true, saved.partial === true);
  for (const key of saved.importedKeys) {
    const importedValue = entries[key];
    delete legacyClaims[key];
    try { if (window.localStorage.getItem(key) === importedValue) window.localStorage.removeItem(key); } catch { /* Keep acknowledged originals when cleanup is blocked. */ }
  }
  notify();
}
export async function claimLegacyStorage() {
  await flushDatabaseStorage();
  await importEntries(legacyClaims, true);
}
export async function initializeDatabaseStorage(userId: string, organizationId: string) {
  if (context === `${userId}/${organizationId}`) return;
  const startedGeneration = generation;
  await flushDatabaseStorage();
  const response = await fetch(`${API}/browser-state?scope=preferences&initialize=1&organizationId=${encodeURIComponent(organizationId)}`, { credentials: 'include', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Impossible de charger les préférences et brouillons');
  const data = await response.json();
  if (startedGeneration !== generation) throw new Error('Session changed during hydration');
  if ((data.userId && data.userId !== userId) || (data.organizationId && data.organizationId !== organizationId)) throw new Error('Session changed during hydration');
  clearDatabaseStorage();
  context = `${userId}/${organizationId}`;
  const ownGeneration = generation;
  preferenceTag = response.headers?.get('ETag') ?? null;
  accept(data.entries, false, false, true);
  const owned: Record<string, string> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const scope = legacyStorageScope(key, userId, organizationId);
      if (scope === 'foreign') continue;
      const value = window.localStorage.getItem(key);
      if (value !== null) (scope === 'owned' ? owned : legacyClaims)[key] = value;
    }
  } catch { /* Database persistence works with browser storage disabled. */ }
  try { await importEntries(owned); notify(); }
  catch (error) { if (ownGeneration === generation) clearDatabaseStorage(); throw error; }
}
export async function refreshDatabaseStorage() {
  if (!context || pending.size || saving) return;
  const currentGeneration = generation;
  const currentMutation = mutation;
  const response = await fetch(`${API}/browser-state?scope=preferences&organizationId=${encodeURIComponent(organization())}`, { headers: preferenceTag ? { 'If-None-Match': preferenceTag } : {}, credentials: 'include', signal: AbortSignal.timeout(15000) });
  if (!response.ok) return; // Session recovery is handled by AuthProvider.
  const data = await response.json();
  if (generation !== currentGeneration || mutation !== currentMutation || saving) return;
  if (data.userId && data.userId !== context.split('/')[0]) return;
  preferenceTag = response.headers?.get('ETag') ?? null;
  accept(data.entries, true, false, true);
}
/** Load large histories only when the corresponding fiche is opened. */
export async function loadDatabaseKeys(keys: string[]) {
  if (!context) return;
  const requested = keys.filter(key => !pending.has(key) && !sending.has(key));
  if (!requested.length) return;
  const currentGeneration = generation;
  const initialValues = new Map(requested.map(key => [key, values.get(key)]));
  const response = await fetch(`${API}/browser-state?organizationId=${encodeURIComponent(organization())}&keys=${encodeURIComponent(JSON.stringify(requested))}`, { credentials: 'include', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Chargement de l’historique impossible');
  const data = await response.json();
  if (generation !== currentGeneration) return;
  const entries = Object.fromEntries(requested.filter(key => !pending.has(key) && !sending.has(key) && values.get(key) === initialValues.get(key)).map(key => [key, data.entries[key] ?? null]));
  accept(entries, true, true);
}
export function monitorDatabaseStorage() {
  const refresh = () => { if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void refreshDatabaseStorage().catch(() => {}); };
  const interval = window.setInterval(refresh, 10000);
  const online = () => { void flushDatabaseStorage().then(refresh).catch(() => {}); };
  window.addEventListener('focus', refresh);
  window.addEventListener('online', online);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', refresh);
  return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); window.removeEventListener('online', online); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', refresh); };
}
function schedule() { clearTimeout(timer); timer = setTimeout(() => { void flushDatabaseStorage().catch(() => {}); }, 150); }
export const databaseStorage = {
  getItem(key: string): string | null { return values.get(key) ?? null; },
  setItem(key: string, value: string) {
    if (!context || values.get(key) === value) return;
    mutation++; values.set(key, value); pending.set(key, value); notify(); schedule();
  },
  removeItem(key: string) {
    if (!context) return;
    mutation++; values.delete(key); pending.set(key, null); notify(); schedule();
  },
};
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void flushDatabaseStorage().catch(() => {}); });
  window.addEventListener('beforeunload', event => { if (pending.size || saving) { event.preventDefault(); event.returnValue = ''; } });
}
