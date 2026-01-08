import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, Layers, Table, Layout, X, Settings, Calendar as CalendarIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import KanbanView from '@/components/KanbanView';
import CalendarView from '@/components/CalendarView';
import TableView from '@/components/TableView';
import ShinyButton from '@/components/ShinyButton';
import LoginPage from '@/components/LoginPage';
import AccessManager from '@/components/AccessManager';
import { useAuth } from '@/auth/AuthProvider';
import NewCollectionModal from '@/components/modals/NewCollectionModal';
import EditCollectionModal from '@/components/modals/EditCollectionModal';
import NewPropertyModal from '@/components/modals/NewPropertyModal';
import EditPropertyModal from '@/components/modals/EditPropertyModal';
import NewItemModal from '@/components/modals/NewItemModal';
import FilterModal from '@/components/modals/FilterModal';
import GroupModal from '@/components/modals/GroupModal';
import NewViewModal from '@/components/modals/NewViewModal';
import DraggableList from '@/components/DraggableList';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const PROPERTY_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  SELECT: 'select',
  MULTI_SELECT: 'multi_select',
  DATE: 'date',
  DATE_RANGE: 'date_range',
  CHECKBOX: 'checkbox',
  URL: 'url',
  EMAIL: 'email',
  PHONE: 'phone',
  RELATION: 'relation'
};

const defaultCollections: any[] = [];

const defaultViews: Record<string, any[]> = {};

