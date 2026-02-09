


import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useErpSync } from '@/lib/useErpSync';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import KanbanView from '@/components/views/KanbanView';
import CalendarView from '@/components/views/CalendarView';
import TableView from '@/components/views/TableView';
import ShinyButton from '@/components/ui/ShinyButton';
import LoginPage from '@/components/pages/LoginPage';
import AccessManager from '@/components/admin/AccessManager';
import AppHeader from '@/components/layout/AppHeader';
import Sidebar from '@/components/menus/Sidebar';
import ViewToolbar from '@/components/views/ViewToolbar';
import { useAuth } from '@/auth/AuthProvider';
import NewCollectionModal from '@/components/modals/NewCollectionModal';
import EditCollectionModal from '@/components/modals/EditCollectionModal';
import NewPropertyModal from '@/components/modals/NewPropertyModal';
import EditPropertyModal from '@/components/modals/EditPropertyModal';
import NewItemModal from '@/components/modals/NewItemModal';
import FilterModal from '@/components/modals/FilterModal';
import GroupModal from '@/components/modals/GroupModal';
import NewViewModal from '@/components/modals/NewViewModal';
import ViewVisibilityModal from '@/components/modals/ViewVisibilityModal';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { API_URL, defaultCollections, defaultDashboards, defaultViews } from '@/lib/constants';
import { useErpState } from '@/lib/useErpState';
import { useCanEdit, useCanEditField, useCanManagePermissions } from '@/lib/hooks/useCanEdit';
import { useCollections } from '@/lib/hooks/useCollections';
import { useItems } from '@/lib/hooks/useItems';
import { useViews } from '@/lib/hooks/useViews';
import { getFilteredItems, getOrderedProperties } from '@/lib/filterUtils';
import { MonthlyDashboardConfig } from '@/lib/dashboardTypes';

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

    // Nettoie récursivement un objet pour supprimer les cycles et les clés privées (commençant par _)
