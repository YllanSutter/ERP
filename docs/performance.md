# Optimisations de performance — 19 novembre 2026

## Périmètre livré

1. Chargement à la demande du catalogue Steam, des vues tableau/cartes/kanban/calendrier/layout, des modales lourdes et des outils PDF. Les dépendances des graphiques ne sont plus imposées au démarrage par le découpage des fichiers.
2. Synchronisation des préférences sans chargement systématique des historiques, ETag/304 quand rien ne change, réponses de sauvegarde limitées aux clés concernées, pause des vérifications dans les onglets masqués. L’historique d’une fiche est récupéré à son ouverture, avec les mêmes contrôles d’accès.
3. Réutilisation des calculs et des données nettoyées des fiches inchangées. Le suivi des différences et les confirmations de sauvegarde conservent leurs références ; une modification ne provoque plus leur copie systématique. Les segments du calendrier mensuel sont indexés une fois par mois et par jeu de données.
4. Affichage par fenêtre des colonnes kanban et des journées du calendrier contenant plus de 60 éléments. Les hauteurs réelles sont mesurées ; la carte en édition et celle en cours de déplacement restent montées. Les tableaux et cartes gardent leur pagination existante. Navigation Début/Fin disponible sur les listes longues.
5. Cache d’un an avec `immutable` pour les fichiers versionnés dans `/assets`. Le document HTML est revalidé pour récupérer les nouveaux déploiements. La compression HTTP existante est conservée.

Les données persistantes restent en PostgreSQL. Ces optimisations n’ajoutent aucune sauvegarde dans le navigateur. Les mécanismes de reprise, conflits, droits et historique sont conservés.

## Mesures du build

Même méthode avant/après : somme des fichiers JavaScript déclarés par le document HTML produit, taille gzip calculée localement. Il ne s’agit pas d’un chronométrage réseau sur le serveur de production.

| Mesure | Avant | Après |
|---|---:|---:|
| JavaScript initial | 12.05 Mo | 1.83 Mo |
| JavaScript initial gzip | 3.76 Mo | 0.46 Mo |
| Fichier principal | 10.00 Mo | 0.65 Mo |

Réduction du JavaScript initial compressé : environ 88 %.

## Traitement d’une modification

Simulation Node.js sur 10 collections de 1 000 fiches, avec champs calculés et commentaires. Une seule fiche est modifiée à chaque passage. Médiane de 40 passages, caches déjà amorcés : calculs et préparation de sauvegarde uniquement.

| Mesure | Avant | Après |
|---|---:|---:|
| Médiane | 3.72 ms | 0.14 ms |
| 95e percentile | 8.15 ms | 0.16 ms |

Ces chiffres ne mesurent ni le rendu complet dans le navigateur, ni le réseau, ni PostgreSQL ; ils ne constituent pas une promesse de gain équivalent sur chaque interaction.

## Vérifications

- Tests de référence, typage et compilation de production.
- Non-régression des cycles dans le nettoyage, calculs numériques, préservation des références, modifications plus récentes pendant une sauvegarde et fenêtres de liste.
- PostgreSQL temporaire : droits et isolation, réponses partielles, suppressions explicites, historique à la demande, réponse 304, sauvegardes/restaurations.
- HTTP : cache des fichiers versionnés et revalidation du HTML.
- Navigateur, build de production, base temporaire de 1 000 fiches : 5 cartes montées initialement dans la grande colonne, 9 après défilement, modification et glisser-déposer confirmés en base, saisie d’un commentaire et lecture de l’historique. Calendrier de 1 000 événements : 22 événements montés à l’ouverture, accès au dernier événement via Fin. Vues tableau et calendrier chargées sans erreur de console.

## Déploiement

Déployer ensemble serveur et client pour bénéficier du nouveau protocole. Le serveur conserve les réponses complètes pour les anciens clients. Les données et tables existantes ne sont pas supprimées.

Conserver les anciens fichiers versionnés pendant la transition lorsqu’un déploiement remplace les ressources statiques : des onglets déjà ouverts peuvent encore demander leurs anciens modules. L’HTML ne doit pas recevoir le cache immuable.
