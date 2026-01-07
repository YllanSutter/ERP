import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  currentDate: Date;
  items: any[];
  dateField: any;
  collection: any;
  onDateSelect: (date: Date) => void;
  getNameValue: (item: any) => string;
  getItemsForDate: (date: Date) => any[];
}

const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  items,
  dateField,
  collection,
  onDateSelect,
  getNameValue,
  getItemsForDate,
}) => {
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
          const dayItems = date ? getItemsForDate(date) : [];

          return (
            <motion.button
              key={idx}
              onClick={() => date && onDateSelect(date)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: day ? 1.05 : 1 }}
              className={cn(
                "aspect-square rounded-lg border transition-all p-2 text-xs",
                !day && 'bg-transparent border-transparent',
                day && 'bg-neutral-800/30 border-white/5 hover:border-white/20',
                isToday && 'border-cyan-500/50 bg-cyan-500/10'
              )}
            >
              {day && (
                <div className="flex flex-col h-full justify-between">
                  <span className={cn(
                    'font-semibold',
                    isToday && 'text-cyan-300',
                    !isToday && 'text-neutral-300'
                  )}>
                    {day}
                  </span>
                  {dayItems.length > 0 && (
                    <div className="text-[10px] text-violet-300 font-medium">
                      {dayItems.length}
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
