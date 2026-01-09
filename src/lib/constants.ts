export const API_URL = import.meta.env.VITE_API_URL || '/api';

export const PROPERTY_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  SELECT: 'select',
  MULTI_SELECT: 'multi_select',
  DATE: 'date',
  DATE_RANGE: 'date_range',
  CHECKBOX: 'checkbox',
  URL: 'url',
  EMAIL: 'email',
  PHONE: 'phone',
  RELATION: 'relation'
} as const;

export const defaultCollections: any[] = [];

export const defaultViews: Record<string, any[]> = {};
