import { v4 as uuidv4 } from 'uuid';
import { buildItemChanges, applyItemChanges, isSyncableItemField } from '../../shared/itemChanges.js';
import { useEffect, useRef, useState } from 'react';
import { SaveQueue, SaveConflictError, SaveTooLargeError, type SaveStatus } from './saveQueue';
import { mergeSavedCollections } from './mergeSavedCollections';
import { cleanForSave } from '@/lib/utils/cleanUtils';

// Types minimalistes pour éviter les erreurs TS
type Collection = { id: string; items?: any[]; [key: string]: any };
type ItemConflict = { collectionId: string; itemId: string; key: string; current?: unknown };
type DisplayConflict = ItemConflict & { proposed?: unknown };
type ViewMap = Record<string, any[]>;
type DashboardSort = 'created' | 'name-asc' | 'name-desc';
type Dashboard = any;
type Favorites = { views: string[]; items: string[] };

interface UseErpSyncParams {
  collections: Collection[];
  views: ViewMap;
  dashboards: Dashboard[];
  dashboardSort: DashboardSort;
  dashboardFilters: Record<string, any[]>;
  favorites: Favorites;
  isLoaded: boolean;
  user: any;
  organizationId: string | null;
  canEdit: boolean;
  setCollections: (c: Collection[] | ((prev: Collection[]) => Collection[])) => void;
  setViews: (v: ViewMap) => void;
  setDashboards: (d: Dashboard[]) => void;
  setDashboardSort: React.Dispatch<React.SetStateAction<DashboardSort>>;
  setDashboardFilters: (f: Record<string, any[]>) => void;
  setFavorites: (f: Favorites) => void;
  setIsLoaded: (b: boolean) => void;
  API_URL: string;
  socket: any;
}

// Calcule un diff entre deux snapshots de collections :
// Retourne la liste des { collectionId, itemId, fields } qui ont changé.
function diffCollectionsItems(
  prev: Collection[],
  next: Collection[]
): Array<{ collectionId: string; itemId: string; fields: Record<string, any> }> {
  const patches: Array<{ collectionId: string; itemId: string; fields: Record<string, any> }> = [];
  const prevMap = new Map(prev.map((c) => [c.id, c]));

  for (const col of next) {
    const prevCol = prevMap.get(col.id);
    if (!prevCol) continue; // nouvelle collection -> POST complet
    if (!col.items) continue;
    const prevItemsMap = new Map((prevCol.items || []).map((i: any) => [i.id, i]));

    for (const item of col.items) {
      const prevItem = prevItemsMap.get(item.id);
      if (!prevItem) continue; // nouvel item -> POST complet
      const changedFields: Record<string, any> = {};
      for (const key of Object.keys(item)) {
        if (!isSyncableItemField(key)) continue;
        if (JSON.stringify(item[key]) !== JSON.stringify(prevItem[key])) {
          changedFields[key] = item[key];
        }
      }
      if (Object.keys(changedFields).length > 0) {
        patches.push({ collectionId: col.id, itemId: item.id, fields: changedFields });
      }
    }
  }
  return patches;
}

// Verifie si des items ont ete ajoutes ou supprimes
function hasItemCountChanged(prev: Collection[], next: Collection[]): boolean {
  if (prev.length !== next.length) return true;
  const prevMap = new Map(prev.map((c) => [c.id, (c.items || []).length]));
  for (const col of next) {
    if ((col.items || []).length !== (prevMap.get(col.id) ?? -1)) return true;
  }
  return false;
}

// Verifie si l'ordre des items a change dans une collection.
// Important: le diff PATCH par item ne capture pas les permutations de liste.
function hasItemOrderChanged(prev: Collection[], next: Collection[]): boolean {
  if (prev.length !== next.length) return true;
  const prevMap = new Map(prev.map((c) => [c.id, c]));

  for (const col of next) {
    const prevCol = prevMap.get(col.id);
    if (!prevCol) return true;

    const prevItems = prevCol.items || [];
    const nextItems = col.items || [];
    if (prevItems.length !== nextItems.length) return true;

    for (let i = 0; i < nextItems.length; i += 1) {
      if (prevItems[i]?.id !== nextItems[i]?.id) {
        return true;
      }
    }
  }

  return false;
}

