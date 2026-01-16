import { useEffect, useRef } from 'react';

/**
 * Hook de synchronisation de l'état global ERP avec le serveur et socket.io
 * - Gère la sauvegarde automatique (POST /api/state)
 * - Gère le hot reload via socket.io (event 'stateUpdated')
 * - Gère l'initialisation de l'état (GET /api/state)
 *
 * @param {Object} params
 * @param {any[]} params.collections
 * @param {Record<string, any[]>} params.views
 * @param {any[]} params.dashboards
 * @param {string} params.dashboardSort
 * @param {Record<string, any[]>} params.dashboardFilters
 * @param {Object} params.favorites
 * @param {boolean} params.isLoaded
 * @param {any} params.user
 * @param {boolean} params.canEdit
 * @param {Function} params.setCollections
 * @param {Function} params.setViews
 * @param {Function} params.setDashboards
 * @param {Function} params.setDashboardSort
 * @param {Function} params.setDashboardFilters
 * @param {Function} params.setFavorites
 * @param {Function} params.setIsLoaded
 * @param {string} params.API_URL
 * @param {Function} params.cleanForSave
 * @param {any} params.socket
 */
// Types minimalistes pour éviter les erreurs TS
type Collection = { id: string; items?: any[]; [key: string]: any };
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
  canEdit: boolean;
  setCollections: (c: Collection[]) => void;
  setViews: (v: ViewMap) => void;
  setDashboards: (d: Dashboard[]) => void;
  setDashboardSort: React.Dispatch<React.SetStateAction<DashboardSort>>;
  setDashboardFilters: (f: Record<string, any[]>) => void;
  setFavorites: (f: Favorites) => void;
  setIsLoaded: (b: boolean) => void;
  API_URL: string;
  cleanForSave: (obj: any) => any;
  socket: any;
  useStringifyDeps?: boolean; // Ajout du flag optionnel
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
  useStringifyDeps = true
}: UseErpSyncParams) {
  // Hot reload sur événement 'stateUpdated' reçu du serveur
  const lastReloadRef = useRef(0);
  const ignoreNextReloadRef = useRef(false);

  // Fetch initial state when user is defined and component is mounted
  useEffect(() => {
    if (!user) return;
    const fetchInitialState = async () => {
      try {
        const res = await fetch(`${API_URL}/state`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setCollections(data.collections || []);
            setViews(data.views || {});
            setDashboards(data.dashboards || []);
            setDashboardSort(data.dashboardSort || 'created');
            setDashboardFilters(data.dashboardFilters || {});
            setFavorites(data.favorites || { views: [], items: [] });
            setIsLoaded(true);
          }
        }
      } catch (err) {
        console.error('Erreur lors du chargement initial de l’état ERP', err);
      }
    };
    fetchInitialState();
  }, [user, API_URL, setCollections, setViews, setDashboards, setDashboardSort, setDashboardFilters, setFavorites, setIsLoaded]);

  // Quand on sauvegarde l'état, on ignore le prochain reload (car c'est nous qui avons modifié)
  useEffect(() => {
    if (!isLoaded || !user || !canEdit) return;
    ignoreNextReloadRef.current = true;
  }, [
    collections.length,
    collections.map((col: Collection) => (Array.isArray(col.items) ? col.items.length : 0)).reduce((a: number, b: number) => a + b, 0),
    Object.keys(views).length,
    dashboards.length,
    dashboardSort,
    Object.keys(dashboardFilters).length,
    favorites.views.length,
    favorites.items.length
  ]);
  useEffect(() => {
    if (!socket) return;
    const reloadState = async () => {
      const now = Date.now();
            console.log('tyest');
      if (ignoreNextReloadRef.current) {
        ignoreNextReloadRef.current = false;
        return;
      }
      if (now - lastReloadRef.current < 5000) {
        return;
      }
      lastReloadRef.current = now;
      try {
            console.log('tyest');
        const res = await fetch(`${API_URL}/state`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
            console.log(data);
          if (data?.collections && data?.views) {
            setCollections(data.collections);
            setViews(data.views);
            setDashboards(data.dashboards || []);
            setDashboardSort(data.dashboardSort || 'created');
            setFavorites(data.favorites || { views: [], items: [] });
            setDashboardFilters(data.dashboardFilters || {});
            setIsLoaded(true);
          }
        }
      } catch (err) {
        console.error('Impossible de recharger les données', err);
      }
    };
    socket.on('stateUpdated', reloadState);
    return () => {
      socket.off('stateUpdated', reloadState);
    };
  }, [socket, isLoaded, user, canEdit]);

  // Sauvegarde et synchro temps réel de l'état global à chaque changement, avec debounce
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isLoaded || !user || !canEdit) return;
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(() => {
      const saveState = async () => {
        try {
          await fetch(`${API_URL}/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              collections: cleanForSave(collections),
              views: cleanForSave(views),
              dashboards: cleanForSave(dashboards),
              dashboardSort,
              dashboardFilters: cleanForSave(dashboardFilters),
              favorites: cleanForSave(favorites)
            }),
          });
        } catch (err) {
          console.error('Impossible de sauvegarder les données', err);
        }
      };
      saveState();
    }, 500); // 500ms de délai après la dernière modif
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, useStringifyDeps ? [
    JSON.stringify(collections),
    JSON.stringify(views),
    JSON.stringify(dashboards),
    dashboardSort,
    JSON.stringify(dashboardFilters),
    JSON.stringify(favorites),
    isLoaded,
    user,
    canEdit
  ] : [
    collections.length,
    collections.map((col: Collection) => (Array.isArray(col.items) ? col.items.length : 0)).reduce((a: number, b: number) => a + b, 0),
    Object.keys(views).length,
    dashboards.length,
    dashboardSort,
    Object.keys(dashboardFilters).length,
    favorites.views.length,
    favorites.items.length,
    isLoaded,
    user,
    canEdit
  ]);
}
