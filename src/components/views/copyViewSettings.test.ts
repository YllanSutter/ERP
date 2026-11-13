import { describe, expect, it } from 'vitest';
import { copyViewSettings, type CopySelection } from './copyViewSettings';
const only = (key: keyof CopySelection): CopySelection => ({ filters: false, groups: false, totals: false, settings: false, [key]: true });
const source = {
  id: 'source', name: 'Source', type: 'table', visibleToUsers: ['someone'],
  filters: [{ property: 'price', operator: 'gt', value: 10 }], groups: ['status'],
  totalFields: { price: 'sum' }, totalsPosition: 'both', totalsAlwaysVisible: true,
  groupTotalsByGroupId: { status: { enabled: true, position: 'bottom' } },
  hiddenFields: ['note'], fieldOrder: ['price', 'status'],
};
const target = { id: 'target', name: 'Target', type: 'table' };

describe('copy selected view categories', () => {
  it('copies only filters without identity, access rights or other categories', () => {
    const patch = copyViewSettings(source, target, only('filters'));
    expect(patch).toEqual({ filters: source.filters });
    (patch.filters as any[])[0].value = 99;
    expect(source.filters[0].value).toBe(10);
  });
  it('copies totals together with the per-level configuration and visibility choice', () => {
    const patch = copyViewSettings(source, target, only('totals'));
    expect(patch.totalFields).toEqual(source.totalFields);
    expect(patch.totalsAlwaysVisible).toBe(true);
    expect(patch.groupTotalsByGroupId).toEqual(source.groupTotalsByGroupId);
    expect(patch).not.toHaveProperty('groups');
    expect(patch).not.toHaveProperty('hiddenFields');
  });
  it('clears destination settings when the source uses defaults', () => {
    const patch = copyViewSettings(target, source, only('totals'));
    expect(patch.totalFields).toEqual({});
    expect(patch.totalsAlwaysVisible).toBe(false);
    expect(patch.totalsPosition).toBe('bottom');
    expect(patch.groupTotalsByGroupId).toEqual({});
  });
  it('adapts grouping between table and Kanban', () => {
    expect(copyViewSettings(source, { ...target, type: 'kanban' }, only('groups')).groupBy).toBe('status');
    expect(copyViewSettings({ ...target, type: 'kanban', groupBy: 'status' }, source, only('groups')).groups).toEqual(['status']);
  });
  it('keeps unselected per-column settings while copying totals', () => {
    const src = { ...source, type: 'kanban', kanbanColumnSettings: { status: { A: { visibleFieldIds: ['note'], totalFields: { price: 'avg' }, showTotals: false } } } };
    const dst = { ...target, type: 'kanban', kanbanColumnSettings: { status: { A: { visibleFieldIds: ['price'], totalFields: { price: 'sum' }, sortFieldId: 'price' }, B: { showTotals: false, visibleFieldIds: ['note'] } } } };
    const patch = copyViewSettings(src, dst, only('totals'));
    expect(patch.kanbanColumnSettings).toEqual({ status: { A: { visibleFieldIds: ['price'], sortFieldId: 'price', totalFields: { price: 'avg' }, showTotals: false }, B: { visibleFieldIds: ['note'] } } });
    expect(dst.kanbanColumnSettings.status.A.totalFields.price).toBe('sum');
  });
  it('copies common parameters across types without changing the view type', () => {
    const patch = copyViewSettings(source, { ...target, type: 'kanban' }, only('settings'));
    expect(patch.hiddenFields).toEqual(['note']);
    expect(patch.fieldOrder).toEqual(['price', 'status']);
    expect(patch).not.toHaveProperty('type');
    expect(patch).not.toHaveProperty('totalFields');
    expect(patch).not.toHaveProperty('groups');
  });
});
