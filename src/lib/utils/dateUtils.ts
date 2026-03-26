export const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export function getRoundedNow(roundToMinutes: number = 15): Date {
  const now = new Date();
  const minutes = now.getMinutes();
  const rounded = Math.round(minutes / roundToMinutes) * roundToMinutes;
  now.setMinutes(rounded);
  now.setSeconds(0);
  now.setMilliseconds(0);
  return now;
}
