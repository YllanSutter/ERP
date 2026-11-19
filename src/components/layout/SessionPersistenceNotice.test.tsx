import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { SessionPersistenceNotice } from './SessionPersistenceNotice';
const state = vi.hoisted(() => ({ pending: false }));
vi.mock('@/lib/databaseStorage', () => ({ subscribeDatabaseStorage: () => () => {}, hasUnsavedDatabaseChanges: () => state.pending }));
vi.mock('react', async importOriginal => ({ ...await importOriginal<typeof import('react')>(), useSyncExternalStore: (_subscribe: unknown, snapshot: () => boolean) => snapshot() }));
it('does not warn against closing a tab when the database has acknowledged all changes', () => {
  state.pending = false;
  const html = renderToStaticMarkup(<SessionPersistenceNotice />);
  expect(html).toContain('Les données déjà enregistrées sont conservées en base.');
  expect(html).not.toContain('Gardez cet onglet ouvert');
});
it('explains that pending changes still need the original tab', () => {
  state.pending = true;
  expect(renderToStaticMarkup(<SessionPersistenceNotice />)).toContain('Gardez cet onglet ouvert');
});
