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
import { updateEventSegments } from '@/lib/updateEventSegments';

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
  onEventDrop?: (item: any, newDate: Date, newHours: number, newMinutes: number, options?: { segmentIndex?: number, moveAllSegments?: boolean }) => void;
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
                isToday ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-black/10 dark:border-white/10 bg-background dark:bg-neutral-800/30'
              )}
            >
              <div className="text-xs font-semibold text-neutral-500">{dayNamesShort[dayOfWeek]}</div>
              <div className={cn('text-lg font-bold', isToday ? 'text-cyan-600 dark:text-cyan-300' : 'text-neutral-700 dark:text-white')}>{date.getDate()}</div>
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
          const handleDayDragLeave = () => {
            console.log('[DND] handleDayDragLeave');
            setDragPreview(null);
          };
          const handleDayDrop = (e: React.DragEvent) => {
            console.log('[DND] handleDayDrop');
            e.preventDefault();
            e.stopPropagation();
            const dragData = e.dataTransfer.getData('application/json');
            if (!dragData) {
              console.warn('[DND] handleDayDrop: pas de dragData');
              return;
            }
            try {
              const data = JSON.parse(dragData);
              const item = { ...data };
              delete item.__dragStartOffsetY;
              const multiDayIndex = data.multiDayIndex ?? data.segmentIndex;
              const container = e.currentTarget as HTMLElement;
              const rect = container.getBoundingClientRect();
              const dropY = e.clientY - rect.top;
              const dragStartOffsetY = data.__dragStartOffsetY || 0;
              const adjustedDropY = Math.max(0, dropY - dragStartOffsetY);
              const { hour, minutes } = calculateDropTime({ dropY: adjustedDropY, containerHeight: rect.height, startHour, endHour });
              if (onEventDrop) {
                console.log('[DND] handleDayDrop: onEventDrop est défini, appel avec', { item, date, hour, minutes, multiDayIndex });
                onEventDrop(item, date, hour, minutes, typeof multiDayIndex === 'number' ? { segmentIndex: multiDayIndex } : undefined);
              } else {
                console.warn('[DND] handleDayDrop: onEventDrop est undefined');
              }
            } catch (e) { console.error('Error parsing drag data:', e); } finally { setDragPreview(null); }
          };
          return (
            <div key={dayIndex} className="relative" onDragOver={handleDayDragOver} onDragLeave={handleDayDragLeave} onDrop={handleDayDrop}>
              {dragPreview && dragPreview.dayIndex === dayIndex && (
                <div className="absolute left-0 right-0 border-t-2 border-blue-500 pointer-events-none z-50" style={{ top: `${dragPreview.positionY}px` }} />
              )}
              {hours.map((hour) => {
                // Cherche s'il y a un event effectivement affiché à cet horaire précis (dans la vue courante)
                // Ne bloque la création que si un event est effectivement affiché (filtré par label/champ date)
                const hasEvent = dayEvents
                  .filter(({ item, segment }) => {
                    const dateField = getDateFieldForItem ? getDateFieldForItem(item) : null;
                    if (!dateField) return false;
                    return segment.label === dateField.name;
                  })
                  .some(({ segment }) => {
                    const segStart = new Date(segment.start || segment.__eventStart);
                    const segEnd = new Date(segment.end || segment.__eventEnd);
                    // La case est occupée si le segment chevauche l'heure de la case
                    const caseStart = hour;
                    const caseEnd = hour + 1;
                    const segStartHour = segStart.getHours() + segStart.getMinutes() / 60;
                    const segEndHour = segEnd.getHours() + segEnd.getMinutes() / 60;
                    return segStartHour < caseEnd && segEndHour > caseStart;
                  });
                return (
                  <div
                    key={`${dayIndex}-${hour}`}
                    className={cn('h-24 border-b border-l border-black/10 dark:border-white/5 transition-colors bg-background dark:bg-neutral-900/30 hover:bg-gray-100 dark:hover:bg-neutral-800/30')}
                    onContextMenu={(e) => {
                      // Si clic sur un event, ne rien faire ici (le WeekEventCard gère son propre clic)
                      // if (hasEvent) return;
                      e.preventDefault();
                      e.stopPropagation();
                      // Trouve la collection du jour, ou fallback sur la première collection qui a un champ date
                      let col = collections.find(c => c.items.some((it: { _eventSegments: {
                        start: any; __eventStart: any; 
                          }[]; }) => toDateKey(new Date(it._eventSegments?.[0]?.start || it._eventSegments?.[0]?.__eventStart)) === dateStr));
                      if (!col) {
                        col = collections.find(c => c.properties.some((p: any) => p.type === 'date')) || collections[0];
                      }
                      if (!col) return;
                      // Récupère tous les champs de type 'date' de la collection
                      const dateFields = col.properties.filter((p: any) => p.type === 'date');
                      if (!dateFields.length) {
                        if (onShowNewItemModalForCollection) {
                          return onShowNewItemModalForCollection(col);
                        }
                        return;
                      }

                      // ...
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
                      // Préremplit l'item avec toutes les clés de type date de toutes les collections
                      const newItem: any = {};
                      collections.forEach((collection) => {
                        (collection.properties || []).forEach((prop: any) => {
                          if (prop.type === 'date') {
                            newItem[prop.id] = slotDate.toISOString();
                          }
                        });
                      });
                      // ...
                      if (onShowNewItemModalForCollection) {
                        // Ajoute un flag isNew pour forcer le mode création côté modal et __collectionId pour la sauvegarde
                        const newItemWithFlag = { ...newItem, isNew: true, __collectionId: col.id };
                        onShowNewItemModalForCollection(col, newItemWithFlag);
                      }
                    }}
                    title={'Créer un événement'}
                    style={{ cursor: 'context-menu' }}
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
                        onReduceDuration={(_item, arg) => {
                          // Suppression segment : on ne supprime que si arg === multiDayIndex (entier)
                          if (typeof arg === 'number' && Number.isInteger(arg) && arg === multiDayIndex) {
                            const updatedSegments = (item._eventSegments || []).filter((_: any, idx: number) => idx !== arg);
                            const updatedItem = { ...item, _eventSegments: updatedSegments };
                            if (onEdit) onEdit(updatedItem);
                            return;
                          }
                          // Sinon, on réduit la durée du segment courant (comme avant)
                          const newDuration = arg;
                          const updatedSegments = (item._eventSegments || []).map((seg: any, idx: number) => {
                            if (idx === multiDayIndex) {
                              const start = new Date(seg.start || seg.__eventStart);
                              const end = new Date(start.getTime() + (newDuration * 60 * 60 * 1000));
                              return { ...seg, end: end.toISOString() };
                            }
                            return seg;
                          });
                          const updatedItem = { ...item, _eventSegments: updatedSegments };
                          if (onEdit) onEdit(updatedItem);
                        }}
                        canViewField={canViewField}
                        onEventDrop={(item, newDate, newHours, newMinutes) => {
                          if (onEventDrop) {
                            onEventDrop(item, newDate, newHours, newMinutes, { segmentIndex: multiDayIndex });
                          }
                        }}
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
