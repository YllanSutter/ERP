import React, { useState, useMemo } from 'react';
import { useConfigSync } from '@/lib/hooks/useConfigSync';
import { getNameValue as getNameValueLib, MONTH_NAMES, parseTimeToDecimalHour, getMonday, getPreviousPeriod, getNextPeriod } from '@/lib/calendarUtils';
import { motion } from 'framer-motion';
import { getFilteredItems } from '@/lib/filterUtils';
import CalendarCollectionsManager from '../calendar/CalendarCollectionsManager';
import { useAuth } from '@/auth/AuthProvider';

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
  viewModeStorageKey?: string;
  showCollectionsSelector?: boolean;
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
  viewModeStorageKey,
  showCollectionsSelector = true,
}) => {
  const { user } = useAuth();

  const userWorkRange = useMemo(() => {
    const prefs = user?.user_preferences && typeof user.user_preferences === 'object'
      ? user.user_preferences
      : {};
    const workStartHour = parseTimeToDecimalHour(prefs.workStart, 9);
    const workEndHourRaw = parseTimeToDecimalHour(prefs.workEnd, 18);
    const workEndHour = Math.max(workStartHour + 0.25, workEndHourRaw);
    const displayStartHour = Math.max(0, Math.floor(workStartHour - 2));
    const displayEndHour = Math.min(24, Math.ceil(workEndHour + 2));

    return {
      workStartHour,
      workEndHour,
      displayStartHour,
      displayEndHour: Math.max(displayStartHour + 1, displayEndHour),
    };
  }, [user?.user_preferences]);

  const resolvedStartHour = userWorkRange.displayStartHour ?? startHour;
  const resolvedEndHour = userWorkRange.displayEndHour ?? endHour;

  // Sélection multiple de collections
  const getInitialSelectedCollections = () => {
    const fromConfig = viewConfig?.calendarCollectionIds;
    if (Array.isArray(fromConfig) && fromConfig.length > 0) return fromConfig;
    if (collection) return [collection.id];
    if (collections.length > 0) return [collections[0].id];
    return [];
  };
  const getInitialSelectedDateFields = () => {
    if (viewConfig?.calendarDateFields && typeof viewConfig.calendarDateFields === 'object') {
      return viewConfig.calendarDateFields;
    }
    const initial: Record<string, string> = {};
    collections.forEach(col => {
      const dateProp = col.properties.find((p: any) => p.type === 'date' || p.type === 'date_range');
      if (dateProp) initial[col.id] = dateProp.id;
    });
    return initial;
  };

  const getInitialCollectionRoles = () => {
    if (viewConfig?.calendarCollectionRoles && typeof viewConfig.calendarCollectionRoles === 'object') {
      return viewConfig.calendarCollectionRoles as Record<string, 'primary' | 'secondary' | 'default'>;
    }
    const initial: Record<string, 'primary' | 'secondary' | 'default'> = {};
    collections.forEach((col) => {
      initial[col.id] = col.isPrimary ? 'primary' : 'default';
    });
    return initial;
  };

  const viewKey = viewConfig?.id || null;

  const [selectedCollectionIds, setSelectedCollectionIds] = useConfigSync<string[]>(
    viewConfig?.calendarCollectionIds,
    getInitialSelectedCollections,
    viewKey
  );
  const [selectedDateFields, setSelectedDateFields] = useConfigSync<Record<string, string>>(
    viewConfig?.calendarDateFields,
    getInitialSelectedDateFields,
    viewKey
  );
  const [collectionRoles, setCollectionRoles] = useConfigSync<Record<string, 'primary' | 'secondary' | 'default'>>(
    viewConfig?.calendarCollectionRoles,
    getInitialCollectionRoles,
    viewKey
  );

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

  React.useEffect(() => {
    if (!collections || collections.length === 0) return;
    let changed = false;
    const next = { ...collectionRoles };
    selectedCollectionIds.forEach((collectionId) => {
      if (next[collectionId]) return;
      const col = collections.find((c) => c.id === collectionId);
      next[collectionId] = col?.isPrimary ? 'primary' : 'default';
      changed = true;
    });
    if (changed) {
      setCollectionRoles(next);
      onUpdateViewConfig?.({ calendarCollectionRoles: next });
    }
  }, [collections, selectedCollectionIds, collectionRoles, onUpdateViewConfig]);

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

  const updateCollectionRole = (collectionId: string, role: 'primary' | 'secondary' | 'default') => {
    setCollectionRoles((prev) => {
      const next = { ...prev, [collectionId]: role };
      onUpdateViewConfig?.({ calendarCollectionRoles: next });
      return next;
    });
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <CalendarCollectionsManager
        collections={collectionsWithOverrides}
        defaultDuration={defaultDuration}
        startHour={resolvedStartHour}
        endHour={resolvedEndHour}
        workStartHour={userWorkRange.workStartHour}
        workEndHour={userWorkRange.workEndHour}
        showCollectionsSelector={showCollectionsSelector}
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
        collectionRoles={collectionRoles}
        onChangeCollectionRole={updateCollectionRole}
        viewModeStorageKey={viewModeStorageKey || viewConfig?.id || collection?.id}
      />
    </motion.div>
  );
};

export default CalendarView;
