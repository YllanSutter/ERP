import { normalizeRelationIds } from '@/lib/utils/relationUtils';
import type { Collection, Item, Property } from '@/lib/types';
import { getSteamDisplayName } from './steamUtils';

export type SteamExchangeLabelSettings = {
  exchangeLabelPropertyId: string;
  exchangeGivenLabel: string;
  exchangeReceivedLabel: string;
};

export const STEAM_EXCHANGE_FIELD = '_steamExchangeReceivedIds';

export function steamGameTitle(collection: Collection, item: Item): string {
  const steamField = collection.properties.find((property) => property.type === 'steam');
  const nameField = collection.properties.find((property) => property.name === 'Nom');
  const names = [item.name, nameField && item[nameField.id], steamField && item[steamField.id]];
  const placeholders = ['[object Object]', 'Nouvel élément', `Nouveau ${collection.name}`];
  return names.map((value) => getSteamDisplayName(value).trim())
    .find((name) => name && !placeholders.includes(name)) || '';
}

export function steamGameName(collection: Collection, item: Item): string {
  return steamGameTitle(collection, item) || 'Jeu sans titre';
}

export function createSteamExchangeDraft(
  collection: Collection,
  source: Item,
  game: unknown,
  bundleField: string,
  canEditField: (id: string) => boolean,
): Item | undefined {
  const steamField = collection.properties.find((property) => property.type === 'steam' && canEditField(property.id));
  if (!steamField) return;
  const draft = { id: crypto.randomUUID(), [steamField.id]: game, _steamExchangeDraft: true };
  if (bundleField && canEditField(bundleField)) {
    const bundleValue = steamExchanges(collection).root(source)[bundleField];
    if (bundleValue != null) draft[bundleField] = bundleValue;
  }
  const nameField = collection.properties.find((property) => property.type === 'text' && (property.id === 'name' || property.name === 'Nom'));
  if (nameField && canEditField(nameField.id)) draft[nameField.id] = getSteamDisplayName(game).trim();
  return draft;
}

const exchangeCache = new WeakMap<Item[], {
  parents: Map<string, Item>;
  children: Map<string, Item[]>;
  root: (item: Item) => Item;
}>();
const noGames: Item[] = [];

export function steamExchanges(collection?: Collection) {
  const items = collection?.plugins?.steam?.role === 'games' ? collection.items : noGames;
  const cached = exchangeCache.get(items);
  if (cached) return cached;
  const parents = new Map<string, Item>();
  const children = new Map<string, Item[]>();
  const byId = new Map(items.map((item) => [item.id, item]));

  function root(item: Item): Item {
    let current = item;
    while (parents.has(current.id)) current = parents.get(current.id)!;
    return current;
  }

  for (const item of items) {
    const ids = item[STEAM_EXCHANGE_FIELD];
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      const received = byId.get(id);
      if (!received || parents.has(id) || root(item).id === id) continue;
      parents.set(id, item);
      const siblings = children.get(item.id) || [];
      siblings.push(received);
      children.set(item.id, siblings);
    }
  }
  const graph = { parents, children, root };
  exchangeCache.set(items, graph);
  return graph;
}

export function orderSteamExchanges(items: Item[], collection: Collection): Item[] {
  const { parents, children } = steamExchanges(collection);
  if (!parents.size) return items;
  const visible = new Map(items.map((item) => [item.id, item]));
  const ordered: Item[] = [];
  for (const item of items) {
    const parent = parents.get(item.id);
    if (parent && visible.has(parent.id)) continue;
    const pending = [item];
    while (pending.length) {
      const next = pending.pop()!;
      ordered.push(next);
      const received = children.get(next.id) || [];
      for (let index = received.length - 1; index >= 0; index--) {
        const row = visible.get(received[index].id);
        if (row) pending.push(row);
      }
    }
  }
  return ordered;
}

export function steamPaidPropertyId(collection: Collection): string | undefined {
  const numeric = collection.properties.filter((property) => property.type === 'number');
  const configured = collection.plugins?.steam?.exchangePaidPropertyId;
  return numeric.find((property) => property.id === configured)?.id
    ?? numeric.find((property) => property.name.trim().toLowerCase() === 'prix payé')?.id;
}

export function steamTotalItems(collection: Collection, items: Item[], fieldId: string, totalType: string): Item[] {
  if (collection.plugins?.steam?.role !== 'games') return items;
  const { parents, children } = steamExchanges(collection);
  if (!parents.size) return items;
  const type = totalType.startsWith('number-filter:') ? totalType.split(':')[1] : totalType;
  const paidField = steamPaidPropertyId(collection);
  const isPaid = type !== 'count' && paidField && (
    fieldId === paidField || totalType === `linked-progress:${paidField}`
  );
  return items.filter((item) => !(isPaid ? parents : children).has(item.id));
}

export function canReceiveSteamGame(source: Item, candidate: Item, graph: ReturnType<typeof steamExchanges>) {
  if (source.id === candidate.id) return false;
  const parent = graph.parents.get(candidate.id);
  if (parent) return parent.id === source.id;
  return graph.root(source).id !== candidate.id;
}

export function isSteamExchangeLabelProperty(property: Property): boolean {
  return ['select', 'multiselect', 'multi_select'].includes(property.type);
}

export function steamExchangeLabelOptions(property?: Property): { value: string; label: string }[] {
  if (!property || !isSteamExchangeLabelProperty(property)) return [];
  return (property.options || []).flatMap((option: string | { value?: string; label?: string }) => {
    const value = typeof option === 'string' ? option : option?.value;
    return value ? [{ value, label: typeof option === 'string' ? option : option.label || value }] : [];
  });
}

export function steamExchangeLabelValue(
  collection: Collection | undefined,
  property: Property,
  value: unknown,
  exchanged: boolean,
  received: boolean,
): string | string[] | undefined {
  const settings = collection?.plugins?.steam;
  if (settings?.role !== 'games' || settings.exchangeLabelPropertyId !== property.id || (!exchanged && !received)) return;
  const options = steamExchangeLabelOptions(property);
  const labels = [
    exchanged ? settings.exchangeGivenLabel : '',
    received ? settings.exchangeReceivedLabel : '',
  ].filter((label) => options.some((option) => option.value === label));
  if (!labels.length) return;
  if (property.type === 'select') return labels[0];
  return [...new Set([...labels, ...normalizeRelationIds(value)])];
}
