import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import EditableProperty from '@/components/fields/EditableProperty';
import WeekEventCard from '@/components/CalendarView/WeekEventCard';
import {
  getItemColor,
  toDateKey,
  getEventStyle,
  getEventLayout,
} from '@/lib/calendarUtils';

interface DayViewProps {
  currentDate: Date;
  items: any[];
  dateField?: any;
  collection?: any;
  onDelete: (id: string) => void;
  onEdit: (item: any) => void;
  onViewDetail: (item: any) => void;
  hiddenFields?: string[];
  getNameValue: (item: any) => string;
  getDateFieldForItem?: (item: any) => any;
  startHour?: number;
  endHour?: number;
  defaultDuration?: number; // in hours
  collections?: any[];
  onEventDrop?: (item: any, newDate: Date, newHours: number, newMinutes: number) => void;
  canViewField?: (fieldId: string) => boolean;
}

const DayView: React.FC<DayViewProps> = ({
  currentDate,
  items,
  dateField,
  collection,
  onDelete,
  onEdit,
  onViewDetail,
  hiddenFields = [],
  getNameValue,
  startHour = 8,
  endHour = 20,
  defaultDuration = 1,
  collections = [],
  onEventDrop,
  canViewField = () => true,
}) => {
  const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];


  // En mode multi-collection, il faut gérer les champs visibles/contextuels par collection
  // (ne jamais appeler de hook dans un useMemo !)
  const collectionMap: Record<string, any> = {};
  (collections || []).forEach((col: any) => {
    const contextualMenuFields = col.contextualMenuFields || [];
    const visibleMetaFields = col.properties.filter(
      (p: any) =>
        !hiddenFields.includes(p.id) &&
        canViewField(p.id) &&
        !contextualMenuFields.includes(p.id)
    );
    collectionMap[col.id] = { contextualMenuFields, visibleMetaFields, collection: col };
  });

  // Helper pour récupérer la collection d'un item
  const getCollectionForItem = (item: any) => {
    if (item.__collectionId && collectionMap[item.__collectionId]) return collectionMap[item.__collectionId].collection;
    if (collections && collections.length === 1) return collections[0];
    return undefined;
  };
  // Helper pour récupérer les champs visibles d'un item
  const getVisibleMetaFields = (item: any) => {
    if (item.__collectionId && collectionMap[item.__collectionId]) return collectionMap[item.__collectionId].visibleMetaFields;
    if (collections && collections.length === 1) return collectionMap[collections[0].id].visibleMetaFields;
    return [];
  };
  // Helper pour récupérer le champ date d'un item (multi-collection)
  const getDateFieldForItem = (item: any) => {
    const col = getCollectionForItem(item);
    if (!col) return undefined;
    const dateProps = col.properties.filter((p: any) => p.type === 'date' || p.type === 'date_range');
    return dateProps[0];
  };

  // Use single day
  const dayDate = new Date(currentDate);
  dayDate.setHours(0, 0, 0, 0);

  // Helper to build a local (non-UTC) date key YYYY-MM-DD
  const toDateKeyLocal = (d: Date) => toDateKey(d);

  // Calculate event positions and spans (par item)
  const getEventStyleLocal = (item: any) => {
    const dateField = getDateFieldForItem(item);
    if (!dateField) return undefined;
    return getEventStyle(item, dateField, defaultDuration, endHour);
  };

  // Group events for the current day à partir des plages horaires (_eventSegments)
  const dayEvents = useMemo(() => {
    const currentDayStr = toDateKey(dayDate);
    const dayEventList: Array<{ item: any; segment: any; dayIndex: number; multiDayIndex: number }> = [];
    items.forEach((item) => {
      if (!item._eventSegments || !Array.isArray(item._eventSegments)) return;
      item._eventSegments.forEach((segment: any, i: number) => {
        const segStart = new Date(segment.start || segment.__eventStart);
        const segEnd = new Date(segment.end || segment.__eventEnd);
        const segDayStr = toDateKey(segStart);
        if (segDayStr === currentDayStr) {
          dayEventList.push({ item, segment, dayIndex: 0, multiDayIndex: i });
        }
      });
    });
    return dayEventList;
  }, [items, dayDate]);

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
      {/* Day Header */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-neutral-800/30">
        <div>
          <div className="text-sm font-semibold text-neutral-500">{dayNames[dayDate.getDay()]}</div>
          <div className="text-2xl font-bold text-white">{dayDate.getDate()}</div>
        </div>
        <div className="text-right text-xs text-neutral-500">
          {dayDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Time Grid */}
      <div className="flex min-w-min">
        {/* Time Column */}
        <div className="w-16">
          {hours.map(hour => (
            <div key={hour} className="h-24 text-xs text-neutral-600 font-medium pt-1">
              {hour}:00
            </div>
          ))}
        </div>

        {/* Day Column */}
        <div className="relative w-full p-20 bg-neutral-900/30">
            <div className="relative mx-auto max-w-3xl w-full">
            {hours.map((hour) => {
                return (
                <div
                    key={`day-${hour}`}
                    className={cn(
                    'h-24 border-b border-l border-white/5 transition-colors  hover:bg-neutral-800/30'
                    )}
                />
                );
            })}

            {/* Render events positionnés par plage horaire */}
            {dayEvents.map(({ item, segment, dayIndex, multiDayIndex }) => {
                const segStart = new Date(segment.start || segment.__eventStart);
                const segEnd = new Date(segment.end || segment.__eventEnd);
                const startTime = segStart.getHours() + segStart.getMinutes() / 60;
                const endTime = segEnd.getHours() + segEnd.getMinutes() / 60;
                const colors = getItemColor(item.id);
                const hasBreakThisDay = startTime < 12 && endTime > 12;
                const visibleMetaFields = getVisibleMetaFields(item);
                return (
                  <WeekEventCard
                    key={`${item.id}-seg-${multiDayIndex}`}
                    item={item}
                    style={{ startTimeInHours: startTime, endTimeInHours: endTime, startDate: segStart, endDate: segEnd }}
                    multiDayIndex={multiDayIndex}
                    dayStartTime={startTime}
                    endHour={endHour}
                    dayEndTime={endTime}
                    column={0}
                    totalColumns={1}
                    colors={colors}
                    startHour={startHour}
                    hoursLength={hours.length}
                    hasBreakThisDay={hasBreakThisDay}
                    visibleMetaFields={visibleMetaFields}
                    collections={collections}
                    getNameValue={getNameValue}
                    onViewDetail={() => onViewDetail(item)}
                    onReduceDuration={reduceDuration}
                    onEventDrop={onEventDrop}
                    weekDayDate={currentDate} startCal={0} endCal={0}                  />
                );
            })}
            </div>
        </div>
      </div>
    </div>
  );
};

export default DayView;
