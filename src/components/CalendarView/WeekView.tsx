import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { addManualSegmentToItem, removeSegmentFromItem } from '@/lib/segmentManager';
import { Search } from 'lucide-react';

interface WeekViewProps {
  currentDate: Date;
  items: any[];
  collections: any[];
  collectionsAll?: any[];
  collectionRoles?: Record<string, 'primary' | 'secondary' | 'default'>;
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
  onRelationChange?: (property: any, item: any, value: any) => void;
  onShowNewItemModalForCollection?: (collection: any, item?: any) => void;
  singleDay?: boolean;
}

const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  items,
  collections = [],
  collectionsAll,
  collectionRoles = {},
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
  singleDay = false,
  onEditField,
  onRelationChange,
}) => {
  const [dragState, setDragState] = useState<null | {
    start: Date;
    end: Date;
    collectionId: string;
    anchorX: number;
    anchorY: number;
  }>(null);
  const [secondaryPicker, setSecondaryPicker] = useState<null | {
    collectionId: string;
    start: Date;
    end: Date;
    x: number;
    y: number;
    selectedItemId?: string;
    search: string;
  }>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const collectionsForProps = collectionsAll?.length ? collectionsAll : collections;
  const collectionsPool = collectionsAll && collectionsAll.length ? collectionsAll : collections;
  const primaryCollectionId = useMemo(() => {
    const entry = Object.entries(collectionRoles).find(([, role]) => role === 'primary');
    return entry?.[0] || null;
  }, [collectionRoles]);
  const secondaryCollectionId = useMemo(() => {
    const entry = Object.entries(collectionRoles).find(([, role]) => role === 'secondary');
    return entry?.[0] || null;
  }, [collectionRoles]);
  const primaryCollection = useMemo(() => {
    if (primaryCollectionId) {
      return collectionsPool.find((c: any) => c.id === primaryCollectionId) || null;
    }
    return collectionsPool.find((c: any) => c.isPrimary) || null;
  }, [collectionsPool, primaryCollectionId]);
  const secondaryCollection = useMemo(() => {
    if (!secondaryCollectionId) return null;
    return collectionsPool.find((c: any) => c.id === secondaryCollectionId) || null;
  }, [collectionsPool, secondaryCollectionId]);

  const getCollectionDisplayName = (item: any, col: any) => {
    if (!col) return item?.name || 'Sans titre';
    const nameField = col.properties?.find((p: any) => p.name === 'Nom' || p.id === 'name');
    return nameField ? item[nameField.id] : item?.name || 'Sans titre';
  };

  const getSlotDateFromEvent = (e: React.MouseEvent, date: Date, hour: number) => {
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const percent = Math.max(0, Math.min(1, y / rect.height));
    const minutesInSlot = 60;
    let minutes = Math.round(percent * minutesInSlot);
    minutes = Math.round(minutes / 15) * 15;
    if (minutes === 60) minutes = 45;
    const slotDate = new Date(date);
    slotDate.setHours(hour, minutes, 0, 0);
    return slotDate;
  };

  const findLastItemBefore = (col: any, start: Date) => {
    if (!col) return null;
    let bestItem: any = null;
    let bestTime = -Infinity;
    (col.items || []).forEach((it: any) => {
      const segments = Array.isArray(it._eventSegments) ? it._eventSegments : [];
      segments.forEach((seg: any) => {
        const end = new Date(seg.end || seg.__eventEnd || seg.start || seg.__eventStart);
        const t = end.getTime();
        if (t <= start.getTime() && t > bestTime) {
          bestTime = t;
          bestItem = it;
        }
      });
    });
    return bestItem || (col.items && col.items[0]) || null;
  };

  const findNearestItems = (col: any, start: Date) => {
    if (!col) return { before: null, after: null };
    let beforeItem: any = null;
    let afterItem: any = null;
    let beforeTime = -Infinity;
    let afterTime = Infinity;
    (col.items || []).forEach((it: any) => {
      const segments = Array.isArray(it._eventSegments) ? it._eventSegments : [];
      segments.forEach((seg: any) => {
        const end = new Date(seg.end || seg.__eventEnd || seg.start || seg.__eventStart);
        const t = end.getTime();
        if (t <= start.getTime() && t > beforeTime) {
          beforeTime = t;
          beforeItem = it;
        }
        if (t >= start.getTime() && t < afterTime) {
          afterTime = t;
          afterItem = it;
        }
      });
    });
    return { before: beforeItem, after: afterItem };
  };

  const finalizeSecondarySelection = (targetItemId?: string) => {
    if (!secondaryPicker) return;
    const col = collectionsPool.find((c: any) => c.id === secondaryPicker.collectionId);
    if (!col) {
      setSecondaryPicker(null);
      return;
    }
    const item = (col.items || []).find((it: any) => it.id === targetItemId) || null;
    if (!item) {
      setSecondaryPicker(null);
      return;
    }
    const dateField = getDateFieldForItem ? getDateFieldForItem({ ...item, __collectionId: col.id }) : null;
    const updatedItem = addManualSegmentToItem(
      { ...item, __collectionId: col.id },
      {
        start: secondaryPicker.start.toISOString(),
        end: secondaryPicker.end.toISOString(),
        label: dateField?.name || undefined,
      }
    );
    if (onEdit) onEdit(updatedItem);
    setSecondaryPicker(null);
  };

  useEffect(() => {
    if (!secondaryPicker) return;
    const onClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        finalizeSecondarySelection(secondaryPicker.selectedItemId);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSecondaryPicker(null);
      }
    };
    window.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [secondaryPicker]);

  useEffect(() => {
    if (!dragState) return;
    const onMouseUp = () => {
      const start = dragState.start;
      const end = dragState.end || dragState.start;
      let startDate = start;
      let endDate = end;
      if (endDate.getTime() < startDate.getTime()) {
        [startDate, endDate] = [endDate, startDate];
      }

      const col = collectionsPool.find((c: any) => c.id === dragState.collectionId);
      const defaultItem = col ? findLastItemBefore(col, startDate) : null;
      let defaultDurationMs = defaultDuration * 60 * 60 * 1000;
      if (defaultItem && Array.isArray(defaultItem._eventSegments) && defaultItem._eventSegments.length > 0) {
        const lastSeg = defaultItem._eventSegments[defaultItem._eventSegments.length - 1];
        const lastStart = new Date(lastSeg.start || lastSeg.__eventStart);
        const lastEnd = new Date(lastSeg.end || lastSeg.__eventEnd || lastSeg.start || lastSeg.__eventStart);
        const lastMs = lastEnd.getTime() - lastStart.getTime();
        if (Number.isFinite(lastMs) && lastMs > 0) defaultDurationMs = lastMs;
      }

      if (endDate.getTime() === startDate.getTime()) {
        endDate = new Date(startDate.getTime() + defaultDurationMs);
      }

      setSecondaryPicker({
        collectionId: dragState.collectionId,
        start: startDate,
        end: endDate,
        x: dragState.anchorX,
        y: dragState.anchorY,
        selectedItemId: defaultItem?.id,
        search: '',
      });
      setDragState(null);
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [dragState, collectionsPool, defaultDuration]);

  const dayNamesShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const [dragPreview, setDragPreview] = React.useState<{ dayIndex: number; positionY: number } | null>(null);
  const [now, setNow] = React.useState(new Date());
  const normalizedDate = new Date(currentDate);
  normalizedDate.setHours(0, 0, 0, 0);
  const weekDays = singleDay ? [normalizedDate] : getWeekDays(currentDate);
  React.useEffect(() => {
    const tick = () => setNow(new Date());
    const intervalId = window.setInterval(tick, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);
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
  const pickerCollection = secondaryPicker
    ? collectionsPool.find((c: any) => c.id === secondaryPicker.collectionId)
    : null;
  const pickerItems = secondaryPicker && pickerCollection ? (pickerCollection.items || []) : [];
  const pickerSuggestions = secondaryPicker && pickerCollection
    ? findNearestItems(pickerCollection, secondaryPicker.start)
    : { before: null, after: null };
  const filteredPickerItems = secondaryPicker && pickerCollection
    ? pickerItems.filter((it: any) => {
        const name = getCollectionDisplayName(it, pickerCollection).toLowerCase();
        const q = (secondaryPicker.search || '').toLowerCase();
        return name.includes(q);
      })
    : [];

  const getRangeStyleForDay = (date: Date) => {
    if (!dragState) return null;
    const start = dragState.start;
    const end = dragState.end || dragState.start;
    const startKey = toDateKey(start);
    const endKey = toDateKey(end);
    const dayKey = toDateKey(date);
    if (startKey !== dayKey && endKey !== dayKey) return null;
    const rangeStart = startKey === dayKey ? start : new Date(date);
    const rangeEnd = endKey === dayKey ? end : new Date(date);
    rangeStart.setHours(rangeStart.getHours(), rangeStart.getMinutes(), 0, 0);
    rangeEnd.setHours(rangeEnd.getHours(), rangeEnd.getMinutes(), 0, 0);
    const startHours = rangeStart.getHours() + rangeStart.getMinutes() / 60;
    const endHours = rangeEnd.getHours() + rangeEnd.getMinutes() / 60;
    const clampedStart = Math.max(startHour, Math.min(endHour, startHours));
    const clampedEnd = Math.max(startHour, Math.min(endHour, endHours));
    const top = (clampedStart - startHour) * 96;
    const height = Math.max(12, (clampedEnd - clampedStart) * 96);
    return { top, height };
  };
  return (
    <div className="space-y-4 overflow-x-auto">
      <div className={`grid ${weekDays.length === 1 ? 'grid-cols-2' : 'grid-cols-6'} min-w-min`}>
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
      <div className={`grid ${weekDays.length === 1 ? 'grid-cols-2' : 'grid-cols-6'} min-w-min`}>
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
          const isToday = toDateKey(date) === toDateKey(now);
          const hoursSinceStart = now.getHours() + now.getMinutes() / 60 - startHour;
          const totalHours = endHour - startHour;
          const lineTop = Math.min(Math.max(hoursSinceStart, 0), totalHours) * 96;
          const rangeStyle = getRangeStyleForDay(date);
          return (
            <div key={dayIndex} className="relative" onDragOver={handleDayDragOver} onDragLeave={handleDayDragLeave} onDrop={handleDayDrop}>
              {dragPreview && dragPreview.dayIndex === dayIndex && (
                <div className="absolute left-0 right-0 border-t-2 border-blue-500 pointer-events-none z-50" style={{ top: `${dragPreview.positionY}px` }} />
              )}
              {dragState && rangeStyle && (
                <div
                  className="absolute left-0 right-0 z-30 pointer-events-none"
                  style={{ top: `${rangeStyle.top}px`, height: `${rangeStyle.height}px` }}
                >
                  <div className="h-full rounded bg-violet-500/20 border border-violet-500/40" />
                </div>
              )}
              {isToday && hoursSinceStart >= 0 && hoursSinceStart <= totalHours && (
                <div className="absolute left-0 right-0 z-40 pointer-events-none" style={{ top: `${lineTop}px` }}>
                  <div className="relative">
                    <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500" />
                    <div className="border-t-2 border-red-500" />
                    <div className="absolute left-2 -top-3 text-[10px] text-red-500 bg-white/80 dark:bg-neutral-900/80 px-1 rounded">
                      {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
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
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      if (!secondaryCollection) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const slotDate = getSlotDateFromEvent(e, date, hour);
                      setDragState({
                        start: slotDate,
                        end: slotDate,
                        collectionId: secondaryCollection.id,
                        anchorX: e.clientX,
                        anchorY: e.clientY,
                      });
                    }}
                    onMouseMove={(e) => {
                      if (!dragState) return;
                      const slotDate = getSlotDateFromEvent(e, date, hour);
                      setDragState((prev) => (prev ? { ...prev, end: slotDate } : prev));
                    }}
                    onContextMenu={(e) => {
                      // Si clic sur un event, ne rien faire ici (le WeekEventCard gère son propre clic)
                      // if (hasEvent) return;
                      e.preventDefault();
                      e.stopPropagation();
                      // Priorité à la collection principale (rôle de vue), puis collection marquée principale
                      let col = primaryCollection;
                      // Sinon, trouve la collection du jour, ou fallback sur la première collection qui a un champ date
                      if (!col) {
                        col = collectionsPool.find(c => c.items.some((it: { _eventSegments: {
                          start: any; __eventStart: any; 
                            }[]; }) => toDateKey(new Date(it._eventSegments?.[0]?.start || it._eventSegments?.[0]?.__eventStart)) === dateStr));
                      }
                      if (!col) {
                        col = collectionsPool.find(c => c.properties.some((p: any) => p.type === 'date')) || collectionsPool[0];
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
                      const prefillCollections = col && !collections.some((c) => c.id === col.id)
                        ? [...collections, col]
                        : collections;
                      prefillCollections.forEach((collection) => {
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
                        collections={collectionsForProps}
                        getNameValue={getNameValue}
                        hiddenFields={hiddenFields ?? []}
                        onViewDetail={() => onViewDetail(item)}
                        onEditField={onEditField}
                        onRelationChange={onRelationChange}
                        onReduceDuration={(_item, action) => {
                          if (action.type === 'delete') {
                            const updatedItem = removeSegmentFromItem(item, action.index);
                            if (onEdit) onEdit(updatedItem);
                            return;
                          }
                          // Sinon, on réduit la durée du segment courant (modifie le champ end)
                          const newDuration = action.hours;
                          const seg = item._eventSegments?.[multiDayIndex];
                          if (!seg) return;
                          
                          const start = new Date(seg.start || seg.__eventStart);
                          const end = new Date(start.getTime() + (newDuration * 60 * 60 * 1000));
                          
                          const updatedItem = { ...item, _eventSegments: (item._eventSegments || []).map((s: any, idx: number) => {
                            if (idx === multiDayIndex) {
                              return { ...s, end: end.toISOString() };
                            }
                            return s;
                          }) };
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
      {secondaryPicker && pickerCollection && (
        <div
          className="fixed z-[200]"
          style={{ left: secondaryPicker.x, top: secondaryPicker.y }}
        >
          <div
            ref={pickerRef}
            className="w-72 rounded-xl border border-white/10 bg-neutral-950/95 text-white shadow-xl backdrop-blur p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-neutral-300">Ajouter une plage (secondaire)</div>
              <button
                className="text-neutral-400 hover:text-white p-1 rounded hover:bg-white/10"
                onClick={() => setSecondaryPicker(null)}
                title="Annuler"
              >
                ×
              </button>
            </div>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={secondaryPicker.search}
                onChange={(e) =>
                  setSecondaryPicker((prev) => (prev ? { ...prev, search: e.target.value } : prev))
                }
                className="w-full pl-8 pr-2 py-1.5 bg-neutral-900/70 border border-white/10 rounded text-sm text-neutral-200 placeholder-neutral-500 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div className="max-h-52 overflow-auto space-y-1">
              {pickerSuggestions.before && (
                <button
                  className="w-full text-left px-2 py-1.5 rounded text-sm transition-colors bg-white/5 hover:bg-white/10"
                  onClick={() => finalizeSecondarySelection(pickerSuggestions.before.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{getCollectionDisplayName(pickerSuggestions.before, pickerCollection)}</span>
                    <span className="text-[10px] text-neutral-400">précédent</span>
                  </div>
                </button>
              )}
              {pickerSuggestions.after && pickerSuggestions.after?.id !== pickerSuggestions.before?.id && (
                <button
                  className="w-full text-left px-2 py-1.5 rounded text-sm transition-colors bg-white/5 hover:bg-white/10"
                  onClick={() => finalizeSecondarySelection(pickerSuggestions.after.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{getCollectionDisplayName(pickerSuggestions.after, pickerCollection)}</span>
                    <span className="text-[10px] text-neutral-400">suivant</span>
                  </div>
                </button>
              )}
              {filteredPickerItems.map((it: any) => {
                const name = getCollectionDisplayName(it, pickerCollection);
                const isDefault = it.id === secondaryPicker.selectedItemId;
                return (
                  <button
                    key={it.id}
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                      isDefault
                        ? 'bg-violet-500/20 text-violet-200 border border-violet-500/30'
                        : 'hover:bg-white/5 text-neutral-200'
                    )}
                    onClick={() => finalizeSecondarySelection(it.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{name}</span>
                      {isDefault && <span className="text-[10px] text-violet-300">par défaut</span>}
                    </div>
                  </button>
                );
              })}
              {filteredPickerItems.length === 0 && (
                <div className="text-xs text-neutral-500 px-2 py-1">Aucun résultat</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeekView;
