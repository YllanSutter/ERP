import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSteamExchanges } from './exchanges.js';

const games = (items) => ({ plugins: { steam: { role: 'games' } }, items });
const game = (id, ...received) => ({ id, _steamExchangeReceivedIds: received });

test('exchange writes preserve a single origin and reject cycles', () => {
  const previous = games([game('a', 'b'), game('b'), game('c')]);
  assert.equal(validateSteamExchanges(games([game('a', 'b'), game('b', 'c'), game('c')]), previous), null);
  assert.match(validateSteamExchanges(games([game('a', 'b'), game('b'), game('c', 'b')]), previous), /un seul échange/);
  assert.match(validateSteamExchanges(games([game('a', 'b'), game('b', 'a'), game('c')]), previous), /boucle/);
  assert.match(validateSteamExchanges(games([game('a', 'missing'), game('b'), game('c')]), previous), /indisponible/);
  assert.equal(validateSteamExchanges(games([game('a', 'b'), game('c')]), previous), null);
});
