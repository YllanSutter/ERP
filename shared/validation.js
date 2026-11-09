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

const identifier = z.string().min(1).max(200);
const safeKey = z.string().refine((key) => !['__proto__', 'prototype', 'constructor'].includes(key));
export const itemChangesPayloadSchema = z.object({
  stateVersion: z.number().int().positive(),
  mutationId: z.string().uuid(),
  itemChanges: z.array(z.object({
    collectionId: identifier,
    added: z.array(z.record(safeKey, z.unknown()).and(z.object({ id: identifier }))),
    updated: z.array(z.object({ itemId: identifier, fields: z.record(safeKey, z.unknown()), unset: z.array(safeKey), previous: z.record(safeKey, z.unknown()).optional() }).strict()),
    deleted: z.array(identifier),
    order: z.array(identifier).optional(),
  }).strict()).min(1),
}).strict();
