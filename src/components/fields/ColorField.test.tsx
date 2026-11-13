import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import ColorField from './ColorField';

it('displays a color swatch and its value in read-only fields', () => {
  const html = renderToStaticMarkup(<ColorField value="#abc" onChange={vi.fn()} readOnly />);
  expect(html).toContain('#aabbcc');
  expect(html).toContain('background-color:#aabbcc');
  expect(html).not.toContain('<button');
});
it('provides an editable trigger and keeps an empty color unset', () => {
  const html = renderToStaticMarkup(<ColorField value={null} onChange={vi.fn()} />);
  expect(html).toContain('Modifier la couleur');
  expect(html).toContain('Aucune couleur');
});
