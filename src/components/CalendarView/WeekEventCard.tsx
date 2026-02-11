import React, { Fragment, useState, useRef, useEffect } from 'react';
import { ColorSet, EventStyle, calculateEventPosition, formatTimeDisplay, formatFieldValue as formatFieldValueUtil, splitEventByWorkdays } from '@/lib/calendarUtils';
import { useCanEdit, useCanEditField, useCanViewField } from '@/lib/hooks/useCanEdit';
import EditableProperty from '@/components/fields/EditableProperty';
import { GripHorizontal, Trash2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from '@/components/ui/context-menu';
import { motion } from 'framer-motion';

// Génère une couleur unique à partir de l'id
function colorFromId(id: string): ColorSet {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#A3E635', '#FBBF24', '#38BDF8', '#F472B6', '#F87171', '#34D399', '#818CF8', '#F9A8D4', '#FACC15', '#60A5FA', '#FCA5A5', '#4ADE80', '#FDE68A', '#A7F3D0', '#C4B5FD'
  ];
  const idx = Math.abs(hash) % colors.length;
  const bg = colors[idx];
  return {
    border: bg,
    bg: bg + '22',
    hover: bg + '44',
    text: ''
  };
}

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
  onReduceDuration: (item: any, action: { type: 'resize'; hours: number } | { type: 'delete'; index: number }) => void;
  onEventDrop?: (item: any, newDate: Date, newHours: number, newMinutes: number, options?: { segmentIndex?: number, moveAllSegments?: boolean, moveMode?: 'all' | 'segment' | 'segment-following', visibleSegments?: Array<{ itemId: string; segmentIndex: number; start: string }> }) => void;
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

  const dragRef = useRef<HTMLDivElement>(null);
  const space = 6;
  const widthPercent = ((1 / totalColumns) * 100) - space;
  const leftPercent = (column * widthPercent) + (space/2);
  const isSingleColumn = totalColumns === 1;

  // Utilise la couleur générée par l'id de l'objet
  const objectColors = colorFromId(item.id);

  const handleDragStart = (e: React.DragEvent) => {
    console.log('[DND] handleDragStart', { item, multiDayIndex });
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
      __dragStartOffsetY: clickYRelative, // Position du click par rapport au haut
      multiDayIndex // Ajoute l'index du segment pour le drop
    };
    dragEvent.dataTransfer!.setData('application/json', JSON.stringify(data));
  };

  const handleDragEnd = (e: React.DragEvent) => {
    console.log('[DND] handleDragEnd', { item });
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
    // Gestion du redimensionnement (resize)
    const [isResizing, setIsResizing] = useState(false);
    const [resizePreviewEndTime, setResizePreviewEndTime] = useState<number | null>(null);
    const resizeStartY = useRef<number | null>(null);
    const initialHeight = useRef<number>(0);
    const initialEndTime = useRef<number>(endTime);
    // Appel du parent pour appliquer la nouvelle durée
    const handleResizeMouseDown = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsResizing(true);
      resizeStartY.current = e.clientY;
      initialHeight.current = heightPx;
      initialEndTime.current = endTime;
      setResizePreviewEndTime(endTime);
      document.body.style.cursor = 'ns-resize';
    };
    useEffect(() => {
      if (!isResizing) return;
      const handleMouseMove = (e: MouseEvent) => {
        if (resizeStartY.current === null) return;
        const deltaY = e.clientY - resizeStartY.current;
        // 1h = 96px (voir calculateEventPosition)
        const hoursDelta = deltaY / (hoursLength * 96) * (endHour - startHour);
        let newEndTime = Math.max(startTime + 0.25, initialEndTime.current + hoursDelta); // min 15min
        // Arrondi à 15min
        newEndTime = Math.round(newEndTime * 4) / 4;
        setResizePreviewEndTime(newEndTime);
      };
      const handleMouseUp = (e: MouseEvent) => {
        if (resizeStartY.current === null) return;
        const deltaY = e.clientY - resizeStartY.current;
        const hoursDelta = deltaY / (hoursLength * 96) * (endHour - startHour);
        let newEndTime = Math.max(startTime + 0.25, initialEndTime.current + hoursDelta);
        newEndTime = Math.round(newEndTime * 4) / 4;
        setIsResizing(false);
        setResizePreviewEndTime(null);
        resizeStartY.current = null;
        document.body.style.cursor = '';
        // Calcul de la nouvelle durée en heures
        const newDuration = newEndTime - startTime;
        // Correction : ne pas supprimer si la durée est trop courte, on limite à 15min
        if (newDuration >= 0.25 && typeof onReduceDuration === 'function') {
          // Passe la nouvelle durée (en heures) au parent
          onReduceDuration(item, { type: 'resize', hours: newDuration });
        }
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
      };
    }, [isResizing, startTime, endTime, duration, hoursLength, endHour, startHour, onReduceDuration, item]);
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

    // Calcul du feedback visuel pendant le resize
    const previewEndTime = isResizing && resizePreviewEndTime !== null ? resizePreviewEndTime : endTime;
    const previewHeightPx = isResizing && resizePreviewEndTime !== null
      ? calculateEventPosition(startTime, resizePreviewEndTime, startHour, endHour, hoursLength).heightPx
      : heightPx;
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.div
            ref={dragRef}
            draggable={!!onEventDrop && !isResizing}
            onMouseDown={() => console.log('[DND] mouseDown sur event', { item, onEventDrop })}
            initial={false}
            className={`absolute rounded-sm p-0.5 px-1.5 grid gap-1 items-start content-start transition-colors group text-[10px] overflow-hidden z-10 hover:opacity-80 ${onEventDrop && !isResizing ? 'cursor-move' : 'cursor-default'}`}
            style={{
              top: `${topOffset}px`,
              height: `${previewHeightPx}px`,
              left: isSingleColumn ? '50%' : `${leftPercent}%`,
              width: isSingleColumn ? 'min(94%, 600px)' : `${widthPercent}%`,
              minHeight: '20px',
              maxWidth: isSingleColumn ? '600px' : undefined,
              transform: isSingleColumn ? 'translateX(-50%)' : undefined,
              borderLeft: `4px solid ${objectColors.border}`,
              backgroundColor: objectColors.bg,
              pointerEvents: isResizing ? 'none' : undefined,
              opacity: isResizing ? 0.85 : 1,
              boxShadow: isResizing ? '0 0 0 2px #a5b4fc' : undefined,
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.backgroundColor = objectColors.hover)}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.backgroundColor = objectColors.bg)}
            onDragStart={(e: any) => handleDragStart(e)}
            onDragEnd={(e: any) => handleDragEnd(e)}
            onContextMenu={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); }}
          >
            <div className="flex gap-2 items-center">
              {canEdit && <GripHorizontal size={14} className="text-neutral-600 transition-opacity flex-shrink-0" />}
              {titleProp ? (
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-neutral-500 text-[10px]">{titleProp.name}:</span>
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
                <span className="font-medium text-cyan-400 text-[11px] flex-1 line-clamp-2 text-left">
                  {getNameValue(item)}
                </span>
              )}
            </div>
            <div className="text-[9px] opacity-70 absolute right-1 top-1">
              {(() => {
                const startH = Math.floor(startTime);
                const startM = Math.round((startTime - startH) * 60);
                const endH = Math.floor(previewEndTime);
                const endM = Math.round((previewEndTime - endH) * 60);
                return `${formatTimeDisplay(startH, startM)} - ${formatTimeDisplay(endH, endM)}`;
              })()}
            </div>
            {/* {label && <div className="text-[9px] truncate">{label}</div>} */}
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
                            const updated = { ...item, [prop.id]: val };
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
            {/* Handle de resize en bas */}
            {canEdit && (
              <div
                onMouseDown={handleResizeMouseDown}
                className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize flex items-center justify-center z-20"
                style={{ userSelect: 'none' }}
                title="Redimensionner (ajuster la durée)"
              >
                <div className="w-8 h-1 rounded bg-neutral-400/60" />
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Passe l'index du segment à supprimer via multiDayIndex
                onReduceDuration(item, { type: 'delete', index: multiDayIndex });
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
         
          {onReduceDuration && (
            <ContextMenuItem onClick={() => onReduceDuration(item, { type: 'delete', index: multiDayIndex })}>
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
