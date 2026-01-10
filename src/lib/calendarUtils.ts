/**
 * Calendar utility functions for WeekView
 */

export interface EventStyle {
  startDate: Date;
  endDate: Date;
  startTimeInHours: number;
  endTimeInHours: number;
  durationHours: number;
  hoursPerDay: number;
  daysSpanned: number;
  hasBreak: boolean;
}

export interface ColorSet {
  border: string;
  bg: string;
  hover: string;
  text: string;
}

/**
 * Generate consistent color for each item based on its ID
 */
export const getItemColor = (itemId: string): ColorSet => {
  let hash = 0;
  for (let i = 0; i < itemId.length; i++) {
    hash = itemId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return {
    border: `hsl(${hue}, 70%, 50%)`,
    bg: `hsl(${hue}, 70%, 15%)`,
    hover: `hsl(${hue}, 70%, 20%)`,
    text: `hsl(${hue}, 70%, 80%)`,
  };
};

/**
 * Build a local (non-UTC) date key YYYY-MM-DD
 */
export const toDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Get week days starting from Monday to Friday (work week only)
 */
export const getWeekDays = (currentDate: Date): Date[] => {
  const weekDays: Date[] = [];
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Lundi
  startOfWeek.setDate(diff);

  for (let i = 0; i < 5; i++) { // Du lundi au vendredi seulement
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    weekDays.push(day);
  }
  return weekDays;
};

/**
 * Get today's date
 */
export const getToday = (): Date => {
  return new Date();
};

/**
 * Get today's date as YYYY-MM-DD string
 */
export const getTodayKey = (): string => {
  return toDateKey(new Date());
};

/**
 * Get the Monday of the week for a given date
 */
export const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
};

/**
 * Month names in French
 */
export const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

/**
 * Get items for a specific date
 */
export const getItemsForDate = (
  date: Date,
  items: any[],
  dateField: any
): any[] => {
  if (!dateField) return [];

  const dateStr = date.toISOString().split('T')[0];
  return items.filter((item) => {
    const value = item[dateField.id];
    if (!value) return false;

    if (dateField.type === 'date') {
      const itemDate = new Date(value).toISOString().split('T')[0];
      return itemDate === dateStr;
    } else if (dateField.type === 'date_range') {
      if (typeof value === 'object' && value.start && value.end) {
        const start = new Date(value.start).toISOString().split('T')[0];
        const end = new Date(value.end).toISOString().split('T')[0];
        return dateStr >= start && dateStr <= end;
      }
    }
    return false;
  });
};

/**
 * Get the name value of an item from a collection
 */
export const getNameValue = (item: any, collection: any): string => {
  const nameField = collection.properties.find(
    (p: any) => p.name === 'Nom' || p.id === 'name'
  );
  return nameField ? item[nameField.id] : item.name || 'Sans titre';
};

/**
 * Navigate to previous period based on view mode
 */
export const getPreviousPeriod = (
  currentDate: Date,
  viewMode: 'month' | 'week' | 'day'
): Date => {
  const newDate = new Date(currentDate);
  if (viewMode === 'month') {
    newDate.setMonth(currentDate.getMonth() - 1);
  } else if (viewMode === 'week') {
    newDate.setDate(currentDate.getDate() - 7);
  } else if (viewMode === 'day') {
    newDate.setDate(currentDate.getDate() - 1);
  }
  return newDate;
};

/**
 * Navigate to next period based on view mode
 */
export const getNextPeriod = (
  currentDate: Date,
  viewMode: 'month' | 'week' | 'day'
): Date => {
  const newDate = new Date(currentDate);
  if (viewMode === 'month') {
    newDate.setMonth(currentDate.getMonth() + 1);
  } else if (viewMode === 'week') {
    newDate.setDate(currentDate.getDate() + 7);
  } else if (viewMode === 'day') {
    newDate.setDate(currentDate.getDate() + 1);
  }
  return newDate;
};

/**
 * Calculate event positions and spans
 */
