import { expect, it } from 'vitest';
import { prepareSteamItem } from './itemImages';
import { normalizeImageField } from '@/lib/itemImages';
const collection = { properties: [{ id: 'steam', type: 'steam' }, { id: 'images', type: 'image' }] };

it('fills and updates the Steam banner while preserving manual images and the selected cover', () => {
  const item = { steam: { appid: 1374490 }, images: { images: [{ id: 'manual', src: 'https://cdn.test/manual.jpg' }], defaultImageId: 'manual' } };
  const next = prepareSteamItem(collection, item);
  expect(next.images.images).toHaveLength(2);
  expect(next.images.defaultImageId).toBe('manual');
  expect(prepareSteamItem(collection, next)).toBe(next);
  const changed = prepareSteamItem(collection, { ...next, steam: { appid: 10 } });
  expect(changed.images.images.find((image: any) => image.source === 'steam').steamAppId).toBe(10);
  expect(changed.images.images[0].id).toBe('manual');
});
it('does not reinsert an automatically added image that the user removed', () => {
  const next = prepareSteamItem(collection, { steam: 10 });
  const removed = { ...next, images: normalizeImageField({ ...next.images, images: [] }) };
  expect(prepareSteamItem(collection, removed)).toBe(removed);
});
it('respects disabled filling and missing image fields', () => {
  const item = { steam: 10 };
  expect(prepareSteamItem({ ...collection, plugins: { steam: { imagePropertyId: 'none' } } }, item)).toBe(item);
  expect(prepareSteamItem({ properties: [collection.properties[0]] }, item)).toBe(item);
});
