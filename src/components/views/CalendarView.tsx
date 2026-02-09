import React, { useState, useMemo } from 'react';
import { getNameValue as getNameValueLib } from '@/lib/calendarUtils';
import { motion } from 'framer-motion';
import { getFilteredItems } from '@/lib/filterUtils';
import CalendarCollectionsManager from '../calendar/CalendarCollectionsManager';

interface CalendarViewProps {
  collection: any;
  items: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onViewDetail: (item: any) => void;
  onRelationChange?: (property: any, item: any, value: any) => void;
  dateProperty?: string;
  hiddenFields?: string[];
  onChangeDateProperty?: (propId: string) => void;
  startHour?: number;
  endHour?: number;
  defaultDuration?: number; // in hours
  collections?: any[];
  onShowNewItemModalForCollection?: (collection: any, item?: any) => void;
  viewConfig?: any;
  onUpdateViewConfig?: (updates: Record<string, any>) => void;
  views?: Record<string, any[]>;
  relationFilter?: { collectionId: string | null; ids: string[] };
  activeCollectionId?: string | null;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  collection,
  items,
  onEdit,
  onDelete,
  onViewDetail,
  onRelationChange,
  dateProperty,
  hiddenFields,
  onChangeDateProperty,
  startHour = 8,
  endHour = 20,
  defaultDuration = 1,
  collections = [],
  onShowNewItemModalForCollection,
  viewConfig,
  onUpdateViewConfig,
  views = {},
  relationFilter = { collectionId: null, ids: [] },
  activeCollectionId = null,
}) => {
  // Sélection multiple de collections
  const getInitialSelectedCollections = () => {
    const fromConfig = viewConfig?.calendarCollectionIds;
    if (Array.isArray(fromConfig) && fromConfig.length > 0) return fromConfig;
    if (collection) return [collection.id];
    if (collections.length > 0) return [collections[0].id];
    return [];
  };
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    getInitialSelectedCollections
  );

  // Sélecteur 'collection - Temps' (champ date par collection)
  const getInitialSelectedDateFields = () => {
    if (viewConfig?.calendarDateFields && typeof viewConfig.calendarDateFields === 'object') {
      return viewConfig.calendarDateFields;
    }
    // fallback initial : premier champ date/date_range de chaque collection
    const initial: Record<string, string> = {};
    collections.forEach(col => {
      const dateProp = col.properties.find((p: any) => p.type === 'date' || p.type === 'date_range');
      if (dateProp) initial[col.id] = dateProp.id;
    });
    return initial;
  };
  const [selectedDateFields, setSelectedDateFields] = useState<Record<string, string>>(getInitialSelectedDateFields);

  const viewKey = viewConfig?.id || null;

  React.useEffect(() => {
    setSelectedCollectionIds(getInitialSelectedCollections());
    setSelectedDateFields(getInitialSelectedDateFields());
  }, [viewKey]);

  React.useEffect(() => {
    if (viewConfig?.calendarCollectionIds) {
      setSelectedCollectionIds(viewConfig.calendarCollectionIds);
    } else {
      setSelectedCollectionIds(getInitialSelectedCollections());
    }
  }, [viewConfig?.calendarCollectionIds, viewKey]);

  React.useEffect(() => {
    if (viewConfig?.calendarDateFields) {
      setSelectedDateFields(viewConfig.calendarDateFields);
    } else {
      setSelectedDateFields(getInitialSelectedDateFields());
    }
  }, [viewConfig?.calendarDateFields, viewKey]);

  React.useEffect(() => {
    if (!collections || collections.length === 0) return;
    let changed = false;
    const next = { ...selectedDateFields };
    selectedCollectionIds.forEach((collectionId) => {
      if (next[collectionId]) return;
      const col = collections.find((c) => c.id === collectionId);
      const dateProp = col?.properties?.find(
        (p: any) => p.type === 'date' || p.type === 'date_range'
      );
      if (dateProp) {
        next[collectionId] = dateProp.id;
        changed = true;
      }
    });
    if (changed) {
      setSelectedDateFields(next);
      onUpdateViewConfig?.({ calendarDateFields: next });
    }
  }, [collections, selectedCollectionIds, selectedDateFields, onUpdateViewConfig]);

  if (!collections || collections.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500">
        <p>Aucune collection accessible</p>
      </div>
    );
  }

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Persistance robuste du mode d'affichage (mois/semaine/jour)
  const getInitialViewMode = () => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('calendarViewMode');
        if (saved === 'month' || saved === 'week' || saved === 'day') return saved;
      } catch {}
    }
    return 'month';
  };
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>(getInitialViewMode);

  const setViewModePersist = (mode: 'month' | 'week' | 'day') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('calendarViewMode', mode);
      } catch {}
    }
  };


  // Récupérer les collections sélectionnées
  const selectedCollections = useMemo(
    () => collections.filter(col => selectedCollectionIds.includes(col.id)),
    [collections, selectedCollectionIds]
  );

  const collectionsWithOverrides = useMemo(() => {
    const getViewConfigForCollection = (colId: string) => {
      if (collection && colId === collection.id) return viewConfig;
      const collectionViews = views[colId] || [];
      const calendarView = collectionViews.find((v: any) => v.type === 'calendar');
      return calendarView || collectionViews[0];
    };

    return collections.map((col) => {
      if (collection && col.id === collection.id && Array.isArray(items)) {
        return { ...col, items };
      }
      const cfg = getViewConfigForCollection(col.id);
      if (!cfg) return col;
      const rel = col.id === activeCollectionId ? relationFilter : { collectionId: null, ids: [] };
      const activeId = col.id === activeCollectionId ? activeCollectionId : null;
      const nextItems = getFilteredItems(col, cfg, rel, activeId, collections);
      return { ...col, items: nextItems };
    });
  }, [
    collections,
    collection,
    items,
    viewConfig,
    views,
    relationFilter,
    activeCollectionId,
  ]);


  // Fusionne tous les items filtrés des collections sélectionnées, en ajoutant __collectionId si besoin
  const mergedItems = useMemo(() => {
    // On utilise getFilteredItems si disponible sur la collection
    const result = selectedCollections.flatMap(col => {
      if (typeof col.getFilteredItems === 'function') {
        return col.getFilteredItems().map((it: any) => ({ ...it, __collectionId: col.id }));
      }
      // fallback : items non filtrés
      return col.items.map((it: any) => ({ ...it, __collectionId: col.id }));
    });
    // console.log('mergedItems (filtered):', result);
    return result;
  }, [selectedCollections]);

  // Pour chaque collection, récupérer le champ date sélectionné
  const dateFieldsByCollection: Record<string, any> = {};
  selectedCollections.forEach(col => {
    dateFieldsByCollection[col.id] = col.properties.find((p: any) => p.id === selectedDateFields[col.id]);
  });

  // Pour chaque item, trouver le champ date à utiliser (par collection)
  const getDateFieldForItem = (item: any) => dateFieldsByCollection[item.__collectionId];

  // Trouver la collection d'un item
  const getCollectionForItem = (item: any) => collections.find(col => col.id === item.__collectionId);


  const handleEventDrop = (item: any, newDate: Date, newHours?: number, newMinutes?: number) => {
    const updatedItem = { ...item };
    const dateField = getDateFieldForItem(item);
    const newDateTime = new Date(newDate);
    if (newHours !== undefined) {
      newDateTime.setHours(newHours);
    } else if (item[dateField?.id]) {
      const originalDate = new Date(item[dateField?.id]);
      newDateTime.setHours(originalDate.getHours(), originalDate.getMinutes());
    } else {
      newDateTime.setHours(9, 0);
    }
    if (newMinutes !== undefined) {
      newDateTime.setMinutes(newMinutes);
    }
    updatedItem[dateField?.id] = newDateTime.toISOString();
    onEdit(updatedItem);
  };

  // --- Ajout navigation et sélecteur de vue ---
  // Fonctions utilitaires pour navigation
  const MONTH_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const getMonday = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };
  const getPreviousPeriod = (date: Date, mode: 'month' | 'week' | 'day') => {
    const d = new Date(date);
    if (mode === 'month') d.setMonth(d.getMonth() - 1);
    else if (mode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    return d;
  };
  const getNextPeriod = (date: Date, mode: 'month' | 'week' | 'day') => {
    const d = new Date(date);
    if (mode === 'month') d.setMonth(d.getMonth() + 1);
    else if (mode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    return d;
  };

  // --- Affichage ---
  // Pour l'exemple, on affiche la vue semaine (à adapter selon viewMode si besoin)
  // --- Affichage ---
  // Pour l'exemple, on affiche la vue semaine (à adapter selon viewMode si besoin)
  // Fonction utilitaire pour WeekView/WeekEventCard
  const getNameValue = (item: any) => {
    const collection = collections.find(col => col.id === item.__collectionId) || collections[0];
    return getNameValueLib(item, collection);
  };

  const toggleCollection = (collectionId: string, enabled: boolean) => {
    setSelectedCollectionIds((prev) => {
      const next = enabled
        ? Array.from(new Set([...prev, collectionId]))
        : prev.filter((id) => id !== collectionId);
      onUpdateViewConfig?.({ calendarCollectionIds: next });
      return next;
    });

    if (enabled) {
      setSelectedDateFields((prev) => {
        if (prev[collectionId]) return prev;
        const col = collections.find((c) => c.id === collectionId);
        const dateProp = col?.properties?.find(
          (p: any) => p.type === 'date' || p.type === 'date_range'
        );
        const next = dateProp ? { ...prev, [collectionId]: dateProp.id } : prev;
        onUpdateViewConfig?.({ calendarDateFields: next });
        return next;
      });
    }
  };

  const updateDateField = (collectionId: string, fieldId: string) => {
    setSelectedDateFields((prev) => {
      const next = { ...prev, [collectionId]: fieldId };
      onUpdateViewConfig?.({ calendarDateFields: next });
      return next;
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <CalendarCollectionsManager
        collections={collectionsWithOverrides}
        defaultDuration={defaultDuration}
        startHour={startHour}
        endHour={endHour}
        hiddenFields={hiddenFields}
        onViewDetail={onViewDetail}
        onEdit={onEdit}
        onDelete={onDelete}
        onEditField={onEdit}
        onRelationChange={onRelationChange}
        onShowNewItemModalForCollection={onShowNewItemModalForCollection}
        selectedCollectionIds={selectedCollectionIds}
        onToggleCollection={toggleCollection}
        dateFields={selectedDateFields}
        onChangeDateField={updateDateField}
      />
    </motion.div>
  );
};

export default CalendarView;
