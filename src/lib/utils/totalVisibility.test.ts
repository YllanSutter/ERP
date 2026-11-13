import { expect, it } from 'vitest';
import { isTotalFieldVisible } from './totalVisibility';

it('inherits the field visibility unless explicitly overridden for totals', () => {
  expect(isTotalFieldVisible('price', ['price'])).toBe(false);
  expect(isTotalFieldVisible('price', [])).toBe(true);
  expect(isTotalFieldVisible('price', ['price'], { price: true })).toBe(true);
  expect(isTotalFieldVisible('price', [], { price: false })).toBe(false);
});
