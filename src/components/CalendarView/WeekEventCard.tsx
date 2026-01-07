import React, { Fragment } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { ColorSet, EventStyle, calculateEventPosition, formatTimeDisplay, formatFieldValue as formatFieldValueUtil } from '@/lib/calendarUtils';

interface WeekEventCardProps {
  item: any;
  style: EventStyle;
  multiDayIndex: number;
  dayStartTime: number;
  dayEndTime: number;
  column: number;
  totalColumns: number;
  colors: ColorSet;
  startHour: number;
  endHour: number;
  hoursLength: number;
  hasBreakThisDay: boolean;
  visibleMetaFields: any[];
  collections: any[];
  getNameValue: (item: any) => string;
  onViewDetail: (item: any) => void;
  onReduceDuration: (item: any, hours: number) => void;
  onEventDrop?: (item: any, newDate: Date, newHours: number, newMinutes: number) => void;
  weekDayDate?: Date;
}

const WeekEventCard: React.FC<WeekEventCardProps> = ({
  item,
  style,
  multiDayIndex,
  dayStartTime,
  dayEndTime,
  column,
  totalColumns,
  colors,
  startHour,
  endHour,
  hoursLength,
  hasBreakThisDay,
  visibleMetaFields,
  collections,
  getNameValue,
  onViewDetail,
  onReduceDuration,
  onEventDrop,
  weekDayDate,
}) => {
  const breakStart = 12;
  const breakEnd = 13;
  const widthPercent = (1 / totalColumns) * 100;
  const leftPercent = column * widthPercent;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!onEventDrop || !weekDayDate) return;

    const container = (e.currentTarget as HTMLElement).parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dropY = e.clientY - rect.top;
    const containerHeight = rect.height;
    
    // Calculate hour based on drop position within the day container
    const hourOffset = (dropY / containerHeight) * (endHour - startHour);
    const newHour = Math.max(startHour, Math.min(endHour - 1, Math.floor(startHour + hourOffset)));
    const newMinutes = Math.round(((startHour + hourOffset) % 1) * 60);

    // weekDayDate is the date for this column's day
    onEventDrop(item, weekDayDate, newHour, newMinutes);
  };

  // If event overlaps with break, split it into two parts
  if (hasBreakThisDay) {
    const beforeBreakEnd = Math.min(dayEndTime, breakStart);
    const afterBreakStart = breakEnd;

    const beforeBreakDuration = beforeBreakEnd - dayStartTime;
    const afterBreakDuration = dayEndTime - breakStart;

    return (
      <Fragment key={`${item.id}-${multiDayIndex}`}>
        {beforeBreakDuration > 0 && (
          <motion.div
            draggable
            onDragStart={(e: any) => {
              const dragEvent = e as DragEvent;
              dragEvent.dataTransfer!.effectAllowed = 'move';
              const element = e.currentTarget as HTMLElement;
              const height = element.offsetHeight;
              const data = { ...item, __dragHeight: height };
              dragEvent.dataTransfer!.setData('application/json', JSON.stringify(data));
            }}
            onDrop={handleDrop}
            onDragOver={(e: any) => {
              e.preventDefault();
              const dragEvent = e as DragEvent;
              dragEvent.dataTransfer!.dropEffect = 'move';
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute p-1.5 cursor-move transition-colors group text-xs overflow-hidden z-10 rounded-sm hover:opacity-80"
            style={{
              top: `${calculateEventPosition(dayStartTime, beforeBreakEnd, startHour, endHour, hoursLength).topOffset}px`,
              height: `${calculateEventPosition(dayStartTime, beforeBreakEnd, startHour, endHour, hoursLength).heightPx}px`,
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              minHeight: '24px',
              borderLeft: `4px solid ${colors.border}`,
              backgroundColor: colors.bg,
              color: colors.text,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.bg)}
            onClick={() => onViewDetail(item)}
          >
            <div className="font-medium truncate">{getNameValue(item)}</div>
            <div className="text-[10px] opacity-70">
              {(() => {
                const startH = Math.floor(dayStartTime);
                const startM = Math.round((dayStartTime - startH) * 60);
                return `${formatTimeDisplay(startH, startM)} - 12:00`;
              })()}
            </div>
            {visibleMetaFields.map((field: any) => {
              const val = formatFieldValueUtil(item, field, collections);
              return val ? (
                <div key={field.id} className="text-[9px] opacity-60 truncate">
                  {field.name}: {val}
                </div>
              ) : null;
            })}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReduceDuration(item, beforeBreakDuration);
              }}
              className="absolute top-0.5 right-0.5 p-0.5 rounded bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={10} />
            </button>
          </motion.div>
        )}

        {afterBreakDuration > 0 && (
          <motion.div
            draggable
            onDragStart={(e: any) => {
              const dragEvent = e as DragEvent;
              dragEvent.dataTransfer!.effectAllowed = 'move';
              const element = e.currentTarget as HTMLElement;
              const height = element.offsetHeight;
              const data = { ...item, __dragHeight: height };
              dragEvent.dataTransfer!.setData('application/json', JSON.stringify(data));
            }}
            onDrop={handleDrop}
            onDragOver={(e: any) => {
              e.preventDefault();
              const dragEvent = e as DragEvent;
              dragEvent.dataTransfer!.dropEffect = 'move';
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute p-1.5 cursor-move transition-colors group text-xs overflow-hidden z-10 rounded-sm hover:opacity-80"
            style={{
              top: `${calculateEventPosition(afterBreakStart, dayEndTime, startHour, endHour, hoursLength).topOffset}px`,
              height: `${calculateEventPosition(afterBreakStart, dayEndTime, startHour, endHour, hoursLength).heightPx}px`,
              left: `${leftPercent}%`,
              width: `${widthPercent}%`,
              minHeight: '24px',
              borderLeft: `4px solid ${colors.border}`,
              backgroundColor: colors.bg,
              color: colors.text,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.bg)}
            onClick={() => onViewDetail(item)}
          >
            <div className="font-medium truncate">{getNameValue(item)}</div>
            <div className="text-[10px] opacity-70">
              {(() => {
                const startH = Math.floor(afterBreakStart);
                const startM = Math.round((afterBreakStart - startH) * 60);
                const endH = Math.floor(dayEndTime);
                const endM = Math.round((dayEndTime - endH) * 60);
                return `${formatTimeDisplay(startH, startM)} - ${formatTimeDisplay(endH, endM)}`;
              })()}
            </div>
            {visibleMetaFields.map((field: any) => {
              const val = formatFieldValueUtil(item, field, collections);
              return val ? (
                <div key={field.id} className="text-[9px] opacity-60 truncate">
                  {field.name}: {val}
                </div>
              ) : null;
            })}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReduceDuration(item, afterBreakDuration);
              }}
              className="absolute top-0.5 right-0.5 p-0.5 rounded bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={10} />
            </button>
          </motion.div>
        )}
      </Fragment>
    );
  }

  const dayDuration = dayEndTime - dayStartTime;
  const { topOffset, heightPx } = calculateEventPosition(
    dayStartTime,
    dayEndTime,
    startHour,
    endHour,
    hoursLength
  );

  return (
    <motion.div
      key={`${item.id}-${multiDayIndex}`}
      draggable
      onDragStart={(e: any) => {
        const dragEvent = e as DragEvent;
        dragEvent.dataTransfer!.effectAllowed = 'move';
        const element = e.currentTarget as HTMLElement;
        const height = element.offsetHeight;
        const data = { ...item, __dragHeight: height };
        dragEvent.dataTransfer!.setData('application/json', JSON.stringify(data));
      }}
      onDrop={handleDrop}
      onDragOver={(e: any) => {
        e.preventDefault();
        const dragEvent = e as DragEvent;
        dragEvent.dataTransfer!.dropEffect = 'move';
      }}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute rounded-sm p-1.5 cursor-move transition-colors group text-xs overflow-hidden z-10 hover:opacity-80"
      style={{
        top: `${topOffset}px`,
        height: `${heightPx}px`,
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        minHeight: '24px',
        borderLeft: `4px solid ${colors.border}`,
        backgroundColor: colors.bg,
        color: colors.text,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.hover)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.bg)}
      onClick={() => onViewDetail(item)}
    >
      <div className="font-medium truncate">{getNameValue(item)}</div>
      <div className="text-[10px] opacity-70">
        {(() => {
          const startH = Math.floor(dayStartTime);
          const startM = Math.round((dayStartTime - startH) * 60);
          const endH = Math.floor(dayEndTime);
          const endM = Math.round((dayEndTime - endH) * 60);
          return `${formatTimeDisplay(startH, startM)} - ${formatTimeDisplay(endH, endM)}`;
        })()}
      </div>
      {visibleMetaFields.map((field: any) => {
        const val = formatFieldValueUtil(item, field, collections);
        return val ? (
          <div key={field.id} className="text-[9px] opacity-60 truncate">
            {field.name}: {val}
          </div>
        ) : null;
      })}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onReduceDuration(item, dayDuration);
        }}
        className="absolute top-0.5 right-0.5 p-0.5 rounded bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={10} />
      </button>
    </motion.div>
  );
};

export default WeekEventCard;
