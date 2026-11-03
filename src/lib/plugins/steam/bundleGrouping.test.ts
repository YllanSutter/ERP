import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  activeBundleGroupPath,
  bundleGroupScheme,
  publicBundleGroupValues,
} from './bundleGrouping';
import { bundleGroupPrefill } from './bundles';
import { buildGroupStructure } from '@/lib/groupingUtils';
import type { Collection } from '@/lib/types';

const games: Collection = {
  id: 'games',
  name: 'Jeux',
  properties: [
    { id: 'parent', name: 'Bundle', type: 'relation', relation: { targetCollectionId: 'bundles' } },
  ],
  items: [],
};
const bundles: Collection = {
  id: 'bundles',
  name: 'Bundles',
  properties: [
    { id: 'name', name: 'Nom', type: 'text' },
    { id: 'year', name: 'Année', type: 'date', dateGranularity: 'year' },
    { id: 'month', name: 'Mois', type: 'date', dateGranularity: 'month' },
  ],
  items: [{ id: 'existing', name: 'Pack', year: '2026-01-01', month: '2026-10-01' }],
};
const groups = ['parent__relcol__year', 'parent__relcol__month'];

afterEach(() => vi.unstubAllGlobals());
describe('bundle parent relation and grouping', () => {
  it('resolves linked groups automatically through the parent when generated columns are absent', () => {
    expect(bundleGroupPrefill('2026/Octobre', groups, games.properties, games, bundles)).toEqual({
      year: '2026-01-01',
      month: '2026-10-01',
    });
  });
  it('copies metadata when grouped directly by an existing bundle without copying its name', () => {
    expect(bundleGroupPrefill('existing', ['parent'], games.properties, games, bundles)).toEqual({
      year: '2026-01-01',
      month: '2026-10-01',
    });
  });
  it('keeps group order and display modes when mapping game groups to bundle properties', () => {
    expect(
      bundleGroupScheme(groups, games.properties, games, bundles, {
        groupDisplayMode: 'select',
        groupDisplayModes: { [groups[1]]: 'tabs' },
      }),
    ).toEqual({
      groups: ['year', 'month'],
      groupDisplayMode: 'select',
      groupDisplayModes: { year: 'select', month: 'tabs' },
    });
    expect(bundleGroupScheme(['month'], bundles.properties, bundles, bundles, null).groups).toEqual(
      ['month'],
    );
  });
  it('uses the latest valid parent and month saved by the table, instead of a stale callback', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => JSON.stringify({ [groups[0]]: '2026', [groups[1]]: '2026/Octobre' }),
      },
    });
    expect(activeBundleGroupPath('games', groups, '')).toBe('2026/Octobre');
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => JSON.stringify({ [groups[0]]: '2027', [groups[1]]: '2026/Octobre' }),
      },
    });
    expect(activeBundleGroupPath('games', groups, '2026/Octobre')).toBe('2027');
  });
  it('groups public metadata by the destination properties, despite different organization field IDs', () => {
    const publicEntry = {
      id: 'publication',
      bundleProperties: [
        { id: 'remoteYear', name: 'Année', type: 'date' },
        { id: 'remoteMonth', name: 'Mois', type: 'date' },
      ],
      bundle: { remoteYear: '2026-01-01', remoteMonth: '2026-10-01' },
    };
    const item = publicBundleGroupValues(publicEntry, bundles);
    const structure = buildGroupStructure([item], ['year', 'month'], bundles.properties);
    expect(structure?.structure['2026/Octobre'].itemIds).toEqual(['publication']);
    expect(item.publication).toBe(publicEntry);
  });
});

it('keeps the active year/month when mapping the opening selection to bundle groups', () => {
  const scheme = bundleGroupScheme(
    groups,
    games.properties,
    games,
    bundles,
    { groupDisplayMode: 'select' },
    '2026/Octobre',
  );
  expect(scheme.initialGroupPath).toBe('2026/Octobre');
});

it('maps a previously published field by its stable ID after a rename', () => {
  const entry = {
    id: 'published',
    bundleProperties: [
      { id: 'year', name: 'Ancienne année', type: 'date' },
      { id: 'month', name: 'Ancien mois', type: 'date' },
    ],
    bundle: { year: '2026-01-01', month: '2026-10-01' },
  };
  const mapped = publicBundleGroupValues(entry, bundles);
  expect(
    buildGroupStructure([mapped], ['year', 'month'], bundles.properties)?.structure['2026/Octobre']
      .itemIds,
  ).toEqual(['published']);
});
