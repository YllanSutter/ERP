# 📋 Plan d'Action IA — Refactoring Project-Manager/ERP

## ⚙️ Règles d'exécution pour l'IA
1. **Ordre** : Traite les tâches par priorité (🔴 > 🟡 > 🟠 > 🟢). Ne passe à la suivante qu'après validation.
2. **Méthode** : Pour chaque tâche : `grep` pour localiser → lire les lignes ciblées (`sed -n`) → modifier de façon ciblée → `git diff` pour vérifier → `npx tsc --noEmit` / `node --check`.
3. **Interdiction** : Ne jamais lancer l'app, ne jamais faire de commit automatique.
4. **Blocage** : Si une tâche nécessite une décision architecturale majeure ou touche >3 fichiers inconnus, **pause** et demande confirmation.
5. ** Validation** valide la tache une fois finie, ne repasse pas sur les taches déja validées

---

## 🔴 PHASE 1 : Sécurité & Correction (Critique)

- [x] **TASK 1.1 : Supprimer les secrets en dur**
  - **Cible** : `server/index.js` (et fichiers de config).
  - **Action** : Supprimer `|| 'dev-secret'` pour `JWT_SECRET` et `FIELD_ENCRYPTION_KEY`. Ajouter un `if (!process.env.JWT_SECRET) throw new Error('Missing JWT_SECRET')` au démarrage.
  - **Vérif** : `node --check server/index.js`

- [x] **TASK 1.2 : Durcir la politique CORS**
  - **Cible** : `server/index.js` ou fichier de config CORS.
  - **Action** : Autoriser les origines dynamiques afin que l’application soit accessible depuis n’importe quel ordinateur.
  - **Vérif** : `grep -n "cors" server/index.js`

- [x] **TASK 1.3 : Rate Limiting & Bcrypt**
  - **Cible** : Routes d'authentification (`server/routes/auth.js` ou similaire).
  - **Action** : Ajouter `express-rate-limit` sur `/api/auth/login` et `/register`. Augmenter le coût de `bcrypt.hash` de 10 à 12.
  - **Vérif** : `grep -n "bcrypt.hash" server/` et `grep -n "rateLimit" server/`

- [x] **TASK 1.4 : Prévenir l'écrasement d'état (Concurrency)**
  - **Cible** : Route `POST /api/state` (ou équivalent).
  - **Action** : Remplacer le POST full-state par une logique de patch (ex: `PATCH /api/state/:id`) ou ajouter un champ `version`/`updatedAt` avec vérification avant écriture.
  - **Vérif** : `grep -rn "POST.*state" server/`

- [x] **TASK 1.5 : Validation des entrées avec Zod**
  - **Cible** : `shared/` (nouveau dossier) ou `src/types/`, et routes serveur.
  - **Action** : Créer des schémas Zod partagés pour les payloads critiques (Auth, State). Remplacer les validations manuelles par `schema.parse(req.body)`.
  - **Vérif** : `npx tsc --noEmit`

---

## 🟡 PHASE 2 : Outillage & Qualité (Fondation)

- [x] **TASK 2.1 : Configuration Linting & Formatting**
  - **Cible** : Racine du projet.
  - **Action** : Ajouter/configurer `eslint` (typescript-eslint, react-hooks) et `prettier`. Ajouter un script `"lint": "eslint ."` dans `package.json`.
  - **Vérif** : `npm run lint` (corriger uniquement les erreurs critiques introduites, ignorer le bruit préexistant hors périmètre).

- [x] **TASK 2.2 : Remplacement des logs console**
  - **Cible** : `server/` (106 occurrences).
  - **Action** : Installer `pino` (ou `winston`). Remplacer `console.log/error` par `logger.info/error`. Configurer pour masquer les logs en production si nécessaire.
  - **Vérif** : `grep -rn "console\." server/ | wc -l` (doit diminuer drastiquement).

- [x] **TASK 2.3 : Arrêt gracieux (Graceful Shutdown)**
  - **Cible** : `server/index.js`.
  - **Action** : Ajouter un listener `process.on('SIGTERM', ...)` qui ferme le serveur HTTP, les connexions Socket.IO et les intervalles de backup avant `process.exit(0)`.
  - **Vérif** : `node --check server/index.js`

- [x] **TASK 2.4 : Nettoyage des dépendances**
  - **Cible** : `package.json`.
  - **Action** : Supprimer `@types/socket.io-client` si il n'est pas nécessaire uniquement (déprécié/inutile). Vérifier les doublons OAuth. Ajouter `npm audit` dans le script CI si existant.
  - **Vérif** : `npm install` réussit sans warnings critiques.

