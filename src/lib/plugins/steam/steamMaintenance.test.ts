import { afterEach, expect, it, vi } from 'vitest';
import { getSteamAppId, invalidateSteamGamesList, loadSteamGamesList } from './steamUtils';
import { refreshSteamImages, resolveSteamHeader, steamImagesRevision } from './steamImages';

afterEach(() => {
  vi.unstubAllGlobals();
  invalidateSteamGamesList();
});
it('uses the refreshed runtime catalogue instead of the bundled list', async () => {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => [{ appid: 1374490, name: 'RuneScape: Dragonwilds' }],
  }));
  vi.stubGlobal('fetch', fetchMock);
  invalidateSteamGamesList();
  expect(await loadSteamGamesList()).toEqual([{ appid: 1374490, name: 'RuneScape: Dragonwilds' }]);
  expect(fetchMock.mock.calls).toHaveLength(1);
  await loadSteamGamesList();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  invalidateSteamGamesList();
  await loadSteamGamesList();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('resolves and refreshes current Steam image URLs even if local storage is unavailable', async () => {
  vi.stubGlobal('window', {
    localStorage: {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    },
    dispatchEvent: vi.fn(),
  });
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith('/images/refresh')
        ? { updatedAt: 123456 }
        : {
            header:
              'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1374490/hash/header.jpg',
          },
  }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await resolveSteamHeader(1374490)).toContain('/hash/header.jpg');
  await refreshSteamImages();
  expect(steamImagesRevision()).toBe('123456');
  expect(await resolveSteamHeader(1374490)).toContain('erp_refresh=123456');
});
it('recognizes Steam IDs stored as objects, appId aliases, numbers and serialized objects', () => {
  for (const raw of [
    { appid: 1374490 },
    { appId: 1374490 },
    1374490,
    '1374490',
    '{"appid":1374490}',
  ])
    expect(getSteamAppId(raw)).toBe(1374490);
  expect(getSteamAppId('RuneScape')).toBeNull();
});
