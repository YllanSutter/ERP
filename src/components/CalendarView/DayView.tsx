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
  dateField: any;
  collection: any;
  onDelete: (id: string) => void;
  onEdit: (item: any) => void;
  onViewDetail: (item: any) => void;
  hiddenFields?: string[];
  getNameValue: (item: any) => string;
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

  // Group events for the current day
  const dayEvents = useMemo(() => {
    const currentDayStr = toDateKey(dayDate);
    const dayEventList: Array<{ item: any; style: any; dayIndex: number; multiDayIndex: number }> = [];

    items.forEach((item) => {
      const style = getEventStyleLocal(item);
      if (!style) return;

      const startDateStr = toDateKey(style.startDate);
      
      // Calculer la différence en jours entre le début de l'événement et aujourd'hui
      const startDate = new Date(style.startDate);
      startDate.setHours(0, 0, 0, 0);
      const currentDay = new Date(dayDate);
      currentDay.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((currentDay.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Inclure l'événement si :
      // 1. Il commence aujourd'hui (daysDiff === 0)
      // 2. Il a commencé avant et continue aujourd'hui (0 <= daysDiff < daysSpanned)
      if (daysDiff >= 0 && daysDiff < style.daysSpanned) {
        dayEventList.push({
          item,
          style,
          dayIndex: 0,
          multiDayIndex: daysDiff,
        });
      }
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

            {/* Render events positioned absolutely */}
            {getEventLayoutLocal(dayEvents, 0).map(({ item, style, multiDayIndex, startTime: dayStartTime, endTime: dayEndTime, column, totalColumns }) => {
                const breakStart = 12;
                const dayDuration = dayEndTime - dayStartTime;
                const colors = getItemColor(item.id);
                const hasBreakThisDay = dayStartTime < breakStart && dayEndTime > breakStart;
                const visibleMetaFields = getVisibleMetaFields(item);
                return (
                  <WeekEventCard
                    key={`${item.id}-${multiDayIndex}`}
                    item={item}
                    style={style}
                    multiDayIndex={multiDayIndex}
                    dayStartTime={dayStartTime}
                    endHour={endHour}
                    dayEndTime={dayEndTime}
                    column={column}
                    totalColumns={totalColumns}
                    colors={colors}
                    startHour={startHour}
                    hoursLength={hours.length}
                    hasBreakThisDay={hasBreakThisDay}
                    visibleMetaFields={visibleMetaFields}
                    collections={collections}
                    getNameValue={getNameValue}
                    onViewDetail={onViewDetail}
                    onReduceDuration={reduceDuration}
                    onEventDrop={onEventDrop}
                    weekDayDate={currentDate}
                  />
                );
            })}
            </div>
        </div>
      </div>
    </div>
  );
};

export default DayView;
