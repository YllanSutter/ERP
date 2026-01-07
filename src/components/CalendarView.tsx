import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import MonthView from '@/components/CalendarView/MonthView';
import WeekView from '@/components/CalendarView/WeekView';

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
  const [currentDate, setCurrentDate] = useState(new Date(2026, 0, 6));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('calendarViewMode');
        if (saved === 'month' || saved === 'week') return saved;
      }
    } catch {}
    return 'month';
  });

  const setViewModePersist = (mode: 'month' | 'week') => {
    setViewMode(mode);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('calendarViewMode', mode);
      }
    } catch {}
  };

  const dateProps = collection.properties.filter((p: any) => p.type === 'date' || p.type === 'date_range');
  let dateFieldId = dateProperty || dateProps[0]?.id;
  const dateField = collection.properties.find((p: any) => p.id === dateFieldId);

  const getItemsForDate = (date: Date): any[] => {
    if (!dateField) return [];

    const dateStr = date.toISOString().split('T')[0];
    return items.filter(item => {
      const value = item[dateField.id];
      if (!value) return false;

      if (dateField.type === 'date') {
        const itemDate = new Date(value).toISOString().split('T')[0];
        return itemDate === dateStr;
      } else if (dateField.type === 'date_range') {
        if (typeof value === 'object' && value.start && value.end) {
          const start = new Date(value.start).toISOString().split('T')[0];
          const end = new Date(value.end).toISOString().split('T')[0];
          return dateStr >= start && dateStr <= end;
        }
      }
      return false;
    });
  };

  const previousPeriod = () => {
    if (viewMode === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() - 7);
      setCurrentDate(newDate);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(currentDate.getDate() + 7);
      setCurrentDate(newDate);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getNameValue = (item: any) => {
    const nameField = collection.properties.find((p: any) => p.name === 'Nom' || p.id === 'name');
    return nameField ? item[nameField.id] : item.name || 'Sans titre';
  };

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Calendar Header */}
      <div className="rounded-lg border border-white/10 bg-gradient-to-br from-neutral-900/50 to-neutral-950/50 p-6 backdrop-blur">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {viewMode === 'month'
              ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
              : `Semaine du ${new Date(currentDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
            }
          </h2>
          <div className="flex items-center gap-3">
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
            </div>
            {dateProps.length > 0 && (
              <select
                value={dateFieldId}
                onChange={(e) => onChangeDateProperty?.(e.target.value)}
                className="px-3 py-1.5 bg-neutral-800/50 border border-white/10 rounded-lg text-sm text-white focus:border-violet-500 focus:outline-none"
              >
                {dateProps.map((prop: any) => (
                  <option key={prop.id} value={prop.id}>{prop.name}</option>
                ))}
              </select>
            )}
            <button onClick={() => {
              const newDate = new Date(currentDate);
              if (viewMode === 'week') {
                newDate.setDate(currentDate.getDate() - 7);
              } else {
                newDate.setMonth(currentDate.getMonth() - 1);
              }
              setCurrentDate(newDate);
            }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm font-medium bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 rounded-lg transition-colors border border-violet-500/30"
            >
              Aujourd'hui
            </button>
            <button onClick={() => {
              const newDate = new Date(currentDate);
              if (viewMode === 'week') {
                newDate.setDate(currentDate.getDate() + 7);
              } else {
                newDate.setMonth(currentDate.getMonth() + 1);
              }
              setCurrentDate(newDate);
            }} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Calendar Views */}
        {!dateField ? (
          <div className="flex items-center justify-center h-96 rounded-lg border border-white/10 bg-white/[0.02]">
            <div className="text-center">
              <p className="text-neutral-400 mb-2">Aucune propriété de type "Date" trouvée</p>
              <p className="text-xs text-neutral-500">Ajoutez une propriété date pour utiliser la vue calendrier</p>
            </div>
          </div>
        ) : viewMode === 'month' ? (
          <MonthView
            currentDate={currentDate}
            items={items}
            dateField={dateField}
            collection={collection}
            onDateSelect={setSelectedDate}
            getNameValue={getNameValue}
            getItemsForDate={getItemsForDate}
          />
        ) : (
          <WeekView
            currentDate={currentDate}
            items={items}
            dateField={dateField}
            collection={collection}
            onDelete={onDelete}
            onEdit={onEdit}
            onViewDetail={onViewDetail}
            hiddenFields={hiddenFields}
            getNameValue={getNameValue}
            getItemsForDate={getItemsForDate}
            startHour={startHour}
            endHour={endHour}
            defaultDuration={defaultDuration}
            collections={collections}
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

                    {/* Editable Properties */}
                    <div className="text-xs space-y-2">
                      {collection.properties
                        .filter((prop: any) => !hiddenFields.includes(prop.id) && prop.id !== 'name')
                        .map((prop: any) => (
                          <div key={prop.id}>
                            <span className="text-neutral-600">{prop.name}:</span>
                          </div>
                        ))}
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
