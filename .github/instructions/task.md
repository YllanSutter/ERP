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

- [ ] **TASK 2.1 : Configuration Linting & Formatting**
  - **Cible** : Racine du projet.
  - **Action** : Ajouter/configurer `eslint` (typescript-eslint, react-hooks) et `prettier`. Ajouter un script `"lint": "eslint ."` dans `package.json`.
  - **Vérif** : `npm run lint` (corriger uniquement les erreurs critiques introduites, ignorer le bruit préexistant hors périmètre).

- [ ] **TASK 2.2 : Remplacement des logs console**
  - **Cible** : `server/` (106 occurrences).
  - **Action** : Installer `pino` (ou `winston`). Remplacer `console.log/error` par `logger.info/error`. Configurer pour masquer les logs en production si nécessaire.
  - **Vérif** : `grep -rn "console\." server/ | wc -l` (doit diminuer drastiquement).

- [ ] **TASK 2.3 : Arrêt gracieux (Graceful Shutdown)**
  - **Cible** : `server/index.js`.
  - **Action** : Ajouter un listener `process.on('SIGTERM', ...)` qui ferme le serveur HTTP, les connexions Socket.IO et les intervalles de backup avant `process.exit(0)`.
  - **Vérif** : `node --check server/index.js`

- [ ] **TASK 2.4 : Nettoyage des dépendances**
  - **Cible** : `package.json`.
  - **Action** : Supprimer `@types/socket.io-client` si il n'est pas nécessaire uniquement (déprécié/inutile). Vérifier les doublons OAuth. Ajouter `npm audit` dans le script CI si existant.
  - **Vérif** : `npm install` réussit sans warnings critiques.

---

## 🟠 PHASE 3 : Architecture & Maintenabilité

- [ ] **TASK 3.1 : Découpage du "God Component" AccessManager**
  - **Cible** : `src/components/AccessManager.tsx` (ou chemin similaire, ~3k lignes).
  - **Action** : Extraire les sous-composants (ex: `RoleTable`, `PermissionMatrix`) dans un dossier `src/features/access/`. Utiliser `react-window` ou `tanstack/react-virtual` pour les tableaux si >100 lignes.
  - **Vérif** : `wc -l src/features/access/AccessManager.tsx` (doit être < 500 lignes).

- [ ] **TASK 3.2 : Injection de dépendances serveur**
  - **Cible** : `server/routes/` et `server/index.js`.
  - **Action** : Remplacer le passage massif d'objets de dépendances par un objet `appContext` unique (contenant db, logger, services) passé aux routeurs.
  - **Vérif** : `grep -rn "require.*db" server/routes/` (doit utiliser le context).

- [ ] **TASK 3.3 : Normalisation des routes**
  - **Cible** : `server/routes/accessRoutes.js` (ou similaire).
  - **Action** : Renommer en ressources plurielles cohérentes (ex: `/api/roles`, `/api/permissions`). Séparer en routeurs dédiés si le fichier dépasse 200 lignes.
  - **Vérif** : `grep -rn "router\." server/routes/`

- [ ] **TASK 3.4 : Migration State Management (Optionnel / Progressif)**
  - **Cible** : `src/` et `server/`.
  - **Action** : Identifier un premier module (ex: `UserPreferences`) et le migrer vers TanStack Query (côté client pour les données serveur) et Zustand (état local). Centraliser `localStorage` dans `src/lib/storage.ts`.
  - **Vérif** : `npx tsc --noEmit`

---

## 🟢 PHASE 4 : Performance & UX Polish

- [ ] **TASK 4.1 : Code-Splitting des vues majeures**
  - **Cible** : Fichier de routing principal (ex: `src/App.tsx` ou `src/router.tsx`).
  - **Action** : Remplacer les imports statiques de `Calendar`, `Dashboard`, `Admin` par `React.lazy(() => import('...'))` avec un `<Suspense fallback={<Spinner />}>`.
  - **Vérif** : `grep -n "React.lazy" src/App.tsx`

- [ ] **TASK 4.2 : Réduction de la payload API**
  - **Cible** : `server/index.js`.
  - **Action** : Réduire la limite de `express.json({ limit: '1mb' })` (au lieu de 10mb+). Ajouter `compression()` middleware.
  - **Vérif** : `grep -n "express.json" server/index.js`

- [ ] **TASK 4.3 : Accessibilité (A11y) de base**
  - **Cible** : Composants UI complexes (boutons icônes, tableaux).
  - **Action** : Ajouter `aria-label` aux boutons sans texte visible. Vérifier la navigation au clavier (tabindex) sur les éléments interactifs custom.
  - **Vérif** : `grep -rn "aria-label" src/` (doit augmenter).

---

## 🛑 Comment l'IA doit procéder pour chaque tâche
1. Annoncer la tâche en cours.
2. Exécuter le `grep` pour localiser le code exact.
3. Afficher un plan de modification en 2 lignes.
4. Appliquer les modifications (search & replace).
5. Exécuter les vérifications statiques (`tsc`, `node --check`).
6. Afficher le `git diff --stat` et cocher la tâche `[x]`.
7. Attendre la validation de l'utilisateur pour la tâche suivante.