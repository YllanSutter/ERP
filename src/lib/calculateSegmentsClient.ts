/**
 * Calcule les segments côté client (pour prévisualisation dans le modal)
 * Identique à la logique serveur mais exécuté côté client
 */

const workDayStart = 9;
const workDayEnd = 17;
const breakStart = 12;
const breakEnd = 13;

interface EventSegment {
  start: string;
  end: string;
  label: string;
}

/**
 * Découpe un événement sur plusieurs jours ouvrés (version client)
 */
function splitEventByWorkdaysClient(item: any, opts: any) {
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
      current.setHours(startCal, 0, 0, 0);
    }

    // Définit les bornes de la journée
    let dayStart = new Date(current);
    let dayEnd = new Date(current);
    dayStart.setHours(startCal, 0, 0, 0);
    dayEnd.setHours(endCal, 0, 0, 0);

    let segmentStart = new Date(Math.max(dayStart.getTime(), current.getTime()));

    let pauseStart = new Date(current);
    pauseStart.setHours(breakStart, 0, 0, 0);
    let pauseEnd = new Date(current);
    pauseEnd.setHours(breakEnd, 0, 0, 0);

    // Matin (avant pause)
    if (segmentStart < pauseStart && segmentStart < dayEnd && remainingMs > 0) {
      let segmentEnd = new Date(Math.min(pauseStart.getTime(), segmentStart.getTime() + remainingMs));
      const segmentDuration = segmentEnd.getTime() - segmentStart.getTime();

      events.push({
        __eventStart: new Date(segmentStart),
        __eventEnd: new Date(segmentEnd),
      });

      remainingMs -= segmentDuration;
      current = new Date(pauseEnd);
    }
    // Après-midi (après pause)
    else if (current < dayEnd && remainingMs > 0) {
      let segmentStart = new Date(Math.max(pauseEnd.getTime(), current.getTime()));
      let segmentEnd = new Date(Math.min(dayEnd.getTime(), segmentStart.getTime() + remainingMs));
      const segmentDuration = segmentEnd.getTime() - segmentStart.getTime();

      if (segmentDuration > 0) {
        events.push({
          __eventStart: new Date(segmentStart),
          __eventEnd: new Date(segmentEnd),
        });
        remainingMs -= segmentDuration;
      }

      current = new Date(dayEnd);
      current.setDate(current.getDate() + 1);
      current.setHours(startCal, 0, 0, 0);
    } else {
      current.setDate(current.getDate() + 1);
      current.setHours(startCal, 0, 0, 0);
    }
  }

  return events;
}

/**
 * Calcule les segments côté client pour un item
 * IMPORTANT: C'est juste pour la prévisualisation dans le modal
 * Les vrais segments sont calculés côté serveur avant la sauvegarde
 */
export function calculateSegmentsClient(item: any, collection: any): EventSegment[] {
  if (!collection || !collection.properties) return [];

  const segments: EventSegment[] = [];

  collection.properties.forEach((prop: any) => {
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

      const segs = splitEventByWorkdaysClient(
        { startDate, durationHours: duration },
        { startCal: workDayStart, endCal: workDayEnd, breakStart, breakEnd }
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

  return segments;
}

/**
 * Formate un segment pour affichage
 */
export function formatSegmentDisplay(segment: EventSegment): string {
  const start = new Date(segment.start);
  const end = new Date(segment.end);
  
  const dateStr = start.toLocaleDateString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric' });
  const startTime = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  
  return `${dateStr} ${startTime}→${endTime}`;
}
