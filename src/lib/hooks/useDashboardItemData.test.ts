import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DashboardModuleConfig } from '@/lib/dashboardTypes';
import type { Collection } from '@/lib/types';
import { getAssignmentKey } from '@/lib/utils/recapAssignments';
import { useDashboardItemData } from './useDashboardItemData';

describe('dashboard metric count', () => {
  it('uses the recap date and counts a site only in its assigned month', () => {
    const module: DashboardModuleConfig = {
      id: 'metric',
      type: 'metric',
      collectionId: 'sites',
      layout: { w: 4, h: 400, order: 0 },
    };
    const collection = {
      id: 'sites',
      name: 'Sites',
      properties: [
        { id: 'created', name: 'Création', type: 'date' },
        { id: 'work', name: 'Temps dev', type: 'date_range' },
      ],
      items: [{
        id: 'pt',
        created: '2026-09-25',
        work: [
          { start: '2026-10-30T08:30:00', end: '2026-10-30T16:00:00' },
          { start: '2026-11-02T08:00:00', end: '2026-11-02T11:00:00' },
        ],
      }],
    } as Collection;
    const key = getAssignmentKey('sites', 'pt', 'work');

    function count(start: string, end: string, assigned?: string) {
      function Metric() {
        const data = useDashboardItemData(
          module,
          [collection],
          { preset: 'custom', start, end },
          assigned ? { [key]: assigned } : {},
          'work'
        );
        return createElement('span', null, data.filteredItems.length);
      }
      return renderToStaticMarkup(createElement(Metric));
    }

    expect(count('2026-10-01', '2026-10-31T23:59:59')).toBe('<span>1</span>');
    expect(count('2026-11-01', '2026-11-30T23:59:59')).toBe('<span>0</span>');
    expect(count('2026-10-01', '2026-10-31T23:59:59', '2026-11-02')).toBe('<span>0</span>');
    expect(count('2026-11-01', '2026-11-30T23:59:59', '2026-11-02')).toBe('<span>1</span>');
  });
});

describe('layout module periods', () => {
  it('includes overlapping work ranges and the entire last day of a custom period', () => {
    const module: DashboardModuleConfig = {
      id: 'metric',
      type: 'metric',
      collectionId: 'sites',
      dateField: 'work',
      metricAggregation: 'sum',
      metricField: 'hours',
      layout: { w: 4, h: 200, order: 0 },
    };
    const collection = {
      id: 'sites',
      name: 'Sites',
      properties: [
        { id: 'created', name: 'Création', type: 'date' },
        { id: 'work', name: 'Temps dev', type: 'date_range' },
      ],
      items: [
        { id: 'overlap', work: [{ start: '2026-10-31T18:00:00', end: '2026-11-01T09:00:00' }] },
        { id: 'last-day', work: [{ start: '2026-11-30T18:00:00', end: '2026-11-30T19:00:00' }] },
        { id: 'outside', work: [{ start: '2026-12-01T08:00:00', end: '2026-12-01T09:00:00' }] },
      ],
    } as Collection;

    function Metric() {
      const { filteredItems } = useDashboardItemData(module, [collection], {
        preset: 'custom',
        start: '2026-11-01',
        end: '2026-11-30',
        matchIntervals: true,
      });
      return createElement('span', null, filteredItems.map(({ id }) => id).join(','));
    }

    expect(renderToStaticMarkup(createElement(Metric))).toBe('<span>overlap,last-day</span>');
  });
});
