# Design system

## Source de vérité

Les variantes de bouton sont centralisées dans `src/components/ui/button.tsx`,
notamment via `buttonVariants`. Une modification globale d'un bouton doit être faite
à cet endroit plutôt que dans les vues.

Les primitives partagées doivent suivre le même principe : une API stable, des variantes
explicites et aucune copie locale de classes lorsqu'une primitive existante convient.

## Règles

- privilégier les tokens CSS de `src/index.css` ;
- réutiliser les primitives de `src/components/ui/` ;
- ajouter une variante nommée plutôt qu'une longue combinaison locale ;
- documenter toute exception visuelle propre à un renderer ;
- vérifier les états clair, sombre, focus, désactivé et responsive.
