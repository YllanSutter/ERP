import { describe, expect, it } from 'vitest';
import type { Collection, Item, Property } from '@/lib/types';
import { buildGroupStructure } from '@/lib/groupingUtils';
import { canReceiveSteamGame, orderSteamExchanges, steamExchangeLabelValue, steamExchanges, steamTotalItems } from './exchanges';

function games(items: Item[]): Collection {
  return {
    id: 'games',
    name: 'Jeux',
    items,
    properties: [
      { id: 'bundle', name: 'Bundle', type: 'relation' },
      { id: 'paid', name: 'Prix payé', type: 'number' },
    ],
    plugins: { steam: { role: 'games', exchangePaidPropertyId: 'paid' } },
  };
}

describe('Steam exchanges', () => {
  it('counts the original purchase and only the currently held games', () => {
    const original = { id: 'original', paid: 12, value: 20, _steamExchangeReceivedIds: ['received', 'second'] };
    const received = { id: 'received', paid: 4, value: 8, _steamExchangeReceivedIds: ['replacement'] };
    const second = { id: 'second', value: 10 };
    const replacement = { id: 'replacement', paid: 6, value: 9 };
    const collection = games([replacement, received, second, original]);
    const ids = (field: string, type: string) => steamTotalItems(collection, collection.items, field, type).map((item) => item.id);

    expect(ids('paid', 'sum')).toEqual(['original']);
    expect(ids('value', 'sum')).toEqual(['replacement', 'second']);
    expect(ids('paid', 'count')).toEqual(['replacement', 'second']);
    expect(orderSteamExchanges(collection.items, collection).map((item) => item.id)).toEqual(['original', 'received', 'replacement', 'second']);
    expect(canReceiveSteamGame(replacement, original, steamExchanges(collection))).toBe(false);

    const cancelled = games(collection.items.map((item) => item.id === original.id ? { ...item, _steamExchangeReceivedIds: [] } : item));
    expect(steamTotalItems(cancelled, cancelled.items, 'paid', 'sum').map((item) => item.id)).toEqual(['received', 'second', 'original']);
  });

  it('puts received games in the original bundle group while retaining their own data', () => {
    const collection = games([
      { id: 'received', bundle: 'other' },
      { id: 'original', bundle: 'bundle', _steamExchangeReceivedIds: ['received'] },
    ]);
    const grouped = buildGroupStructure(collection.items, ['bundle'], collection.properties, [collection]);
    expect(grouped?.rootGroups).toEqual(['bundle']);
    expect(grouped?.structure.bundle.itemIds).toEqual(['received', 'original']);
    expect(collection.items[0].bundle).toBe('other');
  });
});

it('uses configured labels in the chosen column and preserves manual labels', () => {
  const collection = games([]);
  Object.assign(collection.plugins.steam, {
    exchangeLabelPropertyId: 'labels',
    exchangeGivenLabel: 'given',
    exchangeReceivedLabel: 'received',
  });
  const labels: Property = { id: 'labels', name: 'Labels', type: 'multiselect', options: ['given', 'received', 'manual'] };
  expect(steamExchangeLabelValue(collection, labels, ['manual'], true, false)).toEqual(['given', 'manual']);
  expect(steamExchangeLabelValue(collection, labels, ['manual'], true, true)).toEqual(['given', 'received', 'manual']);
  expect(steamExchangeLabelValue(collection, { ...labels, type: 'select' }, 'manual', false, true)).toBe('received');
  expect(steamExchangeLabelValue(collection, labels, ['manual'], false, false)).toBeUndefined();
  expect(steamExchangeLabelValue(collection, { ...labels, id: 'other' }, [], true, false)).toBeUndefined();
  expect(steamExchangeLabelValue(collection, { ...labels, options: ['manual'] }, [], true, false)).toBeUndefined();
});
