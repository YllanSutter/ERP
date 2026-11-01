# Architecture des vues

## Principe

Une vue combine une définition persistée, un contexte de rendu et un renderer spécialisé.
Les filtres, permissions, actions, onglets et états transverses doivent rester dans le socle
commun. Le renderer conserve uniquement les règles propres à sa représentation.

## Registry

Le registry se trouve dans `src/lib/views/viewRegistry.ts`. Il décrit les types de vues,
leurs capacités et leurs configurations par défaut. Toute nouvelle vue doit être enregistrée
ici au lieu d'ajouter une condition dans `App`, `LayoutView` ou `ViewToolbar`.

Les contrats sont définis dans `src/lib/views/viewTypes.ts` :

- `ViewDefinition` : configuration persistée ;
- `ViewCapabilities` : fonctionnalités supportées ;
- `ViewRenderContext` : données nécessaires au renderer ;
- `ViewRegistration` : point d'extension d'un type de vue.

## Paramètres

`ViewSettingsPanel` fournit les paramètres communs et les paramètres spécifiques au type.
Les paramètres sont écrits via `onUpdate` et doivent rester compatibles avec les anciennes
configurations. Toute évolution de structure devra passer par une migration versionnée.

Chaque renderer fournit ses propres réglages dans `ViewTypeSettings.tsx` :

- Tableau : mode de groupes et densité ;
- Cartes : style, colonnes et densité ;
- Kanban : champs au survol et tri ;
- Calendrier : mode initial et sélecteur de collections ;
- Layout : redimensionnement et hauteur des panneaux.

Pour les cartes, les champs `cardIconFieldId` et `cardColorFieldId` permettent de choisir
les propriétés multiselect qui pilotent respectivement les icônes et les couleurs. Le
renderer de cartes interprète ces valeurs ; le tableau ne doit pas en dépendre.

## Procédure pour ajouter une vue

1. Ajouter le type et ses capacités dans `viewTypes.ts`.
2. Ajouter son enregistrement et ses valeurs par défaut dans `viewRegistry.ts`.
3. Créer le renderer spécialisé.
4. Créer son panneau de paramètres.
5. Brancher le renderer au host commun, sans modifier les renderers existants.
6. Documenter les options et les limites de la vue.
