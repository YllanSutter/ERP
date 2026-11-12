import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ItemBanner } from './ItemBanner';
const collection = { properties: [{ id: 'pictures', type: 'image' }] };
it('shows the selected image without depending on Steam', () => {
  const html = renderToStaticMarkup(<ItemBanner collection={collection} item={{ pictures: { images: [{ id: 'first', src: 'https://cdn.test/a.jpg' }, { id: 'cover', src: 'https://cdn.test/b.jpg' }], defaultImageId: 'cover' } }} />);
  expect(html).toContain('https://cdn.test/b.jpg');
  expect(html).not.toContain('src="https://cdn.test/a.jpg"');
});
it('renders nothing when the image field is empty', () => {
  expect(renderToStaticMarkup(<ItemBanner collection={collection} item={{}} />)).toBe('');
});

it('uses the property default only when the item has no image', () => {
  const defaultCollection = { properties: [{ id: 'pictures', type: 'image', defaultImage: 'https://cdn.test/default.jpg' }] };
  expect(renderToStaticMarkup(<ItemBanner collection={defaultCollection} item={{}} />)).toContain('src="https://cdn.test/default.jpg"');
  const html = renderToStaticMarkup(<ItemBanner collection={defaultCollection} item={{ pictures: 'https://cdn.test/custom.jpg' }} />);
  expect(html).toContain('src="https://cdn.test/custom.jpg"');
  expect(html).not.toContain('src="https://cdn.test/default.jpg"');
});

it('uses the collection image base for filenames and default images', () => {
  const collection = { properties: [{ id: 'pictures', type: 'image', imageBaseUrl: 'https://example.com/images/', defaultImage: 'home-bg1.jpg' }] };
  expect(renderToStaticMarkup(<ItemBanner collection={collection} item={{}} />)).toContain('src="https://example.com/images/home-bg1.jpg"');
  expect(renderToStaticMarkup(<ItemBanner collection={collection} item={{ pictures: 'custom.jpg' }} />)).toContain('src="https://example.com/images/custom.jpg"');
});
