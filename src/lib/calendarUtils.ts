/**
 * Découpe un événement sur plusieurs jours ouvrés, en tenant compte des horaires et de la pause
 * Retourne un tableau d'objets { ...item, __eventStart, __eventEnd }
 */
export const breakStart = 12;
export const breakEnd = 13;
export const workHoursPerDay = 7;
export const workDayStart = 9; // Heure de début de journée de travail fixe
export const workDayEnd = 17;

export function splitEventByWorkdays(item: any, opts: { startCal: number; endCal: number; breakStart: number; breakEnd: number }) {
  const { startCal, endCal, breakStart, breakEnd } = opts;

  const startHour = startCal;
  const endHour = endCal;

  // console.log(startHour +'-'+ endHour);
  const start = new Date(item.__eventStart || item.startDate || item.start);
  let durationMs: number;
  if (item.__eventEnd || item.endDate || item.end) {
    const end = new Date(item.__eventEnd || item.endDate || item.end);
    durationMs = end.getTime() - start.getTime();
  } else if (item.durationHours) {
    durationMs = item.durationHours * 60 * 60 * 1000;
  } else {
    return [];
  }
  if (!start || isNaN(start.getTime()) || durationMs <= 0) return [];

  const events = [];
  let remainingMs = durationMs;
  let current = new Date(start);

  while (remainingMs > 0) {
    // Si samedi (6) ou dimanche (0), passe au lundi suivant
    while (current.getDay() === 0 || current.getDay() === 6) {
      current.setDate(current.getDate() + 1);
      current.setHours(startHour, 0, 0, 0);
    }

    // Définir les bornes de la journée
    let dayStart = new Date(current);
    let dayEnd = new Date(current);
    dayStart.setHours(startHour, 0, 0, 0);
    dayEnd.setHours(endHour, 0, 0, 0);

    // Premier segment : commence à l'heure réelle si premier jour
    let segmentStart = new Date(Math.max(dayStart.getTime(), current.getTime()));
    // Pause
    let pauseStart = new Date(current);
    pauseStart.setHours(breakStart, 0, 0, 0);
    let pauseEnd = new Date(current);
    pauseEnd.setHours(breakEnd, 0, 0, 0);

    // 1. Matin (avant pause)
    if (segmentStart < pauseStart && segmentStart < dayEnd && remainingMs > 0) {
      // La borne de fin ne doit jamais dépasser la pause ni endHour
      let segmentEnd = new Date(Math.min(pauseStart.getTime(), dayEnd.getTime(), segmentStart.getTime() + remainingMs));
      if (segmentEnd > dayEnd) segmentEnd = new Date(dayEnd);
      if (segmentEnd > segmentStart) {
        const seg = {
          ...item,
          __eventStart: new Date(segmentStart),
          __eventEnd: new Date(segmentEnd),
        };
        // console.log('segment:', seg.__eventStart.toLocaleString(), '-', seg.__eventEnd.toLocaleString());
        events.push(seg);
        remainingMs -= (segmentEnd.getTime() - segmentStart.getTime());
        segmentStart = new Date(segmentEnd);
      }
    }

    // 2. Après-midi (après pause)
    // On saute la pause si besoin
    if (segmentStart < dayEnd && segmentStart < pauseEnd && remainingMs > 0) {
      segmentStart = new Date(Math.max(segmentStart.getTime(), pauseEnd.getTime()));
    }
    if (segmentStart < dayEnd && remainingMs > 0) {
      // La borne de fin ne doit jamais dépasser endHour
      let segmentEnd = new Date(Math.min(dayEnd.getTime(), segmentStart.getTime() + remainingMs));
      if (segmentEnd > dayEnd) segmentEnd = new Date(dayEnd);
      if (segmentEnd > segmentStart) {
        const seg = {
          ...item,
          __eventStart: new Date(segmentStart),
          __eventEnd: new Date(segmentEnd),
        };
        // console.log('segment:', seg.__eventStart.toLocaleString(), '-', seg.__eventEnd.toLocaleString());
        events.push(seg);
        remainingMs -= (segmentEnd.getTime() - segmentStart.getTime());
        segmentStart = new Date(segmentEnd);
      }
    }

    // Passer au jour suivant si durée restante
    current.setDate(current.getDate() + 1);
    current.setHours(startHour, 0, 0, 0);
  }
  // console.log('splitEventByWorkdays result:', events);
  return events;
}
/**
 * Utilitaires factorisés pour la gestion du calendrier (multi-collection)
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
  workdayDates?: Date[];
}



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
  // console.log('event pos' + startHour+ '-' + endHour);
  return { topOffset, heightPx };
};

export interface ColorSet {
  border: string;
  bg: string;
  hover: string;
  text: string;
}

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

export function getWeekDays(currentDate: Date): Date[] {
  const weekDays: Date[] = [];
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);
  for (let i = 0; i < 5; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    weekDays.push(day);
  }
  return weekDays;
}

export const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
};

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getItemColor(itemId: string): ColorSet {
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
}

export function getEventStyle(item: any, dateField: any, defaultDuration: number, endHour: number): EventStyle | null {
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
  let workdayDates: Date[] = [new Date(startDate)];
  let durationHours = duration;
  let firstDayAvailableHours = endHour - startTimeInHours;
  if (durationHours > firstDayAvailableHours) {
    let remainingHours = durationHours - firstDayAvailableHours;
    let current = new Date(startDate);
    while (remainingHours > 0) {
      current.setDate(current.getDate() + 1);
      workdayDates.push(new Date(current));
      remainingHours -= (endHour - startHourNum);
    }
  }
  return {
    startDate,
    endDate,
    startTimeInHours,
    endTimeInHours,
    durationHours: duration,
    hoursPerDay: endHour - startHourNum,
    daysSpanned: workdayDates.length,
    hasBreak: false,
    workdayDates,
  };
}

export function getEventLayout(dayEvents: any[], multiDayIndex: number, startHour: number, endHour: number) {
  return dayEvents.map(({ item, style, dayIndex, multiDayIndex }) => ({
    item,
    style,
    multiDayIndex,
    startTime: style.startTimeInHours,
    endTime: style.endTimeInHours,
    column: 0,
    totalColumns: 1,
  }));
}

export function calculateDropTime({ dropY, containerHeight, startHour, endHour }: { dropY: number; containerHeight: number; startHour: number; endHour: number; }) {
  const totalHours = endHour - startHour;
  const hourOffset = (dropY / containerHeight) * totalHours;
  const newHourDecimal = startHour + hourOffset;
  const totalMinutes = newHourDecimal * 60;
  const snappedMinutes = Math.round(totalMinutes / 15) * 15;
  const snappedHourDecimal = snappedMinutes / 60;
  const hour = Math.floor(snappedHourDecimal);
  const minutes = Math.round((snappedHourDecimal % 1) * 60);
  return { hour, minutes };
}

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
