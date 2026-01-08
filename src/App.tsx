import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import KanbanView from '@/components/KanbanView';
import CalendarView from '@/components/CalendarView';
import TableView from '@/components/TableView';
import ShinyButton from '@/components/ShinyButton';
import LoginPage from '@/components/LoginPage';
import AccessManager from '@/components/AccessManager';
import AppHeader from '@/components/AppHeader';
import Sidebar from '@/components/Sidebar';
import ViewToolbar from '@/components/ViewToolbar';
import { useAuth } from '@/auth/AuthProvider';
import NewCollectionModal from '@/components/modals/NewCollectionModal';
import EditCollectionModal from '@/components/modals/EditCollectionModal';
import NewPropertyModal from '@/components/modals/NewPropertyModal';
import EditPropertyModal from '@/components/modals/EditPropertyModal';
import NewItemModal from '@/components/modals/NewItemModal';
import FilterModal from '@/components/modals/FilterModal';
import GroupModal from '@/components/modals/GroupModal';
import NewViewModal from '@/components/modals/NewViewModal';
import { API_URL, defaultCollections, defaultViews } from '@/lib/constants';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useCollections } from '@/lib/hooks/useCollections';
import { useItems } from '@/lib/hooks/useItems';
import { useViews } from '@/lib/hooks/useViews';
import { getFilteredItems, getOrderedProperties } from '@/lib/filterUtils';

