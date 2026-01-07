import React, { useMemo, Fragment } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import EditableProperty from '@/components/EditableProperty';

interface WeekViewProps {
  currentDate: Date;
  items: any[];
  dateField: any;
  collection: any;
  onDelete: (id: string) => void;
  onEdit: (item: any) => void;
  onViewDetail: (item: any) => void;
  hiddenFields?: string[];
  getNameValue: (item: any) => string;
  getItemsForDate: (date: Date) => any[];
  startHour?: number;
  endHour?: number;
  defaultDuration?: number; // in hours
}

const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  items,
  dateField,
  collection,
  onDelete,
  onEdit,
  onViewDetail,
  hiddenFields = [],
  getNameValue,
  getItemsForDate,
  startHour = 8,
  endHour = 20,
  defaultDuration = 1,
}) => {
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const dayNamesShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  // Get week days
  const getWeekDays = () => {
    const weekDays: Date[] = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDays.push(day);
    }
    return weekDays;
  };

  const weekDays = getWeekDays();

  // Helper to build a local (non-UTC) date key YYYY-MM-DD
  const toDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Calculate event positions and spans
  const getEventStyle = (item: any) => {
    const itemValue = item[dateField.id];
    if (!itemValue) return null;

    let startDate: Date;
    let endDate: Date;
    let duration: number;

    if (dateField.type === 'date') {
      startDate = new Date(itemValue);
      // Use duration from field-specific duration or property default or global default
      duration = item[`${dateField.id}_duration`] || dateField.defaultDuration || defaultDuration;
      endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + duration);
    } else if (dateField.type === 'date_range') {
      if (typeof itemValue === 'object' && itemValue.start && itemValue.end) {
        startDate = new Date(itemValue.start);
        endDate = new Date(itemValue.end);
        duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      } else {
        return null;
      }
    } else {
      return null;
    }

    const startHourNum = startDate.getHours();
    const startMinutes = startDate.getMinutes();
    const endHourNum = endDate.getHours();
    const endMinutes = endDate.getMinutes();

    const startTimeInHours = startHourNum + startMinutes / 60;
    const endTimeInHours = endHourNum + endMinutes / 60;

    // Check if event overlaps with break time (12h-13h)
    const breakStart = 12;
    const breakEnd = 13;
    let adjustedEndTime = endTimeInHours;
    
    // If event starts before break and ends after break start
    if (startTimeInHours < breakStart && endTimeInHours > breakStart) {
      // Add 1 hour to end time to account for break
      adjustedEndTime = endTimeInHours + 1;
    }

    // Check if item fits within the day (max 7 hours per day)
    let durationHours = duration;
    let hoursPerDay = durationHours;
    let daysSpanned = 1;

    if (durationHours > 7) {
      daysSpanned = Math.ceil(durationHours / 7);
      hoursPerDay = 7;
    }

    return {
      startDate,
      endDate,
      startTimeInHours,
      endTimeInHours: adjustedEndTime,
      durationHours: duration,
      hoursPerDay,
      daysSpanned,
      hasBreak: startTimeInHours < breakStart && endTimeInHours > breakStart,
    };
  };

  // Group events by day with overflow handling
  const eventsByDay = useMemo(() => {
    const events: Record<string, Array<{ item: any; style: any; dayIndex: number; multiDayIndex: number }>> = {};

    weekDays.forEach((date, dayIndex) => {
      const dateStr = toDateKey(date);
      events[dateStr] = [];
    });

    items.forEach(item => {
      const style = getEventStyle(item);
      if (!style) return;

      const startDateStr = toDateKey(style.startDate);
      const dayIndex = weekDays.findIndex(d => toDateKey(d) === startDateStr);

      if (dayIndex !== -1) {
        // Handle multi-day events
        for (let i = 0; i < style.daysSpanned; i++) {
          const currentDayIndex = dayIndex + i;
          if (currentDayIndex < 7) {
            const currentDateStr = toDateKey(weekDays[currentDayIndex]);
            events[currentDateStr].push({
              item,
              style,
              dayIndex: currentDayIndex,
              multiDayIndex: i,
            });
          }
        }
      }
    });

    return events;
  }, [items, weekDays]);

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  return (
    <div className="space-y-4 overflow-x-auto">
      {/* Week Header */}
      <div className="grid grid-cols-8 min-w-min">
        <div className="w-16"></div>
        {weekDays.map((date, idx) => {
          const isToday = date.toDateString() === new Date().toDateString();
          return (
            <div
              key={idx}
              className={cn(
                'text-center py-3 rounded-lg border px-2',
                isToday ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/10 bg-neutral-800/30'
              )}
            >
              <div className="text-xs font-semibold text-neutral-500">{dayNamesShort[idx]}</div>
              <div className={cn('text-lg font-bold', isToday ? 'text-cyan-300' : 'text-white')}>
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time Grid */}
      <div className="grid grid-cols-8 min-w-min">
        {/* Time Column */}
        <div className="w-16">
          {hours.map(hour => (
            <div key={hour} className="h-24 text-xs text-neutral-600 font-medium pt-1">
              {hour}:00
            </div>
          ))}
        </div>

        {/* Day Columns */}
        {weekDays.map((date, dayIndex) => {
          const dateStr = toDateKey(date);
          const dayEvents = eventsByDay[dateStr] || [];

          return (
            <div key={dayIndex} className="relative">
              {hours.map(hour => {
                const isBreakTime = hour === 12; // Pause de 12h à 13h
                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className={cn(
                      "h-24 border-b border-l border-white/5 transition-colors bg-neutral-900/30 hover:bg-neutral-800/30",
                    )}
                  />
                );
              })}
              
              {/* Render events positioned absolutely */}
              {dayEvents.map(({ item, style, multiDayIndex }) => {
                const breakStart = 12;
                const breakEnd = 13;
                const workHoursPerDay = 7; // 7h max par jour
                
                // Calculer les heures pour ce jour spécifique dans l'événement multi-jours
                let dayStartTime: number;
                let dayDuration: number;
                let hoursAlreadyUsed = multiDayIndex * workHoursPerDay;
                
                if (multiDayIndex === 0) {
                  // Premier jour : commence à l'heure de début réelle
                  dayStartTime = style.startTimeInHours;
                  // Calculer combien d'heures on peut mettre aujourd'hui
                  const hoursUntilEndOfDay = endHour - dayStartTime;
                  const hoursUntilBreak = breakStart - dayStartTime;
                  const hoursAfterBreak = endHour - breakEnd;
                  const maxWorkHoursToday = (dayStartTime < breakStart) 
                    ? hoursUntilBreak + hoursAfterBreak 
                    : hoursAfterBreak;
                  dayDuration = Math.min(style.durationHours, maxWorkHoursToday, workHoursPerDay);
                } else {
                  // Jours suivants : commence à la même heure que le jour 1
                  dayStartTime = style.startTimeInHours;
                  const remainingHours = style.durationHours - hoursAlreadyUsed;
                  // Calculer le max d'heures possibles aujourd'hui avec la pause
                  const hoursUntilBreak = breakStart - dayStartTime;
                  const hoursAfterBreak = endHour - breakEnd;
                  const maxWorkHoursToday = (dayStartTime < breakStart) 
                    ? hoursUntilBreak + hoursAfterBreak 
                    : hoursAfterBreak;
                  dayDuration = Math.min(remainingHours, maxWorkHoursToday, workHoursPerDay);
                }
                
                // Calculer l'heure de fin pour ce jour (sans compter la pause)
                let dayEndTime = dayStartTime + dayDuration;
                
                // Vérifier si l'événement chevauche la pause aujourd'hui
                const hasBreakThisDay = dayStartTime < breakStart && dayEndTime > breakStart;
                
                // If event overlaps with break, split it into two parts
                if (hasBreakThisDay) {
                  const beforeBreakEnd = Math.min(dayEndTime, breakStart);
                  const afterBreakStart = breakEnd;
                  
                  const beforeBreakDuration = beforeBreakEnd - dayStartTime;
                  const afterBreakDuration = dayEndTime - breakStart;
                  
                  // Calculate positions for before break
                  const topOffsetBefore = ((dayStartTime - startHour) / (endHour - startHour)) * (hours.length * 96);
                  const heightPxBefore = (beforeBreakDuration / (endHour - startHour)) * (hours.length * 96);
                  
                  // Calculate positions for after break
                  const topOffsetAfter = ((afterBreakStart - startHour) / (endHour - startHour)) * (hours.length * 96);
                  const heightPxAfter = (afterBreakDuration / (endHour - startHour)) * (hours.length * 96);
                  
                  return (
                    <Fragment key={`${item.id}-${multiDayIndex}`}>
                      {/* Part before break */}
                      {beforeBreakDuration > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            'absolute left-0 right-0 border-l-4 border-violet-500 bg-violet-500/10 p-1.5 cursor-pointer hover:bg-violet-500/20 transition-colors group text-xs overflow-hidden z-10',
                            'text-violet-200'
                          )}
                          style={{
                            top: `${topOffsetBefore}px`,
                            height: `${heightPxBefore}px`,
                            minHeight: '24px',
                          }}
                          onClick={() => onViewDetail(item)}
                        >
                          <div className="font-medium truncate">{getNameValue(item)}</div>
                          <div className="text-[10px] text-violet-300/70">
                            {(() => {
                              const startH = Math.floor(dayStartTime);
                              const startM = Math.round((dayStartTime - startH) * 60);
                              return `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')} - 12:00`;
                            })()}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(item.id);
                            }}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={10} />
                          </button>
                        </motion.div>
                      )}
                      
                      {/* Part after break */}
                      {afterBreakDuration > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            'absolute left-0 right-0 border-l-4 border-violet-500 bg-violet-500/10 p-1.5 cursor-pointer hover:bg-violet-500/20 transition-colors group text-xs overflow-hidden z-10',
                            'text-violet-200'
                          )}
                          style={{
                            top: `${topOffsetAfter}px`,
                            height: `${heightPxAfter}px`,
                            minHeight: '24px',
                          }}
                          onClick={() => onViewDetail(item)}
                        >
                          <div className="font-medium truncate">{getNameValue(item)}</div>
                          <div className="text-[10px] text-violet-300/70">
                            {(() => {
                              const endTimeWithBreak = breakEnd + afterBreakDuration;
                              const endH = Math.floor(endTimeWithBreak);
                              const endM = Math.round((endTimeWithBreak - endH) * 60);
                              return `13:00 - ${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')} (${Math.floor(style.durationHours)}h total)`;
                            })()}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(item.id);
                            }}
                            className="absolute top-0.5 right-0.5 p-0.5 rounded bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={10} />
                          </button>
                        </motion.div>
                      )}
                    </Fragment>
                  );
                }
                
                // Normal rendering for events that don't overlap with break
                const topOffset = ((dayStartTime - startHour) / (endHour - startHour)) * (hours.length * 96);
                const heightPx = (dayDuration / (endHour - startHour)) * (hours.length * 96);

                return (
                  <motion.div
                    key={`${item.id}-${multiDayIndex}`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      'absolute left-1 right-1 rounded-lg border-l-4 border-violet-500 bg-violet-500/10 p-1.5 cursor-pointer hover:bg-violet-500/20 transition-colors group text-xs overflow-hidden z-10',
                      dayDuration > 2 ? 'text-violet-200' : 'text-violet-300'
                    )}
                    style={{
                      top: `${topOffset}px`,
                      height: `${heightPx}px`,
                      minHeight: '24px',
                    }}
                    onClick={() => onViewDetail(item)}
                  >
                    <div className="font-medium truncate">{getNameValue(item)}</div>
                    {dayDuration > 1 && (
                      <div className="text-[10px] text-violet-300/70">
                        {(() => {
                          const startH = Math.floor(dayStartTime);
                          const startM = Math.round((dayStartTime - startH) * 60);
                          const endH = Math.floor(dayEndTime);
                          const endM = Math.round((dayEndTime - endH) * 60);
                          return `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')} - ${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')} (${Math.floor(style.durationHours)}h total)`;
                        })()}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={10} />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeekView;
