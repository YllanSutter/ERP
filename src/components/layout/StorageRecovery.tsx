import { useState } from 'react';
import { claimLegacyStorage, databaseStorage, flushDatabaseStorage, getDraftRecoveries, getLegacyClaims } from '@/lib/databaseStorage';
import { useDatabaseStorageRevision } from '@/lib/hooks/useDatabaseStorage';

function recoveryLabel(recovery: { value: string; origin?: string }) {
  const origin = recovery.origin === 'legacy-import' ? 'Import du navigateur' : recovery.origin === 'before-restore' ? 'Version avant restauration' : 'Modification concurrente';
  try {
    const draft = JSON.parse(recovery.value);
    const title = draft.formData?.title || draft.formData?.name;
    return typeof title === 'string' && title ? `${origin} — ${title.slice(0, 100)}` : origin;
  } catch { return origin; }
}

export function StorageRecovery({ account, organization }: { account: string; organization: string }) {
  useDatabaseStorageRevision();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const claims = Object.keys(getLegacyClaims()).length;
  const recoveries = getDraftRecoveries();
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); }
    catch { setMessage('La récupération a échoué. Vos données sont conservées ; réessayez.'); }
    finally { setBusy(false); }
  };
  if (!claims && !recoveries.length && !message) return null;
  return <aside aria-label="Récupération des données" className="fixed bottom-4 right-4 z-[100] max-h-[70vh] w-[min(34rem,calc(100vw-2rem))] overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 shadow-lg">
    <details>
      <summary className="cursor-pointer font-medium">Données à récupérer : {claims ? `${claims} ancienne(s) sauvegarde(s)` : ''}{claims && recoveries.length ? ' · ' : ''}{recoveries.length ? `${recoveries.length} brouillon(s) en conflit` : ''}</summary>
      {claims > 0 && <div className="mt-3 space-y-2">
        <p>Ces anciennes sauvegardes de ce navigateur n’indiquent pas leur propriétaire. Importez-les uniquement si elles vous appartiennent et concernent cette organisation.</p>
        <p>Destination : <strong>{account}</strong> · <strong>{organization}</strong>. Les versions différentes des brouillons seront conservées séparément.</p>
        <button type="button" disabled={busy} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => void run(claimLegacyStorage)}>Ces données m’appartiennent : importer ici</button>
      </div>}
      {recoveries.length > 0 && <div className="mt-3 space-y-2">
        <p>Ces versions n’ont pas remplacé vos brouillons en base. Après restauration, fermez puis rouvrez la fiche pour reprendre le brouillon. La version remplacée sera elle aussi conservée ici.</p>
        {recoveries.map(recovery => <div key={recovery.key} className="flex flex-wrap items-center gap-3">
          <span>{recoveryLabel(recovery)} · Collection {String(recovery.draftKey).split(':')[1]} · {new Date(recovery.createdAt).toLocaleString('fr-FR')}</span>
          <button type="button" disabled={busy} className="rounded border px-3 py-1 disabled:opacity-50" onClick={() => void run(async () => {
            await flushDatabaseStorage();
            const current = databaseStorage.getItem(recovery.draftKey);
            if (current && current !== recovery.value) databaseStorage.setItem(`erp-draft-recovery:${crypto.randomUUID()}`, JSON.stringify({ draftKey: recovery.draftKey, value: current, origin: 'before-restore', createdAt: new Date().toISOString() }));
            databaseStorage.setItem(recovery.draftKey, recovery.value);
            // Keep the recovery copy until the canonical write has been acknowledged.
            await flushDatabaseStorage();
            if (databaseStorage.getItem(recovery.draftKey) !== recovery.value) throw new Error('Concurrent draft');
            databaseStorage.removeItem(recovery.key);
            await flushDatabaseStorage();
            setMessage('Brouillon restauré. Fermez puis rouvrez la fiche pour le reprendre.');
          })}>Restaurer cette version</button>
        </div>)}
      </div>}
    </details>
    {message && <p role="status" className="mt-2">{message}</p>}
  </aside>;
}
