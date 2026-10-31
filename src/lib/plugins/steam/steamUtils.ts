/**
 * Liste des jeux Steam pour autocomplete
 * Cette liste est intégrée dans le build
 */

import steamListRaw from './steamList.json';

export interface SteamGame {
  appid: number;
  name: string;
}

// Export vide - sera chargée dynamiquement à runtime
export const steamGames: SteamGame[] = [];

export function getSteamImageUrl(appid: number | string | undefined | null, type: 'header' | 'capsule' | 'portrait' | 'hero' | 'logo' = 'header'): string | null {
  if (appid === undefined || appid === null || appid === '') return null;
  const id = typeof appid === 'string' ? appid : String(appid);
  switch (type) {
    case 'portrait':
      return `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`;
    case 'hero':
      return `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_hero.jpg`;
    case 'capsule':
      return `https://cdn.akamai.steamstatic.com/steam/apps/${id}/capsule_616x353.jpg`;
    case 'logo':
      return `https://cdn.akamai.steamstatic.com/steam/apps/${id}/logo.png`;
    case 'header':
    default:
      return `https://cdn.akamai.steamstatic.com/steam/apps/${id}/header.jpg`;
  }
}

let cachedSteamGames: SteamGame[] | null = null;

function normalizeSteamGames(raw: any): SteamGame[] {
  const source = Array.isArray(raw)
    ? raw
    : (Array.isArray(raw?.applist?.apps) ? raw.applist.apps : []);

  return source
    .filter((g: any) => g && typeof g.appid === 'number' && typeof g.name === 'string' && g.name.trim())
    .map((g: any) => ({ appid: g.appid, name: g.name.trim() }));
}

/**
 * Charge la liste Steam depuis le fichier JSON
 */
export async function loadSteamGamesList(): Promise<SteamGame[]> {
  if (cachedSteamGames) return cachedSteamGames;

  try {
    const localFromSrc = normalizeSteamGames(steamListRaw);
    if (localFromSrc.length > 0) {
      cachedSteamGames = localFromSrc;
      return localFromSrc;
    }

    // fallback optionnel si un fichier public existe (pas d'appel API externe)
    const response = await fetch('/steamList.json');
    if (response.ok) {
      const publicList = normalizeSteamGames(await response.json());
      cachedSteamGames = publicList;
      return publicList;
    }

    cachedSteamGames = [];
    return [];
  } catch (error) {
    console.error('[SteamUtils] Error loading steam list:', error);
    cachedSteamGames = [];
    return [];
  }
}

/**
 * Recherche les jeux Steam correspondant à une query
 */
export function searchSteamGames(query: string, games: SteamGame[], limit: number = 10): SteamGame[] {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase();
  return games
    .filter(game => game.name.toLowerCase().includes(lowerQuery))
    .slice(0, limit);
}
