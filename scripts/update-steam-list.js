// Same catalogue updater as the Steam plugin settings. Requires STEAM_API_KEY.
import path from 'node:path';
import {
  fetchSteamCatalogue,
  writeSteamCatalogue,
  STEAM_CATALOGUE_PATH,
} from '../server/plugins/steam/catalogue.js';
try {
  const games = await fetchSteamCatalogue(process.env.STEAM_API_KEY);
  const output = process.argv[2] ? path.resolve(process.argv[2]) : STEAM_CATALOGUE_PATH;
  await writeSteamCatalogue(games, output);
  console.log(`${games.length} jeux Steam mis à jour.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
