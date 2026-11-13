import React, * as ReactModule from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomTotalForm } from './CustomTotalSettings';
import { TotalsSettings } from './TotalsSettings';
import { useViewTotals } from '@/lib/hooks/useViewTotals';

vi.mock('react', { spy: true });
afterEach(() => vi.restoreAllMocks());
const properties = [
  { id: 'price', name: 'Prix', type: 'number' }, { id: 'status', name: 'Statut', type: 'select', options: ['À faire', 'Fini'] },
  { id: 'paid', name: 'Payé', type: 'checkbox' },
] as any;
function form(property: any, value: string) {
  vi.mocked(ReactModule.useState).mockImplementation((initial?: any) => [typeof initial === 'function' ? initial() : initial, vi.fn()] as any);
  vi.mocked(ReactModule.useId).mockReturnValue('test');
  const onApply = vi.fn();
  const nodes: React.ReactElement<any>[] = [];
  const visit = (node: React.ReactNode) => React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    nodes.push(child);
    visit((child.props as any).children);
  });
  visit(CustomTotalForm({ property, properties, value, onApply }));
  return { nodes, onApply };
}

describe('custom total editor', () => {
  it('offers custom calculations even when the field currently uses a basic sum', () => {
    const html = renderToStaticMarkup(<TotalsSettings properties={properties} totalFields={{ price: 'sum' }} position="bottom" onChange={() => {}} />);
    expect(html).toContain('Calcul personnalisé · Prix');
    expect(html).toContain('Calcul personnalisé · Payé');
  });
  it('restores and reapplies filtered calculations without losing the excluded value', () => {
    const value = `number-filter:avg:status:${encodeURIComponent('Été: fini / oui')}`;
    const { nodes, onApply } = form(properties[0], value);
    expect(nodes.find((node) => node.props['aria-label'] === 'Valeur à exclure')!.props.value).toBe('Été: fini / oui');
    nodes.find((node) => node.props.children === 'Appliquer le calcul')!.props.onClick();
    expect(onApply).toHaveBeenCalledWith(value);
  });
  it('restores the paid / remaining calculation for checkboxes', () => {
    const { nodes, onApply } = form(properties[2], 'linked-progress:price');
    nodes.find((node) => node.props.children === 'Appliquer le calcul')!.props.onClick();
    expect(onApply).toHaveBeenCalledWith('linked-progress:price');
  });
  it('uses the existing calculation rules for exclusions and paid / remaining totals', () => {
    function Probe() {
      const { calculateTotal } = useViewTotals(properties, { id: 'collection', properties, items: [], name: 'Test' }, []);
      const items = [{ price: 10, status: 'Fini', paid: true }, { price: 30, status: 'À faire', paid: false }];
      return <div>{JSON.stringify({ filtered: calculateTotal('price', items, 'number-filter:sum:status:Fini'), progress: calculateTotal('paid', items, 'linked-progress:price') })}</div>;
    }
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain('&quot;filtered&quot;:30');
    expect(html).toContain('&quot;paid&quot;:10');
    expect(html).toContain('&quot;remaining&quot;:30');
  });
});
