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
      const duration = durationProp && item[durationProp.id] ? Number(item[durationProp.id]) : 1;
      const itemForCalc = {
        startDate: item[prop.id],
        durationHours: duration,
      };
      const segs = splitEventByWorkdays(itemForCalc, {
        startCal: workDayStart,
        endCal: workDayEnd,
        breakStart,
        breakEnd,
      });
      segs.forEach(seg => {
        segments.push({
          start: seg.__eventStart,
          end: seg.__eventEnd,
          label: prop.name,
        });
      });
    }
  });
  return { ...item, _eventSegments: segments };
}
