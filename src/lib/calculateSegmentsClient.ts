/**
 * Calcule les segments côté client (pour prévisualisation dans le modal)
 * Identique à la logique serveur mais exécuté côté client
 */

import { splitEventByWorkdays, workDayStart, workDayEnd, breakStart, breakEnd } from '@/lib/calendarUtils';

interface EventSegment {
  start: string;
  end: string;
  label: string;
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

      const segs = splitEventByWorkdays(
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
