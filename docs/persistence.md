# Règle de persistance

La base PostgreSQL est la source de vérité. Toute nouvelle donnée persistante doit être enregistrée côté serveur. Les collections, fiches, vues partagées et configurations de plugins conservent leurs API métier existantes.

Les préférences d’affichage, couleurs récentes, thème, navigation et brouillons passent par `src/lib/databaseStorage.ts`. Le cache en mémoire permet aux composants de lire leurs paramètres de façon synchrone ; il est hydraté avant leur montage. La table `browser_state` isole les brouillons et réglages de vues par compte et organisation. Le thème, le fond animé, les couleurs récentes et l’ouverture de la barre latérale sont stockés dans `user_state`, liés uniquement au compte : ils restent identiques dans toutes ses organisations. Au premier chargement, les anciennes préférences d’apparence sont reprises depuis l’organisation active, ou une autre organisation du même compte si nécessaire ; les copies précédentes sont conservées pour permettre un retour arrière. L’utilisateur courant est déterminé par la session serveur, jamais par le corps de la requête.

Les historiques de fiches et la révision des images Steam sont partagés dans l’organisation. L’accès aux historiques vérifie les droits de lecture/écriture de la fiche et de ses champs. Les versions concurrentes sont fusionnées côté serveur dans une transaction sérialisée. Les historiques restent masqués si leur contenu inclut des champs auxquels le lecteur n’a pas accès.

Les écritures sont regroupées pendant 150 ms. Les requêtes expirent après 15 secondes ; les charges dépassant la limite navigateur de keepalive sont envoyées normalement. Un échec laisse les modifications en mémoire, affiche une alerte et déclenche une nouvelle tentative. Le changement d’organisation et la déconnexion attendent la sauvegarde. Une fermeture brutale hors connexion peut perdre les changements encore en mémoire : aucune nouvelle copie persistante n’est créée dans le navigateur.

## Reprise des données locales

À la première connexion, les anciennes clés ERP sont importées. Un conflit de préférence conserve la valeur déjà présente en base ; les versions d’historique sont fusionnées. Les clés sont supprimées du navigateur uniquement après confirmation de l’import ; celles dont l’accès est refusé restent intactes. Les clés identifiant un autre compte ou une autre organisation restent intactes. Seules les clés portant explicitement le compte courant (champs épinglés) ou l’organisation courante (historique partagé) sont reprises automatiquement. Les anciennes clés sans propriétaire fiable nécessitent une attribution explicite depuis le panneau de récupération, avec affichage du compte et de l’organisation destinataires. Un brouillon différent est archivé sous une clé déterministe `erp-draft-recovery:` avant confirmation de l’import, ce qui rend les reprises idempotentes. La lecture de localStorage n’est autorisée que dans cet import ; ESLint empêche sa réintroduction dans les composants.

La table est créée de manière additive au démarrage du serveur et fait partie des sauvegardes globales et par organisation. Les sauvegardes d’organisation antérieures restent restaurables. Pour revenir à une version antérieure de l’application, conserver la table et les sauvegardes : une ancienne version ne saura pas lire les nouveaux paramètres ; aucun retour automatique vers localStorage n’est effectué.


## Concurrence et synchronisation

Les clients envoient le dernier brouillon confirmé comme valeur attendue. Si une autre session a modifié ce brouillon, la version entrante est conservée séparément en base au lieu d’écraser celle déjà présente. Le panneau de récupération permet de restaurer une version ; la version remplacée est conservée à son tour. Fermer puis rouvrir la fiche applique le brouillon restauré sans écraser un éditeur déjà ouvert.

Les préférences sont actualisées toutes les dix secondes et au retour sur l’onglet. Les lectures vérifient l’organisation et le compte ; une réponse ancienne ou des écritures encore en attente empêchent l’application d’un état distant. Le thème, le fond animé, les regroupements, les champs épinglés et les réglages de totaux/calendrier se mettent à jour sans remonter les éditeurs. La navigation active reste propre à la session et sa dernière valeur enregistrée sera reprise à la prochaine ouverture.

Le message de session expirée rappelle que les données confirmées sont en base. Il demande de garder l’onglet ouvert uniquement lorsque la file de sauvegarde métier ou celle des préférences/brouillons contient encore des modifications non confirmées.


Les préférences globales du compte sont comprises dans les sauvegardes complètes PostgreSQL. Une restauration d’organisation ne les remplace pas. Les requêtes de sauvegarde vérifient aussi l’identifiant du compte afin qu’un changement de connexion dans un autre onglet n’attribue pas une écriture au mauvais utilisateur.

La connexion temps réel privilégie WebSocket, avec repli sur le polling si nécessaire. Le serveur de développement relaie également `/socket.io`, y compris les connexions WebSocket.