---

## 🟠 PHASE 3 : Architecture & Maintenabilité

- [x] **TASK 3.1 : Découpage du "God Component" AccessManager**
  - **Cible** : `src/components/AccessManager.tsx` (ou chemin similaire, ~3k lignes).
  - **Action** : Extraire les sous-composants (ex: `RoleTable`, `PermissionMatrix`) dans un dossier `src/features/access/`. Utiliser `react-window` ou `tanstack/react-virtual` pour les tableaux si >100 lignes.
  - **Vérif** : `wc -l src/features/access/AccessManager.tsx` (doit être < 500 lignes).

- [x] **TASK 3.2 : Injection de dépendances serveur**
  - **Cible** : `server/routes/` et `server/index.js`.
  - **Action** : Remplacer le passage massif d'objets de dépendances par un objet `appContext` unique (contenant db, logger, services) passé aux routeurs.
  - **Vérif** : `grep -rn "require.*db" server/routes/` (doit utiliser le context).

- [x] **TASK 3.3 : Normalisation des routes**
  - **Cible** : `server/routes/accessRoutes.js` (ou similaire).
  - **Action** : Renommer en ressources plurielles cohérentes (ex: `/api/roles`, `/api/permissions`). Séparer en routeurs dédiés si le fichier dépasse 200 lignes.
  - **Vérif** : `grep -rn "router\." server/routes/`

- [x] **TASK 3.4 : Migration State Management (Optionnel / Progressif)**
  - **Cible** : `src/` et `server/`.
  - **Action** : Identifier un premier module (ex: `UserPreferences`) et le migrer vers TanStack Query (côté client pour les données serveur) et Zustand (état local). Centraliser `localStorage` dans `src/lib/storage.ts`.
  - **Vérif** : `npx tsc --noEmit`

