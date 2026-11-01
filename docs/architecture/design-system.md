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
