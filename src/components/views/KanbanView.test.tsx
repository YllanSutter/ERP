import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import KanbanView from './KanbanView';

vi.mock('@/lib/hooks/useCanEdit', () => ({
  useCanEdit: () => true,
  useCanEditFields: () => () => true,
  useCanViewFields: () => () => true,
}));
vi.mock('@/components/menus/ItemContextMenu', () => ({ default: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/fields/EditableProperty', () => ({ default: ({ property }: any) => <span>{property.name}</span> }));

const collection = {
  id: 'collection', name: 'Achats', properties: [
    { id: 'name', name: 'Nom', type: 'text', showContextMenu: true },
    { id: 'status', name: 'Statut', type: 'select', options: ['À acheter'] },
    { id: 'price', name: 'Prix', type: 'number', numberSuffix: ' €' },
    { id: 'tags', name: 'Tag', type: 'multiselect', options: ['Anniversaire'] },
  ],
};
const item = { id: '1', name: 'Armagnac', status: 'À acheter', price: 35, tags: ['Anniversaire'] };

describe('Kanban card presentation', () => {
  it('keeps actions inside the header and shows compact previews instead of field controls', () => {
    const html = renderToStaticMarkup(<KanbanView collection={collection} items={[item]} groupBy="status"
      collections={[]} onEdit={() => {}} onDelete={() => {}} onViewDetail={() => {}} />);
    expect(html).toContain('Armagnac');
    expect(html).toContain('Champs de Armagnac');
    expect(html).toContain('Supprimer l’élément');
    expect(html).toContain('35 €');
    expect(html).toContain('Anniversaire');
    expect(html).not.toContain('-top-7');
    expect(html).not.toContain('Augmenter');
    expect(html).not.toContain('Diminuer');
    expect(html).not.toContain('>Éditer<');
  });
});
