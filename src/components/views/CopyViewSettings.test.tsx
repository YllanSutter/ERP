import React, * as ReactModule from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CopyViewSettings from './CopyViewSettings';

vi.mock('react', { spy: true });
afterEach(() => vi.restoreAllMocks());
const view = { id: 'target', name: 'Current', type: 'table' };
const source = { id: 'source', name: 'Other', type: 'table', filters: [{ property: 'price', value: 10 }] };

it('offers the copy checkbox disabled by default', () => {
  const html = renderToStaticMarkup(<CopyViewSettings view={view} views={[view, source]} onUpdate={vi.fn()} />);
  expect(html).toContain('Copier les paramètres d’une autre vue');
  expect(html).not.toContain('checked=""');
  expect(html).not.toContain('Copier les catégories cochées');
});
it('only applies selected categories after the copy button is clicked', () => {
  vi.mocked(ReactModule.useState)
    .mockReturnValueOnce([true, vi.fn()])
    .mockReturnValueOnce(['source', vi.fn()])
    .mockReturnValueOnce([{ filters: true, groups: false, totals: false, settings: false }, vi.fn()])
    .mockReturnValueOnce([false, vi.fn()]);
  const onUpdate = vi.fn();
  const tree = CopyViewSettings({ view, views: [view, source], onUpdate });
  const nodes: React.ReactElement<any>[] = [];
  const visit = (node: React.ReactNode) => React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    nodes.push(child);
    visit((child.props as any).children);
  });
  visit(tree);
  expect(onUpdate).not.toHaveBeenCalled();
  const selector = nodes.find((node) => node.props['aria-label'] === 'Vue source')!;
  expect(selector.props.options).toEqual([{ value: 'source', label: 'Other' }]);
  nodes.find((node) => node.props.children === 'Copier les catégories cochées')!.props.onClick();
  expect(onUpdate).toHaveBeenCalledWith({ filters: source.filters });
});
