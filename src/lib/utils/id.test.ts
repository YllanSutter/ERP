import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateId } from './id';
import { createTemporaryRelationView } from '../views/temporaryRelationView';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('identifiers across deployment environments', () => {
  it('uses randomUUID when it is available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-from-browser' });
    expect(generateId()).toBe('uuid-from-browser');
  });
  it('uses getRandomValues without requiring randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => { bytes.fill(1); return bytes; } });
    expect(generateId()).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    expect(() => createTemporaryRelationView()).not.toThrow();
  });
  it.each([undefined, {}])('opens filtered views without Web Crypto (%s)', cryptoValue => {
    vi.stubGlobal('crypto', cryptoValue);
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const first = createTemporaryRelationView();
    const second = createTemporaryRelationView();
    expect(first.id).toMatch(/^temporary-relation-/);
    expect(first.id).not.toBe(second.id);
    expect(first.filters).toEqual([]);
  });
});
