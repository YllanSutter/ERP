import React, { useState } from 'react';
import MonthView from '../CalendarView/MonthView';
import DayView from '../CalendarView/DayView';
import CollectionFilterPanel from './CollectionFilterPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import WeekView from '../CalendarView/WeekView';

interface CalendarCollectionsManagerProps {
  collections: any[];
  defaultDuration?: number;
  startHour?: number;
  endHour?: number;
}

const CalendarCollectionsManager: React.FC<CalendarCollectionsManagerProps> = ({
  collections,
  defaultDuration = 1,
  startHour = 8,
  endHour = 20,
}) => {
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

  // Filtrage des items par collection
  const getFilteredItems = (collection: any) => {
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
            // value: tableau d'IDs, filterValue: tableau d'IDs sélectionnés
            if (!Array.isArray(value)) return false;
            if (!Array.isArray(filterValue)) return false;
            // Si aucun filtre sélectionné, on ne filtre pas
            if (filterValue.length === 0) continue;
            // Si le champ de l'item est vide, on ne matche rien
            if (value.length === 0) return false;
            // Intersection non vide
            if (!filterValue.some((id: string) => value.includes(id))) return false;
          } else {
            // one_to_one : value = id, filterValue = id
            if (filterValue === '') continue;
            if (value !== filterValue) return false;
          }
        } else {
          if (typeof value === 'string' && !value.toLowerCase().includes(filterValue.toLowerCase())) return false;
        }
      }
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
          console.log('[CalendarCollectionsManager] Rendu WeekView, items:', collections.flatMap(getFilteredItems));
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
              onDelete={(id) => console.log('[WeekView] onDelete', id)}
              onEdit={(item) => console.log('[WeekView] onEdit', item)}
              onViewDetail={(item) => console.log('[WeekView] onViewDetail', item)}
              defaultDuration={defaultDuration}
              startHour={startHour}
              endHour={endHour}
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
          onDelete={() => {}}
          onEdit={() => {}}
          onViewDetail={() => {}}
          defaultDuration={defaultDuration}
          startHour={startHour}
          endHour={endHour}
        />
      )}
    </div>
  );
};

export default CalendarCollectionsManager;