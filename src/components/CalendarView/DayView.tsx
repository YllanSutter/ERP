import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
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
  startHour?: number;
  endHour?: number;
  defaultDuration?: number;
  collections?: any[];
  onEventDrop?: (item: any, newDate: Date, newHours: number, newMinutes: number, opts?: any) => void;
  canViewField?: (fieldId: string) => boolean;
  getDateFieldForItem?: (item: any) => any;
}

const DayView: React.FC<DayViewProps> = ({
  currentDate,
  items,
  collections = [],
  onDelete,
  onEdit,
  onViewDetail,
  hiddenFields = [],
  getNameValue,
  startHour = 8,
  endHour = 20,
  defaultDuration = 1,
  onEventDrop,
  canViewField = () => true,
  getDateFieldForItem,
}) => {

  // ...le reste du code inchangé...
    const dayNamesShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
    const dayDate = new Date(currentDate);
    dayDate.setHours(0, 0, 0, 0);
    // Regroupe les événements par jour à partir des plages horaires (_eventSegments)
    const eventsByDay = useMemo(() => {
      const events: Array<{ item: any; segment: any; multiDayIndex: number }> = [];
      items.forEach((item) => {
        if (!item._eventSegments || !Array.isArray(item._eventSegments)) return;
        item._eventSegments.forEach((segment: any, i: number) => {
          const segStart = new Date(segment.start || segment.__eventStart);
          const segDayStr = toDateKey(segStart);
          if (segDayStr === toDateKey(dayDate)) {
            events.push({ item, segment, multiDayIndex: i });
          }
        });
      });
      return events;
    }, [items, dayDate]);

    return (
      <div className="space-y-4 overflow-x-auto">
        <div className="grid grid-cols-1 min-w-min">
          <div className="w-16"></div>
          <div className={cn(
            'text-center py-3 border px-2',
            dayDate.toDateString() === new Date().toDateString()
              ? 'border-cyan-500/50 bg-cyan-500/10'
              : 'border-black/10 dark:border-white/10 bg-background dark:bg-neutral-800/30'
          )}>
            <div className="text-xs font-semibold text-neutral-500">{dayNamesShort[dayDate.getDay()]}</div>
            <div className={cn('text-lg font-bold', dayDate.toDateString() === new Date().toDateString() ? 'text-cyan-600 dark:text-cyan-300' : 'text-neutral-700 dark:text-white')}>{dayDate.getDate()}</div>
          </div>
        </div>
        <div className="grid grid-cols-3 min-w-min">
          <div className="w-16">
            {hours.map(hour => (
              <div key={hour} className="h-24 text-xs text-neutral-600 font-medium pt-1">{hour}:00</div>
            ))}
          </div>
          <div className="relative">
            {hours.map((hour) => (
              <div
                key={`day-${hour}`}
                className={cn('h-24 border-b border-l border-black/10 dark:border-white/5 transition-colors bg-background dark:bg-neutral-900/30 hover:bg-gray-100 dark:hover:bg-neutral-800/30')}
              />
            ))}
            {/* Render events positionnés par plage horaire */}
            {eventsByDay.map(({ item, segment, multiDayIndex }) => {
              const segStart = new Date(segment.start || segment.__eventStart);
              const segEnd = new Date(segment.end || segment.__eventEnd);
              const startTime = segStart.getHours() + segStart.getMinutes() / 60;
              const endTime = segEnd.getHours() + segEnd.getMinutes() / 60;
              const colors = getItemColor(item.id);
              const visibleMetaFields = collections.find(c => c.id === item.__collectionId)?.properties.filter((p: any) => !(hiddenFields ?? []).includes(p.id));
              return (
                <WeekEventCard
                  key={`${item.id}-seg-${multiDayIndex}`}
                  item={item}
                  eventSegments={[{ start: startTime, end: endTime, label: segment.label || undefined }]}
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
                  onReduceDuration={(_item, action) => {
                    if (action.type !== 'delete') return;
                    // Supprime le segment correspondant (multiDayIndex)
                    const updatedSegments = (item._eventSegments || []).filter((_: any, idx: number) => idx !== action.index);
                    const updatedItem = { ...item, _eventSegments: updatedSegments };
                    if (onEdit) onEdit(updatedItem);
                  }}
                  canViewField={canViewField}
                  onEventDrop={(item, newDate, newHours, newMinutes) => {
                    if (onEventDrop) {
                      onEventDrop(item, newDate, newHours, newMinutes, { segmentIndex: multiDayIndex });
                    }
                  }}
                  onShowNewItemModalForCollection={undefined}
                />
              );
            })}

          </div>
        </div>
      </div>
    );
};

export default DayView;
