import type { ViewDefinition } from './viewTypes';

const CURRENT_VIEW_CONFIG_VERSION = 1;

export function migrateViewConfig(input: ViewDefinition): ViewDefinition {
  const config = { ...input };
  const legacyCardField = config.cardStyleFieldId;

  if (
    (config.type === 'steamcards' || config.type === 'cards') &&
    typeof config.cardColorFieldId !== 'string' &&
    typeof legacyCardField === 'string'
  ) {
    config.cardColorFieldId = legacyCardField;
  }

  config.configVersion = CURRENT_VIEW_CONFIG_VERSION;
  return config;
}

export { CURRENT_VIEW_CONFIG_VERSION };
