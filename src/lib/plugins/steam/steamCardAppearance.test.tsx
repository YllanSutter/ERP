import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import SteamCardFullArt from '@/components/views/SteamCardFullArt';

it('keeps full-art titles white with a dark outline independently of the page theme', () => {
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
  const fullArt = renderToStaticMarkup(<SteamCardFullArt {...props} fullArt />);
  expect(fullArt).toMatch(/<text[^>]*class="fill-white"[^>]*stroke:rgba\(0,0,0,0.8\)/);
  const classic = renderToStaticMarkup(<SteamCardFullArt {...props} fullArt={false} />);
  expect(classic).toMatch(/<text[^>]*class="fill-\[var\(--ink\)\]"/);
});
