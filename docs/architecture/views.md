# Architecture des vues

## Principe

Une vue combine une définition persistée, un contexte de rendu, un `ViewShell` commun et un
renderer spécialisé.
Les filtres, permissions, actions, onglets et états transverses doivent rester dans le socle
commun. Le renderer conserve uniquement les règles propres à sa représentation.

## Registry

Le parent visuel commun se trouve dans `src/components/views/ViewShell.tsx`. Il porte la
surface responsive, le débordement et la hiérarchie entre la toolbar et le contenu. Les
renderers ne doivent pas recréer cette structure.

Le registry se trouve dans `src/lib/views/viewRegistry.ts`. Il décrit les types de vues,
leurs capacités et leurs configurations par défaut. Toute nouvelle vue doit être enregistrée
ici au lieu d'ajouter une condition dans `App`, `LayoutView` ou `ViewToolbar`.

Les contrats sont définis dans `src/lib/views/viewTypes.ts` :

- `ViewDefinition` : configuration persistée ;
- `ViewCapabilities` : fonctionnalités supportées ;
- `ViewRenderContext` : données nécessaires au renderer ;
- `ViewRegistration` : point d'extension d'un type de vue, avec `Renderer` optionnel pour
  les extensions plugin.

`ViewRendererHost` résout le renderer via le registry. Une vue plugin ne doit donc pas
ajouter de condition dans `App` ou `LayoutView` : elle fournit son `Renderer` et reçoit le
même `ViewRendererProps` que les autres extensions. Le host accepte aussi un `fallback`
pour les renderers natifs encore en migration ; ce fallback doit disparaître lorsque le
renderer natif a été adapté au contrat commun, pas devenir un second registry.

## Paramètres

`ViewSettingsPanel` fournit les paramètres communs et les paramètres spécifiques au type.
Les paramètres sont écrits via `onUpdate` et doivent rester compatibles avec les anciennes
configurations. Toute évolution de structure devra passer par une migration versionnée dans
`src/lib/views/viewConfigMigration.ts`. Les anciennes configurations Cartes/Steam sont
normalisées vers `cardStyle`, avec `steamFullArt` comme valeur par défaut pour `steamcards`.

Chaque renderer fournit ses propres réglages dans `ViewTypeSettings.tsx` :

- Tableau : mode de groupes et densité ;
- Cartes : style, colonnes et densité ;
- Kanban : champs au survol et tri ;
- Calendrier : mode initial et sélecteur de collections ;
- Layout : redimensionnement et hauteur des panneaux.

Le rendu visuel des cartes est isolé dans `src/components/views/CardsGrid.tsx`.
`ViewGrouping` porte la logique générale de groupage (structure, modes par niveau,
accordéon, onglets, sélection et état des groupes). Son contrôleur `useViewGrouping`
expose le même modèle aux renderers qui ont un rendu spécialisé. Tableau l'utilise pour
alimenter son renderer historique de lignes/totaux, Cartes appelle le composant avec
`renderItems={CardsGrid}`, et Kanban l'utilise pour alimenter ses colonnes. Les différences
de rendu restent donc dans les vues, jamais dans une seconde implémentation du groupage.
Pour Tableau et Cartes, le chemin groupé rend désormais les mêmes headers, accordéons,
onglets et sélecteurs via `ViewGrouping`; seul le contenu des groupes est injecté par
`renderItems`.
Calendrier et Layout ne déclarent actuellement pas la capacité `supportsGrouping` et
n'appellent pas ce composant tant qu'ils ne proposent pas cette fonctionnalité.
Les capacités du registry décrivent uniquement le comportement actuellement disponible :
Tableau est le seul renderer natif à déclarer la sélection ; Cartes ne la déclare pas tant que
la sélection multiple et les actions groupées de TASK 3.6 ne sont pas livrées. Kanban et
Calendrier déclarent le glisser-déposer ; Layout ne déclare pas de vues imbriquées tant que son
éditeur de panneaux ne les prend pas en charge.
La pagination partagée du tableau est isolée dans `src/lib/hooks/useViewPagination.ts`.
Elle conserve le calcul des pages, la remise à zéro lors d'un changement de tri/groupe et
la limitation de la page courante lorsque le nombre d'éléments diminue.

