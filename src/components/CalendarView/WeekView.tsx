import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import EditableProperty from '@/components/fields/EditableProperty';
import WeekEventCard from '@/components/CalendarView/WeekEventCard';
import {
  getItemColor,
  toDateKey,
  getWeekDays,
  getEventStyle,
  getEventLayout,
  formatFieldValue,
  calculateDropTime,
  calculateDropIndicatorPosition,
} from '@/lib/calendarUtils';

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
  onEventDrop?: (item: any, newDate: Date, newHours: number, newMinutes: number) => void;
  canViewField?: (fieldId: string) => boolean;
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
  onEventDrop,
  canViewField = () => true,
}) => {
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const dayNamesShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const [dragPreview, setDragPreview] = React.useState<{ dayIndex: number; positionY: number } | null>(null);

  // Get visible relation/select fields
  const visibleMetaFields = collection.properties.filter(
    (p: any) => 
      (p.type === 'relation' || p.type === 'select') && 
      !hiddenFields.includes(p.id) &&
      canViewField(p.id)
  );

  // Get week days
  const weekDays = getWeekDays(currentDate);

  // Helper to build a local (non-UTC) date key YYYY-MM-DD
  const toDateKeyLocal = (d: Date) => toDateKey(d);

  // Calculate event positions and spans
  const getEventStyleLocal = (item: any) =>
    getEventStyle(item, dateField, defaultDuration, endHour);

  // Group events by day with overflow handling
  const eventsByDay = useMemo(() => {
    const events: Record<string, Array<{ item: any; style: any; dayIndex: number; multiDayIndex: number }>> = {};

    weekDays.forEach((date) => {
      const dateStr = toDateKey(date);
      events[dateStr] = [];
    });

    items.forEach((item) => {
      const style = getEventStyleLocal(item);
      if (!style) return;

      // Utiliser la liste explicite des jours ouvrés couverts par l'événement
      if (style.workdayDates && style.workdayDates.length > 0) {
        style.workdayDates.forEach((date: Date, i: number) => {
          const dateStr = toDateKey(date);
          const dayIndex = weekDays.findIndex((d) => toDateKey(d) === dateStr);
          if (dayIndex !== -1) {
            events[dateStr].push({
              item,
              style,
              dayIndex,
              multiDayIndex: i,
            });
          }
        });
      } else {
        // fallback mono-jour
        const startDateStr = toDateKey(style.startDate);
        const dayIndex = weekDays.findIndex((d) => toDateKey(d) === startDateStr);
        if (dayIndex !== -1) {
          events[startDateStr].push({
            item,
            style,
            dayIndex,
            multiDayIndex: 0,
          });
        }
      }
    });

    return events;
  }, [items, weekDays]);

  // Detect overlapping events and calculate columns
  const getEventLayoutLocal = (dayEvents: any[], multiDayIndex: number) =>
    getEventLayout(dayEvents, multiDayIndex, startHour, endHour);

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
      <div className="grid grid-cols-6 min-w-min">
        <div className="w-16"></div>
        {weekDays.map((date, idx) => {
          const isToday = date.toDateString() === new Date().toDateString();
          const dayOfWeek = date.getDay(); // 0=dimanche, 1=lundi, ..., 6=samedi
          return (
            <div
              key={idx}
              className={cn(
                'text-center py-3 border px-2',
                isToday ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/10 bg-neutral-800/30'
              )}
            >
              <div className="text-xs font-semibold text-neutral-500">{dayNamesShort[dayOfWeek]}</div>
              <div className={cn('text-lg font-bold', isToday ? 'text-cyan-300' : 'text-white')}>
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time Grid */}
      <div className="grid grid-cols-6 min-w-min">
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
          const layoutEvents = getEventLayoutLocal(dayEvents, 0);

          const handleDayDragOver = (e: React.DragEvent) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const dragData = e.dataTransfer.getData('application/json');
            if (!dragData) return;
            
            try {
              const data = JSON.parse(dragData);
              const dragStartOffsetY = data.__dragStartOffsetY || 0;
              
              const container = e.currentTarget as HTMLElement;
              const rect = container.getBoundingClientRect();
              const dropY = e.clientY - rect.top;
              
              // Ajuste pour que le haut de l'élément soit à la position du drop minus l'offset
              const adjustedDropY = Math.max(0, dropY - dragStartOffsetY);
              
              setDragPreview({ dayIndex, positionY: adjustedDropY });
            } catch (e) {
              // Silently fail if data parsing fails
            }
          };

          const handleDayDragLeave = () => {
            setDragPreview(null);
          };

          const handleDayDrop = (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            
            const dragData = e.dataTransfer.getData('application/json');
            if (!dragData) return;
            
            try {
              const data = JSON.parse(dragData);
              // Nettoyer les données de drag
              const item = { ...data };
              delete item.__dragStartOffsetY;
              
              const container = e.currentTarget as HTMLElement;
              const rect = container.getBoundingClientRect();
              const dropY = e.clientY - rect.top;
              const dragStartOffsetY = data.__dragStartOffsetY || 0;
              
              // Ajuste pour que le haut de l'élément soit à la position du drop
              const adjustedDropY = Math.max(0, dropY - dragStartOffsetY);
              
              // Calculer l'heure en fonction de la position ajustée
              const { hour, minutes } = calculateDropTime({
                dropY: adjustedDropY,
                containerHeight: rect.height,
                elementTop: 0,
                startHour,
                endHour,
              });
              
              if (onEventDrop) {
                onEventDrop(item, date, hour, minutes);
              }
            } catch (e) {
              console.error('Error parsing drag data:', e);
            } finally {
              setDragPreview(null);
            }
          };

          return (
            <div 
              key={dayIndex} 
              className="relative"
              onDragOver={handleDayDragOver}
              onDragLeave={handleDayDragLeave}
              onDrop={handleDayDrop}
            >
              {/* Drag preview indicator - thin blue line */}
              {dragPreview && dragPreview.dayIndex === dayIndex && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-blue-500 pointer-events-none z-50"
                  style={{
                    top: `${dragPreview.positionY}px`,
                  }}
                />
              )}

              {hours.map((hour) => {
                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className={cn(
                      'h-24 border-b border-l border-white/5 transition-colors bg-neutral-900/30 hover:bg-neutral-800/30'
                    )}
                  />
                );
              })}

              {/* Render events positioned absolutely */}
              {layoutEvents.map(({ item, style, multiDayIndex, startTime: dayStartTime, endTime: dayEndTime, column, totalColumns }) => {
                const breakStart = 12;
                const dayDuration = dayEndTime - dayStartTime;
                const colors = getItemColor(item.id);
                const hasBreakThisDay = dayStartTime < breakStart && dayEndTime > breakStart;

                return (
                  <WeekEventCard
                    key={`${item.id}-${multiDayIndex}`}
                    item={item}
                    style={style}
                    multiDayIndex={multiDayIndex}
                    dayStartTime={dayStartTime}
                    dayEndTime={dayEndTime}
                    column={column}
                    totalColumns={totalColumns}
                    colors={colors}
                    startHour={startHour}
                    endHour={endHour}
                    hoursLength={hours.length}
                    hasBreakThisDay={hasBreakThisDay}
                    visibleMetaFields={visibleMetaFields}
                    collections={collections}
                    getNameValue={getNameValue}
                    onViewDetail={onViewDetail}
                    onReduceDuration={reduceDuration}
                    onEventDrop={onEventDrop}
                    weekDayDate={weekDays[dayIndex]}
                  />
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
