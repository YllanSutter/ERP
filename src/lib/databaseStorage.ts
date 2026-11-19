/** Database-backed persistence. The map is only a synchronous cache for mounted UI. */
const API = import.meta.env.VITE_API_URL || '/api';
let context = '';
let values = new Map<string, string>();
let pending = new Map<string, string | null>();
let timer: ReturnType<typeof setTimeout> | undefined;
let saving: Promise<void> | undefined;
let generation = 0;

function reportFailure() {
  window.dispatchEvent(new CustomEvent('erp-persistence-error', {
    detail: 'Sauvegarde en base impossible. Les modifications restent dans cet onglet et seront réessayées.',
  }));
}

export async function flushDatabaseStorage(): Promise<void> {
  if (saving) { await saving; if (pending.size) return flushDatabaseStorage(); return; }
  if (!context || !pending.size) return;
  const batch = new Map(pending);
  const currentGeneration = generation;
  pending.clear();
  saving = (async () => {
    try {
      const response = await fetch(`${API}/browser-state`, {
        method: 'PATCH', credentials: 'include', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: Object.fromEntries(batch), organizationId: context.split('/')[1] }),
      });
      if (!response.ok) throw new Error('Database save failed');
      if (currentGeneration === generation && !pending.size) window.dispatchEvent(new Event('erp-persistence-saved'));
    } catch (error) {
      if (currentGeneration === generation) {
        for (const [key, value] of batch) if (!pending.has(key)) pending.set(key, value);
        reportFailure();
        timer = setTimeout(() => { void flushDatabaseStorage().catch(() => {}); }, 5000);
      }
      throw error;
    }
  })();
  try { await saving; } finally { saving = undefined; }
}

export function clearDatabaseStorage() {
  generation++;
  context = '';
  values = new Map();
  pending = new Map();
  clearTimeout(timer);
}

export async function initializeDatabaseStorage(userId: string, organizationId: string) {
  const next = `${userId}/${organizationId}`;
  if (context === next) return;
  const startedGeneration = generation;
  await flushDatabaseStorage();
  const response = await fetch(`${API}/browser-state`, { credentials: 'include' });
  if (!response.ok) throw new Error('Impossible de charger les préférences et brouillons');
  const data = await response.json();
  if (startedGeneration !== generation) throw new Error('Session changed during hydration');
  clearDatabaseStorage();
  const ownGeneration = generation;
  context = next;
  values = new Map(Object.entries(data.entries));
  // Legacy values are imported only when the database has no value. Keep local
  // originals until the server has acknowledged the complete import.
  const imported: [string, string][] = [];
  try {
    try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !/^(erp[-_:]|calendarViewMode)/.test(key)) continue;
      const value = window.localStorage.getItem(key);
      if (value === null) continue;
      imported.push([key, value]);
    }
    } catch {
      // Database persistence also works when browser storage is disabled.
      imported.length = 0;
    }
    if (imported.length) {
      const result = await fetch(`${API}/browser-state/import`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: Object.fromEntries(imported), organizationId }),
      });
      if (!result.ok) throw new Error('Legacy import failed');
      const saved = await result.json();
      if (ownGeneration !== generation) throw new Error('Session changed during import');
      values = new Map(Object.entries(saved.entries));
      try {
        for (const [key, value] of imported) if (saved.importedKeys.includes(key) && window.localStorage.getItem(key) === value) window.localStorage.removeItem(key);
      } catch { /* Acknowledged database values remain usable if cleanup is blocked. */ }
    }
  } catch (error) {
    if (ownGeneration === generation) clearDatabaseStorage();
    throw error;
  }
}

export const databaseStorage = {
  getItem(key: string): string | null { return values.get(key) ?? null; },
  setItem(key: string, value: string) {
    if (!context) return;
    if (values.get(key) === value) return;
    values.set(key, value);
    pending.set(key, value);
    clearTimeout(timer);
    timer = setTimeout(() => { void flushDatabaseStorage().catch(() => {}); }, 150);
  },
  removeItem(key: string) {
    if (!context) return;
    values.delete(key);
    pending.set(key, null);
    clearTimeout(timer);
    timer = setTimeout(() => { void flushDatabaseStorage().catch(() => {}); }, 150);
  },
};
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void flushDatabaseStorage().catch(() => {}); });
  window.addEventListener('pagehide', () => { void flushDatabaseStorage().catch(() => {}); });
}
