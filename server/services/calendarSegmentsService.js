export const DEFAULT_CALENDAR_CONFIG = {
  breakStart: 12.5,
  breakEnd: 13.5,
  workDayStart: 9,
  workDayEnd: 18,
};

const clampHour = (value, min = 0, max = 24) => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
};

const parseTimeToDecimalHour = (value, fallback) => {
  if (typeof value === 'number' && Number.isFinite(value)) return clampHour(value);
  if (typeof value !== 'string') return clampHour(fallback);
  const [hRaw, mRaw] = value.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return clampHour(fallback);
  return clampHour(h + m / 60);
};

const decimalHourToHM = (value) => {
  const clamped = clampHour(value);
  let hour = Math.floor(clamped);
  let minute = Math.round((clamped - hour) * 60);
  if (minute >= 60) {
    hour += 1;
    minute = 0;
  }
  if (hour >= 24) {
    hour = 23;
    minute = 59;
  }
  return { hour, minute };
};

const setDateToDecimalHour = (date, value) => {
  const { hour, minute } = decimalHourToHM(value);
  date.setHours(hour, minute, 0, 0);
};

export const getCalendarConfigForUser = (user) => {
  let prefs = user?.user_preferences;
  if (typeof prefs === 'string') {
    try {
      prefs = JSON.parse(prefs);
    } catch {
      prefs = {};
    }
  }
  if (!prefs || typeof prefs !== 'object') prefs = {};

  const nextStart = parseTimeToDecimalHour(prefs.workStart, DEFAULT_CALENDAR_CONFIG.workDayStart);
  const nextEndRaw = parseTimeToDecimalHour(prefs.workEnd, DEFAULT_CALENDAR_CONFIG.workDayEnd);
  const nextEnd = Math.max(nextStart + 0.25, nextEndRaw);

  let nextBreakStart = parseTimeToDecimalHour(prefs.breakStart, DEFAULT_CALENDAR_CONFIG.breakStart);
  let nextBreakEnd = parseTimeToDecimalHour(prefs.breakEnd, DEFAULT_CALENDAR_CONFIG.breakEnd);

  nextBreakStart = clampHour(nextBreakStart, nextStart, nextEnd);
  nextBreakEnd = clampHour(nextBreakEnd, nextStart, nextEnd);
  if (nextBreakEnd < nextBreakStart) {
    [nextBreakStart, nextBreakEnd] = [nextBreakEnd, nextBreakStart];
  }

  return {
    workDayStart: nextStart,
    workDayEnd: nextEnd,
    breakStart: nextBreakStart,
    breakEnd: nextBreakEnd,
  };
};

const normalizeComparableValue = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const getDateProperties = (collection) => {
  if (!collection || !Array.isArray(collection.properties)) return [];
  return collection.properties.filter((prop) => prop.type === 'date');
};

const hasDateOrDurationChange = (prevItem, nextItem, collection, prevCollection) => {
  const dateProps = getDateProperties(collection);
  const prevProps = Array.isArray(prevCollection?.properties) ? prevCollection.properties : [];

  for (const prop of dateProps) {
    const dateKey = prop.id;
    const durationKey = `${prop.id}_duration`;

    const prevDate = normalizeComparableValue(prevItem?.[dateKey]);
    const nextDate = normalizeComparableValue(nextItem?.[dateKey]);
    if (prevDate !== nextDate) return true;

    const prevHasDuration = prevItem && Object.prototype.hasOwnProperty.call(prevItem, durationKey);
    const nextHasDuration = nextItem && Object.prototype.hasOwnProperty.call(nextItem, durationKey);

    const prevDuration = prevHasDuration ? normalizeComparableValue(prevItem[durationKey]) : null;
    const nextDuration = nextHasDuration ? normalizeComparableValue(nextItem[durationKey]) : null;
    if (prevDuration !== nextDuration) return true;

    if (!prevHasDuration && !nextHasDuration) {
      const prevProp = prevProps.find((p) => p.id === prop.id);
      const prevDefault = normalizeComparableValue(prevProp?.defaultDuration ?? null);
      const nextDefault = normalizeComparableValue(prop?.defaultDuration ?? null);
      if (prevDefault !== nextDefault) return true;
    }
  }

  return false;
};

export const shouldRecalculateSegments = (prevItem, nextItem, collection, prevCollection) => {
  if (!nextItem) return true;
  if (!Array.isArray(nextItem._eventSegments) || nextItem._eventSegments.length === 0) return true;
  if (!prevItem) return true;

  if (nextItem?._preserveEventSegments) {
    return false;
  }

  if (hasDateOrDurationChange(prevItem, nextItem, collection, prevCollection)) return true;

  return false;
};

