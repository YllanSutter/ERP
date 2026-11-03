export function trustedSteamImage(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      (url.hostname.endsWith('.steamstatic.com') || url.hostname === 'steamcdn-a.akamaihd.net')
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function steamAssetUrl(assets, filename) {
  if (typeof assets?.asset_url_format !== 'string' || typeof filename !== 'string' || !filename)
    return null;
  const formatted = assets.asset_url_format.replace('${FILENAME}', filename);
  return trustedSteamImage(
    new URL(formatted, 'https://shared.akamai.steamstatic.com/store_item_assets/').href,
  );
}

export async function fetchSteamImage(appid, fetchImpl = fetch) {
  const id = Number(appid);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Steam App ID invalide.');
  // Steam supplies a different hashed asset path for each image format and each game.
  try {
    const url = new URL('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/');
    url.searchParams.set(
      'input_json',
      JSON.stringify({
        ids: [{ appid: id }],
        context: { language: 'english', country_code: 'FR' },
        data_request: { include_assets: true },
      }),
    );
    const response = await fetchImpl(url.href, { signal: AbortSignal.timeout(10000) });
    if (response.ok) {
      const body = await response.json();
      const assets = body?.response?.store_items?.find(
        (item) => item.appid === id || item.id === id,
      )?.assets;
      const portrait = steamAssetUrl(assets, assets?.library_capsule_2x || assets?.library_capsule);
      const header = steamAssetUrl(assets, assets?.header_2x || assets?.header);
      if (portrait || header) return { portrait, header };
    }
  } catch {
    /* Older or unavailable browse metadata can still supply a store header below. */
  }
  try {
    const response = await fetchImpl(
      `https://store.steampowered.com/api/appdetails?appids=${id}&l=french&cc=fr`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (response.ok) {
      const body = await response.json();
      const header = body?.[id]?.success && trustedSteamImage(body[id].data?.header_image);
      if (header) return { header };
    }
  } catch {
    /* Try the public store page if Steam's detail endpoint fails. */
  }
  const response = await fetchImpl(`https://store.steampowered.com/app/${id}/`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Images Steam indisponibles.');
  const html = await response.text();
  for (const tag of html.match(/<meta\s[^>]*>/gi) || []) {
    if (!/property\s*=\s*["']og:image["']/i.test(tag)) continue;
    const url = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1]?.replace(/&amp;/g, '&');
    const header = trustedSteamImage(url);
    if (header) return { header };
  }
  throw new Error('Aucune image Steam disponible.');
}
export function registerSteamImageRoutes({ app, appContext: { requireAuth } }) {
  const cache = new Map();
  const pending = new Map();
  let revision = 0;
  app.get('/api/plugins/steam/images/:appid', requireAuth, async (req, res) => {
    const id = Number(req.params.appid);
    if (!Number.isSafeInteger(id) || id <= 0)
      return res.status(400).json({ error: 'Steam App ID invalide.' });
    const cached = cache.get(id);
    if (cached && cached.expires > Date.now()) return res.json(cached.data);
    try {
      if (!pending.has(id)) {
        const generation = revision;
        pending.set(
          id,
          fetchSteamImage(id)
            .then((data) => {
              if (revision === generation) {
                if (cache.size >= 1000) cache.delete(cache.keys().next().value);
                cache.set(id, { data, expires: Date.now() + 6 * 3600000 });
              }
              return data;
            })
            .finally(() => {
              if (revision === generation) pending.delete(id);
            }),
        );
      }
      res.set('Cache-Control', 'no-store');
      res.json(await pending.get(id));
    } catch {
      res.status(502).json({ error: 'Images Steam temporairement indisponibles.' });
    }
  });
  app.post('/api/plugins/steam/images/refresh', requireAuth, (req, res) => {
    if (!req.auth.roles?.some((role) => role.name === 'admin'))
      return res.status(403).json({ error: 'Accès administrateur requis.' });
    revision += 1;
    cache.clear();
    pending.clear();
    res.json({ updatedAt: Date.now() });
  });
}
