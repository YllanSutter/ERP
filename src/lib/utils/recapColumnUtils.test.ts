import { describe, expect, it } from 'vitest';
import { buildRecapHeaderRows, computeLeafCell, getLeafCellItems, type LeafColumn, type PeriodRow } from './recapColumnUtils';
import type { Item, Property } from '@/lib/types';

const dateField = { id: 'dates', name: 'Dates', type: 'date_range' } as unknown as Property;
const item = {
  id: 'item',
  dates: { start: '2026-05-31T22:00:00', end: '2026-06-01T02:00:00' },
  amount: 120,
} as Item;
const leaf: LeafColumn = { id: 'leaf', label: 'Objets', filterChain: [], displayType: 'count' };

function period(start: string, end: string): PeriodRow {
  return { key: start, label: '', sublabel: '', start: new Date(start), end: new Date(end) };
}

const may = period('2026-05-01T00:00:00', '2026-05-31T23:59:59.999');
const june = period('2026-06-01T00:00:00', '2026-06-30T23:59:59.999');
const sunday = period('2026-05-31T00:00:00', '2026-05-31T23:59:59.999');
const monday = period('2026-06-01T00:00:00', '2026-06-01T23:59:59.999');
const assignment = () => new Date('2026-06-01T00:00:00').getTime();

describe('récap du dashboard', () => {
  it('conserve le comptage annuel par date de début et la durée répartie par défaut', () => {
    const duration = { ...leaf, displayType: 'duration' as const };
    expect(computeLeafCell([item], leaf, may, dateField, [])).toBe(1);
    expect(computeLeafCell([item], leaf, june, dateField, [])).toBe(0);
    expect(computeLeafCell([item], duration, sunday, dateField, [])).toBeCloseTo(120);
    expect(computeLeafCell([item], duration, monday, dateField, [])).toBeCloseTo(120);
  });

  it('déplace le compte, la somme et la durée vers la même période', () => {
    const duration = { ...leaf, displayType: 'duration' as const };
    const amount = { ...leaf, displayType: 'sum' as const, aggregationField: 'amount' };

    for (const [column, value] of [[leaf, 1], [amount, 120], [duration, 240]] as const) {
      for (const row of [sunday, may]) {
        expect(getLeafCellItems([item], column, row, dateField, [], assignment)).toEqual([]);
        expect(computeLeafCell([item], column, row, dateField, [], assignment)).toBe(0);
      }
      for (const row of [monday, june]) {
        expect(getLeafCellItems([item], column, row, dateField, [], assignment)).toEqual([item]);
        expect(computeLeafCell([item], column, row, dateField, [], assignment)).toBe(value);
      }
    }
  });
});

it('aligne les limites des groupes sur leurs dernières colonnes visibles', () => {
  const rows = buildRecapHeaderRows([
    {
      id: 'production',
      label: 'Production',
      children: [
        { id: 'rn', label: 'RN', displayTypes: ['count', 'duration'] },
        { id: 'nb', label: 'NB', displayTypes: ['count'] },
      ],
    },
    { id: 'modifs', label: 'Modifs', displayTypes: ['count'] },
  ], []);

  expect(rows[0].map((cell) => cell.lastLeafIndex)).toEqual([2, 3]);
  expect(rows[1].map((cell) => cell.lastLeafIndex)).toEqual([1, 2]);
});