export const getEventStyle = (
  item: any,
  dateField: any,
  defaultDuration: number,
  endHour: number
): EventStyle | null => {
  const itemValue = item[dateField.id];
  if (!itemValue) return null;

  let startDate: Date;
  let endDate: Date;
  let duration: number;

  if (dateField.type === 'date') {
    startDate = new Date(itemValue);
    duration = item[`${dateField.id}_duration`] || dateField.defaultDuration || defaultDuration;
    endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + duration);
  } else if (dateField.type === 'date_range') {
    if (typeof itemValue === 'object' && itemValue.start && itemValue.end) {
      startDate = new Date(itemValue.start);
      endDate = new Date(itemValue.end);
      duration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    } else {
      return null;
    }
  } else {
    return null;
  }

  const startHourNum = startDate.getHours();
  const startMinutes = startDate.getMinutes();
  const endHourNum = endDate.getHours();
  const endMinutes = endDate.getMinutes();

  const startTimeInHours = startHourNum + startMinutes / 60;
  const endTimeInHours = endHourNum + endMinutes / 60;

  // Check if event overlaps with break time (12h-13h)
  const breakStart = 12;
  const breakEnd = 13;
  const workDayEnd = 17;
  let adjustedEndTime = endTimeInHours;

  // If event starts before break and ends after break start
  if (startTimeInHours < breakStart && endTimeInHours > breakStart) {
    // Add 1 hour to end time to account for break
    adjustedEndTime = endTimeInHours + 1;
  }

  // Calculer les heures disponibles le premier jour
  let firstDayAvailableHours: number;
  if (startTimeInHours < breakStart) {
    // Commence avant la pause : peut travailler jusqu'à 12h, puis de 13h à 17h
    const hoursBeforeBreak = breakStart - startTimeInHours;
    const hoursAfterBreak = workDayEnd - breakEnd;
    firstDayAvailableHours = hoursBeforeBreak + hoursAfterBreak;
  } else if (startTimeInHours >= breakEnd) {
    // Commence après la pause : peut travailler jusqu'à 17h
    firstDayAvailableHours = workDayEnd - startTimeInHours;
  } else {
    // Commence pendant la pause : peut travailler de 13h à 17h
    firstDayAvailableHours = workDayEnd - breakEnd;
  }

  // Calculer le nombre de jours nécessaires
  let durationHours = duration;
  let daysSpanned = 1;
  let hoursPerDay = Math.min(durationHours, firstDayAvailableHours);

  if (durationHours > firstDayAvailableHours) {
    const remainingHours = durationHours - firstDayAvailableHours;
    const additionalDays = Math.ceil(remainingHours / 7);
    daysSpanned = 1 + additionalDays;
  }

  return {
    startDate,
    endDate,
    startTimeInHours,
    endTimeInHours: adjustedEndTime,
    durationHours: duration,
    hoursPerDay,
    daysSpanned,
    hasBreak: startTimeInHours < breakStart && endTimeInHours > breakStart,
  };
};

/**
 * Format field value for display (select or relation)
 */
export const formatFieldValue = (item: any, prop: any, collections: any[]): string => {
  const value = item[prop.id];
  if (!value) return '';

  if (prop.type === 'select') {
    return value;
  }

  if (prop.type === 'relation') {
    const targetCol = collections.find((c: any) => c.id === prop.relation?.targetCollectionId);
    if (!targetCol) return '';

    const nameField = targetCol.properties.find((p: any) => p.name === 'Nom' || p.id === 'name') || { id: 'name' };

    if (Array.isArray(value)) {
      return value
        .map((id: string) => {
          const linkedItem = targetCol.items.find((i: any) => i.id === id);
          return linkedItem ? (linkedItem[nameField.id] || linkedItem.name || '') : '';
        })
        .filter(Boolean)
        .join(', ');
    } else {
      const linkedItem = targetCol.items.find((i: any) => i.id === value);
      return linkedItem ? (linkedItem[nameField.id] || linkedItem.name || '') : '';
    }
  }

  return '';
};

export interface EventLayoutItem {
  item: any;
  style: EventStyle;
  multiDayIndex: number;
  startTime: number;
  endTime: number;
  column: number;
  totalColumns: number;
}

/**
 * Detect overlapping events and calculate columns
 */
