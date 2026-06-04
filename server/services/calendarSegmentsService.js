export const DEFAULT_CALENDAR_CONFIG = {
  breakStart: 12.5,
  breakEnd: 13.5,
  workDayStart: 9,
  workDayEnd: 18,
  timezone: 'Europe/Paris',
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

const getTimeZoneParts = (date, timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
};

const getTimeZoneOffsetMs = (date, timeZone) => {
  const parts = getTimeZoneParts(date, timeZone);
  const utcAsIfZoned = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0, 0);
  return utcAsIfZoned - date.getTime();
};

const parseDateOnlyToDateInTimeZone = (dateString, timeZone) => {
  const [y, m, d] = dateString.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date(dateString);
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const offsetMs = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offsetMs);
};

const getWeekdayInTimeZone = (date, timeZone) => {
  const parts = getTimeZoneParts(date, timeZone);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
};

const shiftDateByDaysInTimeZone = (date, days, timeZone) => {
  const parts = getTimeZoneParts(date, timeZone);
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second || 0, 0);
  const offsetMs = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  date.setTime(utcGuess - offsetMs);
};

const setDateToDecimalHour = (date, value, timeZone) => {
  const { hour, minute } = decimalHourToHM(value);
  const parts = getTimeZoneParts(date, timeZone);
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, 0, 0);
  const offsetMs = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  date.setTime(utcGuess - offsetMs);
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
    timezone: typeof prefs.timezone === 'string' && prefs.timezone ? prefs.timezone : DEFAULT_CALENDAR_CONFIG.timezone,
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

  // IMPORTANT: Check _preserveEventSegments FIRST before any other condition
  // This allows manually edited segments to be preserved even on creation
  if (nextItem?._preserveEventSegments) {
    return false;
  }

  if (!Array.isArray(nextItem._eventSegments) || nextItem._eventSegments.length === 0) return true;
  if (!prevItem) return true;

  if (hasDateOrDurationChange(prevItem, nextItem, collection, prevCollection)) return true;

  return false;
};

/**
 * Calcule les segments de temps pour un item sur une période de jours de travail
 */
export function calculateEventSegments(item, collection, calendarConfig = DEFAULT_CALENDAR_CONFIG) {
  if (!collection || !collection.properties) return item;

  const segments = [];
  const timeZone = calendarConfig.timezone || DEFAULT_CALENDAR_CONFIG.timezone;

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

      // Normalise les dates sans heure (YYYY-MM-DD) en minuit local du fuseau
      let startDate = item[prop.id];
      let startDateObj = null;
      if (typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        startDateObj = parseDateOnlyToDateInTimeZone(startDate, timeZone);
        startDate = startDateObj.toISOString();
      } else {
        startDateObj = new Date(startDate);
      }

      if (getWeekdayInTimeZone(startDateObj, timeZone) === 6) { // samedi
        shiftDateByDaysInTimeZone(startDateObj, 2, timeZone);
        setDateToDecimalHour(startDateObj, 0, timeZone);
        startDate = startDateObj.toISOString();
      } else if (getWeekdayInTimeZone(startDateObj, timeZone) === 0) { // dimanche
        shiftDateByDaysInTimeZone(startDateObj, 1, timeZone);
        setDateToDecimalHour(startDateObj, 0, timeZone);
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
          timeZone,
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
  const { startCal, endCal, breakStart, breakEnd, timeZone = DEFAULT_CALENDAR_CONFIG.timezone } = opts;
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
    while (getWeekdayInTimeZone(current, timeZone) === 0 || getWeekdayInTimeZone(current, timeZone) === 6) {
      shiftDateByDaysInTimeZone(current, 1, timeZone);
      setDateToDecimalHour(current, startCal, timeZone);
    }

    // Définit les bornes de la journée
    let dayStart = new Date(current);
    let dayEnd = new Date(current);
    setDateToDecimalHour(dayStart, startCal, timeZone);
    setDateToDecimalHour(dayEnd, endCal, timeZone);

    let segmentStart = new Date(Math.max(dayStart.getTime(), current.getTime()));

    let pauseStart = new Date(current);
    setDateToDecimalHour(pauseStart, breakStart, timeZone);
    let pauseEnd = new Date(current);
    setDateToDecimalHour(pauseEnd, breakEnd, timeZone);

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
    shiftDateByDaysInTimeZone(current, 1, timeZone);
    setDateToDecimalHour(current, startCal, timeZone);
  }

  return events;
}
