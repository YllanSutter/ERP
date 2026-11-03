import { bundleRequest } from './bundleApi';

const REVISION_KEY = 'erp:steam-images-revision';
export const STEAM_IMAGES_CHANGED = 'steam-images-changed';
let fallbackRevision = '0';
const headers = new Map<string, Promise<string | null>>();
export function steamImagesRevision() {
  try {
    return typeof window === 'undefined'
      ? '0'
      : window.localStorage.getItem(REVISION_KEY) || fallbackRevision;
  } catch {
    return fallbackRevision;
  }
}
export function subscribeSteamImages(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === REVISION_KEY) {
      headers.clear();
      callback();
    }
  };
  window.addEventListener(STEAM_IMAGES_CHANGED, callback);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(STEAM_IMAGES_CHANGED, callback);
    window.removeEventListener('storage', storage);
  };
}
export function imageUrlRevision(url: string) {
  const revision = steamImagesRevision();
  if (revision === '0') return url;
  const parsed = new URL(url);
  parsed.searchParams.set('erp_refresh', revision);
  return parsed.href;
}
export function resolveSteamHeader(appid: number | string) {
  const key = `${appid}:${steamImagesRevision()}`;
  if (!headers.has(key))
    headers.set(
      key,
      bundleRequest(`images/${Number(appid)}`)
        .then((data) => (typeof data.header === 'string' ? imageUrlRevision(data.header) : null))
        .catch(() => null),
    );
  return headers.get(key)!;
}
export async function refreshSteamImages() {
  const result = await bundleRequest('images/refresh', { method: 'POST' });
  headers.clear();
  fallbackRevision = String(result.updatedAt);
  try {
    window.localStorage.setItem(REVISION_KEY, String(result.updatedAt));
  } catch {
    /* current mounted images still retry */
  }
  window.dispatchEvent(new Event(STEAM_IMAGES_CHANGED));
}
