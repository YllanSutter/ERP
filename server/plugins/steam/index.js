import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const STEAM_LIST_PATH = path.join(PROJECT_ROOT, 'public/steamList.json');

export const steamServerPlugin = {
  id: 'steam',
  register: ({ app, deps }) => {
    const { requireAuth, hasPermission, pool, syncAppStateIdSequence } = deps;

    app.get('/api/plugins/steam/games', requireAuth, async (_req, res) => {
      try {
        const readLocalList = () => {
          try {
            if (!fs.existsSync(STEAM_LIST_PATH)) return [];
            const raw = fs.readFileSync(STEAM_LIST_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((g) => g && typeof g.appid === 'number' && typeof g.name === 'string' && g.name.trim());
          } catch {
            return [];
          }
        };

        const localList = readLocalList();
        if (localList.length > 0) {
          return res.json(localList);
        }

        // Fallback: fetch from Steam and cache locally
        const steamRes = await fetch('https://api.steampowered.com/ISteamApps/GetAppList/v2/');
        if (!steamRes.ok) {
          return res.status(502).json({ error: 'Steam API unavailable' });
        }

        const steamData = await steamRes.json();
        const apps = Array.isArray(steamData?.applist?.apps) ? steamData.applist.apps : [];
        const normalized = apps
          .filter((g) => g && typeof g.appid === 'number' && typeof g.name === 'string' && g.name.trim())
          .map((g) => ({ appid: g.appid, name: g.name.trim() }));

        try {
          fs.writeFileSync(STEAM_LIST_PATH, JSON.stringify(normalized));
        } catch (writeErr) {
          console.warn('[Steam] Failed to cache steamList.json:', writeErr);
        }

        return res.json(normalized);
      } catch (error) {
        console.error('[Steam] Games endpoint error:', error);
        return res.status(500).json({ error: 'Failed to load Steam games list' });
      }
    });

    app.post('/api/plugins/steam/import-prices', requireAuth, async (req, res) => {
      try {
        const { itemIds, organizationId, config = {} } = req.body;
        if (!itemIds || !Array.isArray(itemIds)) {
          return res.status(400).json({ error: 'itemIds must be an array' });
        }

        const activeOrganizationId = req.auth.activeOrganization?.id;
        if (!activeOrganizationId) {
          return res.status(400).json({ error: 'No active organization' });
        }
        if (organizationId && organizationId !== activeOrganizationId) {
          return res.status(403).json({ error: 'Organization mismatch' });
        }

        const sanitizedItemIds = Array.from(
          new Set(itemIds.map((id) => String(id || '').trim()).filter(Boolean))
        );
        if (sanitizedItemIds.length === 0) {
          return res.status(400).json({ error: 'No valid item ids provided' });
        }

        const ITAD_API_KEY = process.env.ITAD_API_KEY;
        if (!ITAD_API_KEY) {
          return res.status(500).json({ error: 'ITAD_API_KEY not configured' });
        }

        const country = config.itadCountry || 'FR';
        const shops = Array.isArray(config.itadShops) ? config.itadShops : [61];
        const capacity = config.itadCapacity || 3;

        console.log(`[ITAD Plugin] Starting price import for ${sanitizedItemIds.length} items`);

        const updates = [];
        const errors = [];

        // Step 1: Load organization state
        const stateResult = await pool.query(
          'SELECT data FROM app_state WHERE organization_id = $1 LIMIT 1',
          [activeOrganizationId]
        );
        if (stateResult.rows.length === 0) {
          return res.status(404).json({ error: 'State not found for organization' });
        }

        let state;
        try {
          state = typeof stateResult.rows[0].data === 'string'
            ? JSON.parse(stateResult.rows[0].data)
            : stateResult.rows[0].data;
        } catch (e) {
          console.error('[ITAD Plugin] Failed to parse app state:', e);
          return res.status(500).json({ error: 'Failed to parse organization state' });
        }

        const collections = Array.isArray(state?.collections) ? state.collections : [];
        const itemRefs = new Map();

        for (const collection of collections) {
          const items = Array.isArray(collection?.items) ? collection.items : [];
          for (const item of items) {
            if (!item || !item.id) continue;
            if (!sanitizedItemIds.includes(item.id)) continue;
            itemRefs.set(item.id, { collection, item });
          }
        }

        const steamNameToAppIds = new Map();
        try {
          if (fs.existsSync(STEAM_LIST_PATH)) {
            const raw = fs.readFileSync(STEAM_LIST_PATH, 'utf8');
            const parsed = JSON.parse(raw);
            const list = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.applist?.apps)
                ? parsed.applist.apps
                : [];
            for (const game of list) {
              const name = String(game?.name || '').trim().toLowerCase();
              const appid = Number(game?.appid);
              if (name && Number.isFinite(appid)) {
                if (!steamNameToAppIds.has(name)) {
                  steamNameToAppIds.set(name, new Set());
                }
                steamNameToAppIds.get(name).add(appid);
              }
            }
          }
        } catch (e) {
          console.warn('[ITAD Plugin] Failed to load local steamList.json:', e);
        }

        const getUniqueSteamAppIdByName = (name) => {
          const key = String(name || '').trim().toLowerCase();
          if (!key) return undefined;
          const ids = steamNameToAppIds.get(key);
          if (!ids || ids.size !== 1) return undefined;
          return Array.from(ids)[0];
        };

        const getAmount = (obj) => {
          if (!obj) return undefined;
          const value = obj.value ?? obj.amount ?? obj.price_new ?? obj.price;
          if (value === null || value === undefined || value === '') return undefined;
          const num = Number(value);
          return Number.isFinite(num) ? num : undefined;
        };

        const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = 15000) => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            return response;
          } finally {
            clearTimeout(timeout);
          }
        };

        // Step 2: For each selected item, lookup on ITAD and update prices
        for (const itemId of sanitizedItemIds) {
          const ref = itemRefs.get(itemId);
          if (!ref) {
            errors.push({ itemId, error: 'Item not found' });
            continue;
          }

          const { collection, item } = ref;
          if (!hasPermission(req.auth, { collection_id: collection.id }, 'can_write')) {
            errors.push({ itemId, error: 'Forbidden to write this collection' });
            continue;
          }

          const steamProps = Array.isArray(collection?.properties)
            ? collection.properties.filter((p) => p?.type === 'steam')
            : [];

          let steamAppId;
          let steamTitle = '';

          // 1) Priority: dedicated steam property value
          for (const prop of steamProps) {
            const rawValue = item[prop.id];
            if (rawValue === null || rawValue === undefined || rawValue === '') continue;

            if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
              steamAppId = rawValue;
              break;
            }

            if (typeof rawValue === 'string') {
              const trimmed = rawValue.trim();
              if (!steamTitle) steamTitle = trimmed;

              const asNumber = Number(trimmed);
              if (Number.isFinite(asNumber)) {
                steamAppId = asNumber;
                break;
              }

              if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                try {
                  const parsed = JSON.parse(trimmed);
                  const parsedId = Number(parsed?.appid ?? parsed?.appId ?? parsed?.id);
                  if (Number.isFinite(parsedId)) {
                    steamAppId = parsedId;
                    steamTitle = String(parsed?.name || steamTitle || '').trim();
                    break;
                  }
                  const parsedName = String(parsed?.name || '').trim().toLowerCase();
                  const mapped = getUniqueSteamAppIdByName(parsedName);
                  if (parsedName && Number.isFinite(mapped)) {
                    steamAppId = mapped;
                    steamTitle = String(parsed?.name || steamTitle || '').trim();
                    break;
                  }
                } catch {
                  // ignore parse errors
                }
              }

              const matchAppId = trimmed.match(/\b(\d{3,})\b/);
              if (matchAppId) {
                const extracted = Number(matchAppId[1]);
                if (Number.isFinite(extracted)) {
                  steamAppId = extracted;
                  break;
                }
              }

              const mapped = getUniqueSteamAppIdByName(trimmed.toLowerCase());
              if (Number.isFinite(mapped)) {
                steamAppId = mapped;
                break;
              }
            }

            if (typeof rawValue === 'object') {
              const asNumber = Number(rawValue.appid ?? rawValue.appId ?? rawValue.id);
              if (Number.isFinite(asNumber)) {
                steamAppId = asNumber;
                steamTitle = String(rawValue.name || steamTitle || '').trim();
                break;
              }
              const name = String(rawValue.name || '').trim().toLowerCase();
              const mapped = getUniqueSteamAppIdByName(name);
              if (name && Number.isFinite(mapped)) {
                steamAppId = mapped;
                steamTitle = String(rawValue.name || steamTitle || '').trim();
                break;
              }
            }
          }

          // 2) Fallback: only dedicated steam fields (avoid generic appid/id collisions)
          if (!Number.isFinite(steamAppId)) {
            const fallbackId = Number(item.steam_app_id ?? item.steamAppId);
            if (Number.isFinite(fallbackId)) {
              steamAppId = fallbackId;
            }
          }

          if (!steamTitle) {
            steamTitle = String(item.steam_name || item.steamName || '').trim();
          }

          if (!Number.isFinite(steamAppId)) {
            errors.push({ itemId, error: 'No Steam App ID found in item', steamValue: steamTitle || null });
            continue;
          }

          try {
            let itadId = null;

            const lookupByAppIdUrl = new URL('https://api.isthereanydeal.com/games/lookup/v1');
            lookupByAppIdUrl.searchParams.append('key', ITAD_API_KEY);
            lookupByAppIdUrl.searchParams.append('appid', String(steamAppId));

            const lookupByAppIdRes = await fetchJsonWithTimeout(lookupByAppIdUrl.toString(), {}, 10000);
            if (lookupByAppIdRes.ok) {
              const lookupData = await lookupByAppIdRes.json();
              if (lookupData?.found && lookupData?.game?.id) {
                itadId = lookupData.game.id;
              }
            }

            if (!itadId && steamTitle) {
              const lookupByTitleUrl = new URL('https://api.isthereanydeal.com/games/lookup/v1');
              lookupByTitleUrl.searchParams.append('key', ITAD_API_KEY);
              lookupByTitleUrl.searchParams.append('title', steamTitle);
              const lookupByTitleRes = await fetchJsonWithTimeout(lookupByTitleUrl.toString(), {}, 10000);
              if (lookupByTitleRes.ok) {
                const lookupByTitleData = await lookupByTitleRes.json();
                if (lookupByTitleData?.found && lookupByTitleData?.game?.id) {
                  itadId = lookupByTitleData.game.id;
                }
              }
            }

            if (!itadId) {
              errors.push({ itemId, error: 'ITAD ID not found', steamAppId, steamTitle: steamTitle || null });
              continue;
            }

            await new Promise((r) => setTimeout(r, 120));

            const pricesUrl = new URL('https://api.isthereanydeal.com/games/prices/v3');
            pricesUrl.searchParams.append('key', ITAD_API_KEY);
            pricesUrl.searchParams.append('country', country);
            pricesUrl.searchParams.append('shops', shops.join(','));
            pricesUrl.searchParams.append('capacity', String(capacity));

            const pricesRes = await fetchJsonWithTimeout(pricesUrl.toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify([itadId]),
            }, 15000);

            if (!pricesRes.ok) {
              errors.push({ itemId, error: 'ITAD prices lookup failed' });
              continue;
            }

            const pricesData = await pricesRes.json();
            const priceItem = Array.isArray(pricesData)
              ? pricesData[0]
              : Array.isArray(pricesData?.data)
                ? pricesData.data[0]
                : Array.isArray(pricesData?.result)
                  ? pricesData.result[0]
                  : null;

            if (!priceItem) {
              errors.push({ itemId, error: 'No price data returned', steamAppId, itadId });
              continue;
            }

            const candidates = Array.isArray(priceItem.prices) ? priceItem.prices
              : Array.isArray(priceItem.deals) ? priceItem.deals
                : [];

            if (candidates.length === 0) {
              errors.push({ itemId, error: 'No prices found' });
              continue;
            }

            const steamEntry = candidates.find((c) => String(c?.shop?.id) === '61') || candidates[0];
            const salePrice = getAmount(steamEntry?.price) ?? 0;
            const regularPrice = getAmount(steamEntry?.regular) ?? salePrice;

            updates.push({
              itemId,
              steamAppId,
              itadId,
              prices: { sale: salePrice, regular: regularPrice },
            });

            if (config.priceSaleColumn) {
              item[config.priceSaleColumn] = salePrice;
            }
            if (config.priceRegularColumn) {
              item[config.priceRegularColumn] = regularPrice;
            }
          } catch (error) {
            errors.push({ itemId, error: error.message || String(error) });
          }
        }

        const stateStr = JSON.stringify(state);
        const updateRes = await pool.query(
          'UPDATE app_state SET data = $1 WHERE organization_id = $2',
          [stateStr, activeOrganizationId]
        );
        if (updateRes.rowCount === 0) {
          await syncAppStateIdSequence();
          await pool.query(
            'INSERT INTO app_state (organization_id, data) VALUES ($1, $2)',
            [activeOrganizationId, stateStr]
          );
        }

        if (global.io && updates.length > 0) {
          global.io.emit('stateUpdated', {
            userId: req.auth.user.id,
            organizationId: activeOrganizationId,
          });
        }

        res.json({
          success: true,
          updated: updates.length,
          errors: errors.length,
          details: { updates, errors },
        });
      } catch (error) {
        console.error('[ITAD Plugin] Error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
      }
    });
  },
};
