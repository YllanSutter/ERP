import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import CalendarCollectionsManager from '../calendar/CalendarCollectionsManager';
import { useCanEdit, useCanEditField, useCanViewField } from '@/lib/hooks/useCanEdit';

interface CalendarViewProps {
  collection: any;
  items: any[];
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onViewDetail: (item: any) => void;
  dateProperty?: string;
  hiddenFields?: string[];
  onChangeDateProperty?: (propId: string) => void;
  startHour?: number;
  endHour?: number;
  defaultDuration?: number; // in hours
  collections?: any[];
}

const CalendarView: React.FC<CalendarViewProps> = ({
  collection,
  items,
  onEdit,
  onDelete,
  onViewDetail,
  dateProperty,
  hiddenFields = [],
  onChangeDateProperty,
  startHour = 8,
  endHour = 20,
  defaultDuration = 1,
  collections = [],
}) => {
  // Sélection multiple de collections
  // Persistance du multi-sélecteur de collections
  const getInitialSelectedCollections = () => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('calendarSelectedCollections');
        if (saved) {
          const arr = JSON.parse(saved);
          if (Array.isArray(arr) && arr.length > 0) return arr;
        }
      }
    } catch {}
    if (collection) return [collection.id];
    if (collections.length > 0) return [collections[0].id];
    return [];
  };
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(getInitialSelectedCollections);

  // Persistance du sélecteur 'collection - Temps' (champ date par collection)
  const getInitialSelectedDateFields = () => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('calendarSelectedDateFields');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch {}
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

  // Sauvegarde à chaque changement
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('calendarSelectedDateFields', JSON.stringify(selectedDateFields));
      } catch {}
    }
  }, [selectedDateFields]);

  // Hooks de permissions (par collection)
  const canEdit = (colId: string) => useCanEdit(colId);
  const canEditFieldFn = (fieldId: string, colId: string) => useCanEditField(fieldId, colId);
  const canViewFieldFn = (fieldId: string, colId: string) => useCanViewField(fieldId, colId);


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
  const selectedCollections = useMemo(() => collections.filter(col => selectedCollectionIds.includes(col.id)), [collections, selectedCollectionIds]);


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
    console.log('mergedItems (filtered):', result);
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
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="rounded-lg border border-white/10 bg-gradient-to-br from-neutral-900/50 to-neutral-950/50 p-6 backdrop-blur">
        <CalendarCollectionsManager
          collections={collections}
          defaultDuration={defaultDuration}
          startHour={startHour}
          endHour={endHour}
          onViewDetail={onViewDetail}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </motion.div>
  );
};

export default CalendarView;
