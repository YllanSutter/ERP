import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import { BundleGroupedList } from './BundleGroupedList';
import { loadPublicBundles } from './bundleApi';
import type { Collection } from '@/lib/types';

const bundles: Collection = {
  id: 'bundles',
  name: 'Bundles',
  properties: [
    { id: 'year', name: 'Année', type: 'text' },
    { id: 'month', name: 'Mois', type: 'text' },
  ],
  items: [],
};
const items = [
  { id: 'old', year: '2025', month: 'Septembre' },
  { id: 'october', year: '2026', month: 'Octobre' },
  { id: 'november', year: '2026', month: 'Novembre' },
];
const scheme = {
  groups: ['year', 'month'],
  groupDisplayMode: 'select',
  groupDisplayModes: { year: 'select', month: 'select' },
  initialGroupPath: '2026/Octobre',
};
afterEach(() => vi.unstubAllGlobals());

it('opens publishing and importing on the source year/month without extra grouping controls', () => {
  const html = renderToStaticMarkup(
    <BundleGroupedList
      items={items}
      bundles={bundles}
      scheme={scheme}
      storageId="test"
      collections={[bundles]}
      renderItems={(rows) => <span>{rows.map((row) => `ROW:${row.id}`).join(',')}</span>}
    />,
  );
  expect(html).toContain('ROW:october');
  expect(html).not.toContain('ROW:old');
  expect(html).not.toContain('ROW:november');
  expect(html).not.toContain('Grouper par');
  expect(html).not.toContain('Ajouter un niveau');
});

it('keeps an empty requested month instead of displaying bundles from another period', () => {
  const html = renderToStaticMarkup(
    <BundleGroupedList
      items={items}
      bundles={bundles}
      scheme={{ ...scheme, initialGroupPath: '2027/Octobre' }}
      storageId="test-empty"
      collections={[bundles]}
      renderItems={(rows) => <span>{rows.map((row) => `ROW:${row.id}`).join(',')}</span>}
    />,
  );
  expect(html).toContain('Aucun bundle pour cette sélection.');
  expect(html).not.toContain('ROW:');
});

it('hydrates older catalogue summaries from public snapshots to avoid empty year/month groups', async () => {
  const fetchMock = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url.endsWith('/public-bundles')
        ? [{ id: 'existing-publication', title: 'Pack', gameCount: 1 }]
        : {
            bundleProperties: [
              { id: 'year', name: 'Année', type: 'text' },
              { id: 'month', name: 'Mois', type: 'text' },
            ],
            bundle: { year: '2026', month: 'Octobre' },
          },
  }));
  vi.stubGlobal('fetch', fetchMock);
  const entries = await loadPublicBundles();
  expect(entries[0].bundle).toEqual({ year: '2026', month: 'Octobre' });
  expect(fetchMock.mock.calls[1][0]).toContain('existing-publication?format=json');
});

it('uses complete catalogue metadata without fetching every snapshot again', async () => {
  const entries = [
    {
      id: 'complete',
      bundle: { year: '2026' },
      bundleProperties: [{ id: 'year', name: 'Année', type: 'text' }],
    },
  ];
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => entries }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await loadPublicBundles()).toEqual(entries);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
