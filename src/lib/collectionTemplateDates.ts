export type CollectionTemplateDateParts = {
  day?: 'none' | 'today' | 'fixed';
  fixedDate?: string;
  time?: string;
  duration?: number | null;
};

/** Applies only the date parts explicitly selected in a collection template. */
export function applyCollectionTemplateDateParts(
  item: Record<string, any>,
  propertyId: string,
  parts: CollectionTemplateDateParts,
  now = new Date(),
) {
  const next = { ...item };
  const durationKey = `${propertyId}_duration`;
  const hasDay = parts.day === 'today' || (parts.day === 'fixed' && Boolean(parts.fixedDate));
  const hasTime = typeof parts.time === 'string' && /^\d{2}:\d{2}$/.test(parts.time);

  if (hasDay || hasTime) {
    const current = next[propertyId] ? new Date(next[propertyId]) : null;
    const base = current && !Number.isNaN(current.getTime()) ? current : new Date(now);

    if (parts.day === 'fixed' && parts.fixedDate) {
      const [year, month, day] = parts.fixedDate.split('-').map(Number);
      base.setFullYear(year, month - 1, day);
    } else if (parts.day === 'today') {
      base.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    }

    if (hasTime) {
      const [hours, minutes] = parts.time!.split(':').map(Number);
      base.setHours(hours, minutes, 0, 0);
    } else if (!current) {
      base.setHours(9, 0, 0, 0);
    }
    next[propertyId] = base.toISOString();
  }

  if (parts.duration !== undefined && parts.duration !== null && Number.isFinite(Number(parts.duration))) {
    next[durationKey] = Number(parts.duration);
  }

  return next;
}

export function toLocalDateInputValue(value: any) {
  if (!value || value === 'current_date') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toTimeInputValue(value: any) {
  if (!value || value === 'current_date') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