Kanban est enregistré comme renderer natif via `KanbanRenderer.tsx`. L'adaptateur reçoit le
contexte commun et les actions injectées par l'application ; `App.tsx` ne doit plus
connaître les détails de ses props métier.
Calendrier suit la même frontière via `CalendarRenderer.tsx`. Ses réglages de collections,
champs de date, rôles, mode d'affichage et filtre relationnel restent dans le renderer et
sont persistés par `onUpdateView`.
Layout est enregistré via `LayoutRenderer.tsx`. Ses panneaux résolvent désormais les
renderers enregistrés pour leurs vues enfants au lieu d'importer directement Kanban et
Calendrier. Le panneau Tableau utilise son adaptateur enregistré comme les autres vues.
Tableau et Cartes sont maintenant eux aussi enregistrés (`TableRenderer.tsx` et
`CardsRenderer.tsx`) et montés par l'unique `ViewRendererHost`. `ActiveViewRenderer` ne doit
plus être réintroduit dans `App.tsx`.

Les dashboards suivent un contrat séparé, car ils ne sont pas des vues de collection :
`src/lib/dashboardRegistry.ts` porte leur registry et
`src/components/dashboard/DashboardRendererHost.tsx` expose le renderer par défaut. Les
extensions de dashboard ne doivent pas être ajoutées comme conditions dans `App.tsx`.

Pour les cartes, les champs `cardIconFieldId` et `cardColorFieldId` permettent de choisir
les propriétés multiselect qui pilotent respectivement les icônes et les couleurs. Le
renderer de cartes interprète ces valeurs ; le tableau ne doit pas en dépendre.
`cardStyle` décrit le rendu visuel (`default` ou `steamFullArt`) tandis que
`cardStyleFieldId` reste le champ historique de compatibilité. Ces clés sont migrées et
conservées par `useViews` ; elles ne doivent pas être réinterprétées par un nouveau renderer.
La grille utilise des paliers responsives : les colonnes configurées deviennent une colonne
sur mobile, puis augmentent à partir des breakpoints du design system.

Les tests ciblés de ces contrats se lancent avec `npm test`. Ils couvrent notamment le
fallback d'une vue inconnue, l'enregistrement/retrait d'une vue plugin et la migration des
anciennes configurations Cartes.

## Procédure pour ajouter une vue

1. Ajouter le type et ses capacités dans `viewTypes.ts`.
2. Ajouter son enregistrement et ses valeurs par défaut dans `viewRegistry.ts`.
3. Créer le renderer spécialisé.
4. Créer son panneau de paramètres.
5. Brancher le renderer au host commun, sans modifier les renderers existants.
6. Documenter les options et les limites de la vue.

Les plugins utilisent `registerViewExtension` depuis leur contexte. L'extension est
enregistrée à l'activation du plugin et retirée lorsqu'il n'est plus actif dans aucune
organisation ; les composants et paramètres restent dans le périmètre du plugin.

## Contrôle d'unification

Lorsqu'une vue est ajoutée ou migrée, comparer son rendu avec Tableau et Cartes sur les
onglets, la toolbar, les actions, les filtres, les contrôles de sélection, les états vides,
les espacements et les breakpoints responsive. Ces surfaces doivent utiliser les mêmes
primitives et variantes ; une différence doit être justifiée par une capacité de vue et
documentée dans son renderer, jamais reproduite par un composant local.
Les onglets de groupes utilisent `src/components/views/ViewGroupTabs.tsx`, y compris pour
les variantes Cartes et Tableau. Les actions de groupe ne doivent jamais imbriquer un bouton
dans un autre bouton ; `GroupHeader` expose une surface clavier non native autour de son
bouton d'action séparé.