const App = () => {
  const { user, loading: authLoading, login, register, logout, isAdmin, isAdminBase, isEditor, impersonate, impersonatedRoleId, permissions } = useAuth();
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
  const [relationFilter, setRelationFilter] = useState<{ collectionId: string | null; ids: string[] }>({ collectionId: null, ids: [] });
  const [showAccessManager, setShowAccessManager] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const settingsRef = useRef<HTMLDivElement>(null);

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
      if (!isAdminBase) return;
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
  }, [isAdminBase]);

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
  }, [collections, views, activeCollection, activeView, isLoaded, user]);

  const currentCollection = collections.find(c => c.id === activeCollection);
  const currentViews = activeCollection ? (views[activeCollection] || []) : [];
  const currentViewConfig = currentViews.find((v: any) => v.id === activeView) || currentViews[0];

  const hasPerm = (scope: { collectionId?: string | null; itemId?: string | null; fieldId?: string | null }, action: string) => {
    if (isAdmin) return true;
    const flag = action;
    const perms = permissions || [];
    const { collectionId = null, itemId = null, fieldId = null } = scope;

    if (fieldId) {
      const match = perms.find((p: any) => (p.field_id || null) === fieldId && (p.item_id || null) === itemId && (p.collection_id || null) === collectionId);
      if (match) return Boolean(match[flag]);
    }
    if (itemId) {
      const match = perms.find((p: any) => (p.item_id || null) === itemId && (p.collection_id || null) === collectionId && (p.field_id || null) === null);
      if (match) return Boolean(match[flag]);
    }
    if (collectionId) {
      const match = perms.find((p: any) => (p.collection_id || null) === collectionId && (p.item_id || null) === null && (p.field_id || null) === null);
      if (match) return Boolean(match[flag]);
    }
    const globalMatch = perms.find((p: any) => (p.collection_id || null) === null && (p.item_id || null) === null && (p.field_id || null) === null);
    if (globalMatch) return Boolean(globalMatch[flag]);
    return false;
  };

  const canEditField = (fieldId: string) => {
    if (isAdmin || isEditor) return true;
    return hasPerm({ collectionId: activeCollection, fieldId }, 'can_write');
  };

  const canEdit = isAdmin || isEditor || hasPerm({}, 'can_write') || (activeCollection ? hasPerm({ collectionId: activeCollection }, 'can_write') : false);
  const canManagePermissions = isAdminBase;

  const addCollection = (name: string, icon: string, color: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '_');
    const newCollections = [...collections, {
      id,
      name,
      icon,
      color,
      properties: [{ id: 'name', name: 'Nom', type: 'text', required: true }],
      items: []
    }];
    setCollections(newCollections);
    setViews({ ...views, [id]: [{ id: 'default', name: 'Toutes les données', type: 'table', filters: [], groups: [], hiddenFields: [] }] });
    setActiveCollection(id);
    setActiveView('default');
    setRelationFilter({ collectionId: null, ids: [] });
    setShowNewCollectionModal(false);
  };

  const deleteProperty = (propId: string) => {
    if (propId === 'name') {
      alert('La propriété "Nom" ne peut pas être supprimée.');
      return;
    }
    if (confirm('Êtes-vous sûr ?')) {
      const updatedCollections = collections.map(col => {
        if (col.id === activeCollection) {
          return { 
            ...col, 
            properties: col.properties.filter((p: any) => p.id !== propId),
            items: col.items.map((item: any) => {
              const newItem = { ...item } as Record<string, any>;
              delete newItem[propId];
              return newItem;
            })
          };
        }
        return col;
      });
      setCollections(updatedCollections);
    }
  };

  const addProperty = (property: any) => {
    if (property.type !== PROPERTY_TYPES.RELATION) {
      const updatedCollections = collections.map(col => {
        if (col.id === activeCollection) {
          return { ...col, properties: [...col.properties, { ...property, id: property.name.toLowerCase().replace(/\s+/g, '_') }] };
        }
        return col;
      });
      setCollections(updatedCollections);
      setShowNewPropertyModal(false);
      return;
    }

    const sourceCollection = collections.find(c => c.id === activeCollection);
    const targetCollection = collections.find(c => c.id === property.relation?.targetCollectionId);
    if (!sourceCollection || !targetCollection) {
      alert('Collection cible introuvable pour la relation');
      return;
    }
    const sourcePropId = property.name.toLowerCase().replace(/\s+/g, '_');
    const reciprocalName = `${sourceCollection.name}`;
    const targetPropId = `${reciprocalName.toLowerCase().replace(/\s+/g, '_')}_lié`;

    const relationType = property.relation?.type || 'many_to_many';
    const reciprocalType = relationType === 'one_to_many' ? 'many_to_one' : relationType === 'many_to_one' ? 'one_to_many' : relationType;

    const sourceProp = {
      ...property,
      id: sourcePropId,
      relation: {
        targetCollectionId: targetCollection.id,
        type: relationType,
        targetFieldId: targetPropId
      }
    };

    const targetProp = {
      name: sourceCollection.name,
      type: 'relation',
      icon: property.icon || 'Link',
      color: property.color || '#8b5cf6',
      id: targetPropId,
      relation: {
        targetCollectionId: sourceCollection.id,
        type: reciprocalType,
        targetFieldId: sourcePropId
      }
    };

    const updatedCollections = collections.map(col => {
      if (col.id === sourceCollection.id) {
        return { ...col, properties: [...col.properties, sourceProp] };
      }
      if (col.id === targetCollection.id) {
        const exists = col.properties.some((p: any) => p.id === targetPropId);
        return exists ? col : { ...col, properties: [...col.properties, targetProp] };
      }
      return col;
    });
    setCollections(updatedCollections);
    setShowNewPropertyModal(false);
  };

  const updateProperty = (property: any) => {
    const updatedCollections = collections.map(col => {
      if (col.id === activeCollection) {
        return {
          ...col,
          properties: col.properties.map((p: any) => p.id === property.id ? property : p)
        };
      }
      return col;
    });
    setCollections(updatedCollections);
    setShowEditPropertyModal(false);
    setEditingProperty(null);
  };

  const applyRelationChangeInternal = (
    stateCollections: any[],
    sourceCollection: any,
    sourceItem: any,
    prop: any,
    newVal: any,
    oldVal: any
  ) => {
    const relation = prop.relation || {};
    const targetCollectionId = relation.targetCollectionId;
    let targetFieldId = relation.targetFieldId;
    const relationType = relation.type || 'many_to_many';

    const targetCollection = stateCollections.find((c: any) => c.id === targetCollectionId);
    if (!targetFieldId && targetCollection) {
      const fallback = (targetCollection.properties || []).find(
        (p: any) => p.type === 'relation' && p.relation?.targetCollectionId === sourceCollection.id
      );
      if (fallback) targetFieldId = fallback.id;
    }
    if (!targetCollection) return stateCollections;
    if (!targetFieldId) return stateCollections;

    const isSourceMany = relationType === 'one_to_many' || relationType === 'many_to_many';
    const isTargetMany = relationType === 'many_to_many' ? true : relationType === 'one_to_many' ? false : true;

    const oldIds = isSourceMany ? (Array.isArray(oldVal) ? oldVal : []) : (oldVal ? [oldVal] : []);
    const newIds = isSourceMany ? (Array.isArray(newVal) ? newVal : []) : (newVal ? [newVal] : []);

    const removed = oldIds.filter((id: string) => !newIds.includes(id));
    const added = newIds.filter((id: string) => !oldIds.includes(id));

    let updatedTargetItems = (targetCollection.items || []).map((ti: any) => {
      if (added.includes(ti.id)) {
        if (isTargetMany) {
          const arr = Array.isArray(ti[targetFieldId]) ? ti[targetFieldId] : [];
          if (!arr.includes(sourceItem.id)) ti[targetFieldId] = [...arr, sourceItem.id];
        } else {
          ti[targetFieldId] = sourceItem.id;
        }
      }
      return ti;
    });

    updatedTargetItems = updatedTargetItems.map((ti: any) => {
      if (removed.includes(ti.id)) {
        if (isTargetMany) {
          const arr = Array.isArray(ti[targetFieldId]) ? ti[targetFieldId] : [];
          ti[targetFieldId] = arr.filter((sid: string) => sid !== sourceItem.id);
        } else {
          if (ti[targetFieldId] === sourceItem.id) ti[targetFieldId] = null;
        }
      }
      return ti;
    });

    if (relationType === 'one_to_one') {
      const keepId = newIds[0] || null;
      if (keepId) {
        updatedTargetItems = updatedTargetItems.map((ti: any) => {
          if (ti.id !== keepId && ti[targetFieldId] === sourceItem.id) {
            ti[targetFieldId] = null;
          }
          return ti;
        });
      }
    }

    const updatedCollections2 = stateCollections.map((c: any) => {
      if (c.id === targetCollectionId) {
        return { ...c, items: updatedTargetItems };
      }
      return c;
    });

    return updatedCollections2;
  };

  const saveItem = (item: any) => {
    let newItem = { ...item };
    if (!editingItem && !item.id) {
      newItem.id = Date.now().toString();
    }

    let updatedCollections = collections.map(col => {
      if (col.id === activeCollection) {
        if (editingItem || item.id) {
          return { ...col, items: col.items.map((i: any) => i.id === newItem.id ? newItem : i) };
        }
        return { ...col, items: [...col.items, newItem] };
      }
      return col;
    });

    const sourceCollection = collections.find(c => c.id === activeCollection)!;
    const relationProps = (sourceCollection.properties || []).filter((p: any) => p.type === 'relation');
    relationProps.forEach((prop: any) => {
      const afterVal = newItem[prop.id];
      if (afterVal && (Array.isArray(afterVal) ? afterVal.length > 0 : true)) {
        updatedCollections = applyRelationChangeInternal(updatedCollections, sourceCollection, newItem, prop, afterVal, null);
      }
    });

    setCollections(updatedCollections);
    setShowNewItemModal(false);
    setEditingItem(null);
  };

  const updateItem = (item: any) => {
    const sourceCollection = collections.find(c => c.id === activeCollection)!;
    const prevItem = sourceCollection.items.find((i: any) => i.id === item.id) || {};

    let updatedCollections = collections.map(col => {
      if (col.id === activeCollection) {
        return { ...col, items: col.items.map((i: any) => i.id === item.id ? item : i) };
      }
      return col;
    });

    const relationProps = (sourceCollection.properties || []).filter((p: any) => p.type === 'relation');
    relationProps.forEach((prop: any) => {
      const beforeVal = prevItem[prop.id];
      const afterVal = item[prop.id];
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        updatedCollections = applyRelationChangeInternal(updatedCollections, sourceCollection, item, prop, afterVal, beforeVal);
      }
    });

    setCollections(updatedCollections);
  };

  const deleteItem = (itemId: string) => {
    // 1) Remove the item from its source collection
    let updatedCollections = collections.map(col => {
      if (col.id === activeCollection) {
        return { ...col, items: col.items.filter((i: any) => i.id !== itemId) };
      }
      return col;
    });

    // 2) Cleanup relations in other collections that point to the deleted item's collection
    updatedCollections = updatedCollections.map(col => {
      const newItems = (col.items || []).map((it: any) => {
        let next = { ...it };
        (col.properties || []).forEach((prop: any) => {
          if (prop.type !== 'relation') return;
          const relation = prop.relation || {};
          const targetCollectionId = relation.targetCollectionId;
          const relationType = relation.type || 'many_to_many';
          const isSourceMany = relationType === 'one_to_many' || relationType === 'many_to_many';

          // Only relations that target the active (deleted item) collection
          if (targetCollectionId === activeCollection) {
            const val = next[prop.id];
            if (isSourceMany) {
              const arr = Array.isArray(val) ? val : [];
              const filtered = arr.filter((id: string) => id !== itemId);
              if (filtered.length !== arr.length) next[prop.id] = filtered;
            } else {
              if (val === itemId) next[prop.id] = null;
            }
          }
        });
        return next;
      });
      return { ...col, items: newItems };
    });

    setCollections(updatedCollections);
  };

  const handleNavigateToCollection = (collectionId: string, linkedIds?: string[]) => {
    setActiveCollection(collectionId);
    setActiveView('default');
    if (linkedIds && linkedIds.length > 0) {
      setRelationFilter({ collectionId, ids: linkedIds });
    } else {
      setRelationFilter({ collectionId: null, ids: [] });
    }
  };

  const getFilteredItems = () => {
    if (!currentCollection || !currentViewConfig) return [];
    let filtered = [...currentCollection.items];
    currentViewConfig.filters.forEach((filter: any) => {
      filtered = filtered.filter(item => {
        const prop = (currentCollection.properties || []).find((p: any) => p.id === filter.property);
        const itemVal = item[filter.property];
        const fVal = filter.value;
        const isArrayVal = Array.isArray(itemVal);

        switch (filter.operator) {
          case 'equals':
            if (isArrayVal) {
              if (Array.isArray(fVal)) {
                // Matches any selected value
                return fVal.some((v: any) => itemVal.includes(v));
              }
              return itemVal.includes(fVal);
            }
            return itemVal === fVal;
          case 'contains':
            if (isArrayVal) {
              if (Array.isArray(fVal)) {
                return fVal.some((fv: any) => itemVal.some((v: any) => String(v).toLowerCase().includes(String(fv).toLowerCase())));
              }
              return itemVal.some((v: any) => String(v).toLowerCase().includes(String(fVal).toLowerCase()));
            }
            return String(itemVal || '').toLowerCase().includes(String(fVal || '').toLowerCase());
          case 'greater':
            return Number(itemVal) > Number(fVal);
          case 'less':
            return Number(itemVal) < Number(fVal);
          case 'is_empty':
            return isArrayVal ? itemVal.length === 0 : (!itemVal || itemVal === '');
          case 'is_not_empty':
            return isArrayVal ? itemVal.length > 0 : (itemVal && itemVal !== '');
          default:
            return true;
        }
      });
    });

    if (relationFilter.collectionId === activeCollection && relationFilter.ids?.length) {
      filtered = filtered.filter((item) => relationFilter.ids.includes(item.id));
    }
    return filtered;
  };

  const addView = (name: string, type: string, config?: any) => {
    const newView: any = {
      id: Date.now().toString(),
      name,
      type,
      filters: [],
      groups: [],
      hiddenFields: []
    };
    if (config?.groupBy) newView.groupBy = config.groupBy;
    if (config?.dateProperty) newView.dateProperty = config.dateProperty;
    
    if (activeCollection) {
      setViews({
        ...views,
        [activeCollection]: [...currentViews, newView]
      });
    }
    setActiveView(newView.id);
    setShowNewViewModal(false);
  };

  const addFilter = (property: string, operator: string, value: any) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    updatedViews[activeCollection][viewIndex].filters.push({ property, operator, value });
    setViews(updatedViews);
    setShowFilterModal(false);
  };

  const removeFilter = (index: number) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    updatedViews[activeCollection][viewIndex].filters.splice(index, 1);
    setViews(updatedViews);
  };

  const addGroup = (property: string) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    if (!updatedViews[activeCollection][viewIndex].groups.includes(property)) {
      updatedViews[activeCollection][viewIndex].groups.push(property);
      setViews(updatedViews);
    }
    setShowGroupModal(false);
  };

  const clearRelationFilter = () => setRelationFilter({ collectionId: null, ids: [] });

  const removeGroup = (property: string) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    updatedViews[activeCollection][viewIndex].groups = updatedViews[activeCollection][viewIndex].groups.filter((g: string) => g !== property);
    setViews(updatedViews);
  };

  const deleteView = (viewId: string) => {
    if (!activeCollection) return;
    if (currentViews.length <= 1) {
      alert('Impossible de supprimer la dernière vue');
      return;
    }
    if (confirm('Êtes-vous sûr de vouloir supprimer cette vue ?')) {
      const updatedViews = {
        ...views,
        [activeCollection]: currentViews.filter((v: any) => v.id !== viewId)
      };
      setViews(updatedViews);
      if (activeView === viewId) {
        setActiveView(updatedViews[activeCollection][0].id);
      }
    }
  };

  const updateCollection = (updatedCollection: any) => {
    const updatedCollections = collections.map(col =>
      col.id === updatedCollection.id ? updatedCollection : col
    );
    setCollections(updatedCollections);
    setShowEditCollectionModal(false);
  };

  const deleteCollection = (collectionId: string) => {
    if (collections.length <= 1) {
      alert('Impossible de supprimer la seule collection');
      return;
    }
    const updatedCollections = collections.filter(col => col.id !== collectionId);
    setCollections(updatedCollections);
    
    // Update views - remove the collection's views
    const updatedViews = { ...views };
    delete updatedViews[collectionId];
    setViews(updatedViews);
    
    // Switch to another collection if we deleted the active one
    if (activeCollection === collectionId) {
      setActiveCollection(updatedCollections[0].id);
      setActiveView('default');
    }
    
    setShowEditCollectionModal(false);
  };

  const toggleFieldVisibility = (fieldId: string) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    const hiddenFields = updatedViews[activeCollection][viewIndex].hiddenFields || [];
    if (hiddenFields.includes(fieldId)) {
      updatedViews[activeCollection][viewIndex].hiddenFields = hiddenFields.filter((f: string) => f !== fieldId);
    } else {
      updatedViews[activeCollection][viewIndex].hiddenFields = [...hiddenFields, fieldId];
    }
    setViews(updatedViews);
  };

  const getOrderedProperties = () => {
    const props = currentCollection?.properties || [];
    const order = currentViewConfig?.fieldOrder && currentViewConfig.fieldOrder.length
      ? currentViewConfig.fieldOrder
      : props.map((p: any) => p.id);
    const ordered = order
      .map((id: string) => props.find((p: any) => p.id === id))
      .filter(Boolean) as any[];
    const missing = props.filter((p: any) => !order.includes(p.id));
    return [...ordered, ...missing];
  };

  const moveFieldInView = (fieldId: string, delta: number) => {
    if (!activeCollection) return;
    const props = currentCollection?.properties || [];
    const currentOrder = currentViewConfig?.fieldOrder && currentViewConfig.fieldOrder.length
      ? [...currentViewConfig.fieldOrder]
      : props.map((p: any) => p.id);
    const idx = currentOrder.indexOf(fieldId);
    const target = idx + delta;
    if (idx === -1 || target < 0 || target >= currentOrder.length) return;
    const nextOrder = [...currentOrder];
    const [item] = nextOrder.splice(idx, 1);
    nextOrder.splice(target, 0, item);
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    updatedViews[activeCollection][viewIndex] = {
      ...updatedViews[activeCollection][viewIndex],
      fieldOrder: nextOrder
    };
    setViews(updatedViews);
  };

  const orderedProperties = getOrderedProperties();

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

      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-white/5 bg-neutral-900/50 backdrop-blur px-8 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-gradient-to-tr from-violet-500 to-cyan-400 animate-pulse" />
            <h1 className="text-2xl font-serif font-bold">Gestionnaire de Projet</h1>
          </div>
          <ShinyButton
            onClick={() => { if (!canEdit) return; setShowNewCollectionModal(true); }}
            className={!canEdit ? 'opacity-60 pointer-events-none' : ''}
          >
            <Plus size={16} />
            Nouvelle collection
          </ShinyButton>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-neutral-400">
            <span className="text-neutral-500">Connecté en tant que</span>{' '}
            <span className="text-white font-medium">{user?.email || 'Utilisateur'}</span>
          </div>
          {isAdminBase && (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="text-neutral-500">Rôle effectif :</span>
              <select
                className="bg-neutral-900 border border-white/10 rounded px-2 py-1 text-sm text-white"
                value={impersonatedRoleId || ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  impersonate(val);
                }}
              >
                <option value="">(Mon rôle réel)</option>
                {availableRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {canManagePermissions && (
            <button
              onClick={() => setShowAccessManager(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-neutral-300 hover:bg-white/10 border border-white/10"
            >
              Comptes & rôles
            </button>
          )}
          <button
            onClick={logout}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-white/5 text-neutral-400 hover:bg-white/10"
          >
            Déconnexion
          </button>
        </div>
      </motion.div>

      <div className="flex flex-1 overflow-hidden">
        <motion.div 
          initial={{ x: -100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-64 border-r border-white/5 bg-neutral-950/50 backdrop-blur overflow-y-auto p-4"
        >
          <h2 className="text-xs font-semibold text-neutral-500 uppercase mb-4 pl-2">Collections</h2>
          {collections.map((col, i) => {
            const IconComponent = (Icons as any)[col.icon] || Icons.Folder;
            return (
              <motion.div
                key={col.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="group relative mb-2"
              >
                <button
                  onClick={() => {
                    setActiveCollection(col.id);
                    setActiveView('default');
                    setRelationFilter({ collectionId: null, ids: [] });
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 pr-10 py-2.5 rounded-lg transition-all",
                    activeCollection === col.id 
                      ? 'bg-gradient-to-r from-violet-500/30 to-cyan-500/30 border border-violet-500/50 text-white' 
                      : 'hover:bg-white/5 text-neutral-400 hover:text-white'
                  )}
                  style={activeCollection === col.id ? {
                    borderColor: `${col.color}80`,
                    background: `linear-gradient(to right, ${col.color}30, ${col.color}10)`
                  } : {}}
                >
                  <IconComponent size={20} style={{ color: col.color || '#8b5cf6' }} />
                  <span className="font-medium flex-1 text-left">{col.name}</span>
                  <span className="text-xs text-neutral-500 bg-white/5 px-2 py-1 rounded">{col.items.length}</span>
                </button>
                <button
                  onClick={() => {
                    setEditingCollection(col);
                    setShowEditCollectionModal(true);
                  }}
                  className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                  title="Éditer la collection"
                >
                  <Settings size={16} />
                </button>
              </motion.div>
            );
          })}
        </motion.div>

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
              <motion.div 
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="border-b border-white/5 bg-neutral-900/30 backdrop-blur px-8 py-4 z-10"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{currentCollection?.icon}</span>
                    <h2 className="text-xl font-bold">{currentCollection?.name}</h2>
                  </div>
                  <ShinyButton
                    onClick={() => { if (!canEdit) return; setShowNewItemModal(true); }}
                    className={!canEdit ? 'opacity-60 pointer-events-none' : ''}
                  >
                    <Plus size={16} />
                    Nouveau
                  </ShinyButton>
                </div>

                <div className="flex items-center gap-2 mb-4">
                  {currentViews.map((view: any, i: number) => (
                    <motion.div key={view.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * i }} className="relative group">
                      <button
                        onClick={() => setActiveView(view.id)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                          activeView === view.id 
                            ? 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg' 
                            : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                        )}
                      >
                        {view.type === 'table' && <Table size={14} className="inline mr-1.5" />}
                        {view.type === 'kanban' && <Layout size={14} className="inline mr-1.5" />}
                        {view.type === 'calendar' && <CalendarIcon size={14} className="inline mr-1.5" />}
                        {view.name}
                      </button>
                      {currentViews.length > 1 && activeView === view.id && (
                        <button
                          onClick={() => deleteView(view.id)}
                          className="absolute -top-1 -right-1 p-1 bg-red-500/80 hover:bg-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Supprimer la vue"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </motion.div>
                  ))}
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => canEdit && setShowNewViewModal(true)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-neutral-400 hover:bg-white/10"
                    disabled={!canEdit}
                  >
                    <Plus size={14} className="inline mr-1" />
                    Nouvelle vue
                  </motion.button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setShowFilterModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-neutral-400 rounded-lg hover:bg-white/10 text-sm">
                    <Filter size={14} />
                    Filtrer
                  </button>
                  <button onClick={() => setShowGroupModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-neutral-400 rounded-lg hover:bg-white/10 text-sm">
                    <Layers size={14} />
                    Grouper
                  </button>
                  <button
                    onClick={() => canEdit && setShowNewPropertyModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-neutral-400 rounded-lg hover:bg-white/10 text-sm"
                    disabled={!canEdit}
                  >
                    <Plus size={14} />
                    Propriété
                  </button>

                  <div className="relative z-[1000]" ref={settingsRef}>
                    <button 
                      onClick={() => setShowViewSettings(!showViewSettings)} 
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-neutral-400 rounded-lg hover:bg-white/10 text-sm"
                    >
                      <Settings size={14} />
                      Paramètres
                    </button>
                    
                    <AnimatePresence>
                      {showViewSettings && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute top-full mt-2 right-0 w-72 bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur z-[1000] p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-white">Colonnes visibles</h4>
                            <button onClick={() => setShowViewSettings(false)} className="text-neutral-500 hover:text-white">
                              <X size={14} />
                            </button>
                          </div>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            <DraggableList
                              items={orderedProperties}
                              getId={(p) => p.id}
                              onReorder={(next) => {
                                const nextOrder = next.map((p: any) => p.id);
                                const updatedViews = { ...views } as Record<string, any[]>;
                                const viewIndex = updatedViews[activeCollection].findIndex(v => v.id === activeView);
                                updatedViews[activeCollection][viewIndex] = {
                                  ...updatedViews[activeCollection][viewIndex],
                                  fieldOrder: nextOrder
                                };
                                setViews(updatedViews);
                              }}
                              renderItem={(prop: any, { isDragging }) => {
                                const isHidden = currentViewConfig?.hiddenFields?.includes(prop.id);
                                const PropIcon = (Icons as any)[prop.icon] || Icons.Tag;
                                return (
                                  <div className={cn(
                                    "flex items-center gap-3 text-sm text-neutral-300 p-2 rounded transition-colors hover:bg-white/5",
                                    isDragging && "border border-cyan-500/60"
                                  )}>
                                    <div className="text-neutral-500 cursor-grab">
                                      <Icons.GripVertical size={16} />
                                    </div>
                                    <div className="relative flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={!isHidden}
                                        onChange={() => toggleFieldVisibility(prop.id)}
                                        className="peer h-4 w-4 appearance-none rounded border-2 border-white/20 bg-neutral-800 checked:bg-gradient-to-r checked:from-violet-500 checked:to-cyan-500 checked:border-transparent transition-all cursor-pointer"
                                      />
                                      <svg className="absolute left-0.5 top-0.5 h-3 w-3 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <PropIcon size={14} style={{ color: prop.color || '#8b5cf6' }} />
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: prop.color || '#8b5cf6' }} />
                                      <span>{prop.name}</span>
                                    </div>
                                    <button
                                      onClick={() => { if (!canEdit) return; setEditingProperty(prop); setShowEditPropertyModal(true); }}
                                      className="ml-auto text-neutral-500 hover:text-cyan-400 p-1 rounded hover:bg-white/10"
                                      title="Modifier la propriété"
                                    >
                                      <Icons.Edit2 size={14} />
                                    </button>
                                  </div>
                                );
                              }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {currentViewConfig?.filters.map((filter: any, idx: number) => (
                    <motion.div key={idx} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 text-violet-200 rounded-lg text-sm border border-violet-500/30">
                      <span>
                        {currentCollection?.properties.find((p: any) => p.id === filter.property)?.name} {filter.operator}{' '}
                        {(() => {
                          const prop = currentCollection?.properties.find((p: any) => p.id === filter.property);
                          if (prop?.type === 'relation') {
                            const targetCol = collections.find((c: any) => c.id === prop.relation?.targetCollectionId);
                            if (!targetCol) return filter.value;
                            const nameField = targetCol.properties.find((p: any) => p.name === 'Nom' || p.id === 'name') || { id: 'name' };
                            if (Array.isArray(filter.value)) {
                              return filter.value
                                .map((id: string) => {
                                  const item = targetCol.items.find((i: any) => i.id === id);
                                  return item ? (item[nameField.id] || item.name || id) : id;
                                })
                                .join(', ');
                            } else {
                              const item = targetCol.items.find((i: any) => i.id === filter.value);
                              return item ? (item[nameField.id] || item.name || filter.value) : filter.value;
                            }
                          }
                          return filter.value;
                        })()}
                      </span>
                      <button onClick={() => removeFilter(idx)} className="hover:bg-violet-500/30 rounded p-0.5">
                        <X size={14} />
                      </button>
                    </motion.div>
                  ))}

                  {relationFilter.collectionId === activeCollection && relationFilter.ids.length > 0 && (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-200 rounded-lg text-sm border border-cyan-500/30">
                      <span>Filtre relation : {relationFilter.ids.length} élément(s)</span>
                      <button onClick={clearRelationFilter} className="hover:bg-cyan-500/30 rounded p-0.5">
                        <X size={14} />
                      </button>
                    </motion.div>
                  )}

                  {currentViewConfig?.groups.map((group: string, idx: number) => (
                    <motion.div key={idx} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-200 rounded-lg text-sm border border-cyan-500/30">
                      <span>Groupé par: {currentCollection?.properties.find((p: any) => p.id === group)?.name}</span>
                      <button onClick={() => removeGroup(group)} className="hover:bg-cyan-500/30 rounded p-0.5">
                        <X size={14} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex-1 overflow-auto p-6"
              >
                {currentViewConfig?.type === 'table' && (
                  <TableView
                    collection={currentCollection}
                    items={getFilteredItems()}
                    onEdit={(item: any) => updateItem(item)}
                    onDelete={deleteItem}
                    onViewDetail={(item: any) => { if (canEdit) { setEditingItem(item); setShowNewItemModal(true); } }}
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
                    onToggleField={toggleFieldVisibility}
                    onDeleteProperty={deleteProperty}
                    onEditProperty={(prop: any) => { setEditingProperty(prop); setShowEditPropertyModal(true); }}
                    collections={collections}
                    onRelationChange={(prop: any, item: any, val: any) => {
                      const updatedItem = { ...item, [prop.id]: val };
                      updateItem(updatedItem);
                    }}
                    onNavigateToCollection={(collectionId: string, linkedIds?: string[]) => {
                      handleNavigateToCollection(collectionId, linkedIds);
                    }}
                  />
                )}
                {currentViewConfig?.type === 'kanban' && (
                  <KanbanView
                    collection={currentCollection}
                    items={getFilteredItems()}
                    onEdit={(item: any) => updateItem(item)}
                    onDelete={deleteItem}
                    onViewDetail={(item: any) => { if (canEdit) { setEditingItem(item); setShowNewItemModal(true); } }}
                    groupBy={currentViewConfig?.groupBy}
                    hiddenFields={currentViewConfig?.hiddenFields || []}
                    canEdit={canEdit}
                    canEditField={canEditField}
                    onChangeGroupBy={(groupBy: string) => {
                      const updatedViews = { ...views } as Record<string, any[]>;
                      const viewIndex = updatedViews[activeCollection].findIndex(v => v.id === activeView);
                      updatedViews[activeCollection][viewIndex].groupBy = groupBy;
                      setViews(updatedViews);
                    }}
                    collections={collections}
                    onRelationChange={(prop: any, item: any, val: any) => {
                      const updatedItem = { ...item, [prop.id]: val };
                      updateItem(updatedItem);
                    }}
                    onNavigateToCollection={(collectionId: string, linkedIds?: string[]) => {
                      handleNavigateToCollection(collectionId, linkedIds);
                    }}
                  />
                )}
                {currentViewConfig?.type === 'calendar' && (
                  <CalendarView
                    collection={currentCollection}
                    items={getFilteredItems()}
                    onEdit={(item: any) => updateItem(item)}
                    onDelete={deleteItem}
                    onViewDetail={(item: any) => { if (canEdit) { setEditingItem(item); setShowNewItemModal(true); } }}
                    dateProperty={currentViewConfig?.dateProperty}
                    hiddenFields={currentViewConfig?.hiddenFields || []}
                    collections={collections}
                    canEdit={canEdit}
                    canEditField={canEditField}
                    onChangeDateProperty={(propId: string) => {
                      const updatedViews = { ...views } as Record<string, any[]>;
                      const viewIndex = updatedViews[activeCollection].findIndex(v => v.id === activeView);
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

      {showNewCollectionModal && <NewCollectionModal onClose={() => setShowNewCollectionModal(false)} onSave={addCollection} />}
      {showEditCollectionModal && editingCollection && (
        <EditCollectionModal
          onClose={() => { setShowEditCollectionModal(false); setEditingCollection(null); }}
          onSave={updateCollection}
          onDelete={deleteCollection}
          collection={editingCollection}
        />
      )}
      {showNewPropertyModal && activeCollection && <NewPropertyModal onClose={() => setShowNewPropertyModal(false)} onSave={addProperty} collections={collections} currentCollection={activeCollection} />}
      {showEditPropertyModal && editingProperty && (
        <EditPropertyModal
          onClose={() => { setShowEditPropertyModal(false); setEditingProperty(null); }}
          onSave={updateProperty}
          property={editingProperty}
          collections={collections}
          currentCollectionId={activeCollection || ''}
        />
      )}
      {showNewItemModal && <NewItemModal collection={currentCollection!} collections={collections} onClose={() => { setShowNewItemModal(false); setEditingItem(null); }} onSave={saveItem} editingItem={editingItem} />}
      {showFilterModal && (
        <FilterModal
          properties={currentCollection?.properties || []}
          collections={collections}
          onClose={() => setShowFilterModal(false)}
          onAdd={addFilter}
        />
      )}
      {showGroupModal && <GroupModal properties={currentCollection?.properties || []} onClose={() => setShowGroupModal(false)} onAdd={addGroup} />}
      {showNewViewModal && <NewViewModal collection={currentCollection} onClose={() => setShowNewViewModal(false)} onSave={addView} />}
      {showAccessManager && canManagePermissions && (
        <AccessManager collections={collections} onClose={() => setShowAccessManager(false)} />
      )}
    </div>
  );
};

export default App;