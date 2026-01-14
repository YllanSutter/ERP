import { ColorSet, EventStyle, calculateEventPosition, formatTimeDisplay, formatFieldValue as formatFieldValueUtil, splitEventByWorkdays } from '@/lib/calendarUtils';
import { useCanEdit, useCanEditField, useCanViewField } from '@/lib/hooks/useCanEdit';
import EditableProperty from '@/components/fields/EditableProperty';
import { GripHorizontal } from 'lucide-react';

// Génère une couleur unique à partir de l'id
function colorFromId(id: string): ColorSet {
  // Simple hash pour générer une couleur
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Palette de couleurs pastel
  const colors = [
    '#A3E635', '#FBBF24', '#38BDF8', '#F472B6', '#F87171', '#34D399', '#818CF8', '#F9A8D4', '#FACC15', '#60A5FA', '#FCA5A5', '#4ADE80', '#FDE68A', '#A7F3D0', '#C4B5FD'
  ];
  const idx = Math.abs(hash) % colors.length;
  const bg = colors[idx];
  return {
  border: bg,
  bg: bg + '22', // couleur pastel + transparence
  hover: bg + '44',
  text: ''
};
}
import React, { Fragment } from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from '@/components/ui/context-menu';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { updateEventSegments } from '@/lib/updateEventSegments';

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
  hiddenFields: string[];
  canViewField?: (fieldId: string) => boolean;
  endHour: number;
  hoursLength: number;
  visibleMetaFields: any[];
  collections: any[];
  getNameValue: (item: any) => string;
  onViewDetail: (item: any) => void;
  onReduceDuration: (item: any, hours: number) => void;
  onEventDrop?: (item: any, newDate: Date, newHours: number, newMinutes: number) => void;
  onEditField?: (updatedItem: any) => void;
  collectionsList?: any[]; // pour compatibilité EditableProperty si besoin
  onRelationChange?: (property: any, item: any, value: any) => void;
  onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
  onShowNewItemModalForCollection?: (collection: any, item?: any) => void;
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
  hiddenFields,
  hoursLength,
  visibleMetaFields,
  collections,
  getNameValue,
  onViewDetail,
  onReduceDuration,
  onEventDrop,
  onEditField,
  onRelationChange,
  onNavigateToCollection,
  onShowNewItemModalForCollection,
}) => {

  const dragRef = React.useRef<HTMLDivElement>(null);
  const space = 6;
  const widthPercent = ((1 / totalColumns) * 100) - space;
  const leftPercent = (column * widthPercent) + (space/2);

  // Utilise la couleur générée par l'id de l'objet
  const objectColors = colorFromId(item.id);

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
    onEditField?: (updatedItem: any) => void;
    onRelationChange?: (property: any, item: any, value: any) => void;
    onNavigateToCollection?: (collectionId: string, linkedIds?: string[]) => void;
  }

  const EventItem: React.FC<EventItemProps & { onShowNewItemModalForCollection?: (collection: any, item?: any) => void }> = ({
    startTime,
    endTime,
    duration,
    label,
    onEditField,
    onRelationChange,
    onNavigateToCollection,
    onShowNewItemModalForCollection,
  }) => {
    const { topOffset, heightPx } = calculateEventPosition(
      startTime,
      endTime,
      startHour,
      endHour,
      hoursLength
    );
    // Trouver la collection de l'item
    const itemCollection = collections.find((col: any) => col.items?.some((it: any) => it.id === item.id)) || collections[0];
    const collectionProps = itemCollection?.properties || [];
    const visibleIds = visibleMetaFields.map((f: any) => f.id);
    // console.log(hiddenFields);
    // Permissions
    const canEdit = useCanEdit(itemCollection?.id);
    const canEditFieldFn = (fieldId: string) => useCanEditField(fieldId, itemCollection?.id);
    const canViewFieldFn = (fieldId: string) => useCanViewField(fieldId, itemCollection?.id);

    // Détermine la propriété de titre (par convention: type 'title' ou nom 'Titre' ou 'Name')
    const titleProp =
      collectionProps.find((prop: any) => prop.type === 'title') ||
      collectionProps.find((prop: any) => ['Titre', 'title', 'Name', 'name'].includes(prop.name));

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
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
              borderLeft: `4px solid ${objectColors.border}`,
              backgroundColor: objectColors.bg,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = objectColors.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = objectColors.bg)}
            onDragStart={(e: any) => handleDragStart(e)}
            onDragEnd={(e: any) => handleDragEnd(e)}
            onContextMenu={(e) => { e.stopPropagation(); }}
          >
            <div className="flex gap-2 items-center">
              {canEdit && <GripHorizontal size={14} className="text-neutral-600 transition-opacity flex-shrink-0" />}
              {titleProp ? (
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-neutral-500 text-xs">{titleProp.name}:</span>
                  <div className="flex-1 text-right">
                    <EditableProperty
                      property={titleProp}
                      value={item[titleProp.id]}
                      onChange={(val) => {
                        if (typeof onEditField === 'function') {
                          onEditField({ ...item, [titleProp.id]: val });
                        }
                      }}
                      size="sm"
                      collections={collections}
                      currentItem={item}
                      onRelationChange={typeof onRelationChange === 'function' ? onRelationChange : undefined}
                      onNavigateToCollection={typeof onNavigateToCollection === 'function' ? onNavigateToCollection : undefined}
                      readOnly={!canEdit || !canEditFieldFn(titleProp.id)}
                    />
                  </div>
                </div>
              ) : (
                <span className="font-medium text-cyan-400 text-sm flex-1 line-clamp-2 text-left">
                  {getNameValue(item)}
                </span>
              )}
            </div>
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
            {/* Champs éditables comme dans KanbanView */}
            <div className="space-y-1 w-full">
              {collectionProps
                .filter((prop: any) => visibleIds.includes(prop.id) && !hiddenFields.includes(prop.id) && canViewFieldFn(prop.id))
                .map((prop: any) => (
                  <div key={prop.id} className="flex items-center gap-1 text-[9px] truncate">
                    <span className="text-neutral-500 block mb-1">{prop.name}:</span>
                    <div className="flex-1 text-right">
                      <EditableProperty
                        property={prop}
                        value={item[prop.id]}
                        onChange={(val) => {
                          if (typeof onEditField === 'function') {
                            const updated = updateEventSegments({ ...item, [prop.id]: val }, itemCollection);
                            onEditField(updated);
                          }
                        }}
                        size="sm"
                        collections={collections}
                        currentItem={item}
                        onRelationChange={typeof onRelationChange === 'function' ? onRelationChange : undefined}
                        onNavigateToCollection={typeof onNavigateToCollection === 'function' ? onNavigateToCollection : undefined}
                        readOnly={!canEdit || !canEditFieldFn(prop.id)}
                      />
                    </div>
                  </div>
                ))}
            </div>
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
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onViewDetail(item)}>
            <span>Détails</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onShowNewItemModalForCollection && onShowNewItemModalForCollection(itemCollection, item)}>
            <span>Créer un item dans « {itemCollection?.name || 'cette collection'} »</span>
          </ContextMenuItem>
          {onReduceDuration && (
            <ContextMenuItem onClick={() => onReduceDuration(item, duration)}>
              <span className="text-red-500">Réduire/Détruire</span>
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // Affiche chaque plage horaire reçue en prop
  if (eventSegments && eventSegments.length > 0) {
    // Debug : log chaque segment
    // eventSegments.forEach((seg, idx) => {
    //   console.log(`[WeekEventCard] Event affiché:`, {
    //     itemId: item.id,
    //     segmentIndex: idx,
    //     start: seg.start,
    //     end: seg.end,
    //     label: seg.label
    //   });
    // });
    return (
      <Fragment>
        {eventSegments.map((seg, idx) => (
          <EventItem
            key={`${item.id}-${multiDayIndex}-seg${idx}`}
            startTime={seg.start}
            endTime={seg.end}
            duration={seg.end - seg.start}
            label={seg.label}
            onEditField={onEditField}
            onRelationChange={onRelationChange}
            onNavigateToCollection={onNavigateToCollection}
            onShowNewItemModalForCollection={typeof onShowNewItemModalForCollection === 'function' ? onShowNewItemModalForCollection : undefined}
          />
        ))}
      </Fragment>
    );
  }
  // Si aucune plage, ne rien afficher
  return null;
};

export default WeekEventCard;
