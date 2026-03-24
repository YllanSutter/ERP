/**
 * Liste des jeux Steam pour autocomplete
 * Cette liste est intégrée dans le build
 */

export interface SteamGame {
  appid: number;
  name: string;
}

// Export vide - sera chargée dynamiquement à runtime
export const steamGames: SteamGame[] = [];

/**
 * Charge la liste Steam depuis le fichier JSON
 */
export async function loadSteamGamesList(): Promise<SteamGame[]> {
  try {
    const response = await fetch('/steamList.json');
    if (!response.ok) throw new Error('Failed to load steam games list');
    return await response.json();
  } catch (error) {
    console.error('[SteamUtils] Error loading steam list:', error);
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
