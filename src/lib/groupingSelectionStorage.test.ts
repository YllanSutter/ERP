import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GROUPING_SELECTION_CHANGE_EVENT,
  saveGroupFieldSelection,
  saveGroupingSelection,
} from './groupingSelectionStorage';

describe('group selection synchronization', () => {
  let values: Map<string, string>;
  let events: EventTarget;
  let dispatch: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    values = new Map();
    events = new EventTarget();
    dispatch = vi.fn((event: Event) => events.dispatchEvent(event));
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
      dispatchEvent: dispatch,
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('does not echo an unchanged selection back into mounted views indefinitely', () => {
    let updates = 0;
    events.addEventListener(GROUPING_SELECTION_CHANGE_EVENT, (event) => {
      const { key, value } = (event as CustomEvent).detail;
      updates += 1;
      // Mirrors the table: applying a received choice triggers its persistence effect.
      if (updates < 10) saveGroupingSelection(key, value);
    });
    saveGroupingSelection('root-select', '{"0":"2026","1":"2026/Octobre"}');
    expect(updates).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('notifies views when a choice actually changes', () => {
    saveGroupingSelection('root-select', 'Octobre');
    saveGroupingSelection('root-select', 'Novembre');
    expect(values.get('root-select')).toBe('Novembre');
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('does not rebroadcast identical collection-level field selections', () => {
    saveGroupFieldSelection('games', 'month', '2026/Octobre');
    saveGroupFieldSelection('games', 'month', '2026/Octobre');
    expect(dispatch).toHaveBeenCalledTimes(1);
    saveGroupFieldSelection('games', 'month', '2026/Novembre');
    expect(dispatch).toHaveBeenCalledTimes(2);
  });
});
