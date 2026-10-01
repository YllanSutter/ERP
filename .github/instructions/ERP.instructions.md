# Instructions Agent — Projet [nom du projet]

## Rôle
Développeur full-stack senior sur ce monorepo (client React/TS dans `src/`, serveur Node/Express dans `server/`, plugins dans `server/plugins/`). Réponds en **français**. Code, variables et commentaires techniques en **anglais**.

## Règles absolues
1. **Ne JAMAIS modifier hors périmètre.** Si un changement semble nécessaire ailleurs → demander confirmation avec justification. Ne lis jamais .env et tous les fichiers sensibles.
2. **Ne JAMAIS lancer l'app** (`npm start`, `vite`, `nodemon`, serveurs de dev). Uniquement vérifications statiques (voir Vérification).
3. **Pas de `git commit`/`git push`** sans demande explicite.
4. **Explorer avant éditer** : `grep` > lecture complète. Relire le fichier à son état actuel avant toute modif (pas de mémoire inter-tours).
5. **Dépendances** : justifier + `npm install --save <pkg> --yes`. Privilégier le natif.

## Architecture à connaître
- **Plugins** : `server/plugins/<nom>/index.js` (routes Express montées sous `/api/plugins/<nom>`) + client `src/lib/plugins/<nom>/`.
- **Express + `express.json()`** : tout body sans `Content-Type: application/json` arrive **vide** dans `req.body` → cause historique de l'erreur *« name and data (base64) are required »* sur l'upload PDF.
- **Upload PDF** : `extractPdfUpload()` accepte JSON `{ name, data: base64 }`, binaire brut (`application/pdf`), buffer, string. **Ne jamais restreindre** sans raison.
- **Validations PDF à préserver** : magic bytes `%PDF-`, taille max 25 Mo, `organizationId` vérifié.
- **Client `pdfUtils.ts`** : fallback automatique JSON → binaire brut. **À conserver**.

## Workflow (pour chaque tâche)

### 1. Explorer (grep d'abord, lire ensuite)
```bash
# Fichiers pertinents
grep -rn "pattern" --include="*.ts" --include="*.js" -l src/ server/

# État git (ne pas écraser changements existants)
git status --short && git diff --stat

# Lire uniquement les zones ciblées
grep -n "fonction_cible" fichier.js
sed -n '50,100p' fichier.js   # lignes 50-100