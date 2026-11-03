import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fetchSteamCatalogue, writeSteamCatalogue } from './catalogue.js';

test('catalogue refresh paginates, cleans and deduplicates Steam games', async () => {
  const cursors = [];
  const games = await fetchSteamCatalogue('test-key', async (url) => {
    const input = JSON.parse(url.searchParams.get('input_json'));
    cursors.push(input.last_appid || 0);
    return {
      ok: true,
      json: async () => ({
        response: input.last_appid
          ? {
              apps: [
                { appid: 20, name: ' Second ' },
                { appid: 10, name: 'First' },
              ],
              have_more_results: false,
            }
          : {
              apps: [
                { appid: 10, name: ' First ' },
                { appid: 0, name: 'invalid' },
              ],
              have_more_results: true,
              last_appid: 10,
            },
      }),
    };
  });
  assert.deepEqual(cursors, [0, 10]);
  assert.deepEqual(games, [
    { appid: 10, name: 'First' },
    { appid: 20, name: 'Second' },
  ]);
});
test('a failed or malformed refresh does not produce a replacement catalogue', async () => {
  await assert.rejects(
    fetchSteamCatalogue('', async () => {}),
    /STEAM_API_KEY/,
  );
  await assert.rejects(
    fetchSteamCatalogue('secret', async () => {
      throw new Error('URL contains secret');
    }),
    (error) => !error.message.includes('secret'),
  );
  await assert.rejects(
    fetchSteamCatalogue('test', async () => ({
      ok: true,
      json: async () => ({ response: { apps: [], have_more_results: false } }),
    })),
    /Aucun jeu/,
  );
  await assert.rejects(
    fetchSteamCatalogue('test', async () => ({
      ok: true,
      json: async () => ({
        response: { apps: [{ appid: 10, name: 'Game' }], have_more_results: true, last_appid: 0 },
      }),
    })),
    /Pagination/,
  );
});
test('catalogue replacement writes the runtime file atomically', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'steam-catalogue-'));
  try {
    const file = path.join(directory, 'games.json');
    await writeSteamCatalogue([{ appid: 10, name: 'Game' }], file);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).applist.apps[0].appid, 10);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
