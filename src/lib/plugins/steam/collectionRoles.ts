import type { Collection } from '@/lib/types';

export function getSteamBundleConfig(collections: Collection[]) {
  const games = collections.find((c) => c.plugins?.steam?.role === 'games');
  const bundles = collections.find((c) => c.plugins?.steam?.role === 'bundles');
  const relations =
    games?.properties.filter(
      (p) => p.type === 'relation' && p.relation?.targetCollectionId === bundles?.id,
    ) || [];
  const configured = games?.plugins?.steam?.bundleRelationPropertyId;
  return {
    gamesCollectionId: games?.id || '',
    bundlesCollectionId: bundles?.id || '',
    bundleRelationPropertyId:
      relations.find((p) => p.id === configured)?.id ||
      (relations.length === 1 ? relations[0].id : ''),
  };
}
