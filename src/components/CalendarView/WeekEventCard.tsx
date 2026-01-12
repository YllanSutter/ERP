import { ColorSet, EventStyle, calculateEventPosition, formatTimeDisplay, formatFieldValue as formatFieldValueUtil, splitEventByWorkdays } from '@/lib/calendarUtils';
import React, { Fragment } from 'react';
import ItemContextMenu from '@/components/menus/ItemContextMenu';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';

interface WeekEventCardProps {
  item: any;
  eventSegments: Array<{
    start: number;
    end: number;
    label?: string;
  }>;
  multiDayIndex: number;
  column: number;
  totalColumns: number;
  colors: ColorSet;
  startHour: number;
  endHour: number;
  hoursLength: number;
  visibleMetaFields: any[];
  collections: any[];
  getNameValue: (item: any) => string;
  onViewDetail: (item: any) => void;
  onReduceDuration: (item: any, hours: number) => void;
  onEventDrop?: (item: any, newDate: Date, newHours: number, newMinutes: number) => void;
}

const WeekEventCard: React.FC<WeekEventCardProps> = ({
  item,
  eventSegments,
  multiDayIndex,
  column,
  totalColumns,
  colors,
  startHour,
  endHour,
  hoursLength,
  visibleMetaFields,
  collections,
  getNameValue,
  onViewDetail,
  onReduceDuration,
  onEventDrop,
}) => {
  // Debug : log des plages horaires et de l'item
  console.log('[WeekEventCard] item:', item);
  console.log('[WeekEventCard] eventSegments:', eventSegments);
  const dragRef = React.useRef<HTMLDivElement>(null);
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
    label?: string;
  }

  const EventItem: React.FC<EventItemProps> = ({
    startTime,
    endTime,
    duration,
    label,
  }) => {
    const { topOffset, heightPx } = calculateEventPosition(
      startTime,
      endTime,
      startHour,
      endHour,
      hoursLength
    );
    return (
      <ItemContextMenu
        item={item}
        onViewDetail={onViewDetail}
        onDelete={onReduceDuration ? () => onReduceDuration(item, duration) : () => {}}
        canEdit={!!onReduceDuration}
        quickEditProperties={[]}
      >
        <motion.div
          ref={dragRef}
          draggable={!!onEventDrop}
          initial={false}
          className={`absolute rounded-sm p-0.5 px-2 grid gap-2 items-start content-start transition-colors group text-xs overflow-hidden z-10 hover:opacity-80 ${onEventDrop ? 'cursor-move' : 'cursor-default'}`}
          style={{
            top: `${topOffset}px`,
            height: `${heightPx}px`,
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            minHeight: '24px',
            borderLeft: `4px solid ${colors.border}`,
            backgroundColor: colors.bg,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = colors.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = colors.bg)}
          onClick={() => onViewDetail(item)}
          onDragStart={(e: any) => handleDragStart(e)}
          onDragEnd={(e: any) => handleDragEnd(e)}
        >
          {/* Affichage du champ nom uniquement s'il est visible */}
          {(() => {
            const nameField = collections[0]?.properties?.find((p: any) => p.name === 'Nom' || p.id === 'name');
            if (nameField && visibleMetaFields.some((f: any) => f.id === nameField.id)) {
              return (
                <div className="font-medium truncate">{getNameValue(item)}</div>
              );
            }
            return null;
          })()}
          <div className="text-[10px] opacity-70 absolute right-1 top-1">
            {(() => {
              const startH = Math.floor(startTime);
              const startM = Math.round((startTime - startH) * 60);
              const endH = Math.floor(endTime);
              const endM = Math.round((endTime - endH) * 60);
              return `${formatTimeDisplay(startH, startM)} - ${formatTimeDisplay(endH, endM)}`;
            })()}
          </div>
          {label && <div className="text-[9px] truncate">{label}</div>}
          {/* ...affichage des autres champs comme avant... */}
          {(() => {
            const itemCollection = collections.find((col: any) => col.items?.some((it: any) => it.id === item.id)) || collections[0];
            const collectionProps = itemCollection?.properties || [];
            const visibleIds = visibleMetaFields.map((f: any) => f.id);
            return collectionProps
              .filter((p: any) => visibleIds.includes(p.id))
              .map((field: any) => {
                const value = item[field.id];
                if (value === undefined || value === null || value === '') return null;
                // MULTI-SELECT : badges colorés
                if (field.type === 'multi_select' && Array.isArray(value)) {
                  const options = field.options || [];
                  return (
                    <div key={field.id} className="flex items-center flex-wrap gap-1 text-[9px] truncate">
                      <span className="mr-1">{field.name}:</span>
                      {value.map((val: any, idx: number) => {
                        const opt = options.find((o: any) => (typeof o === 'string' ? o === val : o.value === val || o.label === val));
                        const color = opt?.color || opt?.bgColor || 'rgba(139,92,246,0.08)';
                        const label = opt?.label || opt?.value || val;
                        return (
                          <span
                            key={val + idx}
                            className="px-2 py-0.5 rounded bg-white/10 inline-flex items-center gap-2"
                          >
                            <span>{label}</span>
                          </span>
                        );
                      })}
                    </div>
                  );
                }
                // SELECT : badge coloré
                if (field.type === 'select') {
                  const options = field.options || [];
                  let val = value;
                  let opt = options.find((o: any) => (typeof o === 'string' ? o === val : o.value === val || o.label === val));
                  if (typeof val === 'object' && val !== null) {
                    opt = options.find((o: any) => o.value === val.value || o.label === val.label);
                    val = val.label || val.value;
                  }
                  const color = opt?.color || opt?.bgColor || 'rgba(139,92,246,0.08)';
                  const label = opt?.label || opt?.value || val;
                  return (
                    <div key={field.id} className="flex items-center flex-wrap gap-1 text-[9px] truncate">
                      <span className="mr-1">{field.name}:</span>
                      <span
                        className="px-2 py-0.5 text-xs rounded bg-white/10 inline-flex items-center gap-2"
                        style={{ backgroundColor: color }}
                      >
                        <span>{label}</span>
                      </span>
                    </div>
                  );
                }
                // AUTRES (fallback)
                const val = formatFieldValueUtil(item, field, collections);
                return val ? (
                  <div key={field.id} className="text-[9px] truncate">
                    {field.name}: {val}
                  </div>
                ) : null;
              });
          })()}
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
      </ItemContextMenu>
    );
  };

  // Affiche chaque plage horaire reçue en prop
  if (eventSegments && eventSegments.length > 0) {
    // Debug : log chaque segment
    eventSegments.forEach((seg, idx) => {
      console.log(`[WeekEventCard] Event affiché:`, {
        itemId: item.id,
        segmentIndex: idx,
        start: seg.start,
        end: seg.end,
        label: seg.label
      });
    });
    return (
      <Fragment>
        {eventSegments.map((seg, idx) => (
          <EventItem
            key={`${item.id}-${multiDayIndex}-seg${idx}`}
            startTime={seg.start}
            endTime={seg.end}
            duration={seg.end - seg.start}
            label={seg.label}
          />
        ))}
      </Fragment>
    );
  }
  // Si aucune plage, ne rien afficher
  return null;
};

export default WeekEventCard;
