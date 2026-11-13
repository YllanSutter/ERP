import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TotalsSettings } from './TotalsSettings';
import ViewTotalsSettings from './ViewTotalsSettings';
import { resolveTotalsScope } from './totalsScope';

const properties = [{ id: 'price', name: 'Prix', type: 'number' }, { id: 'status', name: 'Statut', type: 'text' }] as any;
function descendants(node: React.ReactNode): React.ReactElement<any>[] {
  if (!React.isValidElement(node)) return Array.isArray(node) ? node.flatMap(descendants) : [];
  return [node, ...React.Children.toArray((node.props as any).children).flatMap(descendants)];
}

describe('view totals settings without groups', () => {
  it('saves position and changes one field while preserving the others', () => {
    const onChange = vi.fn();
    const nodes = descendants(TotalsSettings({ properties, totalFields: { price: 'sum', status: 'count' }, position: 'bottom', onChange }));
    nodes.find((node) => node.props.label === 'Position des totaux')!.props.onChange('both');
    expect(onChange).toHaveBeenLastCalledWith({ totalsPosition: 'both' });
    const price = nodes.find((node) => node.props['aria-label'] === 'Total · Prix')!;
    price.props.onChange('avg');
    expect(onChange).toHaveBeenLastCalledWith({ totalFields: { price: 'avg', status: 'count' } });
    price.props.onChange('none');
    expect(onChange).toHaveBeenLastCalledWith({ totalFields: { status: 'count' } });
    expect(nodes.find((node) => node.props['aria-label'] === 'Total · Statut')!.props.options.some(({ value }: any) => value === 'sum')).toBe(false);
  });
  it('shows field names once and keeps custom calculations', () => {
    const html = renderToStaticMarkup(<TotalsSettings properties={properties} totalFields={{ price: 'number-filter:sum:status:Done' }} position="both" onChange={() => {}} />);
    expect(html).toContain('Champs à totaliser');
    expect(html).toContain('Calcul personnalisé');
    expect(html).toContain('1 actifs');
  });
});

describe('scope and group total settings', () => {
  it('does not implicitly add a general total to legacy grouped views', () => {
    expect(resolveTotalsScope(undefined, true)).toBe('groups');
    expect(resolveTotalsScope(undefined, true, 'top')).toBe('both');
    expect(resolveTotalsScope('view', true, 'bottom')).toBe('view');
    expect(resolveTotalsScope('groups', false)).toBe('view');
  });
  it('updates one group without overwriting others', () => {
    const onUpdate = vi.fn();
    const view = { id: 'view', name: 'Table', type: 'table', groups: ['status', 'price'], totalsScope: 'groups', groupTotalsByGroupId: { status: { enabled: true }, price: { position: 'both' } } } as any;
    const nodes = descendants(ViewTotalsSettings({ view, properties, onUpdate }));
    nodes.find((node) => node.props['aria-label'] === 'Position du sous-total niveau 1')!.props.onChange('top');
    expect(onUpdate).toHaveBeenCalledWith({ groupTotalsByGroupId: { status: { enabled: true, position: 'top' }, price: { position: 'both' } } });
    expect(nodes.find((node) => node.type === TotalsSettings)!.props.showPosition).toBe(false);
    const globalNodes = descendants(ViewTotalsSettings({ view: { ...view, totalsScope: 'view', totalsAlwaysVisible: true }, properties, onUpdate }));
    expect(globalNodes.some((node) => node.props['aria-label'] === 'Position du sous-total niveau 1')).toBe(false);
  });
});

it('starts the always-visible checkbox unchecked and saves the explicit choice', () => {
  const onUpdate = vi.fn();
  const nodes = descendants(ViewTotalsSettings({ view: { id: 'table', name: 'Table', type: 'table', groups: ['status'] }, properties, onUpdate }));
  const checkbox = nodes.find((node) => node.props.type === 'checkbox')!;
  expect(checkbox.props.checked).toBe(false);
  checkbox.props.onChange({ target: { checked: true } });
  expect(onUpdate).toHaveBeenCalledWith({ totalsAlwaysVisible: true, totalsScope: 'both' });
});
