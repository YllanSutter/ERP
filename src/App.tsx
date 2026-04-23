


import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useErpSync } from '@/lib/useErpSync';
import { motion } from 'framer-motion';
import { Plus, Zap } from 'lucide-react';
import KanbanView from '@/components/views/KanbanView';
import CalendarView from '@/components/views/CalendarView';
import TableView from '@/components/views/TableView';
import ShinyButton from '@/components/ui/ShinyButton';
import LoginPage from '@/components/pages/LoginPage';
import AutomationsPage from '@/components/pages/AutomationsPage';
import AccessManager from '@/components/admin/AccessManager';
import AppHeader from '@/components/layout/AppHeader';
import Sidebar from '@/components/menus/Sidebar';
import CommandMenu from '@/components/menus/CommandMenu';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import ViewToolbar from '@/components/views/ViewToolbar';
import LayoutView from '@/components/views/LayoutView';
import { useAuth } from '@/auth/AuthProvider';
import NewCollectionModal from '@/components/modals/NewCollectionModal';
import EditCollectionModal from '@/components/modals/EditCollectionModal';
import PropertyModal from '@/components/modals/PropertyModal';
import NewItemModal from '@/components/modals/NewItemModal';
import FilterModal from '@/components/modals/FilterModal';
import GroupModal from '@/components/modals/GroupModal';
import NewViewModal from '@/components/modals/NewViewModal';
import ViewVisibilityModal from '@/components/modals/ViewVisibilityModal';
import DashboardView from '@/components/dashboard/DashboardView';
import { API_URL, defaultCollections, defaultDashboards, defaultViews } from '@/lib/constants';
import { useErpState } from '@/lib/useErpState';
import { useCanEdit, useCanEditField, useCanManagePermissions } from '@/lib/hooks/useCanEdit';
import { useCollections } from '@/lib/hooks/useCollections';
import { useItems } from '@/lib/hooks/useItems';
import { useViews } from '@/lib/hooks/useViews';
import { getFilteredItems, getOrderedProperties } from '@/lib/filterUtils';
import { DashboardConfig } from '@/lib/dashboardTypes';
import { applyCalculatedFieldsToCollections, stripCalculatedNumberFieldsFromItem } from '@/lib/calculatedFields';
import { applyUserCalendarPreferences } from '@/lib/calendarUtils';
import { importPricesFromItad } from '@/lib/itadUtils';
import { isEmptyValue } from '@/lib/utils/valueUtils';
import { getRoundedNow } from '@/lib/utils/dateUtils';
import { pluginManager } from '@/lib/plugins/PluginManager';
import { initializePluginRegistry } from '@/lib/plugins';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu';

