import { bundleGroupProperty, groupValueForBundle } from './bundleGrouping';
import type { Collection, Property } from '@/lib/types';

const steamAppId = (raw: any): number => {
  let value = raw;
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      value = JSON.parse(value);
    } catch {
      return NaN;
    }
  }
  return Number(value && typeof value === 'object' ? (value.appid ?? value.appId) : value);
};

export const relationIds = (value: any): string[] =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .map((v) => (typeof v === 'object' ? v.id : v))
    .filter((v) => typeof v === 'string');
export const bundleTitleProperty = (collection: Collection) =>
  collection.properties.find(
    (p) => p.isNameField || p.isTitle || p.id === 'name' || p.name === 'Nom',
  ) || collection.properties.find((p) => p.type === 'text');
export const bundleTitle = (collection: Collection, item: any) =>
  String(item[bundleTitleProperty(collection)?.id || 'name'] || item.name || 'Sans titre');

export function bundleGroupPrefill(
  path: string,
  groups: string[],
  properties: Property[],
  games: Collection,
  bundles: Collection,
) {
  const values: Record<string, any> = {};
  const parts = path.split('/');
  groups.forEach((id, index) => {
    const value = parts[index];
    if (!value || value === '(vide)') return;
    const target = bundleGroupProperty(id, properties, games, bundles);
    if (target) {
      values[target.id] = groupValueForBundle(target, value, parts);
      return;
    }
    // Grouping directly by Bundle also supplies its metadata through the parent relation.
    const parent = games.properties.find(
      (p) => p.id === id && p.type === 'relation' && p.relation?.targetCollectionId === bundles.id,
    );
    const existing = parent && bundles.items.find((item) => item.id === value);
    if (!existing) return;
    for (const field of bundles.properties) {
      if (
        field.id === bundleTitleProperty(bundles)?.id ||
        ![
          'text',
          'number',
          'date',
          'select',
          'multiselect',
          'multi_select',
          'checkbox',
          'relation',
        ].includes(field.type) ||
        field.isRelationLinkedColumn ||
        field.relation?.targetCollectionId === games.id
      )
        continue;
      if (existing[field.id] !== undefined && values[field.id] === undefined)
        values[field.id] = existing[field.id];
    }
  });
  return values;
}

export function importBundle(
  snapshot: any,
  collections: Collection[],
  config: any,
  uuid: () => string = () => crypto.randomUUID(),
) {
  if (
    snapshot?.format !== 'steam-bundle-v1' ||
    !Array.isArray(snapshot.games) ||
    snapshot.games.length > 2000 ||
    !Array.isArray(snapshot.bundleProperties) ||
    !Array.isArray(snapshot.gameProperties)
  )
    throw new Error('Bundle invalide.');
  const games = collections.find((c) => c.id === config.gamesCollectionId);
  const bundles = collections.find((c) => c.id === config.bundlesCollectionId);
  const relation = games?.properties.find(
    (p) =>
      p.id === config.bundleRelationPropertyId && p.relation?.targetCollectionId === bundles?.id,
  );
  const steam = games?.properties.find((p) => p.type === 'steam');
  if (!games || !bundles || games.id === bundles.id || !relation || !steam)
    throw new Error('Configurez les collections, le champ Steam et la relation dans le plugin.');
  const mapValues = (item: any, source: any[], target: Collection) => {
    const result: Record<string, any> = {};
    for (const p of source) {
      if (
        ![
          'text',
          'number',
          'date',
          'select',
          'multiselect',
          'multi_select',
          'checkbox',
          'steam',
        ].includes(p.type)
      )
        continue;
      const dest =
        p.type === 'steam'
          ? steam
          : target.properties.find(
              (t) => t.name === p.name && t.type === p.type && !t.isRelationLinkedColumn,
            );
      if (dest && item?.[p.id] !== undefined) {
        const value = item[p.id];
        if (p.type === 'steam') {
          const appid = steamAppId(value);
          if (!Number.isSafeInteger(appid) || appid <= 0) throw new Error('Steam App ID invalide.');
          result[dest.id] = { appid, name: typeof value?.name === 'string' ? value.name : '' };
        } else {
          if (!(
            value === null ||
            ['string', 'number', 'boolean'].includes(typeof value) ||
            (Array.isArray(value) && value.every((v) => typeof v === 'string'))
          ))
            throw new Error('Valeur de propriété invalide dans le bundle.');
          result[dest.id] = value;
        }
      }
    }
    return result;
  };
  const bundle: Record<string, any> = {
    ...mapValues(snapshot.bundle, snapshot.bundleProperties, bundles),
    id: uuid(),
  };
  const titleProp = bundleTitleProperty(bundles);
  if (titleProp && !bundle[titleProp.id]) bundle[titleProp.id] = snapshot.title;
  let nextGames = [...games.items];
  for (const source of snapshot.games) {
    const values = mapValues(source, snapshot.gameProperties, games);
    const appid = Number(values[steam.id]?.appid);
    if (!Number.isSafeInteger(appid) || appid <= 0)
      throw new Error('Un jeu ne possède pas de Steam App ID valide.');
    const existing = nextGames.find((g) => steamAppId(g[steam.id]) === appid);
    const many = !['one_to_one', 'many_to_one', 'one-to-one', 'many-to-one'].includes(
      relation.relation?.type || '',
    );
    if (existing && !many && relationIds(existing[relation.id]).some((id) => id !== bundle.id))
      throw new Error(
        'Un jeu appartient déjà à un bundle : utilisez une relation multiple pour conserver les deux.',
      );
    const item = existing || { ...values, id: uuid() };
    const linked = {
      ...item,
      [relation.id]: many
        ? [...new Set([...relationIds(item[relation.id]), bundle.id])]
        : bundle.id,
    };
    nextGames = existing
      ? nextGames.map((g) => (g.id === existing.id ? linked : g))
      : [...nextGames, linked];
  }
  const reverse =
    bundles.properties.find((p) => p.id === relation.relation?.targetFieldId) ||
    bundles.properties.find(
      (p) => p.type === 'relation' && p.relation?.targetCollectionId === games.id,
    );
  if (reverse) {
    const members = nextGames
      .filter((g) => relationIds(g[relation.id]).includes(bundle.id))
      .map((g) => g.id);
    const targetMany = !['one_to_many', 'one_to_one', 'one-to-many', 'one-to-one'].includes(
      relation.relation?.type || '',
    );
    if (!targetMany && members.length > 1)
      throw new Error('La relation inverse ne permet pas plusieurs jeux dans un bundle.');
    bundle[reverse.id] = targetMany ? members : members[0] || null;
  }
  return collections.map((c) =>
    c.id === games.id
      ? { ...c, items: nextGames }
      : c.id === bundles.id
        ? { ...c, items: [...c.items, bundle] }
        : c,
  );
}
