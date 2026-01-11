import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import EditableProperty from '@/components/fields/EditableProperty';
import WeekEventCard from '@/components/CalendarView/WeekEventCard';
import {
  getWeekDays,
  toDateKey,
  getItemColor,
  getEventStyle,
  getEventLayout,
  calculateDropTime,
  workDayStart,
  workDayEnd
} from '@/lib/calendarUtils';

interface WeekViewProps {
  currentDate: Date;
  items: any[];
  collections: any[];
  onDelete: (id: string) => void;
  onEdit: (item: any) => void;
  onViewDetail: (item: any) => void;
  hiddenFields?: string[];
  getNameValue: (item: any) => string;
  getItemsForDate: (date: Date) => any[];
  startHour?: number;
  endHour?: number;
  startCal?: number;
  endCal?: number;
  defaultDuration?: number; // in hours
  onEventDrop?: (item: any, newDate: Date, newHours: number, newMinutes: number) => void;
  canViewField?: (fieldId: string) => boolean;
  getDateFieldForItem?: (item: any) => any;
}

const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  items,
  collections = [],
  onDelete,
  onEdit,
  onViewDetail,
  hiddenFields = [],
  getNameValue,
  getItemsForDate,
  startHour = 8,
  endHour = 20,
  defaultDuration = 1,
  onEventDrop,
  canViewField = () => true,
  getDateFieldForItem,
}) => {
  const dayNamesShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const [dragPreview, setDragPreview] = React.useState<{ dayIndex: number; positionY: number } | null>(null);
  const weekDays = getWeekDays(currentDate);
  // Regroupe les événements par jour
  const eventsByDay = useMemo(() => {
    const events: Record<string, Array<{ item: any; style: any; dayIndex: number; multiDayIndex: number }>> = {};
    weekDays.forEach((date) => {
      const dateStr = toDateKey(date);
      events[dateStr] = [];
    });
    items.forEach((item) => {
      const dateField = getDateFieldForItem ? getDateFieldForItem(item) : undefined;
      if (!dateField) return;
      const style = getEventStyle(item, dateField, defaultDuration, endHour);
      if (!style) return;
      if (style.workdayDates && style.workdayDates.length > 0) {
        style.workdayDates.forEach((date: Date, i: number) => {
          const dateStr = toDateKey(date);
          const dayIndex = weekDays.findIndex((d) => toDateKey(d) === dateStr);
          if (dayIndex !== -1) {
            events[dateStr].push({ item, style, dayIndex, multiDayIndex: i });
          }
        });
      } else {
        const startDateStr = toDateKey(style.startDate);
        const dayIndex = weekDays.findIndex((d) => toDateKey(d) === startDateStr);
        if (dayIndex !== -1) {
          events[startDateStr].push({ item, style, dayIndex, multiDayIndex: 0 });
        }
      }
    });
    return events;
  }, [items, weekDays, getDateFieldForItem, defaultDuration, endHour]);
  const getEventLayoutLocal = (dayEvents: any[], multiDayIndex: number) => getEventLayout(dayEvents, multiDayIndex, startHour, endHour);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  return (
    <div className="space-y-4 overflow-x-auto">
      <div className="grid grid-cols-6 min-w-min">
        <div className="w-16"></div>
        {weekDays.map((date, idx) => {
          const isToday = date.toDateString() === new Date().toDateString();
          const dayOfWeek = date.getDay();
          return (
            <div
              key={idx}
              className={cn(
                'text-center py-3 border px-2',
                isToday ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-white/10 bg-neutral-800/30'
              )}
            >
              <div className="text-xs font-semibold text-neutral-500">{dayNamesShort[dayOfWeek]}</div>
              <div className={cn('text-lg font-bold', isToday ? 'text-cyan-300' : 'text-white')}>{date.getDate()}</div>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-6 min-w-min">
        <div className="w-16">
          {hours.map(hour => (
            <div key={hour} className="h-24 text-xs text-neutral-600 font-medium pt-1">{hour}:00</div>
          ))}
        </div>
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
              const adjustedDropY = Math.max(0, dropY - dragStartOffsetY);
              setDragPreview({ dayIndex, positionY: adjustedDropY });
            } catch (e) {}
          };
          const handleDayDragLeave = () => { setDragPreview(null); };
          const handleDayDrop = (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const dragData = e.dataTransfer.getData('application/json');
            if (!dragData) return;
            try {
              const data = JSON.parse(dragData);
              const item = { ...data };
              delete item.__dragStartOffsetY;
              const container = e.currentTarget as HTMLElement;
              const rect = container.getBoundingClientRect();
              const dropY = e.clientY - rect.top;
              const dragStartOffsetY = data.__dragStartOffsetY || 0;
              const adjustedDropY = Math.max(0, dropY - dragStartOffsetY);
              const { hour, minutes } = calculateDropTime({ dropY: adjustedDropY, containerHeight: rect.height, startHour, endHour });
              if (onEventDrop) {
                onEventDrop(item, date, hour, minutes);
              }
            } catch (e) { console.error('Error parsing drag data:', e); } finally { setDragPreview(null); }
          };
          return (
            <div key={dayIndex} className="relative" onDragOver={handleDayDragOver} onDragLeave={handleDayDragLeave} onDrop={handleDayDrop}>
              {dragPreview && dragPreview.dayIndex === dayIndex && (
                <div className="absolute left-0 right-0 border-t-2 border-blue-500 pointer-events-none z-50" style={{ top: `${dragPreview.positionY}px` }} />
              )}
              {hours.map((hour) => (
                <div key={`${dayIndex}-${hour}`} className={cn('h-24 border-b border-l border-white/5 transition-colors bg-neutral-900/30 hover:bg-neutral-800/30')} />
              ))}
              {layoutEvents.map(({ item, style, multiDayIndex, startTime: dayStartTime, endTime: dayEndTime, column, totalColumns }) => {
                const colors = getItemColor(item.id);
                const visibleMetaFields = collections.find(c => c.id === item.__collectionId)?.properties.filter((p: any) => !hiddenFields.includes(p.id));
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
                    startCal={workDayStart}
                    endCal={workDayEnd}
                    hoursLength={hours.length}
                    hasBreakThisDay={false}
                    visibleMetaFields={visibleMetaFields}
                    collections={collections}
                    getNameValue={getNameValue}
                    onViewDetail={onViewDetail}
                    onReduceDuration={() => {}}
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
