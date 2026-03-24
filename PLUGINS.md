# Architecture des Plugins

## Vue d'ensemble

Le système de plugins permet d'ajouter des fonctionnalités modulaires activables par organisation. Chaque organisation peut gérer ses propres plugins indépendamment.

## Structure des fichiers

```
src/lib/plugins/
├── types.ts                 # Types et interfaces des plugins
├── PluginManager.ts         # Gestionnaire central des plugins
├── index.ts                 # Exports principaux
├── registry.ts              # Registre de tous les plugins disponibles
└── steam/
    ├── manifest.ts          # Manifest du plugin Steam
    └── index.ts             # Logique du plugin Steam
```

## Concepts clés

### PluginManifest
Décrit les metadata d'un plugin :
- `id`: Identifiant unique du plugin
- `name`: Nom affiché
- `version`: Version sémantique
- `description`: Description courte
- `icon`: Emoji ou icône
- `enabled`: État par défaut
- `config`: Configuration par défaut

### Plugin
Implémentation complète du plugin :
- `manifest`: Les métadonnées
- `initialize()`: Appelé lors de l'activation
- `destroy()`: Appelé lors de la désactivation
- `hooks`: Hooks que le plugin peut utiliser
- `actions`: Actions que le plugin expose

### PluginManager
Gestionnaire centralisé qui :
- Enregistre les plugins
- Active/désactive les plugins par organisation
- Gère les configurations
- Déclenche les actions et hooks

## Utilisation

### Initialiser le système

```typescript
import { initializePluginRegistry, pluginManager } from '@/lib/plugins';

// Au démarrage de l'application
initializePluginRegistry();
```

### Activer un plugin pour une organisation

```typescript
const context = {
  organizationId: 'org-123',
  userId: 'user-456',
  api: {
    getOrganizationData: () => {...},
    updateOrganizationConfig: async (config) => {...},
    registerHook: (hookName, callback) => {...},
    unregisterHook: (hookName, callback) => {...},
    emit: (eventName, data) => {...}
  }
};

await pluginManager.enablePlugin('org-123', 'steam', context);
```

### Vérifier si un plugin est actif

```typescript
const isActive = pluginManager.isPluginActive('org-123', 'steam');
```

### Récupérer les plugins actifs

```typescript
const activePlugins = pluginManager.getActivePlugins('org-123');
```

### Exécuter une action de plugin

```typescript
const result = await pluginManager.executePluginAction(
  'org-123',
  'steam',
  'getPluginData',
  [arg1, arg2]
);
```

### Utiliser les hooks

```typescript
// Enregistrer un hook
pluginManager.registerHook('onItemCreated', async (item) => {
  console.log('Item créé:', item);
});

// Déclencher un hook
await pluginManager.fireHook('onItemCreated', { id: 'item-1', name: 'Test' });
```

## Créer un nouveau plugin

### 1. Créer le dossier du plugin

```
src/lib/plugins/myPlugin/
├── manifest.ts
└── index.ts
```

### 2. Créer le manifest

```typescript
// manifest.ts
import { PluginManifest } from '../types';

export const myPluginManifest: PluginManifest = {
  id: 'myPlugin',
  name: 'My Plugin',
  version: '1.0.0',
  description: 'Description du plugin',
  icon: '🔧',
  enabled: false,
  config: {
    // Options par défaut
  }
};
```

### 3. Implémenter le plugin

```typescript
// index.ts
import { Plugin, PluginContext } from '../types';
import { myPluginManifest } from './manifest';

export const myPlugin: Plugin = {
  manifest: myPluginManifest,

  async initialize(context: PluginContext) {
    console.log('Plugin initialized');
    // Votre logique d'initialisation
  },

  async destroy() {
    console.log('Plugin destroyed');
    // Nettoyage
  },

  hooks: {
    'onItemCreated': {
      name: 'On Item Created',
      description: 'Déclenché quand un item est créé'
    }
  },

  actions: {
    'doSomething': {
      name: 'Do Something',
      description: 'Fait quelque chose',
      handler: async (arg1, arg2) => {
        return { result: 'success' };
      }
    }
  }
};

export { myPluginManifest };
```

### 4. Enregistrer le plugin

```typescript
// registry.ts
import { myPlugin } from './myPlugin';

const AVAILABLE_PLUGINS: Plugin[] = [
  steamPlugin,
  myPlugin,  // ← Ajouter ici
];
```

## Lifecycle d'un plugin

```
┌─────────────────┐
│   Non enregistré│
└────────┬────────┘
         │ registerPlugin()
┌────────▼────────┐
│   Enregistré    │
└────────┬────────┘
         │ enablePlugin()
┌────────▼────────┐
│     Actif       │ ◄─┐
└────────┬────────┘   │ initialize()
         │ destroy()  │
         │            │
┌────────▼────────┐   │
│   Inactif       ├──►┘
└─────────────────┘
```

## Best Practices

1. **Isolation**: Chaque plugin doit être indépendant
2. **Gestion des ressources**: Nettoyer dans `destroy()`
3. **Gestion d'erreurs**: Toujours gérer les erreurs dans les hooks et actions
4. **Configuration**: Utiliser `getPluginConfig()` pour les paramètres
5. **Logging**: Logger les événements importants pour le débogage
6. **TypeScript**: Toujours typer les données pour la sécurité

## Exemple complet : Plugin Steam

Le plugin Steam est fourni comme exemple et reste vide pour servir de template. Voir `src/lib/plugins/steam/` pour le code source.
