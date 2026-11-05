import { expect, it } from 'vitest';
import { normalizeImageField, primaryImage, validImageSource, imageDisplayStyle } from './itemImages';

it('keeps the selected cover across JSON export and import', () => {
  const value = { images: [{ id: 'a', src: 'https://cdn.test/a.jpg' }, { id: 'b', src: 'https://cdn.test/b.jpg' }], defaultImageId: 'b' };
  expect(primaryImage(JSON.parse(JSON.stringify(value)))?.id).toBe('b');
});
it('chooses the remaining image if the cover was deleted and hides empty galleries', () => {
  expect(primaryImage({ images: [{ id: 'b', src: 'https://cdn.test/b.jpg' }], defaultImageId: 'a' })?.id).toBe('b');
  expect(primaryImage(null)).toBeNull();
});
it('accepts CDN links and uploaded image data, rejecting executable URLs', () => {
  expect(validImageSource('https://cdn.test/picture.webp')).toBe(true);
  expect(validImageSource('data:image/webp;base64,AAAA')).toBe(true);
  expect(validImageSource('javascript:alert(1)')).toBe(false);
  expect(normalizeImageField(['https://cdn.test/a.jpg', 'javascript:alert(1)']).images).toHaveLength(1);
});

it('applies image limits and fit, ignoring invalid dimensions', () => {
  expect(imageDisplayStyle({ maxHeight: '280', maxWidth: 900, fit: 'cover' })).toEqual({ maxHeight: 280, maxWidth: 900, objectFit: 'cover' });
  expect(imageDisplayStyle({ maxHeight: -10, maxWidth: 'bad', fit: 'bad' })).toEqual({ maxHeight: undefined, maxWidth: undefined, objectFit: 'contain' });
});
