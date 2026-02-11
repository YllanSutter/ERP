/**
 * Gestion centralisée des segments de temps
 * 
 * IMPORTANT: Tous les segments sont maintenant gérés en BDD via POST /api/state
 * Le serveur recalcule AUTOMATIQUEMENT les _eventSegments en fonction des champs date/durée
 * 
 * Cette classe fournit des fonctions utilitaires pour manipuler les segments côté client
 * avant de sauvegarder via saveState()
 */

import { calculateSegmentsClient } from '@/lib/calculateSegmentsClient';

export interface EventSegment {
  start: string; // ISO date
  end: string;   // ISO date
  label?: string;
}

/**
 * Ajoute un nouveau segment manuel à un item
 * Le segment sera sauvegardé lors du prochain saveState()
 */
export function addManualSegmentToItem(
  item: any,
  segment: EventSegment
): any {
  const segments = Array.isArray(item._eventSegments) ? [...item._eventSegments] : [];
  segments.push(segment);
  return { ...item, _eventSegments: segments, _preserveEventSegments: true };
}

/**
 * Modifie un segment existant (drag, resize, etc.)
 * Le segment sera sauvegardé lors du prochain saveState()
 */
export function updateSegmentInItem(
  item: any,
  segmentIndex: number,
  updates: Partial<EventSegment>
): any {
  if (!Array.isArray(item._eventSegments) || segmentIndex < 0 || segmentIndex >= item._eventSegments.length) {
    return item;
  }
  
  const segments = [...item._eventSegments];
  segments[segmentIndex] = { ...segments[segmentIndex], ...updates };
  return { ...item, _eventSegments: segments, _preserveEventSegments: true };
}

/**
 * Supprime un segment d'un item
 * Le changement sera sauvegardé lors du prochain saveState()
 */
export function removeSegmentFromItem(
  item: any,
  segmentIndex: number
): any {
  if (!Array.isArray(item._eventSegments) || segmentIndex < 0 || segmentIndex >= item._eventSegments.length) {
    return item;
  }
  
  const segments = item._eventSegments.filter((_: any, idx: number) => idx !== segmentIndex);
  return { ...item, _eventSegments: segments, _preserveEventSegments: true };
}

/**
 * Déplace tous les segments d'un item (drag & drop de l'item entier)
 * Décale la date de départ du champ date principal
 */
export function moveAllSegmentsOfItem(
  item: any,
  dateFieldId: string,
  newDate: Date,
  newHours: number = 9,
  newMinutes: number = 0,
  collection?: any
): any {
  // La vraie logique est : on change le champ date principal de l'item
  // et on laisse le serveur recalculer les segments via updateEventSegments
  const newDateObj = new Date(newDate);
  newDateObj.setHours(newHours, newMinutes, 0, 0);

  const updatedItem = { ...item, [dateFieldId]: newDateObj.toISOString(), _preserveEventSegments: false };

  // Recalcule localement les segments pour refléter pauses/weekend/heures
  if (collection) {
    const recalculatedSegments = calculateSegmentsClient(updatedItem, collection);
    return { ...updatedItem, _eventSegments: recalculatedSegments, _preserveEventSegments: false };
  }

  return updatedItem;
}

/**
 * Déplace un segment et tous les suivants en appliquant le même décalage
 * Les durées individuelles sont conservées.
 */
export function moveSegmentAndFollowing(
  item: any,
  segmentIndex: number,
  newDate: Date,
  newHours: number = 9,
  newMinutes: number = 0,
  options?: { label?: string }
): any {
  if (!Array.isArray(item._eventSegments) || segmentIndex < 0 || segmentIndex >= item._eventSegments.length) {
    return item;
  }

  const segments = [...item._eventSegments];
  const labelToMatch = options?.label;
  const filteredIndices = segments
    .map((seg: any, idx: number) => ({ seg, idx }))
    .filter(({ seg }) => (labelToMatch ? seg?.label === labelToMatch : true))
    .map(({ idx }) => idx);
  const filteredStartPos = filteredIndices.indexOf(segmentIndex);
  if (filteredStartPos === -1) {
    return item;
  }
  const target = segments[segmentIndex];
  const oldStart = new Date(target.start || target.__eventStart);
  const newStart = new Date(newDate);
  newStart.setHours(newHours ?? 9, newMinutes ?? 0, 0, 0);
  const deltaMs = newStart.getTime() - oldStart.getTime();

  if (!Number.isFinite(deltaMs) || deltaMs === 0) {
    return item;
  }

  const nextSegments = segments.map((seg: any, idx: number) => {
    const shouldMove = filteredIndices.includes(idx) && filteredIndices.indexOf(idx) >= filteredStartPos;
    if (!shouldMove) return seg;
    const segStart = new Date(seg.start || seg.__eventStart);
    const segEnd = new Date(seg.end || seg.__eventEnd || seg.start || seg.__eventStart);
    const duration = segEnd.getTime() - segStart.getTime();
    const shiftedStart = new Date(segStart.getTime() + deltaMs);
    const shiftedEnd = new Date(shiftedStart.getTime() + duration);
    return {
      ...seg,
      start: shiftedStart.toISOString(),
      end: shiftedEnd.toISOString(),
    };
  });

  return { ...item, _eventSegments: nextSegments, _preserveEventSegments: true };
}

/**
 * Récalcule un segment d'un item
 * Si le segment a été modifié manuellement, le serveur l'écrasera lors de la sauvegarde
 * si on modifie aussi un champ date/durée
 */
export function getSegmentLabel(segment: EventSegment): string {
  return segment.label || 'Sans label';
}

/**
 * Utilitaire pour formater un segment en affichage
 */
export function formatSegment(segment: EventSegment): string {
  const start = new Date(segment.start);
  const end = new Date(segment.end);
  const startStr = start.toLocaleString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const endStr = end.toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${startStr} → ${endStr}`;
}

