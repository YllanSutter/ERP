export type ItemChange = {
  collectionId: string;
  added: Record<string, any>[];
  updated: { itemId: string; fields: Record<string, any>; unset: string[]; previous?: Record<string, unknown> }[];
  deleted: string[];
  order?: string[];
};
export function buildItemChanges(previous: any[], next: any[], includePrevious?: boolean): ItemChange[];
export function applyItemChanges<T extends { id: string; items?: any[] }>(collections: T[], changes: ItemChange[]): T[];
