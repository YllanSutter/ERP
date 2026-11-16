# Design system

## Source de vérité

Les variantes de bouton sont centralisées dans `src/components/ui/button.tsx`,
notamment via `buttonVariants`. Une modification globale d'un bouton doit être faite
à cet endroit plutôt que dans les vues.

Les primitives partagées doivent suivre le même principe : une API stable, des variantes
explicites et aucune copie locale de classes lorsqu'une primitive existante convient.
Les contrôles booléens utilisent `src/components/ui/switch.tsx` ; les vues ne doivent pas
réintroduire de checkbox ou de toggle visuellement autonome.

Les contrôles propres aux vues reposent sur quatre primitives, afin que leurs états soient
modifiables sans parcourir les renderers :

- `ToolbarButton` pour les actions de barre d'outils et leurs états actifs ;
- `IconButton` pour toute action sans libellé visuel (le libellé accessible est obligatoire) ;
- `GroupHeader` pour les titres repliables produits par `ViewGrouping` ;
- `SettingsField` pour le libellé et le contrôle associé dans les paramètres de vue.

Les cartes Full Art conservent leurs calques, leur dégradé et leur cartouche décoratif dans
`SteamCardFullArt.tsx` : c'est l'exception visuelle documentée. Les contrôles qu'elle affiche
(options select/multiselect) utilisent néanmoins `OptionTags`, la primitive partagée de rendu
des options.

Les valeurs transverses des vues sont dans `src/index.css` : `--view-control-radius`,
`--view-control-gap`, `--view-group-spacing` et `--view-panel-shadow`. Modifier ces tokens
fait évoluer simultanément les primitives de toolbar, de groupage et de paramètres.

## Règles

Le parent commun du renderer actif porte l'unique surface de lecture : blanc à 50 % en thème
clair et noir à 50 % en thème sombre. Les groupes, tableaux, colonnes, panneaux internes et
shells de vues restent transparents afin de ne pas empiler les voiles au-dessus du fond animé.

- privilégier les tokens CSS de `src/index.css` ;
- réutiliser les primitives de `src/components/ui/` ;
- utiliser `Select`, `Tabs`, `Button`, `Input`, `Switch` et les primitives Radix/shadcn
  avant d'ajouter un contrôle local ;
- ajouter une variante nommée plutôt qu'une longue combinaison locale ;
- documenter toute exception visuelle propre à un renderer ;
- vérifier les états clair, sombre, focus, désactivé et responsive.

## Sélecteurs compacts et création contextuelle

Pour les menus de relations, recherches et sélecteurs similaires, privilégier une
interface fine : une seule ligne pour la recherche, le compteur et les actions
(modèle, ajout, validation). Seuls les badges de résultats peuvent revenir à la ligne.
Éviter les en-têtes, pieds de menu, boutons pleine largeur et blocs décoratifs
supplémentaires. Utiliser des icônes discrètes avec un libellé accessible et une infobulle.
La recherche se réduit avec `min-width: 0` ; les actions restent sur la même ligne.

Conserver les résultats sous forme de badges compacts, avec un état sélectionné
lisible, et afficher les plus récents en premier. En création depuis une recherche,
reprendre le texte saisi dans le premier champ texte simple, sans toucher aux autres
valeurs prédéfinies. Une recherche vide conserve les valeurs par défaut.

La création contextuelle garde une seule barre (retour, titre, créer et lier), puis
des lignes de champs compactes avec libellé et contrôle alignés. Le formulaire peut
se développer verticalement et défiler ; éviter un second bandeau d'actions.

## Panneaux latéraux à droite

Les panneaux latéraux de contenu et de paramètres utilisent `SettingsSheet` dans
`src/components/ui/settings-panel.tsx`, avec `SettingsBody` et, si nécessaire,
`SettingsFooter`. Cela inclut les layouts, paramètres de vue, propriétés, filtres
épinglés et détails de relations. Ne pas recréer un panneau droit avec un `Dialog`
repositionné ou une surface `fixed` locale. La navigation principale conserve son
composant `Sidebar`, adapté à la navigation.

Passer `nested` lorsqu'un panneau s'ouvre au-dessus d'une fenêtre existante, et
`trigger` pour conserver le déclencheur accessible et le retour du focus à la fermeture.

Pour les panneaux de lecture, `fitContent` adapte la largeur au contenu entre
20 et 32 rem, sans dépasser la largeur de l'écran. Les textes longs reviennent
à la ligne plutôt que d'élargir indéfiniment le panneau.

Les menus select/multiselect permettent de rechercher puis créer et sélectionner une
option avec Entrée ou `+`, sans ouvrir les paramètres de propriété. La ligne d'ajout
inclut des contrôles compacts d'icône et de couleur. Dans les paramètres d'une propriété
existante, les changements d'options sont enregistrés immédiatement ; le bouton global
ne doit pas être nécessaire pour confirmer un ajout d'option.
