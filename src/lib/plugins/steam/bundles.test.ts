import { getSteamBundleConfig } from './collectionRoles';
import { describe, it, expect } from 'vitest';
import { bundleGroupPrefill, importBundle } from './bundles';
import type { Collection } from '@/lib/types';

const config = {
  gamesCollectionId: 'games',
  bundlesCollectionId: 'bundles',
  bundleRelationPropertyId: 'bundle',
};
const collections: Collection[] = [
  {
    id: 'games',
    name: 'Jeux',
    properties: [
      { id: 'steam', name: 'Steam', type: 'steam' },
      {
        id: 'bundle',
        name: 'Bundle',
        type: 'relation',
        relation: { targetCollectionId: 'bundles', targetFieldId: 'members', type: 'many_to_many' },
      },
    ],
    items: [
      { id: 'existing', steam: { appid: 10, name: 'Game' }, bundle: ['old'], privateNote: 'keep' },
    ],
  },
  {
    id: 'bundles',
    name: 'Bundles',
    properties: [
      { id: 'title', name: 'Nom', type: 'text' },
      { id: 'month', name: 'Mois', type: 'text' },
      { id: 'members', name: 'Jeux', type: 'relation', relation: { targetCollectionId: 'games' } },
    ],
    items: [],
  },
];
const snapshot = {
  format: 'steam-bundle-v1',
  title: 'Pack',
  bundleProperties: [{ id: 'name', name: 'Nom', type: 'text' }],
  gameProperties: [{ id: 'app', name: 'Steam', type: 'steam' }],
  bundle: { name: 'Pack' },
  games: [{ app: { appid: 10, name: 'Game' } }, { app: { appid: 20, name: 'Other' } }],
};

describe('Steam bundles', () => {
  it('prefills linked bundle fields at every group depth, excluding unrelated relations', () => {
    const props: any[] = [
      {
        id: 'linked',
        isRelationLinkedColumn: true,
        sourceRelationPropertyId: 'bundle',
        sourceDisplayFieldId: 'month',
      },
    ];
    expect(
      bundleGroupPrefill(
        '2026/Novembre',
        ['year', 'linked'],
        props,
        collections[0],
        collections[1],
      ),
    ).toEqual({ month: 'Novembre' });
    expect(bundleGroupPrefill('(vide)', ['linked'], props, collections[0], collections[1])).toEqual(
      {},
    );
  });
  it('reuses existing Steam games, preserves values and relations, and fills the reverse relation', () => {
    let id = 0;
    const next = importBundle(snapshot, collections, config, () => `new-${++id}`);
    expect(next[0].items).toHaveLength(2);
    expect(next[0].items[0]).toMatchObject({
      id: 'existing',
      privateNote: 'keep',
      bundle: ['old', 'new-1'],
    });
    expect(next[1].items[0]).toMatchObject({
      id: 'new-1',
      title: 'Pack',
      members: ['existing', 'new-2'],
    });
    expect(collections[0].items[0].bundle).toEqual(['old']);
    expect(collections[1].items).toEqual([]);
  });
  it('rejects invalid imports atomically', () => {
    expect(() =>
      importBundle({ ...snapshot, games: [{ app: { appid: 'invalid' } }] }, collections, config),
    ).toThrow();
    expect(() => importBundle({}, collections, config)).toThrow();
    expect(collections[0].items).toHaveLength(1);
  });
  it('does not overwrite a single-valued bundle relationship', () => {
    const single: Collection[] = structuredClone(collections);
    single[0].properties[1].relation!.type = 'many_to_one';
    expect(() => importBundle(snapshot, single, config)).toThrow('relation multiple');
  });
});

it('resolves roles from existing collection settings and auto-detects a unique relation', () => {
  const configured = structuredClone(collections);
  configured[0].plugins = { steam: { role: 'games' } };
  configured[1].plugins = { steam: { role: 'bundles' } };
  expect(getSteamBundleConfig(configured)).toEqual(config);
  expect(getSteamBundleConfig(collections).gamesCollectionId).toBe('');
});
