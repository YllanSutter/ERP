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
  collections?: any[];
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
  collections = [],
}) => {
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const dayNamesShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  // Generate consistent color for each item based on its ID
  const getItemColor = (itemId: string) => {
    let hash = 0;
    for (let i = 0; i < itemId.length; i++) {
      hash = itemId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return {
      border: `hsl(${hue}, 70%, 50%)`,
      bg: `hsl(${hue}, 70%, 15%)`,
      hover: `hsl(${hue}, 70%, 20%)`,
      text: `hsl(${hue}, 70%, 80%)`,
    };
  };

  // Get visible relation/select fields
  const visibleMetaFields = collection.properties.filter(
    (p: any) => (p.type === 'relation' || p.type === 'select') && !hiddenFields.includes(p.id)
  );

  // Format field value for display
  const formatFieldValue = (item: any, prop: any) => {
    const value = item[prop.id];
    if (!value) return '';

    if (prop.type === 'select') {
      return value;
    }

    if (prop.type === 'relation') {
      const targetCol = collections.find((c: any) => c.id === prop.relation?.targetCollectionId);
      if (!targetCol) return '';
      
      const nameField = targetCol.properties.find((p: any) => p.name === 'Nom' || p.id === 'name') || { id: 'name' };
      
      if (Array.isArray(value)) {
        return value
          .map((id: string) => {
            const linkedItem = targetCol.items.find((i: any) => i.id === id);
            return linkedItem ? (linkedItem[nameField.id] || linkedItem.name || '') : '';
          })
          .filter(Boolean)
          .join(', ');
      } else {
        const linkedItem = targetCol.items.find((i: any) => i.id === value);
        return linkedItem ? (linkedItem[nameField.id] || linkedItem.name || '') : '';
      }
    }

    return '';
  };

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

  // Detect overlapping events and calculate columns
  const getEventLayout = (dayEvents: any[], multiDayIndex: number) => {
    const breakStart = 12;
    const breakEnd = 13;
    const workHoursPerDay = 7;

    // Calculate time range for each event
    const eventsWithTime = dayEvents.map(({ item, style, multiDayIndex: mdi }) => {
      let dayStartTime: number;
      let dayDuration: number;
      let hoursAlreadyUsed = mdi * workHoursPerDay;
      
      if (mdi === 0) {
        dayStartTime = style.startTimeInHours;
        const hoursUntilBreak = breakStart - dayStartTime;
        const hoursAfterBreak = endHour - breakEnd;
        const maxWorkHoursToday = (dayStartTime < breakStart) 
          ? hoursUntilBreak + hoursAfterBreak 
          : hoursAfterBreak;
        dayDuration = Math.min(style.durationHours, maxWorkHoursToday, workHoursPerDay);
      } else {
        dayStartTime = style.startTimeInHours;
        const remainingHours = style.durationHours - hoursAlreadyUsed;
        const hoursUntilBreak = breakStart - dayStartTime;
        const hoursAfterBreak = endHour - breakEnd;
        const maxWorkHoursToday = (dayStartTime < breakStart) 
          ? hoursUntilBreak + hoursAfterBreak 
          : hoursAfterBreak;
        dayDuration = Math.min(remainingHours, maxWorkHoursToday, workHoursPerDay);
      }

      let dayEndTime = dayStartTime + dayDuration;

      return {
        item,
        style,
        multiDayIndex: mdi,
        startTime: dayStartTime,
        endTime: dayEndTime,
        column: 0,
        totalColumns: 1,
      };
    });

    // Detect overlaps and assign columns
    const checkOverlap = (a: any, b: any) => {
      return a.startTime < b.endTime && b.startTime < a.endTime;
    };

    eventsWithTime.forEach((event, i) => {
      const overlapping = eventsWithTime.filter((other, j) => i !== j && checkOverlap(event, other));
      
      if (overlapping.length > 0) {
        // Find columns already used by overlapping events
        const usedColumns = new Set(overlapping.map(e => e.column));
        
        // Assign first available column
        let column = 0;
        while (usedColumns.has(column)) {
          column++;
        }
        event.column = column;
        
        // Calculate total columns needed for this group
        const maxColumn = Math.max(column, ...overlapping.map(e => e.column));
        const totalColumns = maxColumn + 1;
        
        // Update all overlapping events
        event.totalColumns = totalColumns;
        overlapping.forEach(e => {
          e.totalColumns = Math.max(e.totalColumns, totalColumns);
        });
      }
    });

    return eventsWithTime;
  };

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

  // Reduce duration for a specific item by given hours; delete if duration hits 0
  const reduceDuration = (item: any, hoursToRemove: number) => {
    if (hoursToRemove <= 0) return;
    const durationKey = `${dateField.id}_duration`;
    const itemValue = item[dateField.id];

    if (dateField.type === 'date') {
      const currentDuration = item[durationKey] || dateField.defaultDuration || defaultDuration;
      const newDuration = Math.max(0, currentDuration - hoursToRemove);
      if (newDuration <= 0) {
        onDelete(item.id);
      } else {
        onEdit({ ...item, [durationKey]: newDuration });
      }
    } else if (dateField.type === 'date_range' && itemValue && itemValue.start && itemValue.end) {
      const startDate = new Date(itemValue.start);
      const endDate = new Date(itemValue.end);
      const totalDuration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      const newTotal = Math.max(0, totalDuration - hoursToRemove);
      if (newTotal <= 0) {
        onDelete(item.id);
      } else {
        const newEnd = new Date(startDate);
        newEnd.setHours(newEnd.getHours() + newTotal);
        onEdit({
          ...item,
          [dateField.id]: { ...itemValue, end: newEnd.toISOString() },
        });
      }
    }
  };

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
          const layoutEvents = getEventLayout(dayEvents, 0);

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
              {layoutEvents.map(({ item, style, multiDayIndex, startTime: dayStartTime, endTime: dayEndTime, column, totalColumns }) => {
                const breakStart = 12;
                const breakEnd = 13;
                const workHoursPerDay = 7; // 7h max par jour
                
                // Calculate day duration (already done in getEventLayout)
                const dayDuration = dayEndTime - dayStartTime;
                
                // Calculate width and left position for overlapping events
                const widthPercent = (1 / totalColumns) * 100;
                const leftPercent = column * widthPercent;
                
                // Get item color
                const colors = getItemColor(item.id);
                
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
                          className="absolute p-1.5 cursor-pointer transition-colors group text-xs overflow-hidden z-10 rounded-sm"
                          style={{
                            top: `${topOffsetBefore}px`,
                            height: `${heightPxBefore}px`,
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            minHeight: '24px',
                            borderLeft: `4px solid ${colors.border}`,
                            backgroundColor: colors.bg,
                            color: colors.text,
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg}
                          onClick={() => onViewDetail(item)}
                        >
                          <div className="font-medium truncate">{getNameValue(item)}</div>
                          <div className="text-[10px] opacity-70">
                            {(() => {
                              const startH = Math.floor(dayStartTime);
                              const startM = Math.round((dayStartTime - startH) * 60);
                              return `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')} - 12:00`;
                            })()}
                          </div>
                          {visibleMetaFields.map((field: any) => {
                            const val = formatFieldValue(item, field);
                            return val ? (
                              <div key={field.id} className="text-[9px] opacity-60 truncate">
                                {field.name}: {val}
                              </div>
                            ) : null;
                          })}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reduceDuration(item, beforeBreakDuration);
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
                          className="absolute p-1.5 cursor-pointer transition-colors group text-xs overflow-hidden z-10 rounded-sm"
                          style={{
                            top: `${topOffsetAfter}px`,
                            height: `${heightPxAfter}px`,
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            minHeight: '24px',
                            borderLeft: `4px solid ${colors.border}`,
                            backgroundColor: colors.bg,
                            color: colors.text,
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hover}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg}
                          onClick={() => onViewDetail(item)}
                        >
                          <div className="font-medium truncate">{getNameValue(item)}</div>
                          <div className="text-[10px] opacity-70">
                            {(() => {
                              const endTimeWithBreak = breakEnd + afterBreakDuration;
                              const endH = Math.floor(endTimeWithBreak);
                              const endM = Math.round((endTimeWithBreak - endH) * 60);
                              return `13:00 - ${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')} (${Math.floor(style.durationHours)}h total)`;
                            })()}
                          </div>
                          {visibleMetaFields.map((field: any) => {
                            const val = formatFieldValue(item, field);
                            return val ? (
                              <div key={field.id} className="text-[9px] opacity-60 truncate">
                                {field.name}: {val}
                              </div>
                            ) : null;
                          })}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              reduceDuration(item, afterBreakDuration);
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
                    className="absolute rounded-sm p-1.5 cursor-pointer transition-colors group text-xs overflow-hidden z-10"
                    style={{
                      top: `${topOffset}px`,
                      height: `${heightPx}px`,
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      minHeight: '24px',
                      borderLeft: `4px solid ${colors.border}`,
                      backgroundColor: colors.bg,
                      color: colors.text,
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.hover}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.bg}
                    onClick={() => onViewDetail(item)}
                  >
                    <div className="font-medium truncate">{getNameValue(item)}</div>
                    {dayDuration > 1 && (
                      <div className="text-[10px] opacity-70">
                        {(() => {
                          const startH = Math.floor(dayStartTime);
                          const startM = Math.round((dayStartTime - startH) * 60);
                          const endH = Math.floor(dayEndTime);
                          const endM = Math.round((dayEndTime - endH) * 60);
                          return `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')} - ${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')} (${Math.floor(style.durationHours)}h total)`;
                        })()}
                      </div>
                    )}
                    {visibleMetaFields.map((field: any) => {
                      const val = formatFieldValue(item, field);
                      return val ? (
                        <div key={field.id} className="text-[9px] opacity-60 truncate">
                          {field.name}: {val}
                        </div>
                      ) : null;
                    })}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reduceDuration(item, dayDuration);
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
