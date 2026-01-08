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
  const dragRef = React.useRef<HTMLDivElement>(null);
  const breakStart = 12;
  const breakEnd = 13;
  const space = 6;
  const widthPercent = ((1 / totalColumns) * 100) - space;
  const leftPercent = (column * widthPercent) + (space/2);

  const handleDragStart = (e: React.DragEvent) => {
    const dragEvent = e as unknown as DragEvent;
    dragEvent.dataTransfer!.effectAllowed = 'move';
    
    // Capture la position relative du click par rapport au haut de l'élément
    const element = e.currentTarget as HTMLElement;
    const elementRect = element.getBoundingClientRect();
    const clickYRelative = e.clientY - elementRect.top;
    
    if (dragRef.current) {
      dragRef.current.style.opacity = '0.5';
    }
    
    const data = { 
      ...item,
      __dragStartOffsetY: clickYRelative // Position du click par rapport au haut
    };
    dragEvent.dataTransfer!.setData('application/json', JSON.stringify(data));
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (dragRef.current) {
      dragRef.current.style.opacity = '1';
    }
  };

  interface EventItemProps {
    startTime: number;
    endTime: number;
    duration: number;
    displayStartTime?: number;
    displayEndTime?: number;
  }

  const EventItem: React.FC<EventItemProps> = ({
    startTime,
    endTime,
    duration,
    displayStartTime,
    displayEndTime,
  }) => {
    const { topOffset, heightPx } = calculateEventPosition(
      startTime,
      endTime,
      startHour,
      endHour,
      hoursLength
    );

    return (
      <motion.div
        ref={dragRef}
        draggable={!!onEventDrop}
        initial={false}
        className={`absolute rounded-sm p-1.5 transition-colors group text-xs overflow-hidden z-10 hover:opacity-80 ${onEventDrop ? 'cursor-move' : 'cursor-default'}`}
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
        onDragStart={(e: any) => handleDragStart(e)}
        onDragEnd={(e: any) => handleDragEnd(e)}
      >
        <div className="font-medium truncate">{getNameValue(item)}</div>
        <div className="text-[10px] opacity-70">
          {(() => {
            const dStart = displayStartTime ?? startTime;
            const dEnd = displayEndTime ?? endTime;
            const startH = Math.floor(dStart);
            const startM = Math.round((dStart - startH) * 60);
            const endH = Math.floor(dEnd);
            const endM = Math.round((dEnd - endH) * 60);
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
            onReduceDuration(item, duration);
          }}
          className="absolute top-0.5 right-0.5 p-0.5 rounded bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 size={10} />
        </button>
      </motion.div>
    );
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
          <EventItem
            startTime={dayStartTime}
            endTime={beforeBreakEnd}
            duration={beforeBreakDuration}
            displayEndTime={breakStart}
          />
        )}

        {afterBreakDuration > 0 && (
          <EventItem
            startTime={afterBreakStart}
            endTime={dayEndTime}
            duration={afterBreakDuration}
            displayStartTime={afterBreakStart}
          />
        )}
      </Fragment>
    );
  }

  const dayDuration = dayEndTime - dayStartTime;

  return (
    <EventItem
      key={`${item.id}-${multiDayIndex}`}
      startTime={dayStartTime}
      endTime={dayEndTime}
      duration={dayDuration}
    />
  );
};

export default WeekEventCard;
