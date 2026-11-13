import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TotalsSurface from './TotalsSurface';

const props = {
  displayProperties: [{ id: 'price', name: 'Prix', type: 'number' }, { id: 'quantity', name: 'Quantité', type: 'number' }, { id: 'status', name: 'Statut', type: 'select' }] as any,
  items: [{ id: '1', price: 20, quantity: 2, status: 'A' }],
  totalFields: { price: 'sum', quantity: 'sum' },
  calculateTotal: (id: string) => id === 'price' ? 20 : 2,
  formatTotal: (_: string, value: number) => String(value),
};
describe('shared totals surface', () => {
  it('uses the existing modules on top and only the selected metrics', () => {
    const html = renderToStaticMarkup(<TotalsSurface {...props} position="top" />);
    expect(html).toContain('title="Cartes"');
    expect(html).toContain('title="Tableau"');
    expect(html).not.toContain('>Statut<');
    expect(html).toContain('Prix');
    expect(html).toContain('Quantité');
  });
  it('allows two Kanban summaries to share a row with flexible sizing', () => {
    const html = renderToStaticMarkup(<TotalsSurface {...props} position="bottom" compact />);
    expect(html).toContain('flex-wrap');
    expect(html.match(/flex-\[1_1_120px\]/g)).toHaveLength(2);
    expect(html).not.toContain('min-w-[150px]');
    expect(html).not.toContain('Réglages des totaux');
  });
  it('does not show an empty summary', () => {
    expect(renderToStaticMarkup(<TotalsSurface {...props} position="bottom" items={[]} />)).toBe('');
    expect(renderToStaticMarkup(<TotalsSurface {...props} position="top" totalFields={{}} />)).toBe('');
  });
});
