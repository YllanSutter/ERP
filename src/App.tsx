import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, Layers, Table, Layout, X, Settings, Calendar as CalendarIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import KanbanView from '@/components/KanbanView';
import CalendarView from '@/components/CalendarView';
import TableView from '@/components/TableView';
import ShinyButton from '@/components/ShinyButton';
import NewCollectionModal from '@/components/modals/NewCollectionModal';
import NewPropertyModal from '@/components/modals/NewPropertyModal';
import EditPropertyModal from '@/components/modals/EditPropertyModal';
import NewItemModal from '@/components/modals/NewItemModal';
import FilterModal from '@/components/modals/FilterModal';
import GroupModal from '@/components/modals/GroupModal';
import ItemDetailModal from '@/components/modals/ItemDetailModal';
import NewViewModal from '@/components/modals/NewViewModal';

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

const defaultCollections = [
  {
    id: 'employees',
    name: 'Employés',
    icon: 'Users',
    color: '#8b5cf6',
    properties: [
      { id: 'name', name: 'Nom', type: 'text', required: true, icon: 'Type', color: '#8b5cf6' },
      { id: 'email', name: 'Email', type: 'email', icon: 'Mail', color: '#06b6d4' },
      { id: 'role', name: 'Rôle', type: 'select', options: [{ value: 'Développeur', color: '#3b82f6' }, { value: 'Designer', color: '#ec4899' }, { value: 'Manager', color: '#f59e0b' }, { value: 'Commercial', color: '#22c55e' }], icon: 'Briefcase', color: '#ec4899' },
      { id: 'salary', name: 'Salaire', type: 'number', icon: 'DollarSign', color: '#22c55e' }
    ],
    items: []
  },
  {
    id: 'companies',
    name: 'Entreprises',
    icon: 'Building2',
    color: '#06b6d4',
    properties: [
      { id: 'name', name: 'Nom', type: 'text', required: true, icon: 'Type', color: '#06b6d4' },
      { id: 'sector', name: 'Secteur', type: 'select', options: [{ value: 'Tech', color: '#3b82f6' }, { value: 'Finance', color: '#22c55e' }, { value: 'Santé', color: '#ef4444' }, { value: 'Éducation', color: '#f59e0b' }], icon: 'Tag', color: '#f59e0b' },
      { id: 'size', name: 'Taille', type: 'number', icon: 'Users', color: '#8b5cf6' },
      { id: 'website', name: 'Site web', type: 'url', icon: 'Globe', color: '#06b6d4' }
    ],
    items: []
  },
  {
    id: 'sites',
    name: 'Sites',
    icon: 'Globe',
    color: '#10b981',
    properties: [
      { id: 'name', name: 'Nom', type: 'text', required: true, icon: 'Type', color: '#10b981' },
      { id: 'url', name: 'URL', type: 'url', icon: 'Link', color: '#06b6d4' },
      { id: 'status', name: 'Statut', type: 'select', options: [{ value: 'En cours', color: '#3b82f6' }, { value: 'Terminé', color: '#22c55e' }, { value: 'En attente', color: '#f59e0b' }, { value: 'Annulé', color: '#ef4444' }], icon: 'Flag', color: '#3b82f6' },
      { id: 'dev_time', name: 'Temps dev', type: 'date_range', icon: 'Calendar', color: '#ec4899' },
      { id: 'priority', name: 'Priorité', type: 'select', options: [{ value: 'Haute', color: '#ef4444' }, { value: 'Moyenne', color: '#f59e0b' }, { value: 'Basse', color: '#22c55e' }], icon: 'AlertCircle', color: '#ef4444' }
    ],
    items: []
  }
];

const defaultViews = {
  employees: [{ id: 'default', name: 'Toutes les données', type: 'table', filters: [], groups: [], hiddenFields: [] }],
  companies: [{ id: 'default', name: 'Toutes les données', type: 'table', filters: [], groups: [], hiddenFields: [] }],
  sites: [{ id: 'default', name: 'Toutes les données', type: 'table', filters: [], groups: [], hiddenFields: [] }]
};