const App = () => {
  // Connexion socket.io (même logique que AppHeader)
  const [socket, setSocket] = useState<any>(null);

    // Gestion du thème clair/sombre
  // Thème persistant (clair/sombre)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('erp-theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });
  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp-theme', theme);
    }
  }, [theme]);

  // Filtres par dashboard (clé = dashboard.id)
  const [dashboardFilters, setDashboardFilters] = useState<Record<string, any[]>>({});
  const {
    user,
    roles: userRoles,
    organizations,
    activeOrganizationId,
    switchOrganization,
    createOrganization,
    loading: authLoading,
    login,
    register,
    logout,
    impersonate,
    impersonatedRoleId,
    isAdminBase
  } = useAuth();

  useEffect(() => {
    applyUserCalendarPreferences(user?.user_preferences || {});
  }, [user?.user_preferences]);

  useEffect(() => {
    const bootstrapPlugins = async () => {
      if (!activeOrganizationId || !user?.id) return;

      try {
        initializePluginRegistry();

        const response = await fetch(`${API_URL}/plugins/config/${activeOrganizationId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          console.warn('[Plugin Bootstrap] Failed to load plugin configs');
          return;
        }

        const configs = await response.json() as Record<string, { enabled?: boolean; config?: Record<string, any> }>;
        const enabledPlugins = Object.entries(configs)
          .filter(([, value]) => Boolean(value?.enabled))
          .map(([pluginId]) => pluginId);

        const pluginConfigs = Object.fromEntries(
          Object.entries(configs).map(([pluginId, value]) => [pluginId, value?.config || {}])
        );

        await pluginManager.initializeOrganizationPlugins(
          activeOrganizationId,
          {
            organizationId: activeOrganizationId,
            plugins: pluginManager.getAllPlugins(),
            enabledPlugins,
            pluginConfigs,
          },
          {
            organizationId: activeOrganizationId,
            userId: user.id,
            api: {
              getOrganizationData: () => ({}),
              updateOrganizationConfig: async () => {},
              registerHook: (hookName, callback) => pluginManager.registerHook(hookName, callback),
              unregisterHook: (hookName, callback) => pluginManager.unregisterHook(hookName, callback),
              emit: (eventName, data) => {
                window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
              },
            },
          }
        );
      } catch (error) {
        console.error('[Plugin Bootstrap] Error:', error);
      }
    };

    bootstrapPlugins();
  }, [activeOrganizationId, user?.id]);

  const [collections, setCollections] = useState<any[]>(defaultCollections);
  // console.log(collections);
  const [views, setViews] = useState<Record<string, any[]>>(defaultViews);
  const [dashboards, setDashboards] = useState<DashboardConfig[]>(defaultDashboards);
  const [dashboardSort, setDashboardSort] = useState<'created' | 'name-asc' | 'name-desc'>('created');
  // State ERP global (activeCollection, activeView, activeDashboard)
  const {
    activeCollection,
    setActiveCollection,
    activeView,
    setActiveView,
    activeDashboard,
    setActiveDashboard,
    showViewSettings,
    setShowViewSettings,
  } = useErpState(activeOrganizationId);
  const [isLoaded, setIsLoaded] = useState(false);

  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [showPropertyModal, setShowPropertyModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [groupContext, setGroupContext] = useState<Record<string, any> | null>(null);
  // Vider le contexte de groupe si la collection ou la vue change
  useEffect(() => { setGroupContext(null); }, [activeCollection, activeView]);
  const [modalCollection, setModalCollection] = useState<any>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [editingFilterIndex, setEditingFilterIndex] = useState<number | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showNewViewModal, setShowNewViewModal] = useState(false);
  const [showEditViewModal, setShowEditViewModal] = useState(false);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [showEditCollectionModal, setShowEditCollectionModal] = useState(false);
  const [relationFilter, setRelationFilter] = useState<{ collectionId: string | null; ids: string[] }>({
    collectionId: null,
    ids: []
  });
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('erp_sidebar_open');
    return stored ? stored === '1' : true;
  });
  const [showAccessManager, setShowAccessManager] = useState(false);
  const [showAutomations, setShowAutomations] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<{ views: string[]; items: string[] }>({ views: [], items: [] });
  const [viewVisibilityTarget, setViewVisibilityTarget] = useState<{ viewId: string; collectionId: string } | null>(
    null
  );

  // Hooks personnalisés pour les permissions
  const canEdit = useCanEdit(activeCollection);
  const canManagePermissions = useCanManagePermissions();

  const collectionHooks = useCollections(
    collections,
    setCollections,
    views,
    setViews,
    setActiveCollection,
    setActiveView,
    setRelationFilter,
    activeCollection
  );

  const itemHooks = useItems(collections, setCollections, activeCollection);

  // Handler for ITAD bulk import
  const handleBulkImportItad = async (itemIds: string[]) => {
    if (!activeOrganizationId || !activeCollection) {
      console.error('Missing organization or collection');
      return;
    }

    try {
      // Get Steam plugin config
      const config = pluginManager.getPluginConfig(activeOrganizationId, 'steam');
      
      // Call ITAD import utility
      await importPricesFromItad(activeOrganizationId, itemIds, config);
      
      // Reload full state to reflect imported prices
      const response = await fetch(`${API_URL}/state`, {
        credentials: 'include',
      });
      if (response.ok) {
        const freshState = await response.json();
        if (Array.isArray(freshState?.collections)) {
          setCollections(freshState.collections);
        }
      }
    } catch (error) {
      console.error('ITAD import error:', error);
    }
  };

  const viewHooks = useViews(views, setViews, activeCollection, activeView, setActiveView);
  const collectionsWithCalculatedFields = useMemo(
    () => applyCalculatedFieldsToCollections(collections),
    [collections]
  );
  const currentCollection = collectionsWithCalculatedFields.find((c) => c.id === activeCollection);
  const isSteamPluginActive = Boolean(
    activeOrganizationId && pluginManager.isPluginActive(activeOrganizationId, 'steam')
  );
  const { currentViews } = viewHooks;
  const activeDashboardConfig = dashboards.find((d) => d.id === activeDashboard) || null;



  const getMatchingTemplate = (prop: any, data: any) => {
    const templates = Array.isArray(prop.defaultTemplates) ? prop.defaultTemplates : [];

    // Priorité 1 : template conditionnel dont la condition est vérifiée
    for (const template of templates) {
      const when = template?.when || {};
      if (!when.fieldId) continue;
      const sourceValue = data[when.fieldId];

      if (Array.isArray(sourceValue)) {
        if (sourceValue.includes(when.value)) return template;
      } else if (sourceValue === when.value) {
        return template;
      }
    }

    // Priorité 2 : template marqué isDefault (rétro-compat)
    // OU template sans condition (when.fieldId vide) — un template sans condition
    // est traité comme valeur par défaut, même sans le flag isDefault explicite.
    const fallback = templates.find(
      (t: any) => t?.isDefault || !t?.when?.fieldId
    );
    return fallback || null;
  };

  const applyDefaultTemplates = (data: any, props: any[]) => {
    let nextData = { ...data };
    props.forEach((prop: any) => {
      const match = getMatchingTemplate(prop, nextData);
      if (!match) return;
      const targetKey = prop.type === 'date' || prop.type === 'date_range'
        ? `${prop.id}_duration`
        : prop.id;
      const currentValue = nextData[targetKey];
      if (isEmptyValue(currentValue)) {
        nextData[targetKey] = match.value;
      }
    });
    return nextData;
  };

  const handleQuickCreateItem = (prefill?: Record<string, any>) => {
    console.log('[QuickCreate] triggered — currentCollection:', currentCollection?.id, 'activeCollection:', activeCollection, 'collections count:', collections.length);
    if (!currentCollection) { console.warn('[QuickCreate] ABORT: no currentCollection'); return; }
    const props = currentCollection.properties || [];
    const nameField = props.find((p: any) => p.name === 'Nom' || p.id === 'name') || props[0];
    const baseName = currentCollection.name ? `Nouveau ${currentCollection.name}` : 'Nouvel élément';
    let item: any = { ...(groupContext || {}), ...(prefill || {}) };
    if (nameField && !item[nameField.id]) item[nameField.id] = baseName;

    props.forEach((prop: any) => {
      if (prop.type === 'date') {
        const existing = item[prop.id];
        const existingDate = existing ? new Date(existing) : null;
        const isValidIso = existingDate && !isNaN(existingDate.getTime());
        if (!isValidIso) {
          // Si la valeur existante ressemble à une année (ex: "2026" venant du
          // groupContext d'un champ date/year), on place la date au 1er janvier
          // de cette année pour rester dans le bon groupe de groupage.
          const yearMatch = typeof existing === 'string' && /^\d{4}$/.test(existing.trim());
          if (yearMatch) {
            item[prop.id] = new Date(`${existing.trim()}-01-01T12:00:00.000Z`).toISOString();
          } else {
            item[prop.id] = getRoundedNow().toISOString();
          }
        }
      }
    });

    props.forEach((prop: any) => {
      if (prop.id.endsWith('_duration') && item[prop.id] === undefined) {
        item[prop.id] = 1;
      }
    });

    item._eventSegments = [];

    for (let i = 0; i < 3; i += 1) {
      const next = applyDefaultTemplates(item, props);
      if (JSON.stringify(next) === JSON.stringify(item)) break;
      item = next;
    }

    console.log('[QuickCreate] calling saveItem with collectionId:', currentCollection.id, 'item keys:', Object.keys(item));
    itemHooks.saveItem(item, null, currentCollection.id);
    console.log('[QuickCreate] saveItem returned');
  };

  const userRoleIds = (userRoles || []).map((r: any) => r.id);
  const canSeeView = (view: any) => {
    const allowed = view?.visibleToRoles;
    const allowedUsers = view?.visibleToUsers;
    const hasRoleRestriction = Array.isArray(allowed) && allowed.length > 0;
    const hasUserRestriction = Array.isArray(allowedUsers) && allowedUsers.length > 0;
    if (!hasRoleRestriction && !hasUserRestriction) return true;
    const roleOk = hasRoleRestriction ? allowed.some((rid: string) => userRoleIds.includes(rid)) : false;
    const userOk = hasUserRestriction ? allowedUsers.includes(user?.id) : false;
    return roleOk || userOk;
  };
  const visibleViews = useMemo(() => currentViews.filter(canSeeView), [currentViews, userRoleIds, user?.id]);
  const activeViewConfig =
    visibleViews.find((v: any) => v.id === activeView) || visibleViews[0] || null;
  useEffect(() => {
    // Utilise la même origine que la page (cookies/session OK)
    const s = io({ transports: ['polling'] });
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  // Synchronisation ERP (sauvegarde, socket, hot reload)
  useErpSync({
    collections,
    views,
    dashboards,
    dashboardSort,
    dashboardFilters,
    favorites,
    isLoaded,
    user,
    organizationId: activeOrganizationId,
    canEdit,
    setCollections,
    setViews,
    setDashboards,
    setDashboardSort,
    setDashboardFilters,
    setFavorites,
    setIsLoaded,
    API_URL,
    socket
  });

  useEffect(() => {
    setIsLoaded(false);
    setCollections(defaultCollections);
    setViews(defaultViews);
    setDashboards(defaultDashboards);
    setDashboardSort('created');
    setDashboardFilters({});
    setFavorites({ views: [], items: [] });
  }, [activeOrganizationId]);
 useEffect(() => {
    // Hot reload sur événement 'stateUpdated' reçu du serveur
    // Pour éviter les reloads en boucle, on garde l'heure du dernier reload et un flag local
    const loadUsers = async () => {
      if (!user) return;
      try {
        // Ne pas envoyer le header d'impersonation pour charger la liste complète (besoin des droits admin)
        const res = await fetch(`${API_URL}/users`, { 
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableUsers(data || []);
        }
      } catch (err) {
        console.error('Impossible de charger les utilisateurs', err);
      }
    };
    loadUsers();
  }, [user]);

  useEffect(() => {
    // Charger tous les rôles disponibles pour le sélecteur de rôle admin
    // IMPORTANT: on charge toujours les rôles si l'utilisateur est admin de base,
    // même s'il impersonne un rôle sans permissions
    const loadRoles = async () => {
      if (!user || !isAdminBase) return;
      try {
        // Ne pas envoyer le header d'impersonation pour charger la liste complète (besoin des droits admin de base)
        const res = await fetch(`${API_URL}/roles`, { 
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableRoles(data || []);
        }
      } catch (err) {
        console.error('Impossible de charger les rôles', err);
      }
    };
    loadRoles();
  }, [user, isAdminBase]);

  useEffect(() => {
    if (!activeCollection) return;
    if (visibleViews.length === 0) {
      if (activeView !== null) setActiveView(null);
      return;
    }
    // Si la vue active existe dans la collection courante, on la garde
    const found = visibleViews.find((v: any) => v.id === activeView);
    if (!found) {
      const lastViewId = localStorage.getItem(`erp_lastView_${activeOrganizationId || 'default'}_${activeCollection}`);
      const lastViewExists = lastViewId && visibleViews.some((v: any) => v.id === lastViewId);
      setActiveView(lastViewExists ? lastViewId : visibleViews[0].id);
    }
    // Sinon, on ne touche pas à activeView
  }, [activeCollection, activeView, visibleViews]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('erp_sidebar_open', sidebarOpen ? '1' : '0');
  }, [sidebarOpen]);

  useEffect(() => {
    if (!activeCollection || !activeView) return;
    localStorage.setItem(`erp_lastView_${activeOrganizationId || 'default'}_${activeCollection}`, activeView);
  }, [activeCollection, activeView, activeOrganizationId]);

  const handleNavigateToCollection = (collectionId: string, linkedIds?: string[]) => {
    setActiveDashboard(null);
    setActiveCollection(collectionId);
    if (linkedIds && linkedIds.length > 0) {
      setRelationFilter({ collectionId, ids: linkedIds });
    } else {
      setRelationFilter({ collectionId: null, ids: [] });
    }
  };

  const handleCreateDashboard = () => {
    const now = new Date();
    const newDashboard: DashboardConfig = {
      id: Date.now().toString(),
      name: `Dashboard ${dashboards.length + 1}`,
      modules: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    setDashboards((prev) => [...prev, newDashboard]);
    setActiveDashboard(newDashboard.id);
    setActiveCollection(null);
    setActiveView(null);
    setRelationFilter({ collectionId: null, ids: [] });
  };

  const handleUpdateDashboard = (dashboardId: string, patch: Partial<DashboardConfig>) => {
    setDashboards((prev) =>
      prev.map((db) =>
        db.id === dashboardId
          ? { ...db, ...patch, updatedAt: new Date().toISOString() }
          : db
      )
    );
  };

  const handleDeleteDashboard = (dashboardId: string) => {
    setDashboards((prev) => prev.filter((d) => d.id !== dashboardId));
    if (activeDashboard === dashboardId) {
      setActiveDashboard(null);
    }
  };

  const handleDuplicateDashboard = (dashboardId: string) => {
    const source = dashboards.find((d) => d.id === dashboardId);
    if (!source) return;
    const now = new Date();
    const clone: DashboardConfig = {
      ...source,
      id: Date.now().toString(),
      name: `${source.name} (copie)`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    setDashboards((prev) => [...prev, clone]);
    setActiveDashboard(clone.id);
    setActiveCollection(null);
    setActiveView(null);
    setRelationFilter({ collectionId: null, ids: [] });
  };

  const clearRelationFilter = () => setRelationFilter({ collectionId: null, ids: [] });

  const sortedDashboards = useMemo(() => {
    const base = [...dashboards];
    if (dashboardSort === 'name-asc') {
      return base.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (dashboardSort === 'name-desc') {
      return base.sort((a, b) => b.name.localeCompare(a.name));
    }
    return base;
  }, [dashboards, dashboardSort]);

  const orderedProperties = useMemo(
    () => getOrderedProperties(currentCollection, activeViewConfig, collectionsWithCalculatedFields),
    [currentCollection, activeViewConfig, collectionsWithCalculatedFields]
  );

  const filteredItems = useMemo(
    () =>
      getFilteredItems(
        currentCollection,
        activeViewConfig,
        relationFilter,
        activeCollection,
        collectionsWithCalculatedFields
      ),
    [currentCollection, activeViewConfig, relationFilter, activeCollection, collectionsWithCalculatedFields]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030303] text-black dark:text-white">
        <div className="text-neutral-400">Chargement de l'authentification…</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={login} onRegister={register} loading={authLoading} />;
  }

  return (
    <div className={`h-screen flex flex-col ${theme === 'dark' ? 'bg-neutral-950 text-black dark:text-white' : 'bg-white text-neutral-900'}`}> 

      

     

      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} className="flex flex-1 overflow-hidden">
        <Sidebar
          collections={collections}
          views={views}
          dashboards={sortedDashboards}
          favorites={favorites}
          activeCollection={activeCollection}
          userRoleIds={userRoleIds}
          userId={user?.id || null}
          organizations={organizations}
          activeOrganizationId={activeOrganizationId}
          onSwitchOrganization={switchOrganization}
          onCreateOrganization={createOrganization}
          onSelectCollection={(collectionId) => {
            setShowAutomations(false);
            setActiveDashboard(null);
            setActiveCollection(collectionId);
            const lastViewId = localStorage.getItem(`erp_lastView_${collectionId}`);
            setActiveView(lastViewId || 'default');
            setRelationFilter({ collectionId: null, ids: [] });
          }}
          onEditCollection={(col) => {
            setEditingCollection(col);
            setShowEditCollectionModal(true);
          }}
          onToggleFavoriteView={(viewId: string) => {
            setFavorites((prev) => ({
              ...prev,
              views: prev.views.includes(viewId)
                ? prev.views.filter((id) => id !== viewId)
                : [...prev.views, viewId],
            }));
          }}
          onToggleFavoriteItem={(itemId: string) => {
            setFavorites((prev) => ({
              ...prev,
              items: prev.items.includes(itemId)
                ? prev.items.filter((id) => id !== itemId)
                : [...prev.items, itemId],
            }));
          }}
          onSelectView={(collectionId: string, viewId: string) => {
            setActiveDashboard(null);
            setActiveCollection(collectionId);
            setActiveView(viewId);
            localStorage.setItem(`erp_lastView_${activeOrganizationId || 'default'}_${collectionId}`, viewId);
            setRelationFilter({ collectionId: null, ids: [] });
          }}
          onSelectItem={(collectionId: string, itemId: string) => {
            setActiveDashboard(null);
            const collection = collections.find((c) => c.id === collectionId);
            const item = collection?.items.find((it: any) => it.id === itemId);
            if (item) {
              setActiveCollection(collectionId);
              setEditingItem(item);
              setShowNewItemModal(true);
            }
          }}
          onSelectDashboard={(dashboardId: string) => {
            setShowAutomations(false);
            setActiveDashboard(dashboardId);
            setActiveCollection(null);
            setActiveView(null);
            setRelationFilter({ collectionId: null, ids: [] });
          }}
          onCreateDashboard={handleCreateDashboard}
          onCreateCollection={() => setShowNewCollectionModal(true)}
          onDeleteDashboard={handleDeleteDashboard}
          onDuplicateDashboard={handleDuplicateDashboard}
          onShowAutomations={() => {
            setShowAutomations(true);
            setActiveDashboard(null);
            setActiveCollection(null);
          }}
          showAutomations={showAutomations}
        />

        <SidebarInset className="flex-1 flex flex-col overflow-hidden">
           <AppHeader
            impersonatedRoleId={impersonatedRoleId}
            availableRoles={availableRoles}
            activeCollectionName={currentCollection?.name || null}
            onImpersonate={impersonate}
            onShowAccessManager={() => setShowAccessManager(true)}
            onOpenCommandMenu={() => setCommandMenuOpen(true)}
            theme={theme}
            setTheme={setTheme}
          />
          {showAutomations ? (
            <AutomationsPage collections={collections} />
          ) : activeDashboard ? (
            <DashboardView
              dashboard={activeDashboardConfig}
              collections={collections}
              onUpdate={(patch) => activeDashboard && handleUpdateDashboard(activeDashboard, patch)}
              onEdit={(item: any) => {
                const itemCollection = collections.find((col) => col.id === item.__collectionId || col.items?.some((it: any) => it.id === item.id));
                setEditingItem(item);
                setModalCollection(itemCollection || null);
                setShowNewItemModal(true);
              }}
              onViewDetail={(item: any) => {
                const itemCollection = collections.find((col) => col.id === item.__collectionId || col.items?.some((it: any) => it.id === item.id));
                setEditingItem(item);
                setModalCollection(itemCollection || null);
                setShowNewItemModal(true);
              }}
              onShowNewItemModal={(collection, item) => {
                setModalCollection(collection || null);
                setEditingItem(item || null);
                setShowNewItemModal(true);
              }}
            />
          ) : !activeCollection ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">Aucune collection</h2>
                <p className="text-neutral-400 mb-6">Créez une nouvelle collection pour commencer</p>
                <ShinyButton onClick={() => setShowNewCollectionModal(true)}>
                  <Plus size={16} />
                  Créer une collection
                </ShinyButton>
              </div>
            </motion.div>
          ) : !currentCollection ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="text-center text-neutral-400">
                <p>Collection non accessible avec vos permissions actuelles</p>
              </div>
            </motion.div>
          ) : (
            <>
              <ViewToolbar
                currentCollection={currentCollection}
                currentViews={visibleViews}
                currentViewConfig={activeViewConfig}
                activeView={activeView}
                orderedProperties={orderedProperties}
                collections={collections}
                showViewSettings={showViewSettings}
                relationFilter={relationFilter}
                activeCollection={activeCollection}
                favorites={favorites}
                onSetActiveView={setActiveView}
                onDeleteView={viewHooks.deleteView}
                onShowNewViewModal={() => setShowNewViewModal(true)}
                onShowFilterModal={() => {
                  setEditingFilterIndex(null);
                  setShowFilterModal(true);
                }}
                onShowGroupModal={() => setShowGroupModal(true)}
                onShowNewPropertyModal={() => {
                  setEditingProperty(null);
                  setShowPropertyModal(true);
                }}
                onShowNewItemModal={(prefill) => { console.log('[GroupContext] + clicked, groupContext:', groupContext, 'prefill:', prefill); if (prefill && Object.keys(prefill).length > 0) { setEditingItem(prefill); setGroupContext(prefill); } setShowNewItemModal(true); }}
                onQuickCreateItem={handleQuickCreateItem}
                onSetShowViewSettings={setShowViewSettings}
                onToggleFieldVisibility={viewHooks.toggleFieldVisibility}
                onUpdateViewFieldOrder={viewHooks.updateViewFieldOrder}
                onSetTotalField={(fieldId: string, totalType: string | null) => {
                  if (!activeView) return;
                  const currentTotalFields = activeViewConfig?.totalFields || {};
                  const nextTotalFields = { ...currentTotalFields };
                  if (totalType === null) {
                    delete nextTotalFields[fieldId];
                  } else {
                    nextTotalFields[fieldId] = totalType;
                  }
                  viewHooks.updateView(activeView, { totalFields: nextTotalFields });
                }}
                onEditProperty={(prop) => {
                  setEditingProperty(prop);
                  setShowPropertyModal(true);
                }}
                onEditFilter={(index) => {
                  setEditingFilterIndex(index);
                  setShowFilterModal(true);
                }}
                onRemoveFilter={viewHooks.removeFilter}
                onUpdateFilterValue={(index, newValue) => {
                  if (!activeView) return;
                  const nextFilters = [...(activeViewConfig?.filters || [])];
                  if (nextFilters[index]) {
                    nextFilters[index] = { ...nextFilters[index], value: newValue };
                    viewHooks.updateView(activeView, { filters: nextFilters });
                  }
                }}
                onClearRelationFilter={clearRelationFilter}
                onRemoveGroup={viewHooks.removeGroup}
                onSetGroupDisplayMode={(groupId, mode) => {
                  if (!activeView) return;
                  const currentModes = activeViewConfig?.groupDisplayModes || {};
                  const isRootGroup = (activeViewConfig?.groups || [])[0] === groupId;
                  viewHooks.updateView(activeView, {
                    groupDisplayModes: {
                      ...currentModes,
                      [groupId]: mode,
                    },
                    ...(isRootGroup ? { groupDisplayMode: mode } : {}),
                  });
                }}
                onToggleFavoriteView={(viewId: string) => {
                  setFavorites((prev) => ({
                    ...prev,
                    views: prev.views.includes(viewId)
                      ? prev.views.filter((id) => id !== viewId)
                      : [...prev.views, viewId],
                  }));
                }}
                onManageViewVisibility={(viewId: string) => {
                  if (!activeCollection) return;
                  setViewVisibilityTarget({ viewId, collectionId: activeCollection });
                }}
                onEditView={(viewId: string) => {
                  setEditingViewId(viewId);
                  setShowEditViewModal(true);
                }}
                onDuplicateView={(viewId: string) => {
                  viewHooks.duplicateView(viewId);
                }}
                onUpdateCollectionVisibleFields={(collectionId, visibleFieldIds) => {
                  const col = collections.find((c) => c.id === collectionId);
                  if (!col) return;
                  collectionHooks.updateCollection({
                    ...col,
                    defaultVisibleFieldIds: visibleFieldIds
                  });
                }}
                onUpdateFieldGroups={(groups) => {
                  if (!activeView) return;
                  viewHooks.updateView(activeView, { fieldGroups: groups });
                }}
                onOpenItemFromSearch={(collection, item) => {
                  setEditingItem(item);
                  setModalCollection(collection || null);
                  setShowNewItemModal(true);
                }}
              />

              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex-1 overflow-auto lg:p-6 p-2 z-[1]"
                  >
                {activeViewConfig?.type === 'table' && (
                  <TableView
                    collection={currentCollection}
                    items={filteredItems}
                    favoriteItemIds={favorites.items}
                    onEdit={(item: any) => itemHooks.updateItem(item)}
                    onBulkUpdate={itemHooks.bulkUpdateItems}
                    onDelete={itemHooks.deleteItem}
                    onToggleFavoriteItem={(itemId: string) => {
                      setFavorites((prev) => ({
                        ...prev,
                        items: prev.items.includes(itemId)
                          ? prev.items.filter((id) => id !== itemId)
                          : [...prev.items, itemId],
                      }));
                    }}
                    onBulkDelete={itemHooks.bulkDeleteItems}
                    onViewDetail={(item: any) => {
                      const itemCollection = collectionsWithCalculatedFields.find((col) => col.id === item.__collectionId || col.items?.some((it: any) => it.id === item.id));
                      setEditingItem(item);
                      setModalCollection(itemCollection || null);
                      setShowNewItemModal(true);
                    }}
                    hiddenFields={activeViewConfig?.hiddenFields || []}
                    orderedProperties={orderedProperties}
                    onReorderItems={(nextItems: any[]) => {
                      const sourceCollection = collections.find((col) => col.id === activeCollection);
                      const sanitizedItems = sourceCollection
                        ? nextItems.map((item) => stripCalculatedNumberFieldsFromItem(item, sourceCollection))
                        : nextItems;
                      const updatedCollections = collections.map((col) => {
                        if (col.id === activeCollection) {
                          return { ...col, items: sanitizedItems };
                        }
                        return col;
                      });
                      setCollections(updatedCollections);
                    }}
                    onToggleField={viewHooks.toggleFieldVisibility}
                    onDeleteProperty={collectionHooks.deleteProperty}
                    onDuplicateProperty={collectionHooks.duplicateProperty}
                    onEditProperty={(prop: any) => {
                      setEditingProperty(prop);
                      setShowPropertyModal(true);
                    }}
                    collections={collectionsWithCalculatedFields}
                    onRelationChange={(prop: any, item: any, val: any) => {
                      const updatedItem = { ...item, [prop.id]: val };
                      itemHooks.updateItem(updatedItem);
                      
                      // Les nouveaux items créés dans une relation sont déjà dans targetCollection.items
                      // (ajoutés par handleCreateNew), donc on les laisse là et on nettoie juste le marker
                      const targetCollectionId = prop.relation?.targetCollectionId;
                      if (targetCollectionId) {
                        const targetCollection = collections.find((c: any) => c.id === targetCollectionId);
                        if (targetCollection && targetCollection.__newItems) {
                          delete targetCollection.__newItems;
                        }
                      }
                    }}
                    onNavigateToCollection={handleNavigateToCollection}
                    groups={activeViewConfig?.groups || []}
                    groupDisplayMode={activeViewConfig?.groupDisplayMode || 'accordion'}
                    groupDisplayModes={activeViewConfig?.groupDisplayModes || {}}
                    groupDisplayColumnCount={activeViewConfig?.groupDisplayColumnCount || 3}
                    groupDisplayColumnCounts={activeViewConfig?.groupDisplayColumnCounts || {}}
                    groupTabStyleFieldIds={activeViewConfig?.groupTabStyleFieldIds || {}}
                    groupTotalsByGroupId={activeViewConfig?.groupTotalsByGroupId || {}}
                    onShowNewItemModal={(prefill) => { if (prefill && Object.keys(prefill).length > 0) { setEditingItem(prefill); setGroupContext(prefill); } setShowNewItemModal(true); }}
                    onGroupContextChange={(prefill) => { console.log('[GroupContext] set from TableView:', prefill); setGroupContext(prefill); }}
                    onQuickCreateItem={handleQuickCreateItem}
                    initialSortState={activeViewConfig?.tableSortState || { column: null, direction: 'asc' }}
                    onSortStateChange={(state) => {
                      if (!activeView) return;
                      viewHooks.updateView(activeView, { tableSortState: state });
                    }}
                    initialExpandedGroups={activeViewConfig?.expandedGroups}
                    onExpandedGroupsChange={(groupPaths) => {
                      if (!activeView) return;
                      viewHooks.updateView(activeView, { expandedGroups: groupPaths });
                    }}
                    totalFields={activeViewConfig?.totalFields || {}}
                    onSetTotalField={(fieldId: string, totalType: string | null) => {
                      if (!activeView) return;
                      const currentTotalFields = activeViewConfig?.totalFields || {};
                      const nextTotalFields = { ...currentTotalFields };
                      if (totalType === null) {
                        delete nextTotalFields[fieldId];
                      } else {
                        nextTotalFields[fieldId] = totalType;
                      }
                      viewHooks.updateView(activeView, { totalFields: nextTotalFields });
                    }}
                    onBulkImportItad={isSteamPluginActive ? handleBulkImportItad : undefined}
                    onReorderField={viewHooks.updateViewFieldOrder}
                  />
                )}
                {activeViewConfig?.type === 'kanban' && (
                  <KanbanView
                    collection={currentCollection}
                    items={filteredItems}
                    onEdit={(item: any) => itemHooks.updateItem(item)}
                    onDelete={itemHooks.deleteItem}
                    onViewDetail={(item: any) => {
                      const itemCollection = collectionsWithCalculatedFields.find((col) => col.id === item.__collectionId || col.items?.some((it: any) => it.id === item.id));
                      setEditingItem(item);
                      setModalCollection(itemCollection || null);
                      setShowNewItemModal(true);
                    }}
                    groupBy={activeViewConfig?.groupBy}
                    hiddenFields={activeViewConfig?.hiddenFields || []}
                    filters={activeViewConfig?.filters || []}
                    orderedProperties={orderedProperties}
                    onChangeGroupBy={(groupBy: string) => {
                      const updatedViews = { ...views } as Record<string, any[]>;
                      const viewIndex = updatedViews[activeCollection].findIndex(
                        (v) => v.id === activeView
                      );
                      updatedViews[activeCollection][viewIndex].groupBy = groupBy;
                      setViews(updatedViews);
                    }}
                    collections={collectionsWithCalculatedFields}
                    onRelationChange={(prop: any, item: any, val: any) => {
                      const updatedItem = { ...item, [prop.id]: val };
                      itemHooks.updateItem(updatedItem);
                    }}
                    onNavigateToCollection={handleNavigateToCollection}
                    columnSettings={activeViewConfig?.kanbanColumnSettings || {}}
                    showFieldsOnHover={Boolean(activeViewConfig?.kanbanShowFieldsOnHover)}
                    onUpdateViewConfig={(updates: Record<string, any>) => {
                      if (!activeView) return;
                      viewHooks.updateView(activeView, updates);
                    }}
                    onShowNewItemModal={(prefill) => { if (prefill && Object.keys(prefill).length > 0) { setEditingItem(prefill); setGroupContext(prefill); } setShowNewItemModal(true); }}
                  />
                )}
                {activeViewConfig?.type === 'calendar' && (
                  <CalendarView
                    collection={currentCollection}
                    items={filteredItems}
                    onEdit={(item: any) => itemHooks.updateItem(item)}
                    onDelete={itemHooks.deleteItem}
                    onViewDetail={(item: any) => {
                      const itemCollection = collectionsWithCalculatedFields.find((col) => col.id === item.__collectionId || col.items?.some((it: any) => it.id === item.id));
                      setEditingItem(item);
                      setModalCollection(itemCollection || null);
                      setShowNewItemModal(true);
                    }}
                    onRelationChange={(prop: any, item: any, val: any) => {
                      const updatedItem = { ...item, [prop.id]: val };
                      itemHooks.updateItem(updatedItem);
                    }}
                    dateProperty={activeViewConfig?.dateProperty}
                    hiddenFields={activeViewConfig?.hiddenFields || []}
                    collections={collectionsWithCalculatedFields}
                    viewConfig={activeViewConfig}
                    views={views}
                    relationFilter={relationFilter}
                    activeCollectionId={activeCollection}
                    onChangeDateProperty={(propId: string) => {
                      const updatedViews = { ...views } as Record<string, any[]>;
                      const viewIndex = updatedViews[activeCollection].findIndex(
                        (v) => v.id === activeView
                      );
                      updatedViews[activeCollection][viewIndex].dateProperty = propId;
                      setViews(updatedViews);
                    }}
                    onUpdateViewConfig={(updates: Record<string, any>) => {
                      if (!activeCollection) return;
                      const updatedViews = { ...views } as Record<string, any[]>;
                      const viewIndex = updatedViews[activeCollection].findIndex(
                        (v) => v.id === activeView
                      );
                      if (viewIndex === -1) return;
                      updatedViews[activeCollection][viewIndex] = {
                        ...updatedViews[activeCollection][viewIndex],
                        ...updates,
                      };
                      setViews(updatedViews);
                    }}
                    onShowNewItemModalForCollection={(collection, item) => {
                      setModalCollection(collection);
                      setEditingItem(item || null);
                      setShowNewItemModal(true);
                    }}
                  />
                )}
                {activeViewConfig?.type === 'layout' && (
                  <LayoutView
                    viewConfig={activeViewConfig}
                    collection={currentCollection}
                    collections={collectionsWithCalculatedFields}
                    views={views}
                    items={filteredItems}
                    orderedProperties={orderedProperties}
                    relationFilter={relationFilter}
                    activeCollectionId={activeCollection}
                    onEdit={(item: any) => itemHooks.updateItem(item)}
                    onDelete={itemHooks.deleteItem}
                    onViewDetail={(item: any) => {
                      const itemCollection = collectionsWithCalculatedFields.find((col) => col.id === item.__collectionId || col.items?.some((it: any) => it.id === item.id));
                      setEditingItem(item);
                      setModalCollection(itemCollection || null);
                      setShowNewItemModal(true);
                    }}
                    onRelationChange={(prop: any, item: any, val: any) => {
                      const updatedItem = { ...item, [prop.id]: val };
                      itemHooks.updateItem(updatedItem);
                    }}
                    onUpdateViewConfig={(viewId, updates) => {
                      if (!activeCollection) return;
                      const updatedViews = { ...views } as Record<string, any[]>;
                      const viewIndex = updatedViews[activeCollection].findIndex((v) => v.id === viewId);
                      if (viewIndex === -1) return;
                      updatedViews[activeCollection][viewIndex] = {
                        ...updatedViews[activeCollection][viewIndex],
                        ...updates,
                      };
                      setViews(updatedViews);
                    }}
                    onShowNewItemModalForCollection={(collection, item) => {
                      setModalCollection(collection);
                      setEditingItem(item || null);
                      setShowNewItemModal(true);
                    }}
                    onBulkImportItad={isSteamPluginActive ? handleBulkImportItad : undefined}
                  />
                )}
                  </motion.div>
                </ContextMenuTrigger>
                <ContextMenuContent className="min-w-[200px]">
                  <ContextMenuItem
                    onSelect={() => {
                      if (!canEdit) return;
                      setShowNewItemModal(true);
                    }}
                    className={!canEdit ? 'opacity-60 pointer-events-none' : ''}
                  >
                    <Plus size={14} className="mr-2 text-emerald-400" />
                    <span>{currentCollection?.name ? `Nouveau ${currentCollection.name}` : 'Nouvel élément'}</span>
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => {
                      if (!canEdit) return;
                      handleQuickCreateItem();
                    }}
                    className={!canEdit ? 'opacity-60 pointer-events-none' : ''}
                  >
                    <Zap size={14} className="mr-2 text-amber-400" />
                    <span>Création rapide</span>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </>
          )}
        </SidebarInset>
      </SidebarProvider>

      <CommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        collections={collections}
        views={views}
        dashboards={sortedDashboards}
        organizations={organizations}
        activeOrganizationId={activeOrganizationId}
        theme={theme}
        onSelectCollection={(collectionId) => {
          setShowAutomations(false);
          setActiveDashboard(null);
          setActiveCollection(collectionId);
          const lastViewId = localStorage.getItem(`erp_lastView_${collectionId}`);
          setActiveView(lastViewId || 'default');
          setRelationFilter({ collectionId: null, ids: [] });
        }}
        onSelectView={(collectionId, viewId) => {
          setActiveDashboard(null);
          setActiveCollection(collectionId);
          setActiveView(viewId);
          localStorage.setItem(`erp_lastView_${activeOrganizationId || 'default'}_${collectionId}`, viewId);
          setRelationFilter({ collectionId: null, ids: [] });
        }}
        onSelectDashboard={(dashboardId) => {
          setShowAutomations(false);
          setActiveDashboard(dashboardId);
          setActiveCollection(null);
          setActiveView(null);
          setRelationFilter({ collectionId: null, ids: [] });
        }}
        onSelectItem={(collectionId, itemId) => {
          setShowAutomations(false);
          setActiveDashboard(null);
          const collection = collections.find((c) => c.id === collectionId);
          const item = collection?.items.find((it: any) => it.id === itemId);
          if (item) {
            setActiveCollection(collectionId);
            setEditingItem(item);
            setShowNewItemModal(true);
          }
        }}
        onCreateCollection={() => setShowNewCollectionModal(true)}
        onCreateDashboard={handleCreateDashboard}
        onSwitchOrganization={switchOrganization}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onLogout={logout}
        onShowAutomations={() => {
          setShowAutomations(true);
          setActiveDashboard(null);
          setActiveCollection(null);
        }}
      />

      {showNewCollectionModal && (
        <NewCollectionModal
          onClose={() => setShowNewCollectionModal(false)}
          onSave={(name, icon, color) => {
            collectionHooks.addCollection(name, icon, color);
            setShowNewCollectionModal(false);
          }}
        />
      )}
      {showEditCollectionModal && editingCollection && (
        <EditCollectionModal
          onClose={() => {
            setShowEditCollectionModal(false);
            setEditingCollection(null);
          }}
          onSave={(updatedCollection) => {
            collectionHooks.updateCollection(updatedCollection);
            setShowEditCollectionModal(false);
          }}
          onDelete={(collectionId) => {
            collectionHooks.deleteCollection(collectionId);
            setShowEditCollectionModal(false);
          }}
          collection={editingCollection}
        />
      )}
      {viewVisibilityTarget && (
        <ViewVisibilityModal
          view={
            views[viewVisibilityTarget.collectionId]?.find(
              (v: any) => v.id === viewVisibilityTarget.viewId
            )
          }
          roles={availableRoles}
          users={availableUsers}
          onClose={() => setViewVisibilityTarget(null)}
          onSave={(roleIds, userIds) => {
            viewHooks.updateViewVisibility(viewVisibilityTarget.viewId, roleIds, userIds);
            setViewVisibilityTarget(null);
          }}
        />
      )}
      {showPropertyModal && activeCollection && (
        <PropertyModal
          onClose={() => {
            setShowPropertyModal(false);
            setEditingProperty(null);
          }}
          onSave={(property) => {
            if (editingProperty) {
              // Modification
              collectionHooks.updateProperty(property);
            } else {
              // Création
              collectionHooks.addProperty(property);
            }
            setShowPropertyModal(false);
            setEditingProperty(null);
          }}
          property={editingProperty}
          collections={collections}
          currentCollectionId={activeCollection || ''}
        />
      )}
      {showNewItemModal && (
        <NewItemModal
          collection={modalCollection || currentCollection!}
          collections={collections}
          favorites={favorites}
          orderedProperties={(() => {
            const col = modalCollection || currentCollection;
            if (!col) return [];
            const view = views[col.id]?.find((v: any) => v.id === activeView);
            return view?.fieldOrder
              ? view.fieldOrder.map((fid: string) => col.properties.find((p: any) => p.id === fid)).filter(Boolean)
              : col.properties;
          })()}
          onClose={() => {
            setShowNewItemModal(false);
            setEditingItem(null);
            setModalCollection(null);
          }}
          onSave={(item) => {
            // Correction : toujours utiliser __collectionId pour cibler la collection choisie dans la modale
            const colId = item.__collectionId || (modalCollection && modalCollection.id) || (currentCollection && currentCollection.id);
            // On mémorise la dernière collection utilisée pour la préselection
            setModalCollection(collections.find(c => c.id === colId) || null);
            // On retire __collectionId de l'objet avant sauvegarde réelle (pour ne pas polluer les données)
            const { __collectionId, ...itemToSave } = item;
            itemHooks.saveItem(itemToSave, editingItem, colId);
            setShowNewItemModal(false);
            setEditingItem(null);
            // setModalCollection(null); // On ne reset plus pour garder la préselection
          }}
          onDelete={(itemId) => {
            const colId = (editingItem && editingItem.__collectionId)
              || (modalCollection && modalCollection.id)
              || (currentCollection && currentCollection.id);
            if (!colId) return;
            itemHooks.deleteItem(itemId, colId);
            setShowNewItemModal(false);
            setEditingItem(null);
          }}
          onSaveAndStay={(item) => {
            const colId = item.__collectionId || (modalCollection && modalCollection.id) || (currentCollection && currentCollection.id);
            setModalCollection(collections.find(c => c.id === colId) || null);
            const { __collectionId, ...itemToSave } = item;
            itemHooks.saveItem(itemToSave, editingItem, colId);
            setEditingItem({ ...itemToSave, __collectionId: colId });
          }}
          editingItem={editingItem}
          groupContext={groupContext}
          fieldGroups={(() => {
            const col = modalCollection || currentCollection;
            if (!col) return [];
            const view = views[col.id]?.find((v: any) => v.id === activeView);
            return view?.fieldGroups || [];
          })()}
          onToggleFavoriteItem={(itemId: string) => {
            setFavorites((prev) => ({
              ...prev,
              items: prev.items.includes(itemId)
                ? prev.items.filter((id) => id !== itemId)
                : [...prev.items, itemId],
            }));
          }}
          onOpenRelatedItem={(targetCollection, targetItem) => {
            setModalCollection(targetCollection || null);
            setEditingItem(targetItem || null);
            setShowNewItemModal(true);
          }}
        />
      )}
      {showFilterModal && (
        <FilterModal
          properties={currentCollection?.properties || []}
          collections={collections}
          initialFilter={
            editingFilterIndex !== null
              ? activeViewConfig?.filters?.[editingFilterIndex] || null
              : null
          }
          onClose={() => {
            setShowFilterModal(false);
            setEditingFilterIndex(null);
          }}
          onAdd={(property, operator, value, sourceCollectionId, filterMeta) => {
            if (editingFilterIndex !== null) {
              viewHooks.updateFilter(editingFilterIndex, property, operator, value, sourceCollectionId, filterMeta);
            } else {
              viewHooks.addFilter(property, operator, value, sourceCollectionId, filterMeta);
            }
            setShowFilterModal(false);
            setEditingFilterIndex(null);
          }}
        />
      )}
      {showGroupModal && (
        <GroupModal
          properties={orderedProperties || []}
          collections={collectionsWithCalculatedFields || []}
          currentGroups={activeViewConfig?.groups || []}
          initialGroupTotalsByGroupId={activeViewConfig?.groupTotalsByGroupId || {}}
          initialGroupDisplayModes={activeViewConfig?.groupDisplayModes || {}}
          initialGroupDisplayColumnCounts={activeViewConfig?.groupDisplayColumnCounts || {}}
          initialGroupTabStyleFieldIds={activeViewConfig?.groupTabStyleFieldIds || {}}
          initialDefaultGroupDisplayMode={activeViewConfig?.groupDisplayMode || 'accordion'}
          initialDefaultGroupDisplayColumnCount={activeViewConfig?.groupDisplayColumnCount || 3}
          onClose={() => setShowGroupModal(false)}
          onSave={(groups, groupTotalsByGroupId, groupDisplayModes, groupDisplayColumnCounts, groupTabStyleFieldIds) => {
            if (!activeView) return;
            viewHooks.updateView(activeView, {
              groups,
              groupTotalsByGroupId,
              groupDisplayModes,
              groupDisplayColumnCounts,
              groupTabStyleFieldIds,
              groupDisplayMode: groups[0] ? (groupDisplayModes[groups[0]] || 'accordion') : 'accordion',
              groupDisplayColumnCount: groups[0] ? (groupDisplayColumnCounts[groups[0]] || 3) : 3,
            });
            setShowGroupModal(false);
          }}
        />
      )}
      {showNewViewModal && (
        <NewViewModal
          collection={currentCollection}
          availableViews={currentCollection ? (views[currentCollection.id] || []) : []}
          collections={collections}
          allViews={views}
          onClose={() => setShowNewViewModal(false)}
          mode="create"
          onSave={(name, type, config) => {
            if (!type) return;
            viewHooks.addView(name, type, config);
            setShowNewViewModal(false);
          }}
        />
      )}
      {showEditViewModal && editingViewId && (
        <NewViewModal
          collection={currentCollection}
          availableViews={currentCollection ? (views[currentCollection.id] || []) : []}
          collections={collections}
          allViews={views}
          view={(views[activeCollection || ''] || []).find((v: any) => v.id === editingViewId)}
          mode="edit"
          onClose={() => {
            setShowEditViewModal(false);
            setEditingViewId(null);
          }}
          onSave={(updates) => {
            if (!editingViewId) return;
            viewHooks.updateView(editingViewId, updates);
            setShowEditViewModal(false);
            setEditingViewId(null);
          }}
        />
      )}
      {viewVisibilityTarget && (
        <ViewVisibilityModal
          view={(views[viewVisibilityTarget.collectionId] || []).find(
            (v) => v.id === viewVisibilityTarget.viewId
          )}
          roles={availableRoles}
          users={availableUsers}
          onClose={() => setViewVisibilityTarget(null)}
          onSave={(roleIds, userIds) => {
            viewHooks.updateViewVisibility(viewVisibilityTarget.viewId, roleIds, userIds);
            setViewVisibilityTarget(null);
          }}
        />
      )}
      {showAccessManager && canManagePermissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background dark:bg-neutral-900 bg-opacity-60">
          <div className="bg-background dark:bg-neutral-900 rounded-lg shadow-lg p-6 min-w-[400px] max-w-[90vw] max-h-[90vh] overflow-auto relative">
            <AccessManager
              collections={collections}
              dashboards={dashboards}
              onClose={() => setShowAccessManager(false)}
              onUpdateDashboards={(nextDashboards) => setDashboards(nextDashboards)}
              onImportCollections={(importedData) => {
                // Supporte l'ancien format (array) ou le nouveau (objet)
                let collectionsToImport = importedData;
                let favoritesToImport = undefined;
                let rolesToImport = undefined;
                let usersToImport = undefined;
                if (Array.isArray(importedData)) {
                  collectionsToImport = importedData;
                } else if (
                  typeof importedData === 'object' &&
                  importedData !== null &&
                  'collections' in importedData
                ) {
                  const dataObj = importedData as {
                    collections?: any[];
                    favorites?: any;
                    roles?: any[];
                    users?: any[];
                  };
                  collectionsToImport = dataObj.collections || [];
                  favoritesToImport = dataObj.favorites;
                  rolesToImport = dataObj.roles;
                  usersToImport = dataObj.users;
                }
                setCollections(collectionsToImport);
                // Générer les vues par défaut si absentes pour éviter undefined
                const newViews: Record<string, any[]> = {};
                collectionsToImport.forEach((col: any) => {
                  if (Array.isArray(col.views)) {
                    newViews[col.id] = col.views;
                  } else {
                    newViews[col.id] = [
                      {
                        id: 'default',
                        name: 'Vue par défaut',
                        type: 'table',
                        hiddenFields: [],
                        filters: [],
                        groups: [],
                        groupBy: null,
                        dateProperty: null,
                      },
                    ];
                  }
                });
                setViews(newViews);
                if (
                  favoritesToImport &&
                  typeof favoritesToImport === 'object' &&
                  Array.isArray(favoritesToImport.views) &&
                  Array.isArray(favoritesToImport.items)
                ) {
                  setFavorites(favoritesToImport);
                } else {
                  setFavorites({ views: [], items: [] });
                }
                if (Array.isArray(rolesToImport)) setAvailableRoles(rolesToImport);
                if (Array.isArray(usersToImport)) setAvailableUsers(usersToImport);
                setActiveCollection(null);
                setActiveView(null);
                setActiveDashboard(null);
                setRelationFilter({ collectionId: null, ids: [] });
                alert('Données importées !');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
