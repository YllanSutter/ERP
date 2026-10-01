import { z } from 'zod';

export const authPayloadSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  name: z.string().trim().min(1).optional(),
}).strict();

export const statePayloadSchema = z.object({
  stateVersion: z.number().int().positive(),
  collections: z.array(z.unknown()).optional(),
  views: z.record(z.string(), z.unknown()).optional(),
  dashboards: z.array(z.unknown()).optional(),
  dashboardSort: z.string().optional(),
  dashboardFilters: z.record(z.string(), z.unknown()).optional(),
  favorites: z.object({
    views: z.array(z.string()).optional(),
    items: z.array(z.string()).optional(),
  }).optional(),
}).passthrough();
