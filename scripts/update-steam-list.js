// Régénère src/lib/plugins/steam/steamList.json depuis l'API Steam IStoreService/GetAppList (jeux seulement).
// ISteamApps/GetAppList (v2), source de l'ancien fichier, est déprécié par Valve : ne plus l'utiliser.
// Clé : STEAM_API_KEY dans .env (https://steamcommunity.com/dev/apikey). Usage : npm run steam:list [-- <fichier de sortie>]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = path.resolve(process.argv[2] || path.join(PROJECT_ROOT, 'src/lib/plugins/steam/steamList.json'));
const key = process.env.STEAM_API_KEY;

if (!key) {
  console.error('STEAM_API_KEY manquante : ajoute-la dans .env (clé sur https://steamcommunity.com/dev/apikey).');
  process.exit(1);
}

const apps = [];
let lastAppid = 0;
for (;;) {
  const input = { include_games: true, max_results: 50000, ...(lastAppid ? { last_appid: lastAppid } : {}) };
  const url = `https://api.steampowered.com/IStoreService/GetAppList/v1/?key=${encodeURIComponent(key)}&input_json=${encodeURIComponent(JSON.stringify(input))}`;
  const res = await fetch(url);
  // Ne jamais afficher l'URL : elle contient la clé.
  if (!res.ok) {
    console.error(`Steam a répondu ${res.status} ${res.statusText}${res.status === 403 ? ' (clé refusée ?)' : ''}. Fichier inchangé.`);
    process.exit(1);
  }
  const { response = {} } = await res.json();
  const page = Array.isArray(response.apps) ? response.apps : [];
  apps.push(...page);
  console.log(`${apps.length} jeux récupérés…`);
  if (!response.have_more_results || !response.last_appid || page.length === 0) break;
  lastAppid = response.last_appid;
}

const cleaned = apps
  .filter((app) => typeof app?.appid === 'number' && typeof app?.name === 'string' && app.name.trim())
  .map((app) => ({ appid: app.appid, name: app.name.trim() }))
  .sort((a, b) => a.appid - b.appid);

if (cleaned.length === 0) {
  console.error('Aucun jeu reçu. Fichier inchangé.');
  process.exit(1);
}

// Écriture atomique : l'ancien fichier reste intact si quelque chose échoue.
const tmpPath = `${outPath}.tmp`;
fs.writeFileSync(tmpPath, JSON.stringify({ applist: { apps: cleaned } }));
fs.renameSync(tmpPath, outPath);
console.log(`${cleaned.length} jeux écrits dans ${path.relative(PROJECT_ROOT, outPath)}.`);
