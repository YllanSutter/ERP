import { describe, expect, it } from 'vitest';
import { getLayoutEntries, moveLayoutEntry } from '@/components/views/layoutOrder';

const layout = {
  id: 'layout',
  name: 'Layout',
  type: 'layout',
  layoutPanels: [{ id: 'calendar', viewId: 'calendar' }, { id: 'sites', viewId: 'sites' }],
  layoutModules: [{ id: 'metric', type: 'metric' }],
};

describe('layout order', () => {
  it('preserves the original order for existing layouts', () => {
    expect(getLayoutEntries(layout).order).toEqual(['panel:calendar', 'panel:sites', 'module:metric']);
  });

  it('moves modules past views and preserves that order after changes', () => {
    const order = getLayoutEntries(layout).order;
    const layoutOrder = moveLayoutEntry(moveLayoutEntry(order, 2, -1), 1, -1);
    expect(layoutOrder).toEqual(['module:metric', 'panel:calendar', 'panel:sites']);
    expect(getLayoutEntries({
      ...layout,
      layoutOrder,
      layoutPanels: [{ id: 'sites', viewId: 'sites' }, { id: 'list', viewId: 'list' }],
    }).order).toEqual(['module:metric', 'panel:sites', 'panel:list']);
  });
});
