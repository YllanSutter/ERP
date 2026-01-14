import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
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
  onEditField?: (updatedItem: any) => void;
  onShowNewItemModalForCollection?: (collection: any, item?: any) => void;
}

const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  items,
  collections = [],
  onDelete,
  onEdit,
  onViewDetail,
  hiddenFields,
  getNameValue,
  getItemsForDate,
  startHour = 8,
  endHour = 20,
  defaultDuration = 1,
  onEventDrop,
  canViewField = () => true,
  getDateFieldForItem,
  onShowNewItemModalForCollection,
}) => {
  const dayNamesShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const [dragPreview, setDragPreview] = React.useState<{ dayIndex: number; positionY: number } | null>(null);
  const weekDays = getWeekDays(currentDate);
  // Regroupe les événements par jour à partir des plages horaires (_eventSegments)
  const eventsByDay = useMemo(() => {
    const events: Record<string, Array<{ item: any; segment: any; dayIndex: number; multiDayIndex: number }>> = {};
    weekDays.forEach((date) => {
      const dateStr = toDateKey(date);
      events[dateStr] = [];
    });
    items.forEach((item) => {
      // console.log('[WeekView] item:', item.id, 'eventSegments:', item._eventSegments);
      if (!item._eventSegments || !Array.isArray(item._eventSegments)) return;
      item._eventSegments.forEach((segment: any, i: number) => {
        const segStart = new Date(segment.start || segment.__eventStart);
        const segEnd = new Date(segment.end || segment.__eventEnd);
        const dateStr = toDateKey(segStart);
        const dayIndex = weekDays.findIndex((d) => toDateKey(d) === dateStr);
        if (dayIndex !== -1) {
          events[dateStr].push({ item, segment, dayIndex, multiDayIndex: i });
        }
      });
    });
    // console.log('[WeekView] eventsByDay:', events);
    return events;
  }, [items, weekDays]);
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
          // Ajoute la propriété style à chaque event pour getEventLayout, ignore si pas de dateField
          const dayEventsWithStyle = dayEvents
            .map(ev => {
              const dateField = getDateFieldForItem
                ? getDateFieldForItem(ev.item)
                : (collections.find(c => c.id === ev.item.__collectionId)?.properties.find((p: any) => p.type === 'date'));
              if (!dateField) return null;
              return {
                ...ev,
                style: getEventStyle(ev.item, dateField, defaultDuration, endHour)
              };
            })
            .filter(Boolean);
          const layoutEvents = getEventLayoutLocal(dayEventsWithStyle, 0);
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
              {hours.map((hour) => {
                // Cherche s'il y a un event à cet horaire précis
                const hasEvent = (eventsByDay[dateStr] || []).some(({ segment }) => {
                  const segStart = new Date(segment.start || segment.__eventStart);
                  return segStart.getHours() === hour;
                });
                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className={cn('h-24 border-b border-l border-white/5 transition-colors bg-neutral-900/30 hover:bg-neutral-800/30')}
                    onContextMenu={hasEvent || !onShowNewItemModalForCollection ? undefined : (e) => {
                      e.preventDefault();
                      // Trouve la collection du jour
                      const col = collections.find(c => c.items.some((it: { _eventSegments: {
                        start: any; __eventStart: any; 
}[]; }) => toDateKey(new Date(it._eventSegments?.[0]?.start || it._eventSegments?.[0]?.__eventStart)) === dateStr))
                        || collections[0];
                      if (!col) return;
                      // Trouve le champ date principal de la collection
                      const dateField = col.properties.find((p: any) => p.type === 'date');
                      if (!dateField) return onShowNewItemModalForCollection(col);
                      // Calcule l'heure/minute selon la position du clic
                      const container = e.currentTarget as HTMLElement;
                      const rect = container.getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      const percent = Math.max(0, Math.min(1, y / rect.height));
                      const minutesInSlot = 60;
                      let minutes = Math.round(percent * minutesInSlot);
                      // Arrondi à 15min
                      minutes = Math.round(minutes / 15) * 15;
                      if (minutes === 60) { minutes = 45; }
                      const slotDate = new Date(date);
                      slotDate.setHours(hour, minutes, 0, 0);
                      // Préremplit l'item avec la bonne date
                      const newItem = { [dateField.id]: slotDate.toISOString() };
                      onShowNewItemModalForCollection(col, newItem);
                    }}
                    title={hasEvent ? undefined : 'Créer un événement'}
                    style={{ cursor: hasEvent ? undefined : 'context-menu' }}
                  />
                );
              })}
              {dayEvents
                  // Filtre les segments pour n'afficher que ceux dont le label correspond au champ de date sélectionné
                  .filter(({ item, segment }) => {
                    const dateField = getDateFieldForItem ? getDateFieldForItem(item) : null;
                    if (!dateField) return false;
                    const labelToMatch = dateField.name;

                    // console.log(dateField.id);
                    return segment.label === labelToMatch;
                    
                  })
                  .map(({ item, segment, dayIndex, multiDayIndex }, idx, arr) => {

                    if (idx === 0) {
                      const affiches = arr.filter(({ item, segment }) => {
                        const dateField = getDateFieldForItem ? getDateFieldForItem(item) : null;
                        // console.log(dateField.id);
                        if (!dateField) return false;
                        const labelToMatch = dateField.id;

                        return segment.label === labelToMatch;
                      }).map(({ item, segment }) => {
                        const dateField = getDateFieldForItem ? getDateFieldForItem(item) : undefined;
                        const dateFieldId = dateField?.id;
                        return {
                          id: item.id,
                          name: item.name,
                          date: dateFieldId,
                          value: dateFieldId ? item[dateFieldId] : undefined,
                          segmentLabel: segment.label
                        };
                      });
                      // console.log('[WeekView] éléments affichés pour ce jour:', affiches);
                    }
                    // Prépare le segment pour WeekEventCard
                    const segStart = new Date(segment.start || segment.__eventStart);
                    const segEnd = new Date(segment.end || segment.__eventEnd);
                    const startTime = segStart.getHours() + segStart.getMinutes() / 60;
                    const endTime = segEnd.getHours() + segEnd.getMinutes() / 60;
                    const colors = getItemColor(item.id);
                    // console.log(collections);
                    const visibleMetaFields = collections.find(c => c.id === item.__collectionId)?.properties.filter((p: any) => !(hiddenFields ?? []).includes(p.id));
                    // On passe le segment courant dans eventSegments
                    const eventSegments = [{
                      start: startTime,
                      end: endTime,
                      label: segment.label || undefined
                    }];

                    return (
                      <WeekEventCard
                        key={`${item.id}-seg-${multiDayIndex}`}
                        item={item}
                        eventSegments={eventSegments}
                        multiDayIndex={multiDayIndex}
                        column={0}
                        totalColumns={1}
                        colors={colors}
                        startHour={startHour}
                        endHour={endHour}
                        hoursLength={hours.length}
                        visibleMetaFields={visibleMetaFields}
                        collections={collections}
                        getNameValue={getNameValue}
                        hiddenFields={hiddenFields ?? []}
                        onViewDetail={() => onViewDetail(item)}
                        onReduceDuration={() => {}}
                        canViewField={canViewField}
                        onEventDrop={onEventDrop}
                        onShowNewItemModalForCollection={onShowNewItemModalForCollection}
                        // onEditField={onEditField}
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
