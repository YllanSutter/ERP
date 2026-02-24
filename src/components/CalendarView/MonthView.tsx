import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/AuthProvider';
import ItemContextMenu from '@/components/menus/ItemContextMenu';

interface MonthViewProps {
  currentDate: Date;
  items: any[];
  dateField: any;
  collection: any;
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
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
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
            const key = entry.item.id || entry.item.__id || entry.item.name || JSON.stringify(entry.item);
            if (!acc[key]) acc[key] = { item: entry.item, segments: [] as any[] };
            acc[key].segments.push(entry.segment);
            return acc;
          }, {} as Record<string, { item: any; segments: any[] }>);
          const groupedList = Object.values(groupedSegments);
          return (
            <motion.button
              key={idx}
              onClick={() => date && onDateSelect(date)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: day ? 1.05 : 1 }}
              className={cn(
                "aspect-square rounded-lg border transition-all p-2 text-xs overflow-y-auto",
                !day && 'bg-transparent border-transparent',
                day && 'bg-gray-200 dark:bg-neutral-800/30 border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20',
                isToday && 'border-cyan-400 dark:border-cyan-500/50 bg-cyan-100 dark:bg-cyan-500/10'
              )}
            >
              {day && (
                <div className="grid h-full items-center content-center relative">
                  <span className={cn(
                    'font-semibold absolute top-2 left-1/2',
                    isToday && 'text-cyan-500',
                    !isToday && 'text-neutral-700 dark:text-neutral-300'
                  )}>
                    {day}
                  </span>
                  {groupedList.length > 0 && (
                    <div className="flex flex-col gap-1 mt-1 ">
                      {groupedList.map(({ item, segments }, i) => (
                        <div key={item.id + '-' + i} className="relative group">
                          <ItemContextMenu
                            item={item}
                            onViewDetail={onViewDetail}
                            onDelete={onDelete}
                            canEdit={canEditCollection(item.__collectionId)}
                          >
                            <button
                              className="text-[10px] text-violet-600 dark:text-violet-300 font-medium text-left truncate hover:underline lg:opacity-100 hover:opacity-100 opacity-0"
                              title={getNameValue(item)}
                              onClick={e => {
                                e.stopPropagation();
                                if (item.onViewDetail) item.onViewDetail(item);
                                else if (typeof window !== 'undefined') {
                                  // Fallback: custom event for parent
                                  const event = new CustomEvent('calendar-item-detail', { detail: item });
                                  window.dispatchEvent(event);
                                }
                              }}
                            >
                              {getNameValue(item)}
                            </button>
                          </ItemContextMenu>
                          {segments.length > 0 && (
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-44 rounded-md border border-neutral-200 dark:border-neutral-700 bg-gray-100 dark:bg-neutral-900 p-2 text-[10px] text-neutral-700 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none group-hover:pointer-events-auto">
                              <div className="space-y-1">
                                {segments.map((segment: any, segIdx: number) => (
                                  <div key={segIdx} className="flex items-center gap-1">
                                    <span className="text-violet-300">▸</span>
                                    {new Date(segment.start || segment.__eventStart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    {' → '}
                                    {new Date(segment.end || segment.__eventEnd).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
