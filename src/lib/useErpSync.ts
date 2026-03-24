import { useEffect, useRef } from 'react';

// Types minimalistes pour éviter les erreurs TS
type Collection = { id: string; items?: any[]; [key: string]: any };
type ViewMap = Record<string, any[]>;
type DashboardSort = 'created' | 'name-asc' | 'name-desc';
type Dashboard = any;
type Favorites = { views: string[]; items: string[] };

const SYNCABLE_INTERNAL_ITEM_FIELDS = new Set(['_eventSegments', '_preserveEventSegments']);

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
  cleanForSave: (obj: any) => any;
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
        if (key.startsWith('_') && !SYNCABLE_INTERNAL_ITEM_FIELDS.has(key)) continue;
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
  cleanForSave,
  socket,
}: UseErpSyncParams) {
  const lastReloadRef = useRef(0);
  const lastSavedPayloadRef = useRef<string | null>(null);
  const lastSavedCollectionsRef = useRef<Collection[]>([]);
  const lastSavedStructureRef = useRef<string | null>(null);

  useEffect(() => {
    lastSavedPayloadRef.current = null;
    lastReloadRef.current = 0;
    lastSavedCollectionsRef.current = [];
    lastSavedStructureRef.current = null;
  }, [organizationId]);

  // --- Chargement initial -----------------------------------------------
  useEffect(() => {
    if (!user || !organizationId) return;
    const fetchInitialState = async () => {
      try {
        const res = await fetch(`${API_URL}/state`, {
          credentials: 'include',
          headers: { 'X-Organization-Id': organizationId },
        });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setCollections(data.collections || []);
            setViews(data.views || {});
            setDashboards(data.dashboards || []);
            setDashboardSort(data.dashboardSort || 'created');
            setDashboardFilters(data.dashboardFilters || {});
            setFavorites(data.favorites || { views: [], items: [] });
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
  }, [user, organizationId, API_URL]);

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
          if (data) {
            // Pour les collections : mettre a jour seulement la meta (proprietes, etc.)
            // en preservant les items locaux pour ne pas ecraser une saisie en cours
            setCollections((prev: Collection[]) => {
              const prevMap = new Map(prev.map((c) => [c.id, c]));
              return (data.collections || []).map((serverCol: Collection) => {
                const localCol = prevMap.get(serverCol.id);
                if (!localCol) return serverCol;
                return { ...serverCol, items: localCol.items };
              });
            });
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

  // --- Sauvegarde avec debounce et diff intelligent ---------------------
  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoaded || !user || !organizationId || !canEdit) return;

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    const totalItems = countItems(collections);
    const saveDelay = totalItems >= 1000 ? 1200 : totalItems >= 300 ? 700 : 400;

    debounceTimeout.current = setTimeout(async () => {
      try {
        const cleanedCollections = cleanForSave(collections);
        const cleanedViews = cleanForSave(views);
        const cleanedDashboards = cleanForSave(dashboards);
        const cleanedFilters = cleanForSave(dashboardFilters);
        const cleanedFavorites = cleanForSave(favorites);

        const prevCollections = lastSavedCollectionsRef.current;
        const countChanged = hasItemCountChanged(prevCollections, cleanedCollections);
        const currentStructureStr = buildStructureSnapshot(
          cleanedViews,
          cleanedDashboards,
          dashboardSort,
          cleanedFilters,
          cleanedFavorites,
          cleanedCollections
        );
        const structureChanged = currentStructureStr !== lastSavedStructureRef.current;

        let needsFullPost = structureChanged || countChanged;

        // Patches d'items (PATCH /api/state/item) - evite de tout recharger chez les autres
        if (!countChanged && !needsFullPost) {
          const patches = diffCollectionsItems(prevCollections, cleanedCollections);
          
          if (patches.length > 0) {
            console.log(`[useErpSync] Sending ${patches.length} item patches...`);
            
            // Envoyer les patches séquentiellement (pas en parallèle) pour éviter les race conditions
            // où plusieurs patches liraient la même version de l'état et s'écraseraient l'un l'autre
            let allOk = true;
            for (const patch of patches) {
              try {
                const r = await fetch(`${API_URL}/state/item`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-Organization-Id': organizationId,
                  },
                  credentials: 'include',
                  body: JSON.stringify(patch),
                });
                if (!r.ok) {
                  console.warn(`[useErpSync] Patch failed for item ${patch.itemId}:`, r.status);
                  allOk = false;
                }
              } catch (err) {
                console.error(`[useErpSync] Patch error for item ${patch.itemId}:`, err);
                allOk = false;
              }
            }
            
            if (allOk) {
              console.log(`[useErpSync] All ${patches.length} patches succeeded, snapshot updated`);
              lastSavedCollectionsRef.current = cleanedCollections;
              if (!needsFullPost) return; // tout est sauve via les patches
            } else {
              console.warn(`[useErpSync] Some patches failed, falling back to full POST`);
              needsFullPost = true; // fallback POST complet si des patches ont echoue
            }
          }
        }

        // POST complet (structure ou ajout/suppression d'items)
        if (needsFullPost) {
          const fullPayload = {
            collections: cleanedCollections,
            views: cleanedViews,
            dashboards: cleanedDashboards,
            dashboardSort,
            dashboardFilters: cleanedFilters,
            favorites: cleanedFavorites,
          };
          const fullPayloadStr = JSON.stringify(fullPayload);
          if (fullPayloadStr !== lastSavedPayloadRef.current) {
            console.log(`[useErpSync] Sending full POST with ${cleanedCollections.reduce((acc, c) => acc + (c.items?.length ?? 0), 0)} items`);
            const res = await fetch(`${API_URL}/state`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Organization-Id': organizationId,
              },
              credentials: 'include',
              body: fullPayloadStr,
            });
            if (res.ok) {
              console.log(`[useErpSync] Full POST succeeded`);
              lastSavedPayloadRef.current = fullPayloadStr;
              lastSavedCollectionsRef.current = cleanedCollections;
              lastSavedStructureRef.current = currentStructureStr;
            } else {
              console.error(`[useErpSync] Full POST failed with status ${res.status}`);
            }
          }
        }
      } catch (err) {
        console.error('Impossible de sauvegarder les donnees', err);
      }
    }, saveDelay);

    return () => {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
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
  ]);
}