/**
 * Calcule les segments de temps pour un item sur une période de jours de travail
 */
export function calculateEventSegments(item, collection, calendarConfig = DEFAULT_CALENDAR_CONFIG) {
  if (!collection || !collection.properties) return item;

  const segments = [];

  collection.properties.forEach((prop) => {
    if (prop.type === 'date' && item[prop.id]) {
      const durationKey = `${prop.id}_duration`;
      let duration = undefined;

      if (Object.prototype.hasOwnProperty.call(item, durationKey)) {
        duration = Number(item[durationKey]);
      } else if (prop.defaultDuration !== undefined && prop.defaultDuration !== null) {
        duration = Number(prop.defaultDuration);
      }

      // Si pas de durée valide, on ne génère pas de segment
      if (duration === undefined || isNaN(duration) || duration <= 0) {
        return;
      }

      // Décale la date au lundi si samedi/dimanche
      let startDate = item[prop.id];
      let startDateObj = new Date(startDate);

      if (startDateObj.getDay() === 6) { // samedi
        startDateObj.setDate(startDateObj.getDate() + 2);
        startDateObj.setHours(0, 0, 0, 0);
        startDate = startDateObj.toISOString();
      } else if (startDateObj.getDay() === 0) { // dimanche
        startDateObj.setDate(startDateObj.getDate() + 1);
        startDateObj.setHours(0, 0, 0, 0);
        startDate = startDateObj.toISOString();
      }

      // Appelle la fonction de découpe
      const segs = splitEventByWorkdaysServer(
        { startDate, durationHours: duration },
        {
          startCal: calendarConfig.workDayStart,
          endCal: calendarConfig.workDayEnd,
          breakStart: calendarConfig.breakStart,
          breakEnd: calendarConfig.breakEnd,
        }
      );

      segs.forEach(seg => {
        segments.push({
          start: seg.__eventStart instanceof Date ? seg.__eventStart.toISOString() : seg.__eventStart,
          end: seg.__eventEnd instanceof Date ? seg.__eventEnd.toISOString() : seg.__eventEnd,
          label: prop.name,
        });
      });
    }
  });

  return { ...item, _eventSegments: segments };
}

/**
 * Découpe un événement sur plusieurs jours ouvrés (version serveur)
 */
function splitEventByWorkdaysServer(item, opts) {
  const { startCal, endCal, breakStart, breakEnd } = opts;
  const start = new Date(item.startDate || item.start);

  let durationMs = 0;
  if (item.durationHours) {
    durationMs = item.durationHours * 60 * 60 * 1000;
  }

  if (!start || isNaN(start.getTime()) || durationMs <= 0) {
    return [];
  }

  const events = [];
  let remainingMs = durationMs;
  let current = new Date(start);

  while (remainingMs > 0) {
    // Saute les weekends
    while (current.getDay() === 0 || current.getDay() === 6) {
      current.setDate(current.getDate() + 1);
      setDateToDecimalHour(current, startCal);
    }

    // Définit les bornes de la journée
    let dayStart = new Date(current);
    let dayEnd = new Date(current);
    setDateToDecimalHour(dayStart, startCal);
    setDateToDecimalHour(dayEnd, endCal);

    let segmentStart = new Date(Math.max(dayStart.getTime(), current.getTime()));

    let pauseStart = new Date(current);
    setDateToDecimalHour(pauseStart, breakStart);
    let pauseEnd = new Date(current);
    setDateToDecimalHour(pauseEnd, breakEnd);

    // Matin (avant pause)
    if (segmentStart < pauseStart && segmentStart < dayEnd && remainingMs > 0) {
      let segmentEnd = new Date(Math.min(pauseStart.getTime(), segmentStart.getTime() + remainingMs));
      const segmentDuration = segmentEnd.getTime() - segmentStart.getTime();

      events.push({
        __eventStart: new Date(segmentStart),
        __eventEnd: new Date(segmentEnd),
      });

      remainingMs -= segmentDuration;
      segmentStart = new Date(pauseEnd);
    }

    // Après-midi (après pause)
    if (segmentStart < dayEnd && remainingMs > 0) {
      let segmentEnd = new Date(Math.min(dayEnd.getTime(), segmentStart.getTime() + remainingMs));
      const segmentDuration = segmentEnd.getTime() - segmentStart.getTime();

      if (segmentDuration > 0) {
        events.push({
          __eventStart: new Date(segmentStart),
          __eventEnd: new Date(segmentEnd),
        });
        remainingMs -= segmentDuration;
      }
    }

    // Passe au jour suivant
    current.setDate(current.getDate() + 1);
    setDateToDecimalHour(current, startCal);
  }

  return events;
}