export const getEventLayout = (
  dayEvents: any[],
  multiDayIndex: number,
  startHour: number,
  endHour: number
): EventLayoutItem[] => {
  const breakStart = 12;
  const breakEnd = 13;
  const workHoursPerDay = 7;
  const workDayStart = 9; // Heure de début de journée de travail fixe
  const workDayEnd = 17; // Heure de fin de journée fixe (9h + 7h travail + 1h pause = 17h)

  // Calculate time range for each event
  const eventsWithTime: EventLayoutItem[] = dayEvents.map(({ item, style, multiDayIndex: mdi }) => {
    let dayStartTime: number;
    let dayDuration: number;
    
    // Calculer les heures disponibles le premier jour (selon l'heure de début)
    let firstDayHours: number;
    const startTime = style.startTimeInHours;
    if (startTime < breakStart) {
      const hoursBeforeBreak = breakStart - startTime;
      const hoursAfterBreak = workDayEnd - breakEnd;
      firstDayHours = hoursBeforeBreak + hoursAfterBreak;
    } else if (startTime >= breakEnd) {
      firstDayHours = workDayEnd - startTime;
    } else {
      firstDayHours = workDayEnd - breakEnd;
    }
    
    // Calculer les heures déjà utilisées selon le jour actuel
    let hoursAlreadyUsed: number;
    if (mdi === 0) {
      hoursAlreadyUsed = 0;
    } else if (mdi === 1) {
      // Deuxième jour : on a utilisé les heures du premier jour
      hoursAlreadyUsed = firstDayHours;
    } else {
      // Jours suivants : premier jour + (mdi-1) jours complets de 7h
      hoursAlreadyUsed = firstDayHours + (mdi - 1) * workHoursPerDay;
    }

    if (mdi === 0) {
      // Premier jour : commence à l'heure de début de l'événement
      dayStartTime = style.startTimeInHours;
      dayDuration = Math.min(style.durationHours, firstDayHours);
    } else {
      // Jours suivants : toujours commencer à l'heure de début de journée (9h)
      dayStartTime = workDayStart;
      const remainingHours = style.durationHours - hoursAlreadyUsed;
      
      // Pour une journée complète de 9h à 17h avec 1h de pause = 7h de travail
      const availableHours = workHoursPerDay;
      dayDuration = Math.min(remainingHours, availableHours);
    }

    // Calculer l'heure de fin en tenant compte de la pause
    let dayEndTime: number;
    if (dayStartTime < breakStart) {
      const hoursBeforeBreak = breakStart - dayStartTime;
      if (dayDuration <= hoursBeforeBreak) {
        // L'événement se termine avant la pause
        dayEndTime = dayStartTime + dayDuration;
      } else {
        // L'événement chevauche la pause
        const hoursAfterBreak = dayDuration - hoursBeforeBreak;
        dayEndTime = breakEnd + hoursAfterBreak;
      }
    } else {
      // L'événement commence à/après la pause
      dayEndTime = Math.max(dayStartTime, breakEnd) + dayDuration;
    }
    
    // S'assurer que l'événement ne dépasse pas 17h
    dayEndTime = Math.min(dayEndTime, workDayEnd);

    return {
      item,
      style,
      multiDayIndex: mdi,
      startTime: dayStartTime,
      endTime: dayEndTime,
      column: 0,
      totalColumns: 1,
    };
  });

  // Detect overlaps and assign columns
  const checkOverlap = (a: EventLayoutItem, b: EventLayoutItem) => {
    return a.startTime < b.endTime && b.startTime < a.endTime;
  };

  eventsWithTime.forEach((event, i) => {
    const overlapping = eventsWithTime.filter((other, j) => i !== j && checkOverlap(event, other));

    if (overlapping.length > 0) {
      // Find columns already used by overlapping events
      const usedColumns = new Set(overlapping.map((e) => e.column));

      // Assign first available column
      let column = 0;
      while (usedColumns.has(column)) {
        column++;
      }
      event.column = column;

      // Calculate total columns needed for this group
      const maxColumn = Math.max(column, ...overlapping.map((e) => e.column));
      const totalColumns = maxColumn + 1;

      // Update all overlapping events
      event.totalColumns = totalColumns;
      overlapping.forEach((e) => {
        e.totalColumns = Math.max(e.totalColumns, totalColumns);
      });
    }
  });

  return eventsWithTime;
};

/**
 * Format time display for events
 */
export const formatTimeDisplay = (
  hours: number,
  minutes: number,
  endHours?: number,
  endMinutes?: number
): string => {
  const startStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  if (endHours !== undefined && endMinutes !== undefined) {
    const endStr = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    return `${startStr} - ${endStr}`;
  }
  return startStr;
};

/**
 * Calculate position and height for event rendering
 */
export const calculateEventPosition = (
  startTime: number,
  endTime: number,
  startHour: number,
  endHour: number,
  hoursLength: number
): { topOffset: number; heightPx: number } => {
  const totalHours = endHour - startHour;
  const topOffset = ((startTime - startHour) / totalHours) * (hoursLength * 96);
  const heightPx = ((endTime - startTime) / totalHours) * (hoursLength * 96);
  return { topOffset, heightPx };
};

/**
 * Drag and Drop utilities
 */

export interface DragDropInfo {
  dropY: number; // Position du drop en pixels par rapport au container
  containerHeight: number;
  elementTop: number; // Position du haut de l'élément en cours de drag
  startHour: number;
  endHour: number;
}

/**
 * Calculate the drop time based on the position where the user is dragging
 * This accounts for the top of the element being dragged
 * Snaps to nearest 15 minutes
 */
export const calculateDropTime = (dragDropInfo: DragDropInfo): { hour: number; minutes: number } => {
  const { dropY, containerHeight, elementTop, startHour, endHour } = dragDropInfo;
  
  // La position de drop considère le haut de l'élément
  const adjustedDropY = dropY;
  
  const totalHours = endHour - startHour;
  const hourOffset = (adjustedDropY / containerHeight) * totalHours;
  const newHourDecimal = startHour + hourOffset;
  
  // Snap to nearest 15 minutes
  // Convert to minutes, round to nearest 15, convert back
  const totalMinutes = newHourDecimal * 60;
  const snappedMinutes = Math.round(totalMinutes / 15) * 15;
  const snappedHourDecimal = snappedMinutes / 60;
  
  const hour = Math.floor(snappedHourDecimal);
  const minutes = Math.round((snappedHourDecimal % 1) * 60);
  
  // Clamp to valid range
  const clampedHour = Math.max(startHour, Math.min(endHour - 1, hour));
  
  return {
    hour: clampedHour,
    minutes: clampedHour === hour ? minutes : (hour < startHour ? 0 : 59),
  };
};

/**
 * Calculate the visual position for the drag preview indicator (blue line)
 * Returns the Y position for a thin line that shows where the element will be dropped
 */
export const calculateDropIndicatorPosition = (
  dropY: number,
  containerHeight: number,
  startHour: number,
  endHour: number,
  hoursLength: number
): number => {
  // La ligne doit être à la position du curseur (ou près de là)
  // Elle montre où le haut de l'élément sera déposé
  return dropY;
};
