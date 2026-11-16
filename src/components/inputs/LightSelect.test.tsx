import React, * as ReactModule from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { LightSelect } from './LightSelect';
import { PopoverAnchor, PopoverTrigger } from '@/components/ui/popover';

vi.mock('react', { spy: true });
afterEach(() => vi.restoreAllMocks());
function descendants(node: React.ReactNode): React.ReactElement[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement(child)
    ? [child, ...descendants((child.props as { children?: React.ReactNode }).children)] : []);
}

it.each([
  { value: '' },
  { value: 'Dev' },
  { multiple: true as const, values: [] },
  { multiple: true as const, values: ['Dev'] },
])('keeps one stable field anchor and one trigger with selection %j', selection => {
  vi.mocked(ReactModule.useState).mockImplementation(((initial: unknown) => [typeof initial === 'function' ? initial() : initial, vi.fn()]) as unknown as typeof ReactModule.useState);
  vi.mocked(ReactModule.useRef).mockReturnValue({ current: null });
  const tree = LightSelect({ options: ['Dev'], onChange: vi.fn(), ...selection });
  const elements = descendants(tree);
  expect(elements.filter(element => element.type === PopoverAnchor)).toHaveLength(1);
  expect(elements.filter(element => element.type === PopoverTrigger)).toHaveLength(1);
  const anchor = elements.find(element => element.type === PopoverAnchor)!;
  expect(descendants(anchor).some(element => element.type === PopoverTrigger)).toBe(true);
});
