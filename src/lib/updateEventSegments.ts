// Met à jour _eventSegments pour un item selon tous ses champs date/durée
import { splitEventByWorkdays, workDayStart, workDayEnd, breakStart, breakEnd } from '@/lib/calendarUtils';

/**
 * Met à jour _eventSegments dans l'objet item selon tous les champs date/durée trouvés dans la collection
 * @param item L'objet item à modifier
 * @param collection La collection à laquelle appartient l'item (pour les propriétés)
 * @returns L'item modifié (avec _eventSegments à jour)
 */
export function updateEventSegments(item: any, collection: any): any {
  if (!collection || !collection.properties) return item;
  const segments: Array<{ start: Date; end: Date; label?: string }> = [];
  collection.properties.forEach((prop: any) => {
    if (prop.type === 'date' && item[prop.id]) {
      // Cherche la durée associée
      const durationProp = collection.properties.find((p: any) => p.id === `${prop.id}_duration`);
      let duration: number | undefined = undefined;
      if (durationProp && item.hasOwnProperty(durationProp.id) && item[durationProp.id] !== undefined && item[durationProp.id] !== null && item[durationProp.id] !== '') {
        duration = Number(item[durationProp.id]);
      } else if (prop.defaultDuration !== undefined && prop.defaultDuration !== null && prop.defaultDuration !== '') {
        duration = Number(prop.defaultDuration);
      }
      // DEBUG : log de la durée et de l'objet transmis à splitEventByWorkdays
      console.log('[updateEventSegments] prop:', prop.id, 'date:', item[prop.id], 'duration:', duration);
      // Si la durée est absente, nulle ou non numérique, on ne génère pas de segment
      if (duration === undefined || isNaN(duration) || duration <= 0) return;
      const itemForCalc = {
        startDate: item[prop.id],
        durationHours: duration,
      };
      console.log('[updateEventSegments] itemForCalc:', itemForCalc);
      const segs = splitEventByWorkdays(itemForCalc, {
        startCal: workDayStart,
        endCal: workDayEnd,
        breakStart,
        breakEnd,
      });
      console.log('[updateEventSegments] segs:', segs);
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