function countItems(collections: Collection[] = []): number {
  return (collections || []).reduce((acc, col) => acc + ((col.items || []).length || 0), 0);
}

// Verifie si la structure (hors contenu des items) a change
function buildStructureSnapshot(
  views: ViewMap,
  dashboards: Dashboard[],
  dashboardSort: string,
  dashboardFilters: any,
  favorites: Favorites,
  collections: Collection[]
): string {
  return JSON.stringify({
    views,
    dashboards,
    dashboardSort,
    dashboardFilters,
    favorites,
    collectionMetas: collections.map(({ items: _i, ...meta }) => meta),
  });
}

export function useErpSync({
  collections,
  views,
  dashboards,
  dashboardSort,
  dashboardFilters,
  favorites,
  isLoaded,
  user,
  organizationId,
  canEdit,
  setCollections,
  setViews,
  setDashboards,
  setDashboardSort,
  setDashboardFilters,
  setFavorites,
  setIsLoaded,
  API_URL,
  socket,
}: UseErpSyncParams) {
  const [itemConflicts, setItemConflicts] = useState<DisplayConflict[]>([]);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading');
  const latestCollectionsRef = useRef(collections);
  latestCollectionsRef.current = collections;
  const saveQueueRef = useRef<SaveQueue | null>(null);
  useEffect(() => {
    const queue = new SaveQueue(setSaveStatus);
    saveQueueRef.current = queue;
    setSaveStatus('loading');
    setItemConflicts([]);
    setConflictOpen(false);
    const retry = () => queue.retryNow();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!queue.hasPending) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('online', retry);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      queue.dispose();
      window.removeEventListener('online', retry);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [organizationId, user?.id, canEdit]);

  const lastReloadRef = useRef(0);
  const lastSavedCollectionsRef = useRef<Collection[]>([]);
  const lastSavedStructureRef = useRef<string | null>(null);
  const stateVersionRef = useRef<number | null>(null);
  const loadedOrganizationRef = useRef<string | null>(null);
  const supportsItemChangesRef = useRef(false);
  const pendingItemsRef = useRef<{
    payload: { stateVersion: number | null; mutationId: string; itemChanges: ReturnType<typeof buildItemChanges> };
    previous: Collection[];
    submitted: Collection[];
  } | null>(null);

  useEffect(() => {
    setIsLoaded(false);
    lastReloadRef.current = 0;
    lastSavedCollectionsRef.current = [];
    lastSavedStructureRef.current = null;
    stateVersionRef.current = null;
    loadedOrganizationRef.current = null;
    supportsItemChangesRef.current = false;
    pendingItemsRef.current = null;
  }, [organizationId]);

  const userId = user?.id;

  // --- Chargement initial -----------------------------------------------
  useEffect(() => {
    if (!userId || !organizationId) return;
    let cancelled = false;
    const fetchInitialState = async () => {
      try {
        const res = await fetch(`${API_URL}/state`, {
          credentials: 'include',
          headers: { 'X-Organization-Id': organizationId },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && !cancelled) {
            setCollections(data.collections || []);
            setViews(data.views || {});
            setDashboards(data.dashboards || []);
            setDashboardSort(data.dashboardSort || 'created');
            setDashboardFilters(data.dashboardFilters || {});
            setFavorites(data.favorites || { views: [], items: [] });
            stateVersionRef.current = Number(data.stateVersion) || 1;
            loadedOrganizationRef.current = organizationId;
            supportsItemChangesRef.current = data.supportsItemChanges === true;
            lastSavedCollectionsRef.current = data.collections || [];
            lastSavedStructureRef.current = buildStructureSnapshot(
              data.views || {},
              data.dashboards || [],
              data.dashboardSort || 'created',
              data.dashboardFilters || {},
              data.favorites || { views: [], items: [] },
              data.collections || []
            );
            setIsLoaded(true);
          }
        }
      } catch (err) {
        console.error("Erreur lors du chargement initial de l'etat ERP", err);
      }
    };
    fetchInitialState();
    return () => { cancelled = true; };
  }, [userId, organizationId, API_URL]);

  // --- Reception temps reel : item modifie (patch chirurgical) ----------
  useEffect(() => {
    if (!socket || !organizationId) return;

    const handleItemUpdated = (payload?: {
      userId?: string;
      organizationId?: string;
      collectionId?: string;
      itemId?: string;
      item?: any;
    }) => {
      if (payload?.organizationId && payload.organizationId !== organizationId) return;
      if (payload?.userId && user && payload.userId === user.id) return;
      if (!payload?.collectionId || !payload?.itemId || !payload?.item) return;

      const { collectionId, itemId, item } = payload;

      // Mise a jour chirurgicale : on ne touche qu'a l'item concerne
      setCollections((prev: Collection[]) =>
        prev.map((col) => {
          if (col.id !== collectionId) return col;
          return {
            ...col,
            items: (col.items || []).map((it: any) =>
              it.id === itemId ? { ...it, ...item } : it
            ),
          };
        })
      );

      // Mettre a jour le snapshot pour eviter de re-sauvegarder ce changement
      lastSavedCollectionsRef.current = lastSavedCollectionsRef.current.map((col) => {
        if (col.id !== collectionId) return col;
        return {
          ...col,
          items: (col.items || []).map((it: any) =>
            it.id === itemId ? { ...it, ...item } : it
          ),
        };
      });
    };

    socket.on('itemUpdated', handleItemUpdated);
    return () => socket.off('itemUpdated', handleItemUpdated);
  }, [socket, organizationId, user]);

  // --- Reception temps reel : structure modifiee ------------------------
  useEffect(() => {
    if (!socket || !organizationId) return;

    const handleStructureUpdated = async (payload?: { userId?: string; organizationId?: string }) => {
      if (payload?.organizationId && payload.organizationId !== organizationId) return;
      if (payload?.userId && user && payload.userId === user.id) return;

      // Une notification distante ne doit pas remplacer une sauvegarde locale en attente.
      if (saveQueueRef.current?.hasPending) return;
      const now = Date.now();
      if (now - lastReloadRef.current < 2000) return;
      lastReloadRef.current = now;

      try {
        const res = await fetch(`${API_URL}/state`, {
          credentials: 'include',
          headers: { 'X-Organization-Id': organizationId },
        });
        if (res.ok) {
          const data = await res.json();
          if (data && !saveQueueRef.current?.hasPending) {
            stateVersionRef.current = Number(data.stateVersion) || stateVersionRef.current;
            // Pour les collections : mettre a jour seulement la meta (proprietes, etc.)
            // en preservant les items locaux pour ne pas ecraser une saisie en cours
            const previousCollections = lastSavedCollectionsRef.current;
            const serverCollections = data.collections || [];
            setCollections((prev: Collection[]) => {
              const merged = mergeSavedCollections(previousCollections, serverCollections, prev);
              return serverCollections.map((col: Collection) => ({
                ...col, items: merged.find((entry) => entry.id === col.id)?.items || col.items,
              }));
            });
            lastSavedCollectionsRef.current = serverCollections;
            setViews(data.views || {});
            setDashboards(data.dashboards || []);
            setDashboardSort(data.dashboardSort || 'created');
            setDashboardFilters(data.dashboardFilters || {});
            setFavorites(data.favorites || { views: [], items: [] });
            lastSavedStructureRef.current = buildStructureSnapshot(
              data.views || {},
              data.dashboards || [],
              data.dashboardSort || 'created',
              data.dashboardFilters || {},
              data.favorites || { views: [], items: [] },
              data.collections || []
            );
          }
        }
      } catch (err) {
        console.error('Impossible de recharger la structure', err);
      }
    };

    socket.on('structureUpdated', handleStructureUpdated);
    // Compatibilite ascendante
    socket.on('stateUpdated', handleStructureUpdated);
    return () => {
      socket.off('structureUpdated', handleStructureUpdated);
      socket.off('stateUpdated', handleStructureUpdated);
    };
  }, [socket, organizationId, user, API_URL]);

  const savePendingItems = async (isActive: () => boolean) => {
    const pending = pendingItemsRef.current;
    if (!pending || !isActive()) return;
    const res = await fetch(`${API_URL}/state/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Organization-Id': organizationId! },
      credentials: 'include',
      body: JSON.stringify(pending.payload),
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 413) throw new SaveTooLargeError('Les données dépassent la limite du serveur.');
    if (res.status === 409) {
      const result = await res.json().catch(() => null);
      if (!isActive()) return;
      const conflicts: ItemConflict[] = Array.isArray(result?.conflicts) ? result.conflicts : [];
      setItemConflicts(conflicts.map((conflict) => {
        const update = pending.payload.itemChanges
          .find(({ collectionId }) => collectionId === conflict.collectionId)?.updated
          .find(({ itemId }) => itemId === conflict.itemId);
        return { ...conflict, proposed: update?.fields[conflict.key] };
      }));
      setConflictOpen(conflicts.length > 0);
      throw new SaveConflictError('Une autre session a modifié les données.');
    }
    if (!res.ok) throw new Error(`Échec de sauvegarde ciblée (${res.status})`);
    const result = await res.json();
    if (!isActive()) return;
    if (!Array.isArray(result.itemChanges) || !Number.isInteger(result.stateVersion)) throw new Error('Réponse de sauvegarde invalide');
    const rebased = Array.isArray(result.rebasedCollections);
    const saved = rebased
      ? pending.previous.map((collection) => ({
        ...collection,
        items: result.rebasedCollections.find((remote: Collection) => remote.id === collection.id)?.items || [],
      }))
      : applyItemChanges(pending.previous, result.itemChanges);
    latestCollectionsRef.current = mergeSavedCollections(pending.submitted, saved, latestCollectionsRef.current);
    setCollections((local) => mergeSavedCollections(pending.submitted, saved, local));
    lastSavedCollectionsRef.current = saved;
    // A rebased response refreshes items only. Keep the version of the loaded structure.
    if (!rebased) stateVersionRef.current = result.stateVersion;
    pendingItemsRef.current = null;
  };

  // --- Sauvegarde avec debounce et diff intelligent ---------------------
  useEffect(() => {
    if (!isLoaded || !user || !organizationId || !canEdit || loadedOrganizationRef.current !== organizationId) return;

    const queue = saveQueueRef.current;
    if (!queue) return;

    const totalItems = countItems(collections);
    const saveDelay = totalItems >= 1000 ? 1200 : totalItems >= 300 ? 700 : 400;

    queue.enqueue(async ({ isActive }) => {
      // Acquitter d'abord une écriture dont la réponse a pu être perdue.
      await savePendingItems(isActive);
      if (!isActive()) return;
      const cleanedCollections = cleanForSave(latestCollectionsRef.current);
      const cleanedViews = cleanForSave(views);
      const cleanedDashboards = cleanForSave(dashboards);
      const cleanedFilters = cleanForSave(dashboardFilters);
      const cleanedFavorites = cleanForSave(favorites);

      const prevCollections = lastSavedCollectionsRef.current;
      const countChanged = hasItemCountChanged(prevCollections, cleanedCollections);
      const orderChanged = hasItemOrderChanged(prevCollections, cleanedCollections);
      const currentStructureStr = buildStructureSnapshot(
        cleanedViews,
        cleanedDashboards,
        dashboardSort,
        cleanedFilters,
        cleanedFavorites,
        cleanedCollections
      );
      const structureChanged = currentStructureStr !== lastSavedStructureRef.current;

      if (!structureChanged && supportsItemChangesRef.current) {
        const itemChanges = buildItemChanges(prevCollections, cleanedCollections, true);
        if (!itemChanges.length) return;
        pendingItemsRef.current = {
          payload: { stateVersion: stateVersionRef.current, mutationId: uuidv4(), itemChanges },
          previous: prevCollections,
          submitted: cleanedCollections,
        };
        await savePendingItems(isActive);
        return;
      }

      let needsFullPost = structureChanged || countChanged || orderChanged;

      // Patches d'items (PATCH /api/state/item) - evite de tout recharger chez les autres
      if (!countChanged && !needsFullPost) {
        const patches = diffCollectionsItems(prevCollections, cleanedCollections);

        if (patches.length > 0) {
          console.log(`[useErpSync] Sending ${patches.length} item patches...`);

          // Envoyer les patches séquentiellement (pas en parallèle) pour éviter les race conditions
          // où plusieurs patches liraient la même version de l'état et s'écraseraient l'un l'autre
          let allOk = true;
          for (const patch of patches) {
            if (!isActive()) return;
            try {
              const r = await fetch(`${API_URL}/state/item`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Organization-Id': organizationId,
                },
                credentials: 'include',
                body: JSON.stringify({ ...patch, stateVersion: stateVersionRef.current }),
                signal: AbortSignal.timeout(15000),
              });
              if (r.status === 409) throw new SaveConflictError('Une autre session a modifié les données.');
              if (r.ok) {
                const result = await r.json();
                if (!isActive()) return;
                stateVersionRef.current = Number(result?.stateVersion) || stateVersionRef.current;
              } else {
                console.warn(`[useErpSync] Patch failed for item ${patch.itemId}:`, r.status);
                allOk = false;
              }
            } catch (err) {
              if (err instanceof SaveConflictError) throw err;
              console.error(`[useErpSync] Patch error for item ${patch.itemId}:`, err);
              allOk = false;
            }
          }

          if (allOk) {
            console.log(`[useErpSync] All ${patches.length} patches succeeded, snapshot updated`);
            if (!isActive()) return;
            lastSavedCollectionsRef.current = cleanedCollections;
            if (!needsFullPost) return; // tout est sauve via les patches
          } else {
            console.warn(`[useErpSync] Some patches failed, falling back to full POST`);
            needsFullPost = true; // fallback POST complet si des patches ont echoue
          }
        }
      }

      // POST complet (structure ou ajout/suppression d'items)
      if (!isActive()) return;
      if (needsFullPost) {
        const fullPayload = {
          collections: cleanedCollections,
          views: cleanedViews,
          dashboards: cleanedDashboards,
          dashboardSort,
          dashboardFilters: cleanedFilters,
          favorites: cleanedFavorites,
          stateVersion: stateVersionRef.current,
        };
        const fullPayloadStr = JSON.stringify(fullPayload);
        console.log(`[useErpSync] Sending full POST with ${cleanedCollections.reduce((acc: number, c: any) => acc + (c.items?.length ?? 0), 0)} items`);
        const res = await fetch(`${API_URL}/state`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Organization-Id': organizationId,
          },
          credentials: 'include',
          body: fullPayloadStr,
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          console.log(`[useErpSync] Full POST succeeded`);
          const result = await res.json();
          if (!isActive()) return;
          stateVersionRef.current = Number(result?.stateVersion) || stateVersionRef.current;

          const serverCollections = result?.collections || result?.automationCollections || null;
          if (serverCollections) {
            console.log(`[useErpSync] Applying server-returned collections after save`);
            // Conserver aussi les saisies récentes et les nouveaux objets des automations.
            latestCollectionsRef.current = mergeSavedCollections(cleanedCollections, serverCollections, latestCollectionsRef.current);
            setCollections((local) => mergeSavedCollections(cleanedCollections, serverCollections, local));
            lastSavedCollectionsRef.current = serverCollections;
          } else {
            lastSavedCollectionsRef.current = cleanedCollections;
          }
          lastSavedStructureRef.current = currentStructureStr;
        } else {
          if (res.status === 413) throw new SaveTooLargeError('Les données dépassent la limite du serveur.');
          if (res.status === 409) throw new SaveConflictError('Une autre session a modifié les données.');
          throw new Error(`Échec de sauvegarde (${res.status})`);
        }
      }
    }, saveDelay);
  }, [
    collections,
    views,
    dashboards,
    dashboardSort,
    dashboardFilters,
    favorites,
    isLoaded,
    user,
    organizationId,
    canEdit,
    API_URL,
  ]);

  const replaceConflictingValues = () => {
    const pending = pendingItemsRef.current;
    if (!pending || !itemConflicts.length || loadedOrganizationRef.current !== organizationId || !canEdit) return;
    for (const { collectionId, itemId, key, current } of itemConflicts) {
      const update = pending.payload.itemChanges.find((change) => change.collectionId === collectionId)
        ?.updated.find((entry) => entry.itemId === itemId);
      if (!update?.previous) continue;
      if (current === undefined) delete update.previous[key];
      else update.previous[key] = current;
    }
    setItemConflicts([]);
    setConflictOpen(false);
    saveQueueRef.current?.resumeAfterConflict();
  };

  return {
    saveStatus: !isLoaded ? 'loading' as const : saveStatus,
    itemConflicts, conflictOpen, setConflictOpen, replaceConflictingValues,
    retrySave: () => saveQueueRef.current?.retryNow(),
  };
}
