const exchangeField = '_steamExchangeReceivedIds';

export function validateSteamExchanges(collection, previousCollection) {
  if (collection.plugins?.steam?.role !== 'games' || !Array.isArray(collection.items)) return null;

  const items = new Map(collection.items.map((item) => [item.id, item]));
  const previousItems = new Map((previousCollection?.items || []).map((item) => [item.id, item]));
  const parents = new Map();
  for (const item of collection.items) {
    const ids = item[exchangeField];
    if (ids === undefined) continue;
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length) {
      return 'La liste des jeux reçus est invalide.';
    }
    const previousIds = previousItems.get(item.id)?.[exchangeField];
    for (const id of ids) {
      if (!items.has(id)) {
        if (Array.isArray(previousIds) && previousIds.includes(id)) continue;
        return 'Un des jeux reçus est indisponible.';
      }
      if (id === item.id || parents.has(id)) {
        return 'Un jeu ne peut être reçu que dans un seul échange.';
      }
      parents.set(id, item.id);
    }
  }

  const visited = new Set();
  for (const id of parents.keys()) {
    const path = new Set();
    let current = id;
    while (parents.has(current) && !visited.has(current)) {
      if (path.has(current)) return 'La chaîne d’échanges forme une boucle.';
      path.add(current);
      current = parents.get(current);
    }
    for (const entry of path) visited.add(entry);
  }
  return null;
}
