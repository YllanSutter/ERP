import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { Collection } from '@/lib/types';
import { SteamExchangeEditor } from './SteamExchangeEditor';

it('offers games from the original bundle and enables creation before price configuration', () => {
  const origin = { id: 'origin', name: 'Jeu donné', bundle: 'bundle-a', _steamExchangeReceivedIds: ['source'] };
  const source = { id: 'source', name: 'Jeu rééchangé' };
  const collection: Collection = {
    id: 'games',
    name: 'Jeux',
    properties: [],
    items: [
      origin,
      source,
      { id: 'same', name: { name: 'Dans le bundle', appid: 620 }, bundle: ['bundle-a'] },
      { id: 'other', name: 'Autre bundle', bundle: 'bundle-b' },
      { id: 'empty-entry', name: '   ', bundle: 'bundle-a' },
      { id: 'placeholder-entry', name: 'Nouveau Jeux', bundle: 'bundle-a' },
      { id: 'loose', name: 'Sans bundle' },
    ],
    plugins: { steam: { role: 'games' } },
  };
  const markup = renderToStaticMarkup(
    <SteamExchangeEditor collection={collection} item={source} receivedIds={[]} bundleRelationPropertyId="bundle" standalone onChange={() => {}} onCreate={() => {}} onOpenItem={() => {}} />,
  );
  expect(markup).toContain('Dans le bundle');
  expect(markup).toContain('Créer un jeu reçu');
  expect(markup).not.toContain('[object Object]');
  expect(markup).not.toContain('Enregistrer un échange');
  expect(markup).not.toContain('Autre bundle');
  expect(markup).not.toContain('Sans bundle');
  expect(markup).not.toContain('Jeu sans titre');
  expect(markup).not.toContain('Nouveau Jeux');
  expect(markup).not.toContain(' disabled=');
});
