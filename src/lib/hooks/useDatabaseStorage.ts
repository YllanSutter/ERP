import { useEffect, useSyncExternalStore } from 'react';
import { databaseStorage, databaseStorageRevision, subscribeDatabaseStorage } from '../databaseStorage';
export function useDatabaseStorageRevision() {
  return useSyncExternalStore(subscribeDatabaseStorage, databaseStorageRevision, databaseStorageRevision);
}
export function useDatabaseStorageValue(key: string) {
  return useSyncExternalStore(subscribeDatabaseStorage, () => databaseStorage.getItem(key), () => null);
}

export function useRemoteStorage(keys: string[], apply: () => void) {
  useEffect(() => {
    const sync = (event: Event) => {
      const changed: string[] = (event as CustomEvent).detail?.keys || [];
      if (keys.some(key => changed.includes(key))) apply();
    };
    window.addEventListener('erp-database-state-changed', sync);
    return () => window.removeEventListener('erp-database-state-changed', sync);
  }, [keys, apply]);
}
