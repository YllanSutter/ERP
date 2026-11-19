import { useSyncExternalStore } from 'react';
import { hasUnsavedDatabaseChanges, subscribeDatabaseStorage } from '@/lib/databaseStorage';
export function SessionPersistenceNotice() {
  const unsaved = useSyncExternalStore(subscribeDatabaseStorage, hasUnsavedDatabaseChanges, () => false);
  return <div role="alert" className="bg-amber-100 p-4 text-center text-amber-950">
    <p>Votre session a expiré. Reconnectez-vous avec le même compte pour continuer.</p>
    <p>Les données déjà enregistrées sont conservées en base.</p>
    {unsaved && <p>Des modifications attendent encore leur sauvegarde. Gardez cet onglet ouvert et ne rechargez pas la page avant de vous reconnecter.</p>}
  </div>;
}
