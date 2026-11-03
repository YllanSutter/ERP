import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchSteamImage, trustedSteamImage } from './images.js';

const dragonwilds =
  'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1374490/3e27915a647dbf05e17f2ff98d33c9a0765da539/header.jpg?t=1793372596';
test('Dragonwilds uses the current hashed image URL instead of guessing a legacy path', async () => {
  const result = await fetchSteamImage(1374490, async (url) => {
    if (url.includes('IStoreBrowseService')) return { ok: false };
    assert.ok(url.includes('appids=1374490'));
    return {
      ok: true,
      json: async () => ({ 1374490: { success: true, data: { header_image: dragonwilds } } }),
    };
  });
  assert.equal(result.header, dragonwilds);
});
test('store page metadata provides a fallback if appdetails is unavailable', async () => {
  let calls = 0;
  const result = await fetchSteamImage(1374490, async (url) => {
    if (url.includes('IStoreBrowseService')) return { ok: false };
    return ++calls === 1
      ? { ok: false }
      : {
          ok: true,
          text: async () =>
            `<meta content="${dragonwilds.replace('&', '&amp;')}" property="og:image">`,
        };
  });
  assert.equal(result.header, dragonwilds);
});
test('image metadata accepts only Steam HTTPS assets and valid IDs', async () => {
  assert.equal(trustedSteamImage('https://attacker.example/header.jpg'), null);
  assert.equal(trustedSteamImage('http://shared.fastly.steamstatic.com/image.jpg'), null);
  await assert.rejects(fetchSteamImage('../other'), /invalide/);
});

test('all games resolve portrait and header from their own Steam asset metadata', async () => {
  for (const id of [1374490, 10]) {
    const result = await fetchSteamImage(id, async () => ({
      ok: true,
      json: async () => ({
        response: {
          store_items: [
            {
              appid: id,
              assets: {
                asset_url_format: `steam/apps/${id}/\${FILENAME}?t=123`,
                library_capsule: 'portrait-hash/library_capsule.jpg',
                header: 'header-hash/header.jpg',
              },
            },
          ],
        },
      }),
    }));
    assert.equal(
      result.portrait,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/portrait-hash/library_capsule.jpg?t=123`,
    );
    assert.equal(
      result.header,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header-hash/header.jpg?t=123`,
    );
  }
});
