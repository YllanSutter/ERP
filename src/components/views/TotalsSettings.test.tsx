import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { TotalsSettings } from './TotalsSettings';

const properties = [{ id: 'price', name: 'Prix', type: 'number' }, { id: 'status', name: 'Statut', type: 'text' }] as any;

describe('view totals settings without groups', () => {
  it('saves position and changes one field while preserving the others', () => {
    const onChange = vi.fn();
    const element = TotalsSettings({ properties, totalFields: { price: 'sum', status: 'count' }, position: 'bottom', onChange });
    const [position, fields] = element.props.children;
    position.props.onChange('both');
    expect(onChange).toHaveBeenLastCalledWith({ totalsPosition: 'both' });
    fields[0].props.onChange('avg');
    expect(onChange).toHaveBeenLastCalledWith({ totalFields: { price: 'avg', status: 'count' } });
    fields[0].props.onChange('none');
    expect(onChange).toHaveBeenLastCalledWith({ totalFields: { status: 'count' } });
    expect(fields[1].props.options.some(({ value }: any) => value === 'sum')).toBe(false);
  });
});
