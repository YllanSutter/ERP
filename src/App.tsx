import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Filter, Layers, Table, Layout, X, ChevronDown, Edit2, Trash2, Eye, EyeOff, Calendar as CalendarIcon, ArrowRight, Settings } from 'lucide-react';
import * as Icons from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import KanbanView from '@/components/KanbanView';
import CalendarView from '@/components/CalendarView';
import EditableProperty from '@/components/EditableProperty';
import IconPicker from '@/components/IconPicker';
import ColorPicker from '@/components/ColorPicker';

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

const PropertyTypeLabels = {
  text: 'Texte',
  number: 'Nombre',
  select: 'Sélection',
  multi_select: 'Multi-sélection',
  date: 'Date',
  date_range: 'Période',
  checkbox: 'Case à cocher',
  url: 'URL',
  email: 'Email',
  phone: 'Téléphone',
  relation: 'Relation'
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

const ShinyButton = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "group relative isolate overflow-hidden rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 px-6 py-2 text-sm font-medium text-white transition-all",
        "shadow-[0_0_20px_-5px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_-5px_rgba(139,92,246,0.5)]",
        className
      )}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
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

  // Load state from API
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

  // Persist state to API
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
    const updatedCollections = collections.map(col => {
      if (col.id === activeCollection) {
        return { ...col, properties: [...col.properties, { ...property, id: property.name.toLowerCase().replace(/\s+/g, '_') }] };
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

  const saveItem = (item: any) => {
    const updatedCollections = collections.map(col => {
      if (col.id === activeCollection) {
        if (editingItem || item.id) {
          // Update existing item
          return { ...col, items: col.items.map((i: any) => i.id === item.id ? item : i) };
        }
        // Add new item
        return { ...col, items: [...col.items, { ...item, id: Date.now().toString() }] };
      }
      return col;
    });
    setCollections(updatedCollections);
    setShowNewItemModal(false);
    setEditingItem(null);
  };

  const updateItem = (item: any) => {
    const updatedCollections = collections.map(col => {
      if (col.id === activeCollection) {
        return { ...col, items: col.items.map((i: any) => i.id === item.id ? item : i) };
      }
      return col;
    });
    setCollections(updatedCollections);
  };

  const deleteItem = (itemId: string) => {
    const updatedCollections = collections.map(col => {
      if (col.id === activeCollection) {
        return { ...col, items: col.items.filter((i: any) => i.id !== itemId) };
      }
      return col;
    });
    setCollections(updatedCollections);
  };

  const getFilteredItems = () => {
    if (!currentCollection || !currentViewConfig) return [];
    let filtered = [...currentCollection.items];
    currentViewConfig.filters.forEach((filter: any) => {
      filtered = filtered.filter(item => {
        const value = item[filter.property];
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return value?.toString().toLowerCase().includes(filter.value.toLowerCase());
          case 'greater':
            return Number(value) > Number(filter.value);
          case 'less':
            return Number(value) < Number(filter.value);
          case 'is_empty':
            return !value || value === '';
          case 'is_not_empty':
            return value && value !== '';
          default:
            return true;
        }
      });
    });
    return filtered;
  };

  const getGroupedItems = () => {
    const filtered = getFilteredItems();
    if (!currentViewConfig?.groups.length) {
      return { 'all': filtered };
    }
    const grouped: Record<string, any[]> = {};
    const groupBy = currentViewConfig.groups[0];
    filtered.forEach(item => {
      const key = item[groupBy] || 'Sans valeur';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return grouped;
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

  const addFilter = (property: string, operator: string, value: string) => {
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

      {/* Header */}
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
        {/* Sidebar */}
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

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
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

            {/* View Tabs */}
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

            {/* Controls */}
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
              
              {/* Settings Popover */}
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
                                <Edit2 size={14} />
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
                  <span>{currentCollection?.properties.find((p: any) => p.id === filter.property)?.name} {filter.operator} {filter.value}</span>
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

          {/* Data Views */}
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
      {showNewItemModal && <NewItemModal collection={currentCollection!} onClose={() => { setShowNewItemModal(false); setEditingItem(null); }} onSave={saveItem} editingItem={editingItem} />}
      {showFilterModal && <FilterModal properties={currentCollection?.properties || []} onClose={() => setShowFilterModal(false)} onAdd={addFilter} />}
      {showGroupModal && <GroupModal properties={currentCollection?.properties || []} onClose={() => setShowGroupModal(false)} onAdd={addGroup} />}
      {showNewViewModal && <NewViewModal collection={currentCollection} onClose={() => setShowNewViewModal(false)} onSave={addView} />}
    </div>
  );
};

const formatValue = (value: any, type: string) => {
  if (!value) return '-';
  switch (type) {
    case 'date':
      return new Date(value).toLocaleDateString('fr-FR');
    case 'date_range':
      if (value.start && value.end) {
        return `${new Date(value.start).toLocaleDateString('fr-FR')} - ${new Date(value.end).toLocaleDateString('fr-FR')}`;
      }
      return '-';
    case 'checkbox':
      return value ? '✓' : '✗';
    case 'url':
      return <a href={value} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{value}</a>;
    case 'multi_select':
      return Array.isArray(value) ? value.join(', ') : value;
    default:
      return value;
  }
};

const TableView = ({ collection, items, onEdit, onDelete, hiddenFields, onToggleField, onDeleteProperty, onEditProperty, onViewDetail }: any) => {
  const visibleProperties = collection.properties.filter((p: any) => !hiddenFields.includes(p.id));
  
  return (
    <div className="bg-neutral-900/40 border border-white/5 rounded-lg overflow-hidden backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-900/60 border-b border-white/5">
            <tr>
              {visibleProperties.map((prop: any) => {
                const PropIcon = (Icons as any)[prop.icon] || Icons.Tag;
                return (
                  <th key={prop.id} className="px-6 py-3 text-left text-xs font-medium text-neutral-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <PropIcon size={14} style={{ color: prop.color || '#8b5cf6' }} />
                      {prop.name}
                      <div className="flex gap-1 opacity-0 hover:opacity-100 transition-all duration-500">
                        <button
                          onClick={() => onEditProperty(prop)}
                          className="text-neutral-600 hover:text-cyan-400"
                          title="Modifier la propriété"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => onToggleField(prop.id)}
                          className="text-neutral-600 hover:text-neutral-400"
                          title="Masquer la colonne"
                        >
                          <EyeOff size={14} />
                        </button>
                        {prop.id !== 'name' && (
                          <button
                            onClick={() => onDeleteProperty(prop.id)}
                            className="text-neutral-600 hover:text-red-500"
                            title="Supprimer la propriété"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((item: any) => (
              <motion.tr 
                key={item.id} 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hover:bg-white/5 transition-colors"
              >
                {visibleProperties.map((prop: any) => (
                  <td key={prop.id} className="px-6 py-4 whitespace-nowrap text-sm text-neutral-300">
                    <EditableProperty
                      property={prop}
                      value={item[prop.id]}
                      onChange={(val) => onEdit({...item, [prop.id]: val})}
                      size="md"
                      isNameField={prop.id === 'name' || prop.name === 'Nom'}
                      onViewDetail={prop.id === 'name' || prop.name === 'Nom' ? () => onViewDetail(item) : undefined}
                    />
                  </td>
                ))}
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                  <button onClick={() => onDelete(item.id)} className="text-red-500 hover:text-red-400">
                    <Trash2 size={16} />
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const NewCollectionModal = ({ onClose, onSave }: any) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Folder');
  const [color, setColor] = useState('#8b5cf6');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[500px] max-h-[90vh] overflow-y-auto backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Nouvelle collection</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Nom</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
              placeholder="Nom de la collection"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-3">Icône</label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-3">Couleur</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">Annuler</button>
          <ShinyButton onClick={() => name && onSave(name, icon, color)} className="flex-1">Créer</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

const NewPropertyModal = ({ onClose, onSave, collections, currentCollection }: any) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [options, setOptions] = useState<Array<{value: string, color: string}>>([]);
  const [newOptionValue, setNewOptionValue] = useState('');
  const [newOptionColor, setNewOptionColor] = useState('#8b5cf6');
  const [newOptionIcon, setNewOptionIcon] = useState<string>('Tag');
    const [showIconPopover, setShowIconPopover] = useState(false);
    const [showColorPopover, setShowColorPopover] = useState(false);

  const addOption = () => {
    if (newOptionValue.trim()) {
      setOptions([...options, { value: newOptionValue.trim(), color: newOptionColor, icon: newOptionIcon } as any]);
      setNewOptionValue('');
      setNewOptionColor('#8b5cf6');
      setNewOptionIcon('Tag');
    }
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const property: any = { name, type, icon: 'Tag', color: '#8b5cf6' };
    if (type === 'select' || type === 'multi_select') {
      property.options = options;
    }
    onSave(property);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[500px] max-h-[90vh] overflow-y-auto backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Nouvelle propriété</h3>
        <div className="space-y-4">
          <input 
            type="text" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Nom" 
            className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none" 
          />
          <select 
            value={type} 
            onChange={(e) => setType(e.target.value)} 
            className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none"
          >
            {Object.entries(PropertyTypeLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          {(type === 'select' || type === 'multi_select') && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-300">Options</label>
              <div className="space-y-2">
                {options.map((opt: any, index) => {
                  const optValue = typeof opt === 'string' ? opt : opt.value;
                  const optColor = typeof opt === 'string' ? '#8b5cf6' : (opt.color || '#8b5cf6');
                  const iconName = typeof opt === 'string' ? null : (opt.icon || null);
                  const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
                  return (
                    <div key={index} className="flex items-center gap-2">
                      {OptIcon && <OptIcon size={16} />}
                      <div className="w-6 h-6 rounded border border-white/20" style={{ backgroundColor: optColor }} />
                      <span className="flex-1 text-sm text-neutral-300">{optValue}</span>
                      <button
                        onClick={() => removeOption(index)}
                        className="p-1 hover:bg-red-500/20 rounded text-red-400"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newOptionValue}
                    onChange={(e) => setNewOptionValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addOption()}
                    placeholder="Nouvelle option"
                    className="flex-1 px-3 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
                  />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowIconPopover((v) => !v)}
                      className="px-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-300 text-sm"
                      title="Choisir une icône"
                    >Icône</button>
                    {showIconPopover && (
                      <div className="absolute z-[1000] right-0 mt-2 w-[280px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                        <IconPicker value={newOptionIcon} onChange={(val) => { setNewOptionIcon(val); setShowIconPopover(false); }} mode="all" />
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowColorPopover((v) => !v)}
                      className="px-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-300 text-sm"
                      title="Choisir une couleur"
                    >Couleur</button>
                    {showColorPopover && (
                      <div className="absolute z-[1000] right-0 mt-2 w-[280px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                        <ColorPicker value={newOptionColor} onChange={(val) => { setNewOptionColor(val); setShowColorPopover(false); }} />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={addOption}
                    className="px-3 py-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/50 rounded-lg text-violet-300 text-sm transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={handleSave} className="flex-1">Créer</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

const EditPropertyModal = ({ onClose, onSave, property }: any) => {
  const [name, setName] = useState(property.name);
  const [icon, setIcon] = useState(property.icon || 'Tag');
  const [color, setColor] = useState(property.color || '#8b5cf6');
  const [options, setOptions] = useState<Array<{value: string, color: string, icon?: string}>>(
    property.options || []
  );
  const [newOptionValue, setNewOptionValue] = useState('');
  const [newOptionColor, setNewOptionColor] = useState('#8b5cf6');
  const [newOptionIcon, setNewOptionIcon] = useState<string>('Tag');
  const [showIconPopover, setShowIconPopover] = useState(false);
  const [showColorPopover, setShowColorPopover] = useState(false);

  const addOption = () => {
    if (newOptionValue.trim()) {
      setOptions([...options, { value: newOptionValue.trim(), color: newOptionColor, icon: newOptionIcon }]);
      setNewOptionValue('');
      setNewOptionColor('#8b5cf6');
      setNewOptionIcon('Tag');
    }
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const updatedProperty: any = { 
      ...property, 
      name, 
      icon, 
      color 
    };
    if (property.type === 'select' || property.type === 'multi_select') {
      updatedProperty.options = options;
    }
    onSave(updatedProperty);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[500px] max-h-[90vh] overflow-y-auto backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Modifier la propriété</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">Nom</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-3">Icône</label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-3">Couleur</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          {(property.type === 'select' || property.type === 'multi_select') && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-300">Options</label>
              <div className="space-y-2">
                {options.map((opt: any, index) => {
                  const optValue = typeof opt === 'string' ? opt : opt.value;
                  const optColor = typeof opt === 'string' ? '#8b5cf6' : (opt.color || '#8b5cf6');
                  const iconName = typeof opt === 'string' ? null : (opt.icon || null);
                  const OptIcon = iconName ? (Icons as any)[iconName] || null : null;
                  return (
                    <div key={index} className="flex items-center gap-2">
                      {OptIcon && <OptIcon size={16} />}
                      <div className="w-6 h-6 rounded border border-white/20" style={{ backgroundColor: optColor }} />
                      <span className="flex-1 text-sm text-neutral-300">{optValue}</span>
                      <button
                        onClick={() => removeOption(index)}
                        className="p-1 hover:bg-red-500/20 rounded text-red-400"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={newOptionValue}
                    onChange={(e) => setNewOptionValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addOption()}
                    placeholder="Nouvelle option"
                    className="flex-1 px-3 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
                  />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowIconPopover((v) => !v)}
                      className="px-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-300 text-sm"
                      title="Choisir une icône"
                    >Icône</button>
                    {showIconPopover && (
                      <div className="absolute z-[1000] right-0 mt-2 w-[280px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                        <IconPicker value={newOptionIcon} onChange={(val) => { setNewOptionIcon(val); setShowIconPopover(false); }} mode="all" />
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowColorPopover((v) => !v)}
                      className="px-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-neutral-300 text-sm"
                      title="Choisir une couleur"
                    >Couleur</button>
                    {showColorPopover && (
                      <div className="absolute z-[1000] right-0 mt-2 w-[280px] bg-neutral-900/95 border border-white/10 rounded-lg shadow-xl backdrop-blur p-3">
                        <ColorPicker value={newOptionColor} onChange={(val) => { setNewOptionColor(val); setShowColorPopover(false); }} />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={addOption}
                    className="px-3 py-2 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/50 rounded-lg text-violet-300 text-sm transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={handleSave} className="flex-1">Enregistrer</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

const NewItemModal = ({ collection, onClose, onSave, editingItem }: any) => {
  const [formData, setFormData] = useState(editingItem || {});
  const handleChange = (propId: string, value: any) => {
    setFormData({ ...formData, [propId]: value });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[600px] max-h-[80vh] overflow-y-auto backdrop-blur">
        <h3 className="text-xl font-bold mb-6">{editingItem ? 'Modifier' : 'Nouveau'} {collection.name}</h3>
        <div className="space-y-4">
          {collection.properties.map((prop: any) => (
            <div key={prop.id}>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                {prop.name} {prop.required && <span className="text-red-500">*</span>}
              </label>
              {prop.type === 'text' && <input type="text" value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none" />}
              {prop.type === 'number' && <input type="number" value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none" />}
              {prop.type === 'email' && <input type="email" value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none" />}
              {prop.type === 'url' && <input type="url" value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none" />}
              {prop.type === 'phone' && <input type="tel" value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none" />}
              {prop.type === 'date' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none flex items-center gap-2",
                      !formData[prop.id] && "text-neutral-500"
                    )}>
                      <CalendarIcon size={16} className="opacity-50" />
                      {formData[prop.id] ? format(new Date(formData[prop.id]), 'dd MMM yyyy', { locale: fr }) : 'Choisir une date'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-700" align="start">
                    <Calendar
                      mode="single"
                      selected={formData[prop.id] ? new Date(formData[prop.id]) : undefined}
                      onSelect={(date) => handleChange(prop.id, date ? format(date, 'yyyy-MM-dd') : '')}
                      initialFocus
                      className="bg-neutral-900 text-white"
                    />
                  </PopoverContent>
                </Popover>
              )}
              {prop.type === 'checkbox' && <input type="checkbox" checked={formData[prop.id] || false} onChange={(e) => handleChange(prop.id, e.target.checked)} className="w-5 h-5" />}
              {prop.type === 'select' && (
                <select value={formData[prop.id] || ''} onChange={(e) => handleChange(prop.id, e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none">
                  <option value="">Sélectionner...</option>
                  {prop.options?.map((opt: any) => {
                    const optValue = typeof opt === 'string' ? opt : opt.value;
                    return (
                      <option key={optValue} value={optValue}>{optValue}</option>
                    );
                  })}
                </select>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={() => onSave(formData)} className="flex-1">{editingItem ? 'Modifier' : 'Créer'}</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

const FilterModal = ({ properties, onClose, onAdd }: any) => {
  const [property, setProperty] = useState('');
  const [operator, setOperator] = useState('equals');
  const [value, setValue] = useState('');
  const operators = [
    { value: 'equals', label: 'Est égal à' },
    { value: 'contains', label: 'Contient' },
    { value: 'greater', label: 'Supérieur à' },
    { value: 'less', label: 'Inférieur à' },
    { value: 'is_empty', label: 'Est vide' },
    { value: 'is_not_empty', label: "N'est pas vide" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-96 backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Ajouter un filtre</h3>
        <div className="space-y-4">
          <select value={property} onChange={(e) => setProperty(e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none">
            <option value="">Sélectionner...</option>
            {properties.map((prop: any) => (
              <option key={prop.id} value={prop.id}>{prop.name}</option>
            ))}
          </select>
          <select value={operator} onChange={(e) => setOperator(e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none">
            {operators.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          {!['is_empty', 'is_not_empty'].includes(operator) && (
            <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Valeur" className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none" />
          )}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={() => property && onAdd(property, operator, value)} className="flex-1">Ajouter</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

const GroupModal = ({ properties, onClose, onAdd }: any) => {
  const [property, setProperty] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-96 backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Grouper par</h3>
        <select value={property} onChange={(e) => setProperty(e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none mb-6">
          <option value="">Sélectionner...</option>
          {properties.filter((p: any) => p.type === 'select').map((prop: any) => (
            <option key={prop.id} value={prop.id}>{prop.name}</option>
          ))}
        </select>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={() => property && onAdd(property)} className="flex-1">Grouper</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

const ItemDetailModal = ({ item, collection, onClose, onEdit, onDelete }: any) => {
  const getNameValue = () => {
    const nameField = collection.properties.find((p: any) => p.name === 'Nom' || p.id === 'name');
    return nameField ? item[nameField.id] : item.name || 'Sans titre';
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[700px] max-h-[80vh] overflow-y-auto backdrop-blur"
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-white mb-2">{getNameValue()}</h3>
            <p className="text-sm text-neutral-500">{collection.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {collection.properties.map((prop: any) => {
            const value = item[prop.id];
            if (!value) return null;

            return (
              <div key={prop.id} className="border-b border-white/5 pb-4">
                <label className="block text-xs font-semibold text-neutral-500 uppercase mb-2">
                  {prop.name}
                </label>
                <div className="text-base text-white">
                  {formatValue(value, prop.type)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 mt-8 pt-6 border-t border-white/10">
          <button
            onClick={onEdit}
            className="flex-1 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 rounded-lg transition-colors font-medium"
          >
            Modifier
          </button>
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg transition-colors font-medium"
          >
            Supprimer
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const NewViewModal = ({ onClose, onSave, collection }: any) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('table');
  const [groupBy, setGroupBy] = useState('');
  const [dateProperty, setDateProperty] = useState('');
  
  const viewTypes = [
    { value: 'table', label: 'Tableau' },
    { value: 'kanban', label: 'Kanban' },
    { value: 'calendar', label: 'Calendrier' }
  ];

  const selectProps = collection?.properties.filter((p: any) => p.type === 'select') || [];
  const dateProps = collection?.properties.filter((p: any) => p.type === 'date' || p.type === 'date_range') || [];

  const handleSave = () => {
    const config: any = { name, type };
    if (type === 'kanban' && groupBy) config.groupBy = groupBy;
    if (type === 'calendar' && dateProperty) config.dateProperty = dateProperty;
    onSave(name, type, config);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-96 max-h-[80vh] overflow-y-auto backdrop-blur">
        <h3 className="text-xl font-bold mb-6">Nouvelle vue</h3>
        <div className="space-y-4">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la vue" className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white placeholder-neutral-500 focus:border-violet-500 focus:outline-none" />
          <div className="space-y-2">
            {viewTypes.map(vt => (
              <button
                key={vt.value}
                onClick={() => setType(vt.value)}
                className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all", type === vt.value ? 'border-violet-500 bg-violet-500/20' : 'border-white/10 hover:border-white/20')}
              >
                <span className="font-medium">{vt.label}</span>
              </button>
            ))}
          </div>

          {type === 'kanban' && selectProps.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Grouper par</label>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none">
                <option value="">Sélectionner une propriété...</option>
                {selectProps.map((prop: any) => (
                  <option key={prop.id} value={prop.id}>{prop.name}</option>
                ))}
              </select>
            </div>
          )}

          {type === 'calendar' && dateProps.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">Propriété date</label>
              <select value={dateProperty} onChange={(e) => setDateProperty(e.target.value)} className="w-full px-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-white focus:border-violet-500 focus:outline-none">
                <option value="">Sélectionner une propriété...</option>
                {dateProps.map((prop: any) => (
                  <option key={prop.id} value={prop.id}>{prop.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg">Annuler</button>
          <ShinyButton onClick={handleSave} className="flex-1">Créer</ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default App;