- [x] **TASK 3.5 : Refonte complète de l'architecture des vues et de leurs paramètres**
  - **Cible** : `src/components/views/`, `src/components/`, `src/lib/`, `src/features/` et la documentation d'architecture.
  - **Action** : Refaire toutes les vues (Tableau, Cartes, Kanban, Calendrier, Layout et Dashboard) autour d'un socle partagé (`ViewShell`, onglets de collection, actions, filtres, tri, groupes, permissions, sélection, états et navigation), tout en conservant les spécificités propres à chaque renderer. Remplacer les branchements conditionnels et variantes dupliquées par un registry de renderers et un `ViewRenderContext` typé. Séparer chaque vue en composants spécialisés et supprimer progressivement les responsabilités des composants géants et les `any` des contrats de vue.
  - **Avancement** : socle, paramètres spécialisés, renderers Tableau/Cartes/Kanban/Calendrier/Layout, registry Dashboard, tests ciblés et documentation sont en place. `App.tsx` utilise l'unique `ViewRendererHost`. Tableau et Cartes passent maintenant par le rendu partagé `ViewGrouping` avec seulement leur contenu de groupe injecté ; Kanban consomme le même modèle pour ses colonnes ; Calendrier et Layout n'ont pas la capacité de groupage.
  - **Action complémentaire** : Ajouter un onglet commun **Paramètres de la vue**, avec une section générique et une section spécifique fournie par chaque type de vue. Introduire des configurations de vue typées, versionnées et migrables ; pour la vue Cartes, permettre notamment de choisir le champ multiselect utilisé pour les icônes, le champ utilisé pour les couleurs, le style de carte, les champs affichés, l'image, la densité et la grille. Les styles spécialisés, dont `SteamCardFullArt`, doivent être enregistrés comme variantes indépendantes du tableau.
  - **Design system** : Unifier au maximum le style de l'application avec des tokens et primitives partagés pour les couleurs, espacements, typographies, rayons, ombres, densités, états et responsive. Centraliser les variantes de composants (notamment les boutons, boutons d'action, boutons d'onglet, champs, badges et menus) afin qu'une modification de style puisse être faite à un seul endroit et se propage de manière contrôlée à toutes les vues. Interdire les styles locaux divergents sauf exception documentée.
  - **Primitives UI obligatoires** : Réutiliser les composants UI/shadcn existants (`Select`, `Tabs`, `Button`, `Input`, menus, dialogues, etc.) pour tout nouveau contrôle. Ne pas introduire de `<select>`, bouton ou contrôle stylé localement lorsqu'une primitive partagée existe ; si une primitive manque, la créer dans `src/components/ui/` avant de l'utiliser.
  - **Vérification d'unification des composants** : Pour chaque vue, vérifier que les onglets, la toolbar, les actions, les filtres, les contrôles de sélection, les états vides, les espacements et les points de rupture responsive utilisent les mêmes composants partagés et les mêmes variantes. Une vue ne peut pas conserver une copie visuelle ou comportementale d'un onglet Tableau si l'équivalent Cartes existe ; toute différence doit être portée par une capacité ou une variante explicitement documentée et testée.
  - **Sous-tâches de clôture** : supprimer `ActiveViewRenderer` et faire passer Tableau/Cartes par l'unique `ViewRendererHost` ; enregistrer un renderer Cartes dédié sans délégation directe à `TableView` ; extraire le groupage général dans `ViewGrouping`, faire consommer son modèle par Tableau/Cartes/Kanban sans perdre leurs renderers spécifiques ; enregistrer le Dashboard via un contrat de renderer dédié ; réduire les `any` des adaptateurs et ajouter les tests ciblés registry/migrations/fallback/sélection initiale.
  - **Validation par étape** : après chaque sous-tâche, exécuter au minimum `npx tsc --noEmit`, le lint ciblé des fichiers touchés et `git diff --check`. Après le dernier bloc, exécuter `npm run build`, les tests ciblés disponibles et une validation visuelle des vues concernées.
  - **Documentation** : Documenter le cycle de vie des vues, le contexte partagé, les capacités, le registry, les paramètres configurables, la procédure d'ajout d'une vue ou d'un style de carte et l'emplacement de chaque responsabilité afin qu'une IA puisse retrouver et étendre le système sans parcourir les composants géants.
  - **Documentation design system** : Répertorier les tokens, primitives, variantes autorisées et points d'extension dans une documentation dédiée, avec des exemples indiquant où modifier le style global d'un bouton ou d'un contrôle sans rechercher toutes ses occurrences.
  - **Dernier point — intégration des plugins** : Une fois le socle des vues unifié, améliorer l'intégration des plugins afin qu'ils puissent enregistrer des extensions via les mêmes contrats que le cœur (`ViewDefinition`, `ViewRenderContext`, capacités, registry, paramètres et actions). Ajouter un point d'extension explicite `{{plugins}}` dans le système unifié pour permettre à un plugin d'ajouter une nouvelle vue, un renderer, un style de carte ou un panneau de paramètres sans modifier les vues natives ni le cœur de l'application.
  - **Isolation des plugins** : Toute fonctionnalité ajoutée par un plugin (vues, champs, actions, menus, paramètres, routes, composants, styles, migrations et documentation) doit rester dans le périmètre du plugin et être exposée au cœur uniquement via des contrats d'extension documentés. Le cœur ne doit pas contenir de condition spécifique à un plugin ; inversement, un plugin doit réutiliser les primitives communes sans copier la logique métier. Prévoir l'enregistrement, le retrait, les capacités, les erreurs et la compatibilité de version des extensions plugin.
  - **Vérification plugins** : Tester qu'un plugin peut ajouter et retirer une vue sans modifier le code des renderers natifs, qu'une vue plugin reçoit le même contexte et les mêmes permissions qu'une vue native, et qu'aucun import ou branchement plugin ne fuit dans le cœur hors du registry/contrat d'extension.
  - **Vérif** : `npx tsc --noEmit`, `npm run lint`, tests ciblés des renderers et des migrations de configuration, puis vérifier qu'une nouvelle vue peut être ajoutée sans modifier les renderers existants et que les configurations de vues existantes restent lisibles.

