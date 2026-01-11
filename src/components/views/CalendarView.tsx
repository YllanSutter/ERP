import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import MonthView from '@/components/CalendarView/MonthView';
import WeekView from '@/components/CalendarView/WeekView';
import DayView from '@/components/CalendarView/DayView';
import { useCanEdit, useCanEditField, useCanViewField } from '@/lib/hooks/useCanEdit';
import {
  getMonday,
  MONTH_NAMES,
  getItemsForDate as getItemsForDateUtil,
  getNameValue as getNameValueUtil,
  getPreviousPeriod,
  getNextPeriod,
} from '@/lib/calendarUtils';

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


  // Fusionne tous les items des collections sélectionnées, en ajoutant __collectionId si besoin
  const mergedItems = useMemo(() => {
    // Toujours fusionner tous les items des collections sélectionnées, ignorer la prop items
    const result = selectedCollections.flatMap(col => col.items.map((it: any) => ({ ...it, __collectionId: col.id })));
    // console.log('mergedItems (all selected collections):', result);
    return result;
  }, [selectedCollections]);

  // Pour chaque collection, récupérer le champ date sélectionné
  const dateFieldsByCollection: Record<string, any> = {};
  selectedCollections.forEach(col => {
    dateFieldsByCollection[col.id] = col.properties.find((p: any) => p.id === selectedDateFields[col.id]);
  });

  // Pour chaque item, trouver le champ date à utiliser (par collection)
  const getDateFieldForItem = (item: any) => dateFieldsByCollection[item.__collectionId];

  // Pour chaque date, récupérer les items correspondants (toutes collections)
  const getItemsForDate = (date: Date) => {
    return mergedItems.filter(item => {
      const dateField = getDateFieldForItem(item);
      return getItemsForDateUtil(date, [item], dateField).length > 0;
    });
  };


  const previousPeriod = () => setCurrentDate(getPreviousPeriod(currentDate, viewMode));
  const nextPeriod = () => setCurrentDate(getNextPeriod(currentDate, viewMode));
  const goToToday = () => setCurrentDate(new Date());


  // Trouver la collection d'un item
  const getCollectionForItem = (item: any) => collections.find(col => col.id === item.__collectionId);
  const getNameValue = (item: any) => getNameValueUtil(item, getCollectionForItem(item));


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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Calendar Header */}
      <div className="rounded-lg border border-white/10 bg-gradient-to-br from-neutral-900/50 to-neutral-950/50 p-6 backdrop-blur">
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
            {/* Sélecteur multi-collections UX boutons toggle */}
            <div className="flex gap-2">
              {collections.map(col => {
                const selected = selectedCollectionIds.includes(col.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => {
                      setSelectedCollectionIds(ids => {
                        const newIds = ids.includes(col.id)
                          ? ids.filter(id => id !== col.id)
                          : [...ids, col.id];
                        try {
                          if (typeof window !== 'undefined') {
                            window.localStorage.setItem('calendarSelectedCollections', JSON.stringify(newIds));
                          }
                        } catch {}
                        return newIds;
                      });
                    }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                      selected
                        ? 'bg-violet-500/30 text-violet-200 border-violet-500/50 shadow'
                        : 'bg-neutral-800/50 text-neutral-400 border-white/10 hover:bg-neutral-700/50 hover:text-white'
                    )}
                  >
                    {col.name}
                  </button>
                );
              })}
            </div>
            {/* Sélecteur de champ date par collection */}
            {selectedCollections.map(col => {
              const dateProps = col.properties.filter((p: any) => p.type === 'date' || p.type === 'date_range');
              return (
                <select
                  key={col.id}
                  value={selectedDateFields[col.id] || ''}
                  onChange={e => {
                    setSelectedDateFields(f => {
                      const updated = { ...f, [col.id]: e.target.value };
                      // La persistance est déjà gérée par useEffect
                      return updated;
                    });
                  }}
                  className="px-3 py-1.5 bg-neutral-800/50 border border-white/10 rounded-lg text-sm text-white focus:border-violet-500 focus:outline-none min-w-[120px]"
                >
                  {dateProps.map((prop: any) => (
                    <option key={prop.id} value={prop.id}>{col.name} - {prop.name}</option>
                  ))}
                </select>
              );
            })}
            <div className="flex gap-1 bg-neutral-800/50 rounded-lg p-1">
              <button
                onClick={() => setViewModePersist('month')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  viewMode === 'month' ? 'bg-violet-500/30 text-violet-200' : 'text-neutral-400 hover:text-white'
                )}
              >
                Mois
              </button>
              <button
                onClick={() => setViewModePersist('week')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  viewMode === 'week' ? 'bg-violet-500/30 text-violet-200' : 'text-neutral-400 hover:text-white'
                )}
              >
                Semaine
              </button>
              <button
                onClick={() => setViewModePersist('day')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors',
                  viewMode === 'day' ? 'bg-violet-500/30 text-violet-200' : 'text-neutral-400 hover:text-white'
                )}
              >
                Jour
              </button>
            </div>
            <button onClick={previousPeriod} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm font-medium bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 rounded-lg transition-colors border border-violet-500/30"
            >
              Aujourd'hui
            </button>
            <button onClick={nextPeriod} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Calendar Views */}
        {selectedCollections.length === 0 || selectedCollections.every(col => !col.properties.some((p: any) => p.type === 'date' || p.type === 'date_range')) ? (
          <div className="flex items-center justify-center h-96 rounded-lg border border-white/10 bg-white/[0.02]">
            <div className="text-center">
              <p className="text-neutral-400 mb-2">Aucune propriété de type "Date" trouvée dans les collections sélectionnées</p>
              <p className="text-xs text-neutral-500">Ajoutez une propriété date pour utiliser la vue calendrier</p>
            </div>
          </div>
        ) : viewMode === 'month' ? (
          <MonthView
            currentDate={currentDate}
            items={mergedItems}
            dateField={undefined} // non utilisé, getItemsForDate fait le tri
            collection={undefined} // non utilisé, getItemsForDate fait le tri
            onDateSelect={setSelectedDate}
            getNameValue={getNameValue}
            getItemsForDate={getItemsForDate}
          />
        ) : viewMode === 'week' ? (
          <WeekView
            currentDate={currentDate}
            items={mergedItems}
            dateField={undefined}
            collection={undefined}
            onDelete={onDelete}
            onEdit={onEdit}
            onViewDetail={onViewDetail}
            hiddenFields={hiddenFields}
            getNameValue={getNameValue}
            getItemsForDate={getItemsForDate}
            startHour={startHour}
            endHour={endHour}
            defaultDuration={defaultDuration}
            collections={selectedCollections}
            onEventDrop={handleEventDrop}
            canViewField={(fieldId: string, colId?: string) => canViewFieldFn(fieldId, colId || selectedCollections[0]?.id)}
            getDateFieldForItem={getDateFieldForItem}
          />
        ) : (
          <DayView
            currentDate={currentDate}
            items={mergedItems}
            dateField={undefined}
            collection={undefined}
            onDelete={onDelete}
            onEdit={onEdit}
            onViewDetail={onViewDetail}
            hiddenFields={hiddenFields}
            getNameValue={getNameValue}
            getItemsForDate={getItemsForDate}
            startHour={startHour}
            endHour={endHour}
            defaultDuration={defaultDuration}
            collections={selectedCollections}
            onEventDrop={handleEventDrop}
            canViewField={(fieldId: string, colId?: string) => canViewFieldFn(fieldId, colId || selectedCollections[0]?.id)}
          />
        )}
      </div>

      {/* Event Popup Modal (Month view only) */}
      {selectedDate && viewMode === 'month' && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50" onClick={() => setSelectedDate(null)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900/90 border border-white/10 rounded-2xl p-8 w-[600px] max-h-[80vh] overflow-y-auto backdrop-blur"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h3>
              <button onClick={() => setSelectedDate(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            {getItemsForDate(selectedDate).length === 0 ? (
              <p className="text-neutral-500 text-sm">Aucun élément pour cette date</p>
            ) : (
              <div className="space-y-3">
                {getItemsForDate(selectedDate).map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <button
                        onClick={() => onViewDetail(item)}
                        className="font-medium text-cyan-400 hover:text-cyan-300 hover:underline text-sm flex-1 text-left"
                      >
                        {getNameValue(item)}
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1.5 rounded text-red-300 hover:bg-red-500/20 transition-colors opacity-0 group-hover:opacity-100"
                        title="Supprimer"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Affichage de tous les champs visibles avec rendu badges pour multi-select/select */}
                    <div className="text-xs space-y-2">
                      {collection.properties
                        .filter((prop: any) => !hiddenFields.includes(prop.id) && prop.id !== 'name')
                        .map((prop: any) => {
                          let value = item[prop.id];
                          if (value === undefined || value === null || value === '') return null;
                          // MULTI-SELECT : badges colorés
                          if (prop.type === 'multi_select' && Array.isArray(value)) {
                            const options = prop.options || [];
                            return (
                              <div key={prop.id} className="flex items-center flex-wrap gap-1">
                                <span className="text-neutral-600 mr-1">{prop.name}:</span>
                                {value.map((val: any, idx: number) => {
                                  const opt = options.find((o: any) => (typeof o === 'string' ? o === val : o.value === val || o.label === val));
                                  const color = opt?.color || opt?.bgColor || 'rgba(139,92,246,0.08)';
                                  const label = opt?.label || opt?.value || val;
                                  const icon = opt?.icon;
                                  return (
                                    <span
                                      key={val + idx}
                                      className="px-2 py-0.5 text-xs rounded bg-white/10 inline-flex items-center gap-2"
                                      style={{ backgroundColor: color }}
                                    >
                                      {icon && <span dangerouslySetInnerHTML={{ __html: icon }} />}
                                      <span>{label}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          }
                          // SELECT : badge coloré
                          if (prop.type === 'select') {
                            const options = prop.options || [];
                            let val = value;
                            let opt = options.find((o: any) => (typeof o === 'string' ? o === val : o.value === val || o.label === val));
                            if (typeof val === 'object' && val !== null) {
                              opt = options.find((o: any) => o.value === val.value || o.label === val.label);
                              val = val.label || val.value;
                            }
                            const color = opt?.color || opt?.bgColor || 'rgba(139,92,246,0.08)';
                            const label = opt?.label || opt?.value || val;
                            const icon = opt?.icon;
                            return (
                              <div key={prop.id} className="flex items-center flex-wrap gap-1">
                                <span className="text-neutral-600 mr-1">{prop.name}:</span>
                                <span
                                  className="px-2 py-0.5 text-xs rounded bg-white/10 inline-flex items-center gap-2"
                                  style={{ backgroundColor: color }}
                                >
                                  {icon && <span dangerouslySetInnerHTML={{ __html: icon }} />}
                                  <span>{label}</span>
                                </span>
                              </div>
                            );
                          }
                          // DATE & DATE_RANGE
                          if (prop.type === 'date' || prop.type === 'date_range') {
                            let display = '';
                            if (prop.type === 'date') {
                              display = value ? new Date(value).toLocaleString('fr-FR') : '';
                            } else if (typeof value === 'object' && value.start && value.end) {
                              display = `${new Date(value.start).toLocaleDateString('fr-FR')} → ${new Date(value.end).toLocaleDateString('fr-FR')}`;
                            }
                            return (
                              <div key={prop.id}>
                                <span className="text-neutral-600">{prop.name}:</span> <span className="text-white">{display}</span>
                              </div>
                            );
                          }
                          // CHECKBOX
                          if (prop.type === 'checkbox') {
                            return (
                              <div key={prop.id}>
                                <span className="text-neutral-600">{prop.name}:</span> <span className="text-white">{value ? 'Oui' : 'Non'}</span>
                              </div>
                            );
                          }
                          // RELATION (affichage brut ou à améliorer)
                          if (prop.type === 'relation') {
                            if (Array.isArray(value)) {
                              return (
                                <div key={prop.id}>
                                  <span className="text-neutral-600">{prop.name}:</span> <span className="text-white">{value.join(', ')}</span>
                                </div>
                              );
                            }
                          }
                          // AUTRES
                          return (
                            <div key={prop.id}>
                              <span className="text-neutral-600">{prop.name}:</span> <span className="text-white">{value}</span>
                            </div>
                          );
                        })}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default CalendarView;
