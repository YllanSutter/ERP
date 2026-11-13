import React, * as ReactModule from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ColorPicker from './ColorPicker';

vi.mock('react', { spy: true });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup(saved = '[]', value = '#abc') {
  const localStorage = { getItem: vi.fn(() => saved), setItem: vi.fn() };
  vi.stubGlobal('window', { localStorage });
  vi.mocked(ReactModule.useState).mockImplementation((initial?: any) => [typeof initial === 'function' ? initial() : initial, vi.fn()] as any);
  vi.mocked(ReactModule.useEffect).mockImplementation(() => {});
  const onChange = vi.fn();
  const tree = ColorPicker({ value, onChange });
  const nodes: React.ReactElement<any>[] = [];
  const visit = (node: React.ReactNode) => React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    nodes.push(child);
    visit((child.props as any).children);
  });
  visit(tree);
  return { nodes, onChange, localStorage };
}

describe('shared color picker', () => {
  it('offers a free color selector alongside the palette', () => {
    const html = renderToStaticMarkup(<ColorPicker value="#8b5cf6" onChange={() => {}} />);
    expect(html).toContain('type="color"');
    expect(html).toContain('Code hexadécimal');
    expect(html).toContain('Palette');
    expect(html).toContain('type="button"');
  });
  it('normalizes hex input and records it without duplicate recent colors', () => {
    const { nodes, onChange, localStorage } = setup('["#aabbcc","#123456"]');
    nodes.find((node) => node.props.type === 'text')!.props.onBlur();
    expect(onChange).toHaveBeenCalledWith('#aabbcc');
    expect(JSON.parse(localStorage.setItem.mock.calls[0][1])).toEqual(['#aabbcc', '#123456']);
  });
  it('applies free colors and remembers the final selection', () => {
    const { nodes, onChange, localStorage } = setup();
    const input = nodes.find((node) => node.props.type === 'color')!;
    input.props.onChange({ target: { value: '#112233' } });
    expect(onChange).toHaveBeenCalledWith('#112233');
    input.props.onBlur({ target: { value: '#112233' } });
    expect(JSON.parse(localStorage.setItem.mock.calls[0][1])).toEqual(['#112233']);
  });
  it('ignores invalid hex input and tolerates unavailable storage', () => {
    const { nodes, onChange, localStorage } = setup('invalid json', '#zzzzzz');
    nodes.find((node) => node.props.type === 'text')!.props.onBlur();
    expect(onChange).not.toHaveBeenCalled();
    localStorage.setItem.mockImplementation(() => { throw new Error('Unavailable'); });
    nodes.find((node) => node.props['aria-label'] === 'Violet')!.props.onClick();
    expect(onChange).toHaveBeenCalledWith('#8b5cf6');
  });
});
