import React, { useState, useEffect } from 'react';
import MonthView from '../CalendarView/MonthView';
import DayView from '../CalendarView/DayView';
import CollectionFilterPanel from './CollectionFilterPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import WeekView from '../CalendarView/WeekView';
import { updateEventSegments } from '@/lib/updateEventSegments';

interface CalendarCollectionsManagerProps {
  collections: any[];
  defaultDuration?: number;
  startHour?: number;
  endHour?: number;
  onViewDetail?: (item: any) => void;
  onEdit?: (item: any) => void;
  onDelete?: (id: string) => void;
  hiddenFields?: string[];
  onEditField?: (updatedItem: any) => void;
  onShowNewItemModalForCollection?: (collection: any, item?: any) => void;
  viewId?: string;
}

const CalendarCollectionsManager: React.FC<CalendarCollectionsManagerProps> = ({
  collections,
  defaultDuration = 1,
  startHour = 8,
  endHour = 20,
  hiddenFields,
  onViewDetail = () => {},
  onEdit = () => {},
  onDelete = () => {},
  onShowNewItemModalForCollection,
  viewId,
}) => {
  // Option pour déplacer tout ou seulement le segment
  const [moveAllSegments, setMoveAllSegments] = useState(true);
  // Fonction pour gérer le déplacement d'un événement (drag & drop)
  /**
   * Déplace uniquement le segment concerné (par défaut), ou tous les segments si moveAllSegments=true
   * @param item L'item à modifier
   * @param newDate Nouvelle date (jour)
   * @param newHours Nouvelle heure
   * @param newMinutes Nouvelles minutes
   * @param options { moveAllSegments?: boolean, segmentIndex?: number }
   */
  const onEventDrop = (item: any, newDate: Date, newHours: number, newMinutes: number, options?: { moveAllSegments?: boolean, segmentIndex?: number }) => {
    // On utilise la valeur de moveAllSegments de l'état si non précisé
    const moveAll = options?.moveAllSegments !== undefined ? options.moveAllSegments : moveAllSegments;
    console.log('[onEventDrop] Appel avec options:', options, 'moveAllSegments:', moveAll);
    const col = collections.find((c) => c.id === item.__collectionId);
    if (!col) {
      console.warn('[onEventDrop] Collection non trouvée pour', item);
      return;
    }
    const dateFieldId = dateFields[col.id];
    const dateField = col.properties.find((p: any) => p.id === dateFieldId);
    if (!dateField) {
      console.warn('[onEventDrop] Champ date non trouvé pour', item);
      return;
    }
    if (moveAll) {
      // Comportement classique : déplace tout (recalcule tout)
      const newDateObj = new Date(newDate);
      newDateObj.setHours(newHours ?? 9, newMinutes ?? 0, 0, 0);
      const updatedItem = { ...item, [dateField.id]: newDateObj.toISOString() };
      const updatedWithSegments = updateEventSegments(updatedItem, col);
      onEdit(updatedWithSegments);
    } else if (typeof options?.segmentIndex === 'number' && Array.isArray(item._eventSegments)) {
      // Déplacement d'un seul segment : on ne modifie que ce segment dans _eventSegments
      const updatedSegments = item._eventSegments.map((seg: any, idx: number) => {
        if (idx === options.segmentIndex) {
          // On modifie uniquement ce segment
          const segStart = new Date(newDate);
          segStart.setHours(newHours ?? 9, newMinutes ?? 0, 0, 0);
          const segEnd = new Date(segStart);
          const duration = new Date(seg.end).getTime() - new Date(seg.start).getTime();
          segEnd.setTime(segStart.getTime() + duration);
          return { ...seg, start: segStart.toISOString(), end: segEnd.toISOString() };
        }
        return seg;
      });
      const updatedItem = { ...item, _eventSegments: updatedSegments };
      onEdit(updatedItem);
    } else {
      // Fallback : comportement classique (déplace tout)
      const newDateObj = new Date(newDate);
      newDateObj.setHours(newHours ?? 9, newMinutes ?? 0, 0, 0);
      const updatedItem = { ...item, [dateField.id]: newDateObj.toISOString() };
      const updatedWithSegments = updateEventSegments(updatedItem, col);
      onEdit(updatedWithSegments);
    }
  };
  // --- State pour la vue et la date courante ---
  const MONTH_NAMES = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const getMonday = (date: string | number | Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };
  const getPreviousPeriod = (date: string | number | Date, mode: string) => {
    const d = new Date(date);
    if (mode === 'month') d.setMonth(d.getMonth() - 1);
    else if (mode === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    return d;
  };
  const getNextPeriod = (date: string | number | Date, mode: string) => {
    const d = new Date(date);
    if (mode === 'month') d.setMonth(d.getMonth() + 1);
    else if (mode === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    return d;
  };
  const getInitialViewMode = () => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('calendarViewMode');
        if (saved === 'month' || saved === 'week' || saved === 'day') return saved;
      } catch {}
    }
    return 'month';
  };
  const [viewMode, setViewMode] = useState(getInitialViewMode());
  const [currentDate, setCurrentDate] = useState(new Date());
  const setViewModePersist = (mode: React.SetStateAction<string>) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      try {
        const modeValue = typeof mode === 'function' ? mode(viewMode) : mode;
        window.localStorage.setItem('calendarViewMode', modeValue);
      } catch {}
    }
  };

  // État des filtres et du champ date par collection
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [dateFields, setDateFields] = useState<Record<string, string>>({});

   // Helper pour obtenir l'id de la vue calendrier (par exemple, la première vue de type 'calendar' de la collection)
   const getCalendarViewId = (col: any) => {
     if (!col || !col.views) return null;
     const calendarView = col.views.find((v: any) => v.type === 'calendar');
     return calendarView ? calendarView.id : null;
   };

  // --- Initialisation des filtres et dateFields au montage ---
  useEffect(() => {
    if (!collections || collections.length === 0) return;
    const newFilters: Record<string, any> = {};
    const newDateFields: Record<string, string> = {};
    collections.forEach(col => {
      // Utilise le viewId passé en prop (celui de la vue calendrier active)
      const filtersKey = viewId ? `erp_collection_filters_${col.id}_${viewId}` : `erp_collection_filters_${col.id}`;
      const dateFieldKey = viewId ? `erp_collection_datefield_${col.id}_${viewId}` : `erp_collection_datefield_${col.id}`;
      // Filtres
      const savedFilters = localStorage.getItem(filtersKey);
      if (savedFilters) {
        try {
          const parsed = JSON.parse(savedFilters);
          if (parsed && typeof parsed === 'object') {
            newFilters[col.id] = parsed;
          }
        } catch {}
      }
      // Champ date
      const savedDateField = localStorage.getItem(dateFieldKey);
      if (savedDateField && savedDateField !== '') {
        newDateFields[col.id] = savedDateField;
      }
    });
    setFilters(newFilters);
    setDateFields(newDateFields);
  }, [collections]);

  // Filtrage des items par collection
  const getFilteredItems = (collection: any) => {
     // On cherche l'id de la vue calendrier pour cette collection
     const viewId = getCalendarViewId(collection);
     // On utilise la clé de filtre propre à la collection+vue
     const filter = filters[collection.id] || {};
    const dateFieldId = dateFields[collection.id];
    const dateField = collection.properties.find((p: any) => p.id === dateFieldId);
    let items = collection.items || [];
    // Filtrage par champ
    items = items.filter((item: any) => {
      for (const fieldId in filter) {
        const field = collection.properties.find((p: any) => p.id === fieldId);
        if (!field) continue;
        const value = item[fieldId];
        const filterValue = filter[fieldId];
        // Si filtre vide (string vide ou tableau vide), on ne filtre pas
        if (
          filterValue === '' ||
          filterValue === null ||
          (Array.isArray(filterValue) && filterValue.length === 0)
        ) continue;
        if (field.type === 'select') {
          if (value !== filterValue) return false;
        } else if (field.type === 'relation') {
          const relationType = field.relation?.type || 'many_to_many';
          if (relationType === 'many_to_many' || relationType === 'one_to_many') {
            if (!Array.isArray(value)) return false;
            if (!Array.isArray(filterValue)) return false;
            if (filterValue.length === 0) continue;
            if (value.length === 0) return false;
            if (!filterValue.some((id: string) => value.includes(id))) return false;
          } else {
            if (filterValue === '') continue;
            if (value !== filterValue) return false;
          }
        } else {
          if (typeof value === 'string' && !value.toLowerCase().includes(filterValue.toLowerCase())) return false;
        }
      }
      // NE GARDER QUE les items qui ont une valeur dans le champ date sélectionné
      if (!item[dateFieldId]) return false;
      return true;
    });
    // Ajoute la référence collection à chaque item
    return items.map((item: any) => ({ ...item, __collectionId: collection.id }));
  };

  // Rendu header + panneaux de filtre + vue calendrier
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">
          {viewMode === 'month'
            ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
            : viewMode === 'week'
            ? `Semaine du ${getMonday(currentDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
            : currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
          }
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-neutral-800/50 rounded-lg p-1">
            <button
              onClick={() => setViewModePersist('month')}
              className={
                'px-3 py-1.5 text-sm font-medium transition-colors ' +
                (viewMode === 'month' ? 'bg-violet-500/30 text-violet-200' : 'text-neutral-400 hover:text-white')
              }
            >
              Mois
            </button>
            <button
              onClick={() => setViewModePersist('week')}
              className={
                'px-3 py-1.5 text-sm font-medium transition-colors ' +
                (viewMode === 'week' ? 'bg-violet-500/30 text-violet-200' : 'text-neutral-400 hover:text-white')
              }
            >
              Semaine
            </button>
            <button
              onClick={() => setViewModePersist('day')}
              className={
                'px-3 py-1.5 text-sm font-medium transition-colors ' +
                (viewMode === 'day' ? 'bg-violet-500/30 text-violet-200' : 'text-neutral-400 hover:text-white')
              }
            >
              Jour
            </button>
          </div>
          {/* Option de déplacement visible seulement en vue calendrier (week ou day) */}
          {(viewMode === 'week' || viewMode === 'day') && (
            <div className="flex items-center gap-2 bg-neutral-800/50 rounded-lg px-4 py-3 ml-2">
              <span className="text-xs text-neutral-400">Déplacement :</span>
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="moveAllSegments"
                  checked={moveAllSegments}
                  onChange={() => setMoveAllSegments(true)}
                  className="accent-violet-500"
                />
                <span>Tous</span>
              </label>
              <label className="flex items-center gap-1 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="moveAllSegments"
                  checked={!moveAllSegments}
                  onChange={() => setMoveAllSegments(false)}
                  className="accent-violet-500"
                />
                <span>Segment seul</span>
              </label>
            </div>
          )}
          <button onClick={() => setCurrentDate(getPreviousPeriod(currentDate, viewMode))} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 text-sm font-medium bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 rounded-lg transition-colors border border-violet-500/30"
          >
            Aujourd'hui
          </button>
          <button onClick={() => setCurrentDate(getNextPeriod(currentDate, viewMode))} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      <Tabs defaultValue={collections[0]?.id} className="w-full mb-4">
        <TabsList>
          {collections.map((collection) => (
            <TabsTrigger key={collection.id} value={collection.id}>
              {collection.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {collections.map((collection) => (
          <TabsContent key={collection.id} value={collection.id}>
            <CollectionFilterPanel
              collection={collection}
              properties={collection.properties}
              filters={filters[collection.id] || {}}
              setFilters={(f: any) => setFilters((prev) => ({ ...prev, [collection.id]: f }))}
              dateField={dateFields[collection.id]}
              setDateField={(fieldId: string) => setDateFields((prev) => ({ ...prev, [collection.id]: fieldId }))}
              collections={collections}
              onShowNewItemModalForCollection={onShowNewItemModalForCollection}
              viewId={viewId}
            />
          </TabsContent>
        ))}
      </Tabs>
      {/* Affichage de la vue calendrier selon viewMode */}
      {viewMode === 'month' ? (
        <MonthView
          currentDate={currentDate}
          items={collections.flatMap(getFilteredItems)}
          dateField={undefined}
          collection={undefined}
          onDateSelect={() => {}}
          getNameValue={(item) => {
            const col = collections.find(c => c.id === item.__collectionId);
            if (!col) return item.name || 'Sans titre';
            const nameField = col.properties.find((p: any) => p.name === 'Nom' || p.id === 'name');
            return nameField ? item[nameField.id] : item.name || 'Sans titre';
          }}
          getItemsForDate={() => []}
        />
      ) : viewMode === 'week' ? (
        (() => {
          return (
            <WeekView
              currentDate={currentDate}
              items={collections.flatMap(getFilteredItems)}
              collections={collections}
              getNameValue={(item) => {
                const col = collections.find(c => c.id === item.__collectionId);
                if (!col) return item.name || 'Sans titre';
                const nameField = col.properties.find((p: any) => p.name === 'Nom' || p.id === 'name');
                return nameField ? item[nameField.id] : item.name || 'Sans titre';
              }}
              getItemsForDate={() => []}
              getDateFieldForItem={(item) => {
                const col = collections.find(c => c.id === item.__collectionId);
                if (!col) return undefined;
                const dateFieldId = dateFields[col.id];
                return col.properties.find((p: any) => p.id === dateFieldId);
              }}
              hiddenFields={hiddenFields}
              onEditField={onEdit}
              onDelete={onDelete}
              onEdit={onEdit}
              onViewDetail={onViewDetail}
              defaultDuration={defaultDuration}
              startHour={startHour}
              endHour={endHour}
              onShowNewItemModalForCollection={onShowNewItemModalForCollection}
              onEventDrop={onEventDrop}
            />
          );
        })()
      ) : (
        <DayView
          currentDate={currentDate}
          items={collections.flatMap(getFilteredItems)}
          collections={collections}
          getNameValue={(item) => {
            const col = collections.find(c => c.id === item.__collectionId);
            if (!col) return item.name || 'Sans titre';
            const nameField = col.properties.find((p: any) => p.name === 'Nom' || p.id === 'name');
            return nameField ? item[nameField.id] : item.name || 'Sans titre';
          }}
          getDateFieldForItem={(item: { __collectionId: any; }) => {
            const col = collections.find(c => c.id === item.__collectionId);
            if (!col) return undefined;
            const dateFieldId = dateFields[col.id];
            return col.properties.find((p: any) => p.id === dateFieldId);
          }}
          onDelete={onDelete}
          onEdit={onEdit}
          onViewDetail={onViewDetail}
          defaultDuration={defaultDuration}
          startHour={startHour}
          endHour={endHour}
        />
      )}
    </div>
  );
};

export default CalendarCollectionsManager;