function cleanForSave(obj: any, seen: WeakSet<object> = new WeakSet()): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return undefined;
  seen.add(obj);
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanForSave(item, seen)).filter((v) => v !== undefined);
  }
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    // On NE filtre plus les clés commençant par _ pour garder _eventSegments
    const val = cleanForSave(obj[key], seen);
    if (val !== undefined) result[key] = val;
  }
  return result;
}
  // Filtres par dashboard (clé = dashboard.id)
  const [dashboardFilters, setDashboardFilters] = useState<Record<string, any[]>>({});
  const {
    user,
    roles: userRoles,
    loading: authLoading,
    login,
    register,
    logout,
    impersonate,
    impersonatedRoleId
  } = useAuth();
  const [collections, setCollections] = useState<any[]>(defaultCollections);
  // console.log(collections);
  const [views, setViews] = useState<Record<string, any[]>>(defaultViews);
  const [dashboards, setDashboards] = useState<MonthlyDashboardConfig[]>(defaultDashboards);
  const [dashboardSort, setDashboardSort] = useState<'created' | 'name-asc' | 'name-desc'>('created');
  // State ERP global (activeCollection, activeView, activeDashboard)
  const {
    activeCollection,
    setActiveCollection,
    activeView,
    setActiveView,
    activeDashboard,
    setActiveDashboard
  } = useErpState();
  const [isLoaded, setIsLoaded] = useState(false);

  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [showNewPropertyModal, setShowNewPropertyModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [modalCollection, setModalCollection] = useState<any>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showNewViewModal, setShowNewViewModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [showEditPropertyModal, setShowEditPropertyModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [showEditCollectionModal, setShowEditCollectionModal] = useState(false);
  const [showViewSettings, setShowViewSettings] = useState(false);
  const [relationFilter, setRelationFilter] = useState<{ collectionId: string | null; ids: string[] }>({
    collectionId: null,
    ids: []
  });
  const [showAccessManager, setShowAccessManager] = useState(false);
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

  const viewHooks = useViews(views, setViews, activeCollection, activeView, setActiveView);
  const currentCollection = collections.find((c) => c.id === activeCollection);
  const { currentViews } = viewHooks;
  const activeDashboardConfig = dashboards.find((d) => d.id === activeDashboard) || null;

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
    socket
  });
 useEffect(() => {
    // Hot reload sur événement 'stateUpdated' reçu du serveur
    // Pour éviter les reloads en boucle, on garde l'heure du dernier reload et un flag local
    const loadUsers = async () => {
      if (!user) return;
      try {
        const res = await fetch(`${API_URL}/users`, { credentials: 'include' });
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
    if (!activeCollection) return;
    if (visibleViews.length === 0) {
      if (activeView !== null) setActiveView(null);
      return;
    }
    // Si la vue active existe dans la collection courante, on la garde
    const found = visibleViews.find((v: any) => v.id === activeView);
    if (!found) {
      setActiveView(visibleViews[0].id);
    }
    // Sinon, on ne touche pas à activeView
  }, [activeCollection, activeView, visibleViews]);

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
    const newDashboard: MonthlyDashboardConfig = {
      id: Date.now().toString(),
      name: `Dashboard ${dashboards.length + 1}`,
      sourceCollectionId: collections[0]?.id || null,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      includeWeekends: false,
      typeField: null,
      globalDateField: null,
      globalDateRange: { startField: null, endField: null },
      globalDurationField: null,
      columnTree: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    setDashboards((prev) => [...prev, newDashboard]);
    setActiveDashboard(newDashboard.id);
    setActiveCollection(null);
    setActiveView(null);
    setRelationFilter({ collectionId: null, ids: [] });
  };

  const handleUpdateDashboard = (dashboardId: string, patch: Partial<MonthlyDashboardConfig>) => {
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
    const clone: MonthlyDashboardConfig = {
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

  const orderedProperties = getOrderedProperties(currentCollection, activeViewConfig);

  const filteredItems = getFilteredItems(
    currentCollection,
    activeViewConfig,
    relationFilter,
    activeCollection,
    collections
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

      

      <AppHeader
        impersonatedRoleId={impersonatedRoleId}
        availableRoles={availableRoles}
        onNewCollection={() => setShowNewCollectionModal(true)}
        onImpersonate={impersonate}
        onShowAccessManager={() => setShowAccessManager(true)}
        theme={theme}
        setTheme={setTheme}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collections={collections}
          views={views}
          dashboards={sortedDashboards}
          favorites={favorites}
          activeCollection={activeCollection}
          userRoleIds={userRoleIds}
          userId={user?.id || null}
          onSelectCollection={(collectionId) => {
            setActiveDashboard(null);
            setActiveCollection(collectionId);
            setActiveView('default');
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
            setActiveDashboard(dashboardId);
            setActiveCollection(null);
            setActiveView(null);
            setRelationFilter({ collectionId: null, ids: [] });
          }}
          onCreateDashboard={handleCreateDashboard}
          onDeleteDashboard={handleDeleteDashboard}
          onDuplicateDashboard={handleDuplicateDashboard}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeDashboard ? (
            <DashboardShell
              dashboard={activeDashboardConfig}
              collections={collections}
              onUpdate={(patch) => activeDashboard && handleUpdateDashboard(activeDashboard, patch)}
              onViewDetail={(item: any) => {
                const itemCollection = collections.find((col) => col.id === item.__collectionId || col.items?.some((it: any) => it.id === item.id));
                setEditingItem(item);
                setModalCollection(itemCollection || null);
                setShowNewItemModal(true);
              }}
              onDelete={(id: string) => {
                // Optionnel : suppression d'un item depuis le dashboard
              }}
              dashboardFilters={dashboardFilters}
              setDashboardFilters={setDashboardFilters}
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
                onShowFilterModal={() => setShowFilterModal(true)}
                onShowGroupModal={() => setShowGroupModal(true)}
                onShowNewPropertyModal={() => setShowNewPropertyModal(true)}
                onShowNewItemModal={() => setShowNewItemModal(true)}
                onSetShowViewSettings={setShowViewSettings}
                onToggleFieldVisibility={viewHooks.toggleFieldVisibility}
                onUpdateViewFieldOrder={viewHooks.updateViewFieldOrder}
                onEditProperty={(prop) => {
                  setEditingProperty(prop);
                  setShowEditPropertyModal(true);
                }}
                onRemoveFilter={viewHooks.removeFilter}
                onClearRelationFilter={clearRelationFilter}
                onRemoveGroup={viewHooks.removeGroup}
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
              />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex-1 overflow-auto p-6"
              >
                {activeViewConfig?.type === 'table' && (
                  <TableView
                    collection={currentCollection}
                    items={filteredItems}
                    onEdit={(item: any) => itemHooks.updateItem(item)}
                    onDelete={itemHooks.deleteItem}
                    onViewDetail={(item: any) => {
                      const itemCollection = collections.find((col) => col.id === item.__collectionId || col.items?.some((it: any) => it.id === item.id));
                      setEditingItem(item);
                      setModalCollection(itemCollection || null);
                      setShowNewItemModal(true);
                    }}
                    hiddenFields={activeViewConfig?.hiddenFields || []}
                    orderedProperties={orderedProperties}
                    onReorderItems={(nextItems: any[]) => {
                      const updatedCollections = collections.map((col) => {
                        if (col.id === activeCollection) {
                          return { ...col, items: nextItems };
                        }
                        return col;
                      });
                      setCollections(updatedCollections);
                    }}
                    onToggleField={viewHooks.toggleFieldVisibility}
                    onDeleteProperty={collectionHooks.deleteProperty}
                    onEditProperty={(prop: any) => {
                      setEditingProperty(prop);
                      setShowEditPropertyModal(true);
                    }}
                    collections={collections}
                    onRelationChange={(prop: any, item: any, val: any) => {
                      const updatedItem = { ...item, [prop.id]: val };
                      itemHooks.updateItem(updatedItem);
                    }}
                    onNavigateToCollection={handleNavigateToCollection}
                    groups={activeViewConfig?.groups || []}
                  />
                )}
                {activeViewConfig?.type === 'kanban' && (
                  <KanbanView
                    collection={currentCollection}
                    items={filteredItems}
                    onEdit={(item: any) => itemHooks.updateItem(item)}
                    onDelete={itemHooks.deleteItem}
                    onViewDetail={(item: any) => {
                      const itemCollection = collections.find((col) => col.id === item.__collectionId || col.items?.some((it: any) => it.id === item.id));
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
                    collections={collections}
                    onRelationChange={(prop: any, item: any, val: any) => {
                      const updatedItem = { ...item, [prop.id]: val };
                      itemHooks.updateItem(updatedItem);
                    }}
                    onNavigateToCollection={handleNavigateToCollection}
                  />
                )}
                {activeViewConfig?.type === 'calendar' && (
                  <CalendarView
                    collection={currentCollection}
                    items={filteredItems}
                    onEdit={(item: any) => itemHooks.updateItem(item)}
                    onDelete={itemHooks.deleteItem}
                    onViewDetail={(item: any) => {
                      const itemCollection = collections.find((col) => col.id === item.__collectionId || col.items?.some((it: any) => it.id === item.id));
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
                    collections={collections}
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
              </motion.div>
            </>
          )}
        </div>
      </div>

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
      {showNewPropertyModal && activeCollection && (
        <NewPropertyModal
          onClose={() => setShowNewPropertyModal(false)}
          onSave={(property) => {

            collectionHooks.addProperty(property);
            setShowNewPropertyModal(false);
          }}
          collections={collections}
          currentCollection={activeCollection}
        />
      )}
      {showEditPropertyModal && editingProperty && (
        <EditPropertyModal
          onClose={() => {
            setShowEditPropertyModal(false);
            setEditingProperty(null);
          }}
          onSave={(property) => {
            collectionHooks.updateProperty(property);
            setShowEditPropertyModal(false);
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
          editingItem={editingItem}
          onToggleFavoriteItem={(itemId: string) => {
            setFavorites((prev) => ({
              ...prev,
              items: prev.items.includes(itemId)
                ? prev.items.filter((id) => id !== itemId)
                : [...prev.items, itemId],
            }));
          }}
        />
      )}
      {showFilterModal && (
        <FilterModal
          properties={currentCollection?.properties || []}
          collections={collections}
          onClose={() => setShowFilterModal(false)}
          onAdd={(property, operator, value) => {
            viewHooks.addFilter(property, operator, value);
            setShowFilterModal(false);
          }}
        />
      )}
      {showGroupModal && (
        <GroupModal
          properties={currentCollection?.properties || []}
          onClose={() => setShowGroupModal(false)}
          onAdd={(property) => {
            viewHooks.addGroup(property);
            setShowGroupModal(false);
          }}
        />
      )}
      {showNewViewModal && (
        <NewViewModal
          collection={currentCollection}
          onClose={() => setShowNewViewModal(false)}
          onSave={(name, type, config) => {
            viewHooks.addView(name, type, config);
            setShowNewViewModal(false);
          }}
        />
      )}
      {viewVisibilityTarget && (
        <ViewVisibilityModal
          view={(views[viewVisibilityTarget.collectionId] || []).find(
            (v) => v.id === viewVisibilityTarget.viewId
          )}
          roles={availableRoles.length ? availableRoles : userRoles || []}
          users={availableUsers}
          onClose={() => setViewVisibilityTarget(null)}
          onSave={(roleIds, userIds) => {
            viewHooks.updateViewVisibility(viewVisibilityTarget.viewId, roleIds, userIds);
            setViewVisibilityTarget(null);
          }}
        />
      )}
      {showAccessManager && canManagePermissions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-neutral-900 rounded-lg shadow-lg p-6 min-w-[400px] max-w-[90vw] max-h-[90vh] overflow-auto relative">
            <AccessManager
              collections={collections}
              onClose={() => setShowAccessManager(false)}
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