- [ ] **TASK 3.6 : Interactions avancées des cartes full-art**
  - **Cible** : `src/components/views/SteamCardFullArt.tsx`, `src/components/views/TableView.tsx` et les primitives UI partagées nécessaires.
  - **Action** : Ajouter un effet de survol cohérent avec le style full-art (élévation, accentuation de la bordure et mise en évidence de l'image) sans gêner l'ouverture du détail.
  - **Action complémentaire** : Permettre de déplacer les cartes par glisser-déposer afin de réorganiser les éléments, en réutilisant le mécanisme de réordonnancement existant et en conservant le tri, le groupage et la pagination.
  - **Action complémentaire** : Ajouter la sélection individuelle et la sélection multiple des cartes, avec état visuel clair, sélection globale par périmètre affiché et compatibilité avec les actions groupées existantes (mise à jour et suppression).
  - **Contraintes** : Ne pas lancer l'application ; ne pas modifier le comportement des vues Tableau, Kanban, Calendrier ou Layout ; utiliser les primitives UI existantes pour les contrôles ; préserver l'accessibilité clavier et les zones cliquables.
  - **Vérif** : `npm run typecheck`, `npm run build`, puis validation visuelle de la vue Cartes avec survol, déplacement, sélection simple, sélection multiple et action groupée.

---

## 🟢 PHASE 4 : Performance & UX Polish

- [x] **TASK 4.1 : Code-Splitting des vues majeures**
  - **Cible** : Fichier de routing principal (ex: `src/App.tsx` ou `src/router.tsx`).
  - **Action** : Remplacer les imports statiques de `Calendar`, `Dashboard`, `Admin` par `React.lazy(() => import('...'))` avec un `<Suspense fallback={<Spinner />}>`.
  - **Vérif** : `grep -n "React.lazy" src/App.tsx`

- [x] **TASK 4.2 : Réduction de la payload API**
  - **Cible** : `server/index.js`.
  - **Action** : Réduire la limite de `express.json({ limit: '1mb' })` (au lieu de 10mb+). Ajouter `compression()` middleware.
  - **Vérif** : `grep -n "express.json" server/index.js`

- [x] **TASK 4.3 : Unifier l'exécution des renderers et supprimer les chemins hérités**
  - **Cible** : `src/components/views/LayoutView.tsx`, `src/components/views/TableView.tsx`, `src/components/views/ViewRendererHost.tsx` et tests des vues.
  - **Action** : Ne rendre chaque panneau Layout que par le renderer résolu dans le registry ; supprimer les branches Tableau/Cartes devenues inatteignables et leurs états, imports et props associés, sans modifier le comportement du chemin `ViewGrouping`.
  - **Vérif** : test de non-double rendu d'un panneau Tableau, `npm run typecheck`, `npm test`, `git diff --check`.

- [x] **TASK 4.4 : Rendre effectif le contrat de configuration des vues Cartes**
  - **Cible** : `src/lib/views/`, `src/components/views/CardsRenderer.tsx`, `CardsView.tsx`, `CardsGrid.tsx`, `SteamCardFullArt.tsx` et tests de migration.
  - **Action** : Faire appliquer `cardStyle`, `cardDensity`, `cardIconFieldId` et `cardColorFieldId` de bout en bout. Enregistrer le style Standard et `SteamCardFullArt` comme renderers de carte indépendants ; ne pas fusionner les champs icône/couleur ; ajouter des tests de configuration et de rétrocompatibilité.
  - **Vérif** : tests de registry/migration/rendu de style, `npm run typecheck`, `npm run build`.

- [x] **TASK 4.5 : Centraliser les primitives et variantes de l'interface des vues**
  - **Cible** : `src/components/ui/`, `src/components/views/ViewToolbar.tsx`, `TableView.tsx`, `KanbanView.tsx`, `ViewGrouping.tsx` et documentation design system.
  - **Action** : Créer ou compléter les primitives `ToolbarButton`, `IconButton`, `GroupHeader`, `SettingsField` et les variantes de `Button`. Remplacer les boutons, champs et `<select>` locaux des vues par ces primitives, y compris pagination, actions groupées et groupage ; documenter les points d'extension.
  - **Vérif** : aucune balise `<select>` dans les vues, lint ciblé, `npm run typecheck`, `npm run build`.

- [x] **TASK 4.6 : Consolider les tokens visuels et aligner les capacités de vues**
  - **Cible** : `src/index.css`, `src/components/ui/`, `src/components/views/`, `src/lib/views/viewRegistry.ts` et docs.
  - **Action** : Remplacer les couleurs, rayons, ombres, espacements et états réutilisables locaux par des tokens et variantes partagés. Documenter l'exception Full Art. Déclarer uniquement les capacités effectivement disponibles ; intégrer la sélection Cartes lors de la clôture de TASK 3.6.
  - **Vérif** : audit des classes locales restantes, tests de capacités, `npm run typecheck`, `npm run build`.

---

## 🛑 Comment l'IA doit procéder pour chaque tâche
1. Annoncer la tâche en cours.
2. Exécuter le `grep` pour localiser le code exact.
3. Afficher un plan de modification en 2 lignes.
4. Appliquer les modifications (search & replace).
5. Exécuter les vérifications statiques (`tsc`, `node --check`).
6. Afficher le `git diff --stat` et cocher la tâche `[x]`.
7. Attendre la validation de l'utilisateur pour la tâche suivante.