const App = () => {
  const { user, loading: authLoading, login, register, logout, impersonate, impersonatedRoleId } = useAuth();
  const [collections, setCollections] = useState<any[]>(defaultCollections);
  const [views, setViews] = useState<Record<string, any[]>>(defaultViews);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [showNewPropertyModal, setShowNewPropertyModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
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

  // Hooks personnalisés
  const { canEditField, canEdit, canManagePermissions } = usePermissions(activeCollection);

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
  const { currentViews, currentViewConfig } = viewHooks;

  useEffect(() => {
    const loadState = async () => {
      if (authLoading) return;
      if (!user) {
        setCollections(defaultCollections);
        setViews(defaultViews);
        setActiveCollection(null);
        setActiveView(null);
        setIsLoaded(true);
        return;
      }
      try {
        const res = await fetch(`${API_URL}/state`, { credentials: 'include' });
        if (res.status === 401) {
          await logout();
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data?.collections && data?.views) {
            setCollections(data.collections);
            setViews(data.views);
            setActiveCollection(data.activeCollection || null);
            setActiveView(data.activeView || null);
            setIsLoaded(true);
            return;
          }
        }
      } catch (err) {
        console.error('Impossible de charger les données', err);
      }
      setCollections(defaultCollections);
      setViews(defaultViews);
      setActiveCollection(null);
      setActiveView(null);
      setIsLoaded(true);
    };

    loadState();
  }, [authLoading, user, logout]);

  useEffect(() => {
    const loadRoles = async () => {
      if (!canManagePermissions) return;
      try {
        const res = await fetch(`${API_URL}/roles`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setAvailableRoles(data || []);
        }
      } catch (err) {
        console.error('Impossible de charger les rôles', err);
      }
    };
    loadRoles();
  }, [canManagePermissions]);

  useEffect(() => {
    if (!isLoaded || !user || !canEdit) return;
    const saveState = async () => {
      try {
        await fetch(`${API_URL}/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ collections, views, activeCollection, activeView }),
        });
      } catch (err) {
        console.error('Impossible de sauvegarder les données', err);
      }
    };
    saveState();
  }, [collections, views, activeCollection, activeView, isLoaded, user, canEdit]);

  const handleNavigateToCollection = (collectionId: string, linkedIds?: string[]) => {
    setActiveCollection(collectionId);
    setActiveView('default');
    if (linkedIds && linkedIds.length > 0) {
      setRelationFilter({ collectionId, ids: linkedIds });
    } else {
      setRelationFilter({ collectionId: null, ids: [] });
    }
  };

  const clearRelationFilter = () => setRelationFilter({ collectionId: null, ids: [] });

  const orderedProperties = getOrderedProperties(currentCollection, currentViewConfig);

  const filteredItems = getFilteredItems(
    currentCollection,
    currentViewConfig,
    relationFilter,
    activeCollection,
    collections
  );

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030303] text-white">
        <div className="text-neutral-400">Chargement de l'authentification…</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={login} onRegister={register} loading={authLoading} />;
  }

  return (
    <div className="h-screen flex flex-col bg-[#030303] text-white">
      <style>{`
        @property --gradient-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes border-spin {
          from { --gradient-angle: 0deg; }
          to { --gradient-angle: 360deg; }
        }
        .animate-border-spin {
          animation: border-spin 2s linear infinite;
        }
      `}</style>

      <AppHeader
        canEdit={canEdit}
        canManagePermissions={canManagePermissions}
        impersonatedRoleId={impersonatedRoleId}
        availableRoles={availableRoles}
        onNewCollection={() => setShowNewCollectionModal(true)}
        onImpersonate={impersonate}
        onShowAccessManager={() => setShowAccessManager(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          collections={collections}
          activeCollection={activeCollection}
          onSelectCollection={(collectionId) => {
            setActiveCollection(collectionId);
            setActiveView('default');
            setRelationFilter({ collectionId: null, ids: [] });
          }}
          onEditCollection={(col) => {
            setEditingCollection(col);
            setShowEditCollectionModal(true);
          }}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {!activeCollection ? (
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
                currentViews={currentViews}
                currentViewConfig={currentViewConfig}
                activeView={activeView}
                orderedProperties={orderedProperties}
                collections={collections}
                canEdit={canEdit}
                showViewSettings={showViewSettings}
                relationFilter={relationFilter}
                activeCollection={activeCollection}
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
              />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex-1 overflow-auto p-6"
              >
                {currentViewConfig?.type === 'table' && (
                  <TableView
                    collection={currentCollection}
                    items={filteredItems}
                    onEdit={(item: any) => itemHooks.updateItem(item)}
                    onDelete={itemHooks.deleteItem}
                    onViewDetail={(item: any) => {
                      if (canEdit) {
                        setEditingItem(item);
                        setShowNewItemModal(true);
                      }
                    }}
                    hiddenFields={currentViewConfig?.hiddenFields || []}
                    orderedProperties={orderedProperties}
                    canEdit={canEdit}
                    canEditField={canEditField}
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
                    groups={currentViewConfig?.groups || []}
                  />
                )}
                {currentViewConfig?.type === 'kanban' && (
                  <KanbanView
                    collection={currentCollection}
                    items={filteredItems}
                    onEdit={(item: any) => itemHooks.updateItem(item)}
                    onDelete={itemHooks.deleteItem}
                    onViewDetail={(item: any) => {
                      if (canEdit) {
                        setEditingItem(item);
                        setShowNewItemModal(true);
                      }
                    }}
                    groupBy={currentViewConfig?.groupBy}
                    hiddenFields={currentViewConfig?.hiddenFields || []}
                    canEdit={canEdit}
                    canEditField={canEditField}
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
                {currentViewConfig?.type === 'calendar' && (
                  <CalendarView
                    collection={currentCollection}
                    items={filteredItems}
                    onEdit={(item: any) => itemHooks.updateItem(item)}
                    onDelete={itemHooks.deleteItem}
                    onViewDetail={(item: any) => {
                      if (canEdit) {
                        setEditingItem(item);
                        setShowNewItemModal(true);
                      }
                    }}
                    dateProperty={currentViewConfig?.dateProperty}
                    hiddenFields={currentViewConfig?.hiddenFields || []}
                    collections={collections}
                    canEdit={canEdit}
                    canEditField={canEditField}
                    onChangeDateProperty={(propId: string) => {
                      const updatedViews = { ...views } as Record<string, any[]>;
                      const viewIndex = updatedViews[activeCollection].findIndex(
                        (v) => v.id === activeView
                      );
                      updatedViews[activeCollection][viewIndex].dateProperty = propId;
                      setViews(updatedViews);
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
          collection={currentCollection!}
          collections={collections}
          onClose={() => {
            setShowNewItemModal(false);
            setEditingItem(null);
          }}
          onSave={(item) => {
            itemHooks.saveItem(item, editingItem);
            setShowNewItemModal(false);
            setEditingItem(null);
          }}
          editingItem={editingItem}
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
      {showAccessManager && canManagePermissions && (
        <AccessManager collections={collections} onClose={() => setShowAccessManager(false)} />
      )}
    </div>
  );
};

export default App;
