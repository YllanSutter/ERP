# Ajouter une vue

## Objectif

Une nouvelle vue ne doit pas modifier `App.tsx` ni les renderers des autres vues. Elle est
décrite par le registry, rendue par `ViewRendererHost` et configurée dans le panneau de
paramètres commun. Les données, permissions et actions sont injectées par le même contrat
que pour les vues existantes.

## Parcours minimal

1. **Choisir un identifiant et les capacités.** Ajouter le type natif à `NativeViewType` dans
   `src/lib/views/viewTypes.ts`, puis déterminer honnêtement les capacités disponibles
   (`supportsGrouping`, `supportsSelection`, etc.). Une capacité ne doit être déclarée que
   lorsque l'interaction fonctionne réellement.
2. **Créer le renderer.** Créer `src/components/views/ExampleRenderer.tsx`. Il reçoit
   `ViewRendererProps` et adapte uniquement les données nécessaires au composant visuel.
   Les actions optionnelles doivent être vérifiées avant utilisation, comme dans
   `CardsRenderer.tsx`.
3. **Créer le composant visuel.** Il doit employer `ViewShell`, `ViewGrouping` et
   `useViewPagination` lorsque la vue propose ces fonctions. Utiliser les primitives de
   `src/components/ui` pour les contrôles, et les composants de `src/components/views` pour
   les en-têtes de groupes, boutons de toolbar et champs de réglage.
4. **Créer les réglages spécifiques.** Ajouter un composant dans
   `src/components/views/ViewTypeSettings.tsx`, basé sur `ViewSettingsProps`. Toute nouvelle
   clé persistée est écrite via `onUpdate` ; lorsqu'elle change une structure existante,
   ajouter une migration dans `src/lib/views/viewConfigMigration.ts`.
5. **Enregistrer la vue.** Ajouter une entrée dans `src/lib/views/viewRegistry.ts` avec son
   `Renderer`, ses `Settings`, ses capacités et `createDefaultConfig`. C'est le seul
   branchement nécessaire pour qu'elle soit résolue par le host et utilisable dans Layout.
6. **Tester le contrat.** Étendre `src/lib/views/viewArchitecture.test.ts` avec le défaut,
   les capacités et, si nécessaire, la migration. Vérifier que les autres vues ne changent
   pas et lancer `npm run typecheck`, `npm test`, `npm run build` et `git diff --check`.

## Exemple de forme attendue

```tsx
// ExampleRenderer.tsx
const ExampleRenderer: React.FC<ViewRendererProps> = ({ collection, items, view, onUpdateView }) => (
  <ViewShell>
    <ExampleView collection={collection} items={items} density={view.exampleDensity} />
  </ViewShell>
);
```

```ts
// viewRegistry.ts
example: {
  type: 'example',
  label: 'Exemple',
  Renderer: ExampleRenderer,
  Settings: ExampleViewSettings,
  capabilities: { ...defaultCapabilities, supportsGrouping: true },
  createDefaultConfig: (id, collectionId) => ({
    id, name: 'Exemple', type: 'example', collectionId, exampleDensity: 'comfortable',
  }),
},
```

## Proposition de prochaine vue : Galerie

Une vue **Galerie** serait une bonne validation du contrat : elle montre des cartes à image
dans une grille plus sobre que Full Art, avec titre et métadonnées au survol. Elle peut
réemployer `CardsGrid` ou extraire un petit `GalleryTile` commun, `ViewGrouping`, la
pagination et les actions de sélection. Sa configuration initiale serait limitée à : champ
d'image, ratio des vignettes et densité.

Elle est faisable sans toucher à `App.tsx`, Tableau, Kanban, Calendrier ou Layout. La barre
d'actions de sélection est déjà mutualisée dans `BulkSelectionToolbar`; Galerie peut donc
réutiliser le même contrat de modification, suppression et import. Seul l'état de sélection
reste local à chaque renderer afin de respecter son périmètre affiché.

## Checklist de qualité

- Aucun nouveau `if (view.type === ...)` dans `App.tsx`, `LayoutView.tsx` ou la toolbar.
- Aucun contrôle HTML local lorsqu'une primitive UI existe ; créer la primitive manquante
  avant de l'utiliser.
- Les actions de souris restent utilisables au clavier et ne recouvrent pas l'ouverture du
  détail.
- Les groupes, filtres, pagination, permissions et éléments vides sont validés pour la vue.
- Les styles réutilisables utilisent les tokens du design system ; toute exception visuelle
  est justifiée dans la documentation de la vue.
