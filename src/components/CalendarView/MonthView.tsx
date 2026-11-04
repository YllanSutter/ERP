import React from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/AuthProvider';
import ItemContextMenu from '@/components/menus/ItemContextMenu';
import { getCalendarEventColors, MONTH_NAMES } from '@/lib/calendarUtils';

interface MonthViewProps {
  currentDate: Date;
  items: any[];
  dateField: any;
  collection: any;
  collections?: Array<{ id: string; color?: string }>;
  onDateSelect: (date: Date) => void;
  getNameValue: (item: any) => string;
  getItemsForDate: (date: Date) => any[];
  onViewDetail: (item: any) => void;
  onDelete: (id: string) => void;
}

const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  items,
  dateField,
  collection,
  collections = [],
  onDateSelect,
  getNameValue,
  getItemsForDate,
  onViewDetail,
  onDelete,
}) => {
  const { isAdmin, isEditor, permissions } = useAuth();
  const canEditCollection = (collectionId?: string | null) => {
    if (isAdmin || isEditor) return true;
    const perms = permissions || [];
    const globalPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === null &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (globalPerm && globalPerm.can_write) return true;
    if (collectionId) {
      const collectionPerm = perms.find(
        (p: any) =>
          (p.collection_id || null) === collectionId &&
          (p.item_id || null) === null &&
          (p.field_id || null) === null
      );
      if (collectionPerm && collectionPerm.can_write) return true;
    }
    return false;
  };
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const days: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  return (
    <div className="space-y-4">
      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-xs font-semibold text-neutral-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, idx) => {
          const date = day ? new Date(currentDate.getFullYear(), currentDate.getMonth(), day) : null;
          const isToday = date && date.toDateString() === new Date().toDateString();
          // Récupérer toutes les plages horaires pour ce jour
          let daySegments: Array<{ item: any; segment: any }> = [];
          if (date) {
            items.forEach(item => {
              if (!item._eventSegments || !Array.isArray(item._eventSegments)) return;
              item._eventSegments.forEach((segment: any) => {
                const segStart = new Date(segment.start || segment.__eventStart);
                if (segStart.toDateString() === date.toDateString()) {
                  daySegments.push({ item, segment });
                }
              });
            });
          }
          const groupedSegments = daySegments.reduce((acc, entry) => {
            const key = `${entry.item.__collectionId || ''}:${entry.item.id || entry.item.__id || entry.item.name || JSON.stringify(entry.item)}`;
            if (!acc[key]) acc[key] = { item: entry.item, segments: [] as any[] };
            acc[key].segments.push(entry.segment);
            return acc;
          }, {} as Record<string, { item: any; segments: any[] }>);
          const groupedList = Object.values(groupedSegments);
          return (
            <div
              key={idx}
              className={cn(
                "min-h-24 min-w-0 rounded-lg border p-1.5 text-xs sm:min-h-28",
                !day && 'bg-transparent border-transparent',
                day && 'bg-gray-200 dark:bg-neutral-800/30 border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20',
                isToday && 'border-cyan-400 dark:border-cyan-500/50 bg-cyan-100 dark:bg-cyan-500/10'
              )}
            >
              {day && (
                <div className="flex min-w-0 flex-col gap-1">
                  <button type="button" onClick={() => date && onDateSelect(date)} className={cn(
                    'self-start rounded px-1 font-semibold',
                    isToday && 'text-cyan-500',
                    !isToday && 'text-neutral-700 dark:text-neutral-300'
                  )}>
                    {day}
                  </button>
                  {groupedList.length > 0 && (
                    <div className="flex max-h-32 min-w-0 flex-col gap-1 overflow-y-auto">
                      {groupedList.map(({ item, segments }, i) => (
                        <div key={item.id + '-' + i} className="relative group">
                          <ItemContextMenu
                            item={item}
                            onViewDetail={onViewDetail}
                            onDelete={onDelete}
                            canEdit={canEditCollection(item.__collectionId)}
                          >
                            <button
                              className="block w-full truncate rounded border-l-2 px-1 text-left text-[10px] font-medium text-foreground hover:underline [--calendar-event-surface:white] dark:[--calendar-event-surface:#171717]"
                              style={(() => {
                                const source = collections.find((entry) => entry.id === item.__collectionId);
                                const colors = getCalendarEventColors(item.id, item.__collectionId || '', source?.color);
                                return { backgroundColor: colors.bg, borderLeftColor: colors.border };
                              })()}
                              title={[getNameValue(item), ...segments.map((segment) =>
                                [segment.start || segment.__eventStart, segment.end || segment.__eventEnd]
                                  .map((value) => new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
                                  .join(' – ')
                              )].join('\n')}
                              onClick={e => {
                                e.stopPropagation();
                                (item.onViewDetail || onViewDetail)(item);
                              }}
                            >
                              {getNameValue(item)}
                            </button>
                          </ItemContextMenu>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
