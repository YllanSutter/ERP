import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import ItemSearchResults from './ItemSearchResults';

vi.mock('@/components/ui/command', () => ({
  CommandGroup: ({ children }: any) => <section>{children}</section>,
  CommandItem: ({ children }: any) => <div>{children}</div>,
  CommandShortcut: ({ children }: any) => <span>{children}</span>,
}));
const collection = { id: 'projects', name: 'Projets', properties: [{ id: 'title', name: 'Nom' }], items: [
  { id: 'old', title: 'Étude ancienne', createdAt: '2026-01-01' },
  { id: 'new', title: 'Étude récente', createdAt: '2026-11-01' },
  { id: 'other', title: 'Facture', createdAt: '2026-11-02' },
] };
it('uses accent-insensitive multi-word search and lists newest matches first', () => {
  const html = renderToStaticMarkup(<ItemSearchResults collections={[collection]} query="etude projets" onSelectItem={vi.fn()} />);
  expect(html).toContain('Étude ancienne');
  expect(html).toContain('Étude récente');
  expect(html.indexOf('Étude récente')).toBeLessThan(html.indexOf('Étude ancienne'));
  expect(html).not.toContain('Facture');
});
it('shows recent items from only the supplied collection', () => {
  const html = renderToStaticMarkup(<ItemSearchResults collections={[collection]} query="" onSelectItem={vi.fn()} />);
  expect(html.indexOf('Facture')).toBeLessThan(html.indexOf('Étude récente'));
  expect(html).not.toContain('Sans titre');
});
