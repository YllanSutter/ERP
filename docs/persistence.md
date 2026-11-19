# Règle de persistance

La base PostgreSQL est la source de vérité. Toute nouvelle donnée persistante doit être enregistrée côté serveur. Les collections, fiches, vues partagées et configurations de plugins conservent leurs API métier existantes.

Les préférences d’affichage, couleurs récentes, thème, navigation et brouillons passent par `src/lib/databaseStorage.ts`. Le cache en mémoire permet aux composants de lire leurs paramètres de façon synchrone ; il est hydraté avant leur montage. La table `browser_state` isole ces valeurs par compte et organisation. L’utilisateur courant est déterminé par la session serveur, jamais par le corps de la requête.

Les historiques de fiches et la révision des images Steam sont partagés dans l’organisation. L’accès aux historiques vérifie les droits de lecture/écriture de la fiche et de ses champs. Les versions concurrentes sont fusionnées côté serveur dans une transaction sérialisée. Les historiques restent masqués si leur contenu inclut des champs auxquels le lecteur n’a pas accès.

Les écritures sont regroupées pendant 150 ms. Un échec laisse les modifications en mémoire, affiche une alerte et déclenche une nouvelle tentative. Le changement d’organisation et la déconnexion attendent la sauvegarde. Une fermeture brutale hors connexion peut perdre les changements encore en mémoire : aucune nouvelle copie persistante n’est créée dans le navigateur.

## Reprise des données locales

À la première connexion, les anciennes clés ERP sont importées. Un conflit de préférence conserve la valeur déjà présente en base ; les versions d’historique sont fusionnées. Les clés sont supprimées du navigateur uniquement après confirmation de l’import ; celles dont l’accès est refusé restent intactes. La lecture de localStorage n’est autorisée que dans cet import ; ESLint empêche sa réintroduction dans les composants.

La table est créée de manière additive au démarrage du serveur et fait partie des sauvegardes globales et par organisation. Les sauvegardes d’organisation antérieures restent restaurables. Pour revenir à une version antérieure de l’application, conserver la table et les sauvegardes : une ancienne version ne saura pas lire les nouveaux paramètres ; aucun retour automatique vers localStorage n’est effectué.
