import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { PinnedFieldsHeader, PinnedFieldsSettings } from './PinnedItemFields';

it('keeps pinned fields editable outside tab content and exposes unpin actions', () => {
  const onUnpin = vi.fn();
  const renderField = vi.fn((property: any) => <input aria-label={property.name} defaultValue="Oui" />);
  const properties = [{ id: 'status', name: 'Statut' }, { id: 'price', name: 'Prix' }];
  const tree = PinnedFieldsHeader({ properties, onUnpin, renderField })!;
  const html = renderToStaticMarkup(tree);
  expect(html).toContain('aria-label="Statut"');
  expect(html).toContain('aria-label="Prix"');
  expect(html).not.toContain('tabpanel');
  const cards = React.Children.toArray(tree.props.children) as React.ReactElement<any>[];
  const button = React.Children.toArray(cards[0].props.children)[2] as React.ReactElement<any>;
  expect(cards[0].props.className).toContain('items-center');
  expect(html).toContain('whitespace-nowrap');
  button.props.onClick();
  expect(onUnpin).toHaveBeenCalledWith('status');
});

it('offers a per-field choice to keep the original location', () => {
  const onChange = vi.fn();
  const tree = PinnedFieldsSettings({ properties: [{ id: 'status', name: 'Statut' }], fields: [{ id: 'status', keepOriginal: false }], onChange });
  const elements: React.ReactElement<any>[] = [];
  const visit = (node: React.ReactNode) => React.Children.forEach(node, child => {
    if (!React.isValidElement(child)) return;
    elements.push(child);
    visit((child.props as any).children);
  });
  visit(tree);
  const inputs = elements.filter(element => element.type === 'input');
  expect(inputs.map(input => input.props.checked)).toEqual([true, false]);
  inputs[1].props.onChange({ target: { checked: true } });
  expect(onChange).toHaveBeenCalledWith('status', true, true);
  inputs[0].props.onChange({ target: { checked: false } });
  expect(onChange).toHaveBeenLastCalledWith('status', false);
});
