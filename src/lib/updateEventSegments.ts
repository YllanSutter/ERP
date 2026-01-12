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
  console.log('[updateEventSegments] propriétés de la collection:', collection.properties);
  console.log('[updateEventSegments] item reçu:', item);
  const segments: Array<{ start: Date; end: Date; label?: string }> = [];
  collection.properties.forEach((prop: any) => {
    if (prop.type === 'date' && item[prop.id]) {
      // Cherche la durée associée
      const durationKey = `${prop.id}_duration`;
      console.log('[updateEventSegments] durationKey:', durationKey);
      console.log('[updateEventSegments] clés de item:', Object.keys(item));
      let duration: number | undefined = undefined;
      if (Object.prototype.hasOwnProperty.call(item, durationKey)) {
        console.log('[updateEventSegments] valeur brute de', durationKey, ':', item[durationKey]);
        duration = Number(item[durationKey]);
      } else if (prop.defaultDuration !== undefined && prop.defaultDuration !== null && prop.defaultDuration !== '') {
        duration = Number(prop.defaultDuration);
      }
      // DEBUG : log de la durée et de l'objet transmis à splitEventByWorkdays
      console.log('[updateEventSegments] prop:', prop.id, 'date:', item[prop.id], 'duration:', duration);
      // Si la durée est absente, nulle ou non numérique, on ne génère pas de segment
      if (duration === undefined || isNaN(duration) || duration <= 0) {
        console.log('[updateEventSegments] PAS DE SEGMENT pour', prop.id, 'car durée absente ou invalide:', duration);
        return;
      }
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
    } else {
      if (prop.type === 'date') {
        console.log('[updateEventSegments] PAS DE SEGMENT pour', prop.id, 'car item[prop.id] absent:', item[prop.id]);
      }
    }
  });
  return { ...item, _eventSegments: segments };
}
