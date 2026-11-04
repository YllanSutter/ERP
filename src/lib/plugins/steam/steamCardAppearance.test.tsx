import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import SteamCardFullArt from '@/components/views/SteamCardFullArt';

const noop = () => {};
const props = {
  item: { id: 'game', steam: { appid: 1374490, name: 'RuneScape: Dragonwilds' } },
  steamProperty: { id: 'steam' },
  properties: [],
  collections: [],
  collection: { id: 'games', properties: [] },
  canEdit: false,
  canEditField: () => false,
  selected: false,
  draggable: false,
  isDragging: false,
  onViewDetail: noop,
  onEdit: noop,
  onRelationChange: noop,
  onNavigateToCollection: noop,
  onSelectionChange: noop,
  onDragStart: noop,
  onDragEnd: noop,
  onDropOnItem: noop,
};

it('keeps full-art titles white with a dark outline independently of the page theme', () => {
  const fullArt = renderToStaticMarkup(<SteamCardFullArt {...props} fullArt />);
  expect(fullArt).toMatch(/<text[^>]*class="fill-white"[^>]*stroke:rgba\(0,0,0,0.8\)/);
  const classic = renderToStaticMarkup(<SteamCardFullArt {...props} fullArt={false} />);
  expect(classic).toMatch(/<text[^>]*class="fill-\[var\(--ink\)\]"/);
});


it('formats linked bundle dates using the year and month settings', () => {
  const linkedDate = (field: string, granularity: string) => ({
    id: `bundle__relcol__${field}`,
    name: field,
    type: 'date',
    dateGranularity: granularity,
    isRelationLinkedColumn: true,
    sourceTargetCollectionId: 'bundles',
    sourceRelationPropertyId: 'bundle',
    sourceDisplayFieldId: field,
  });
  const markup = renderToStaticMarkup(
    <SteamCardFullArt
      {...props}
      item={{ ...props.item, bundle: ['b1', 'b2'] }}
      properties={[linkedDate('Année', 'year'), linkedDate('Mois', 'month')]}
      collections={[{
        id: 'bundles',
        items: [
          { id: 'b1', Année: '2026-01-01T12:00:00Z', Mois: '2026-10-01T12:00:00Z' },
          { id: 'b2', Année: '2026-01-01T12:00:00Z', Mois: '2026-11-01T12:00:00Z' },
        ],
      }]}
    />
  );

  expect(markup).toContain('>2026</dd>');
  expect(markup).toMatch(/>octobre · novembre<\/dd>/i);
  expect(markup).not.toContain('2026-01-01');
});
