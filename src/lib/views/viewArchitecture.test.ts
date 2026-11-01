import { afterEach, describe, expect, it } from 'vitest';
import {
  getPluginViewRegistrations,
  registerPluginView,
  unregisterPluginViews,
} from './pluginViewRegistry';
import { createDefaultViewConfig, getViewRegistration } from './viewRegistry';
import { migrateViewConfig } from './viewConfigMigration';
import type { ViewRegistration } from './viewTypes';

const pluginRegistration: ViewRegistration = {
  type: 'test-plugin-view',
  label: 'Test plugin view',
  pluginId: 'architecture-test-plugin',
  capabilities: {
    supportsGrouping: false,
    supportsSorting: false,
    supportsInlineEditing: false,
    supportsDragAndDrop: false,
    supportsMultiCollection: false,
    supportsNestedViews: false,
    supportsSelection: false,
  },
  createDefaultConfig: (id, collectionId) => ({
    id,
    name: 'Test plugin view',
    type: 'test-plugin-view',
    collectionId,
  }),
};

afterEach(() => {
  unregisterPluginViews('architecture-test-plugin');
});

describe('view architecture contracts', () => {
  it('resolves native renderers and falls back to table for unknown types', () => {
    expect(getViewRegistration('cards').label).toBe('Cartes');
    expect(getViewRegistration('cards').capabilities.supportsSelection).toBe(true);
    expect(getViewRegistration('cards').capabilities.supportsDragAndDrop).toBe(true);
    expect(getViewRegistration('unknown-view').type).toBe('table');
  });

  it('registers and removes plugin views through the shared registry', () => {
    registerPluginView('architecture-test-plugin', pluginRegistration);

    expect(getViewRegistration('test-plugin-view')).toBe(pluginRegistration);
    expect(getPluginViewRegistrations()).toContain(pluginRegistration);

    unregisterPluginViews('architecture-test-plugin');
    expect(getViewRegistration('test-plugin-view').type).toBe('table');
  });

  it('migrates legacy card style fields without losing view identity', () => {
    const migrated = migrateViewConfig({
      id: 'cards-1',
      name: 'Cartes',
      type: 'cards',
      collectionId: 'collection-1',
      cardStyleFieldId: 'legacy-style',
    });

    expect(migrated.cardColorFieldId).toBe('legacy-style');
    expect(migrated.cardStyle).toBe('default');
    expect(migrated.cardGroupPlacements).toEqual({});
    expect(migrated.configVersion).toBe(2);
  });

  it('keeps standard and full-art card defaults distinct', () => {
    expect(createDefaultViewConfig('cards', 'cards-1', 'collection-1').cardStyle).toBe('default');
    expect(createDefaultViewConfig('steamcards', 'cards-2', 'collection-1').cardStyle).toBe('steamFullArt');
  });
});
