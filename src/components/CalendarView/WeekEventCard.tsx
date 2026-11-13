import ItemContextMenu from '@/components/menus/ItemContextMenu';
import React, { useState, useRef, useEffect } from 'react';
import { ColorSet, calculateEventPosition, formatFieldValue, formatTimeDisplay } from '@/lib/calendarUtils';
import { useCanEdit, useCanEditField, useCanEditFields, useCanViewFields } from '@/lib/hooks/useCanEdit';
import type { OptionType } from '@/components/inputs/LightSelect';
import { OptionTags } from '@/components/inputs/OptionTags';
import EditableProperty from '@/components/fields/EditableProperty';
import { ArrowUpRight, Clock, Ellipsis, FileText, GripHorizontal, Trash2, Type, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { motion } from 'framer-motion';

type CalendarFieldProps = React.ComponentProps<typeof EditableProperty> & {
  collectionId?: string;
  canEdit: boolean;
};

function CalendarField({ collectionId, canEdit, ...props }: CalendarFieldProps) {
  const canEditField = useCanEditField(props.property.id, collectionId);
  return <EditableProperty {...props} readOnly={!canEdit || !canEditField} />;
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
  workStartHour?: number;
  workEndHour?: number;
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



type EventItemProps = Omit<WeekEventCardProps, 'eventSegments'> & {
  startTime: number;
  endTime: number;
};

const EventItem: React.FC<EventItemProps> = ({
  item,
  startTime,
  endTime,
  multiDayIndex,
  column,
  totalColumns,
  colors,
  startHour,
  endHour,
  workStartHour = startHour,
  workEndHour = endHour,
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
}) => {

  const dragRef = useRef<HTMLDivElement>(null);
  const columnWidth = 100 / totalColumns;

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

  const duration = endTime - startTime;
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
      newEndTime = Math.min(newEndTime, workEndHour);
      // Arrondi à 15min
      newEndTime = Math.round(newEndTime * 4) / 4;
      setResizePreviewEndTime(newEndTime);
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (resizeStartY.current === null) return;
      const deltaY = e.clientY - resizeStartY.current;
      const hoursDelta = deltaY / (hoursLength * 96) * (endHour - startHour);
      let newEndTime = Math.max(startTime + 0.25, initialEndTime.current + hoursDelta);
      newEndTime = Math.min(newEndTime, workEndHour);
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
  }, [isResizing, startTime, endTime, duration, hoursLength, endHour, startHour, workEndHour, onReduceDuration, item]);
  // Trouver la collection de l'item
  const itemCollection = collections.find((col: any) => col.id === item.__collectionId)
    || collections.find((col: any) => col.items?.some((it: any) => it.id === item.id))
    || collections[0];
  const collectionProps = itemCollection?.properties || [];
  const visibleIds = visibleMetaFields.map((f: any) => f.id);
  // console.log(hiddenFields);
  // Permissions
  const canEdit = useCanEdit(itemCollection?.id);
  const canEditFieldFn = useCanEditFields(itemCollection?.id);
  const canViewFieldFn = useCanViewFields(itemCollection?.id);

  // Détermine la propriété de titre (par convention: type 'title' ou nom 'Titre' ou 'Name')
  const orderedVisibleProps: any[] = collectionProps.filter(
    (prop: any) => visibleIds.includes(prop.id) && !hiddenFields.includes(prop.id) && canViewFieldFn(prop.id)
  );
  const titleProp = orderedVisibleProps.find((prop: any) => prop.id === 'name' || prop.name === 'Nom');
  const bodyProps: any[] = orderedVisibleProps.filter((prop: any) => prop.id !== titleProp?.id);
  const title = titleProp ? getNameValue(item) || 'Sans titre' : 'Événement';
  const renderField = (prop: any, preview = false, readOnly = false) => (
    <CalendarField
      property={prop}
      value={item[prop.id]}
      onChange={(value) => onEditField?.({ ...item, [prop.id]: value })}
      size="xs"
      compactDate
      forceRichEditor={!preview && prop.type === 'rich_text'}
      richTextPreviewLimit={preview ? 80 : undefined}
      className={preview && prop.type === 'rich_text' ? '!text-[10px]' : undefined}
      collections={collections}
      currentItem={item}
      onRelationChange={onRelationChange}
      onNavigateToCollection={onNavigateToCollection}
      canEdit={!readOnly && canEdit && Boolean(onEditField)}
      collectionId={itemCollection?.id}
    />
  );

  // Calcul du feedback visuel pendant le resize
  const previewEndTime = isResizing && resizePreviewEndTime !== null ? resizePreviewEndTime : endTime;
  const previewHeightPx = isResizing && resizePreviewEndTime !== null
    ? calculateEventPosition(startTime, resizePreviewEndTime, startHour, endHour, hoursLength).heightPx
    : heightPx;
  const formatHour = (time: number) => formatTimeDisplay(Math.floor(time), Math.round((time % 1) * 60));
  const timeLabel = `${formatHour(startTime)} – ${formatHour(previewEndTime)}`;
  const badgeTypes = ['select', 'multiselect', 'multi_select', 'relation'];
  const badgeFields = bodyProps.flatMap((prop: any) => {
    if (!badgeTypes.includes(prop.type)) return [];
    if (prop.type === 'relation') {
      const label = formatFieldValue(item, prop, collections);
      return label ? [{ prop, value: label, label, options: [{ value: label, label, color: '#64748b' }] }] : [];
    }
    const value = item[prop.id];
    if (!value || (Array.isArray(value) && !value.length)) return [];
    const options: OptionType[] = prop.options || [];
    const label = (Array.isArray(value) ? value : [value]).map((id) => {
      const option = options.find((candidate) => (typeof candidate === 'string' ? candidate : candidate.value) === id);
      return typeof option === 'object' ? option.label || option.value : option || id;
    }).join(', ');
    return [{ prop, value, options, label }];
  });
  const showBadges = previewHeightPx >= 58 && badgeFields.length > 0;
  const links = bodyProps.flatMap((prop: any) => {
    if (prop.type !== 'url' || typeof item[prop.id] !== 'string') return [];
    const value = item[prop.id].trim();
    if (!value) return [];
    try {
      const url = new URL(value.includes('://') ? value : `https://${value}`);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        return [{ id: prop.id, name: prop.name, href: url.href }];
      }
    } catch {
      // Une URL incomplète reste modifiable depuis le panneau des champs.
    }
    return [];
  });
  const fieldGroups = new Map<string, any[]>();
  for (const prop of bodyProps) {
    const value = item[prop.id];
    if (prop.type === 'url' || badgeTypes.includes(prop.type) || value == null || value === '' || (Array.isArray(value) && !value.length)) continue;
    const groupType = prop.type === 'rich_text' ? 'text' : prop.type;
    const group = fieldGroups.get(groupType) ?? [];
    group.push(prop);
    fieldGroups.set(groupType, group);
  }
  const visibleRows = [...fieldGroups.values()].flat().slice(
    0, Math.max(0, Math.floor((previewHeightPx - 44 - (showBadges ? 18 : 0)) / 24))
  );

  const menuProps = {
    item, onViewDetail, canEdit, onEdit: onEditField, collections, onRelationChange, onNavigateToCollection,
    canEditField: canEditFieldFn,
    quickEditProperties: collectionProps.filter((property: any) => property.showContextMenu && canViewFieldFn(property.id)),
    extraActions: onReduceDuration ? [{ label: 'Supprimer le segment', onSelect: () => onReduceDuration(item, { type: 'delete', index: multiDayIndex }) }] : [],
  };
  return (
    <ItemContextMenu {...menuProps}>
        <motion.div
          ref={dragRef}
          draggable={!!onEventDrop && !isResizing}
          onMouseDown={() => console.log('[DND] mouseDown sur event', { item, onEventDrop })}
          initial={false}
          className={`absolute rounded-md px-1.5 py-0.5 flex min-w-0 flex-col gap-0.5 transition-colors group text-[11px] text-foreground overflow-hidden z-10 [--calendar-event-surface:white] dark:[--calendar-event-surface:#171717] ${onEventDrop && !isResizing ? 'cursor-move' : 'cursor-default'}`}
          style={{
            top: `${topOffset}px`,
            height: `${previewHeightPx}px`,
            left: `calc(${column * columnWidth}% + 2px)`,
            width: `calc(${columnWidth}% - 4px)`,
            borderLeft: `4px solid ${colors.border}`,
            backgroundColor: colors.bg,
            pointerEvents: isResizing ? 'none' : undefined,
            opacity: isResizing ? 0.85 : 1,
            boxShadow: isResizing ? '0 0 0 2px #a5b4fc' : undefined,
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.backgroundColor = colors.hover)}
          onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.backgroundColor = colors.bg)}
          onDragStart={(e: any) => handleDragStart(e)}
          onDragEnd={(e: any) => handleDragEnd(e)}
          onContextMenu={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); }}
        >
          <div className="flex h-4 min-w-0 shrink-0 items-center gap-1">
            {canEdit && <GripHorizontal size={12} aria-hidden="true" className="hidden shrink-0 text-muted-foreground md:block" />}
            <span className="min-w-0 flex-1 truncate font-semibold leading-4" title={`${title} · ${timeLabel}`}>
              {title}
            </span>
            {links.length > 0 && (
              <TooltipProvider>
                {links.map((link) => (
                  <Tooltip key={link.id}>
                    <TooltipTrigger asChild>
                      <a href={link.href} target="_blank" rel="noopener noreferrer" draggable={false}
                        aria-label={`Ouvrir ${link.name}`}
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-black/10 hover:text-foreground focus-visible:outline dark:hover:bg-white/15">
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs break-all border border-border bg-popover text-popover-foreground shadow-md">
                      <span className="font-semibold">{link.name}</span>{' : '}{link.href}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            )}
            <ItemContextMenu {...menuProps} triggerMode="button">
              <button type="button" draggable={false} aria-label={`Menu de ${title}`}
                className="flex h-4 w-5 shrink-0 items-center justify-center rounded hover:bg-black/10 focus-visible:outline focus-visible:outline-1 dark:hover:bg-white/15">
                <Ellipsis size={14} />
              </button>
            </ItemContextMenu>
            {canEdit && (
              <button
                type="button"
                draggable={false}
                aria-label="Supprimer le segment"
                title="Supprimer le segment"
                onClick={(event) => {
                  event.stopPropagation();
                  onReduceDuration(item, { type: 'delete', index: multiDayIndex });
                }}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/15 hover:text-destructive focus-visible:outline"
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            )}
          </div>
          {previewHeightPx >= 38 && (
            <div className="shrink-0 truncate text-[10px] tabular-nums leading-3 text-muted-foreground">
              {timeLabel}
            </div>
          )}
          <TooltipProvider>
            {showBadges && (
              <div className="flex h-4 min-w-0 shrink-0 gap-0.5 overflow-hidden">
                {badgeFields.map(({ prop, value, options, label }) => (
                  <Tooltip key={prop.id}>
                    <TooltipTrigger asChild>
                      <div className="min-w-0" tabIndex={0}>
                        <OptionTags options={options} value={value} compact borderless />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs break-words border border-border bg-popover text-popover-foreground shadow-md">
                      <span className="font-semibold">{prop.name}</span>{' : '}{label}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
            {visibleRows.length > 0 && (
              <div className="min-w-0 divide-y divide-white/10 overflow-hidden">
                {visibleRows.map((prop: any) => (
                  <Tooltip key={prop.id}>
                    <TooltipTrigger asChild>
                      <div className="flex h-6 min-w-0 items-center gap-1.5 overflow-hidden text-[10px]">
                        <span aria-hidden="true" className="flex w-3 shrink-0 items-center justify-center text-muted-foreground">
                          {prop.type === 'text' && <Type size={11} />}
                          {prop.type === 'rich_text' && <FileText size={11} />}
                        </span>
                        <div className="min-w-0 flex-1 overflow-hidden">{renderField(prop, true)}</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs border border-border bg-popover text-popover-foreground shadow-md">
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="shrink-0 font-semibold">{prop.name} :</span>
                        <div className="min-w-0">{renderField(prop, true, true)}</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </TooltipProvider>
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
        </motion.div>
    </ItemContextMenu>
  );
};

const WeekEventCard: React.FC<WeekEventCardProps> = ({ eventSegments, ...props }) => (
  <>
    {eventSegments?.map((segment, index) => (
      <EventItem key={index} {...props} startTime={segment.start} endTime={segment.end} />
    ))}
  </>
);

export default WeekEventCard;