const App = () => {
  const [collections, setCollections] = useState<any[]>(defaultCollections);
  const [views, setViews] = useState<Record<string, any[]>>(defaultViews);
  const [activeCollection, setActiveCollection] = useState('employees');
  const [activeView, setActiveView] = useState('default');
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
  const [showViewSettings, setShowViewSettings] = useState(false);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadState = async () => {
      try {
        const res = await fetch(`${API_URL}/state`);
        if (res.ok) {
          const data = await res.json();
          if (data?.collections && data?.views) {
            setCollections(data.collections);
            setViews(data.views);
            setActiveCollection(data.activeCollection || 'employees');
            setActiveView(data.activeView || 'default');
            setIsLoaded(true);
            return;
          }
        }
      } catch (err) {
        console.error('Impossible de charger les données', err);
      }
      setCollections(defaultCollections);
      setViews(defaultViews);
      setActiveCollection('employees');
      setActiveView('default');
      setIsLoaded(true);
    };

    loadState();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const saveState = async () => {
      try {
        await fetch(`${API_URL}/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collections, views, activeCollection, activeView }),
        });
      } catch (err) {
        console.error('Impossible de sauvegarder les données', err);
      }
    };
    saveState();
  }, [collections, views, activeCollection, activeView, isLoaded]);

  const currentCollection = collections.find(c => c.id === activeCollection);
  const currentViews = views[activeCollection] || [];
  const currentViewConfig = currentViews.find(v => v.id === activeView) || currentViews[0];

  const addCollection = (name: string, icon: string, color: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '_');
    setCollections([...collections, {
      id,
      name,
      icon,
      color,
      properties: [{ id: 'name', name: 'Nom', type: 'text', required: true }],
      items: []
    }]);
    setViews({ ...views, [id]: [{ id: 'default', name: 'Toutes les données', type: 'table', filters: [], groups: [], hiddenFields: [] }] });
    setActiveCollection(id);
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
    const targetFieldId = relation.targetFieldId;
    const relationType = relation.type || 'many_to_many';

    const targetCollection = stateCollections.find((c: any) => c.id === targetCollectionId);
    if (!targetCollection) return stateCollections;

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
    
    setViews({
      ...views,
      [activeCollection]: [...currentViews, newView]
    });
    setActiveView(newView.id);
    setShowNewViewModal(false);
  };

  const addFilter = (property: string, operator: string, value: any) => {
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex(v => v.id === activeView);
    updatedViews[activeCollection][viewIndex].filters.push({ property, operator, value });
    setViews(updatedViews);
    setShowFilterModal(false);
  };

  const removeFilter = (index: number) => {
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex(v => v.id === activeView);
    updatedViews[activeCollection][viewIndex].filters.splice(index, 1);
    setViews(updatedViews);
  };

  const addGroup = (property: string) => {
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex(v => v.id === activeView);
    if (!updatedViews[activeCollection][viewIndex].groups.includes(property)) {
      updatedViews[activeCollection][viewIndex].groups.push(property);
      setViews(updatedViews);
    }
    setShowGroupModal(false);
  };

  const removeGroup = (property: string) => {
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex(v => v.id === activeView);
    updatedViews[activeCollection][viewIndex].groups = updatedViews[activeCollection][viewIndex].groups.filter((g: string) => g !== property);
    setViews(updatedViews);
  };

  const deleteView = (viewId: string) => {
    if (currentViews.length <= 1) {
      alert('Impossible de supprimer la dernière vue');
      return;
    }
    if (confirm('Êtes-vous sûr de vouloir supprimer cette vue ?')) {
      const updatedViews = {
        ...views,
        [activeCollection]: currentViews.filter(v => v.id !== viewId)
      };
      setViews(updatedViews);
      if (activeView === viewId) {
        setActiveView(updatedViews[activeCollection][0].id);
      }
    }
  };

  const toggleFieldVisibility = (fieldId: string) => {
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex(v => v.id === activeView);
    const hiddenFields = updatedViews[activeCollection][viewIndex].hiddenFields || [];
    if (hiddenFields.includes(fieldId)) {
      updatedViews[activeCollection][viewIndex].hiddenFields = hiddenFields.filter((f: string) => f !== fieldId);
    } else {
      updatedViews[activeCollection][viewIndex].hiddenFields = [...hiddenFields, fieldId];
    }
    setViews(updatedViews);
  };

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
          <ShinyButton onClick={() => setShowNewCollectionModal(true)}>
            <Plus size={16} />
            Nouvelle collection
          </ShinyButton>
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
              <motion.button
                key={col.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                onClick={() => {
                  setActiveCollection(col.id);
                  setActiveView('default');
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg mb-2 transition-all",
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
              </motion.button>
            );
          })}
        </motion.div>

        <div className="flex-1 flex flex-col overflow-hidden">
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
              <ShinyButton onClick={() => setShowNewItemModal(true)}>
                <Plus size={16} />
                Nouveau
              </ShinyButton>
            </div>

            <div className="flex items-center gap-2 mb-4">
              {currentViews.map((view, i) => (
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
                onClick={() => setShowNewViewModal(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-neutral-400 hover:bg-white/10"
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
              <button onClick={() => setShowNewPropertyModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-neutral-400 rounded-lg hover:bg-white/10 text-sm">
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
                        {currentCollection?.properties.map((prop: any) => {
                          const isHidden = currentViewConfig?.hiddenFields?.includes(prop.id);
                          const PropIcon = (Icons as any)[prop.icon] || Icons.Tag;
                          return (
                            <div key={prop.id} className="flex items-center gap-3 text-sm text-neutral-300 p-2 rounded transition-colors hover:bg-white/5">
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
                                onClick={() => { setEditingProperty(prop); setShowEditPropertyModal(true); }}
                                className="ml-auto text-neutral-500 hover:text-cyan-400 p-1 rounded hover:bg-white/10"
                                title="Modifier la propriété"
                              >
                                <Icons.Edit2 size={14} />
                              </button>
                            </div>
                          );
                        })}
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
                onViewDetail={(item: any) => { setSelectedItem(item); setShowItemDetail(true); }}
                hiddenFields={currentViewConfig?.hiddenFields || []}
                onToggleField={toggleFieldVisibility}
                onDeleteProperty={deleteProperty}
                onEditProperty={(prop: any) => { setEditingProperty(prop); setShowEditPropertyModal(true); }}
                collections={collections}
                onRelationChange={(prop: any, item: any, val: any) => {
                  const updatedItem = { ...item, [prop.id]: val };
                  updateItem(updatedItem);
                }}
                onNavigateToCollection={(collectionId: string, linkedIds?: string[]) => {
                  setActiveCollection(collectionId);
                }}
              />
            )}
            {currentViewConfig?.type === 'kanban' && (
              <KanbanView
                collection={currentCollection}
                items={getFilteredItems()}
                onEdit={(item: any) => updateItem(item)}
                onDelete={deleteItem}
                onViewDetail={(item: any) => { setSelectedItem(item); setShowItemDetail(true); }}
                groupBy={currentViewConfig?.groupBy}
                hiddenFields={currentViewConfig?.hiddenFields || []}
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
                  setActiveCollection(collectionId);
                }}
              />
            )}
            {currentViewConfig?.type === 'calendar' && (
              <CalendarView
                collection={currentCollection}
                items={getFilteredItems()}
                onEdit={(item: any) => updateItem(item)}
                onDelete={deleteItem}
                onViewDetail={(item: any) => { setSelectedItem(item); setShowItemDetail(true); }}
                dateProperty={currentViewConfig?.dateProperty}
                hiddenFields={currentViewConfig?.hiddenFields || []}
                collections={collections}
                onChangeDateProperty={(propId: string) => {
                  const updatedViews = { ...views } as Record<string, any[]>;
                  const viewIndex = updatedViews[activeCollection].findIndex(v => v.id === activeView);
                  updatedViews[activeCollection][viewIndex].dateProperty = propId;
                  setViews(updatedViews);
                }}
              />
            )}
          </motion.div>
        </div>
      </div>

      {showItemDetail && selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          collection={currentCollection}
          onClose={() => { setShowItemDetail(false); setSelectedItem(null); }}
          onEdit={() => { setEditingItem(selectedItem); setShowNewItemModal(true); setShowItemDetail(false); }}
          onDelete={() => { deleteItem(selectedItem.id); setShowItemDetail(false); setSelectedItem(null); }}
        />
      )}

      {showNewCollectionModal && <NewCollectionModal onClose={() => setShowNewCollectionModal(false)} onSave={addCollection} />}
      {showNewPropertyModal && <NewPropertyModal onClose={() => setShowNewPropertyModal(false)} onSave={addProperty} collections={collections} currentCollection={activeCollection} />}
      {showEditPropertyModal && editingProperty && <EditPropertyModal onClose={() => { setShowEditPropertyModal(false); setEditingProperty(null); }} onSave={updateProperty} property={editingProperty} />}
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
    </div>
  );
};

export default App;