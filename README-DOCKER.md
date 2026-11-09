# Déployer l’ERP avec Docker Compose

Depuis le dossier du projet, avec Docker et Docker Compose installés :

```bash
cp .env.example .env
chmod 600 .env
```

Pour une installation neuve, générez trois valeurs distinctes avec `openssl rand -hex 32` et renseignez `DB_PASSWORD`, `JWT_SECRET` et `FIELD_ENCRYPTION_KEY` dans `.env`. Définissez `CLIENT_ORIGIN` sur l’URL exacte utilisée dans le navigateur.

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

En local, ouvrez `http://localhost:4000`. Pour une mise en ligne, configurez un reverse proxy HTTPS vers `127.0.0.1:4000` et renseignez l’URL publique HTTPS dans `CLIENT_ORIGIN`. Le proxy doit transférer toutes les routes, y compris `/api` et `/socket.io/`. En mode production, le navigateur a besoin d’HTTPS pour le cookie de connexion sur un domaine public.

Le port de l’application est lié à la boucle locale par défaut. PostgreSQL est accessible uniquement sur le réseau interne de Compose. L’image est construite depuis la copie locale du projet.

## Mettre à jour une installation existante

Avant de recréer les conteneurs, conservez une sauvegarde de PostgreSQL et du volume PDF. Gardez le même nom de projet Compose pour réutiliser les volumes. Reportez dans `.env` les identifiants PostgreSQL en vigueur, ainsi que les clés JWT et de chiffrement existantes. Modifier `DB_PASSWORD` dans `.env` ne modifie pas le mot de passe d’une base déjà initialisée.

Si l’ancienne application écrivait en root, adaptez la propriété des deux volumes applicatifs une fois, pendant la maintenance :

```bash
docker compose stop app
docker compose build app
docker compose run --rm --no-deps --user 0 --entrypoint chown app -R 1001:1001 /app/backups /app/data/pdf-plugin
docker compose up -d
```

Ces commandes conservent les volumes `postgres_data`, `app_backups` et `pdf_plugin_data`. Pour consulter les journaux, utilisez `docker compose logs -f app`.

## Sauvegarder et restaurer

Les nouvelles sauvegardes sont des archives `.tar` dans le volume `app_backups`. Elles contiennent PostgreSQL, les modèles PDF, les PDF remplis enregistrés et leurs métadonnées pour l’ensemble des organisations. `BACKUP_INTERVAL_MINUTES=0` désactive les sauvegardes automatiques.

Restaurez une archive depuis le panneau de sauvegarde de l’ERP. La restauration remplace la base et les fichiers PDF du plugin par leur état dans l’archive. Pour garantir leur cohérence, créez et restaurez les sauvegardes pendant une fenêtre sans écritures concurrentes dans l’ERP.

Les anciennes sauvegardes SQL ou PostgreSQL restent restaurables depuis ce panneau et conservent les PDF présents sur le serveur. Pour restaurer les fichiers d’une ancienne sauvegarde, il faut aussi disposer d’une copie du volume PDF.
