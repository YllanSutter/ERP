# 🚀 ERP - Installation Docker Automatique

**Déploiement en 1 SEULE COMMANDE - Aucune configuration requise !**

## 📋 Prérequis

- Docker et Docker Compose installés
- Ports 4000 et 5432 disponibles

## ⚡ Installation Instantanée

### Option 1: Clone & Run (recommandé)
```bash
git clone <votre-repo> erp
cd erp
docker-compose -f docker-compose.simple.yml up -d
```

### Option 2: Download & Run
```bash
# Télécharger le projet
curl -L https://github.com/votre-repo/archive/main.zip -o erp.zip
unzip erp.zip
cd erp-main
docker-compose -f docker-compose.simple.yml up -d
```

### Option 3: 1Panel
1. **Docker Compose** → **Create**
2. **Nom**: `erp`
3. **Contenu**: Copiez `docker-compose.simple.yml`
4. **Start**

## 🎯 Accès Immédiat

- **Application**: http://localhost:4000
- **API**: http://localhost:4000/api
- **Base de données**: postgresql://postgres:postgres123@localhost:5432/erp_db

## 📦 Configuration par Défaut

| Service | Valeur par défaut |
|---------|-------------------|
| **Utilisateur DB** | postgres |
| **Mot de passe DB** | postgres123 |
| **Nom DB** | erp_db |
| **Port App** | 4000 |
| **Port DB** | 5432 |
| **JWT Secret** | change-this-secret-key-in-production-32-chars-min |

## 🔧 Personnalisation (optionnel)

Pour modifier les valeurs par défaut, créez un fichier `.env` :
```bash
# Copier les valeurs par défaut
cat > .env << EOF
POSTGRES_PASSWORD=votre_mot_de_passe
JWT_SECRET=votre_clé_secrète_32_caractères_minimum
FIELD_ENCRYPTION_KEY=une_clé_aléatoire_dédiée_aux_champs_password
CLIENT_ORIGIN=http://votre-domaine.com
EOF

# Redémarrer avec les nouvelles valeurs
docker-compose -f docker-compose.simple.yml down
docker-compose -f docker-compose.simple.yml up -d
```

## 🛠️ Commandes Utiles

```bash
# Vérifier le statut
docker-compose -f docker-compose.simple.yml ps

# Voir les logs
docker-compose -f docker-compose.simple.yml logs -f

# Arrêter
docker-compose -f docker-compose.simple.yml down

# Redémarrer
docker-compose -f docker-compose.simple.yml restart

# Mise à jour
git pull
docker-compose -f docker-compose.simple.yml down
docker-compose -f docker-compose.simple.yml build --no-cache
docker-compose -f docker-compose.simple.yml up -d
```

## 📊 Monitoring

### Health Checks
- **Application**: http://localhost:4000/api
- **Base de données**: pg_isready

### Volumes persistants
- **Base de données**: `postgres_data`
- **Sauvegardes**: `app_backups`

## 🔒 Sécurité (Production)

Pour la production, modifiez les valeurs par défaut :
```bash
# Générer un mot de passe sécurisé
openssl rand -base64 32

# Générer une clé JWT sécurisée
openssl rand -hex 32
```

## 🚨 Dépannage

### Port déjà utilisé ?
```bash
# Vérifier les ports
netstat -tulpn | grep :4000
netstat -tulpn | grep :5432

# Arrêter les services existants
sudo systemctl stop postgresql
```

### Container ne démarre pas ?
```bash
# Vérifier les logs
docker-compose -f docker-compose.simple.yml logs app
docker-compose -f docker-compose.simple.yml logs postgres

# Recréer depuis zéro
docker-compose -f docker-compose.simple.yml down -v
docker-compose -f docker-compose.simple.yml up -d
```

### Accès à la base de données
```bash
# Se connecter
docker-compose -f docker-compose.simple.yml exec postgres psql -U postgres -d erp_db

# Sauvegarder
docker-compose -f docker-compose.simple.yml exec postgres pg_dump -U postgres erp_db > backup.sql
```
### Perte du mdp postgre ?
docker exec -it erp_postgres psql -U postgres
ALTER USER postgres WITH PASSWORD '5DSUUF4XQN699';

### VERIFIER Tables
docker exec -it erp_postgres psql -U postgres -d erp_db
\dt
\d users
SELECT * FROM users;

## 📈 Mise à l'échelle

Pour augmenter les ressources :
```bash
# Dans docker-compose.simple.yml, ajouter :
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

## 🌐 Domaine personnalisé

Pour utiliser votre domaine :
1. **Modifiez** `CLIENT_ORIGIN` dans `.env`
2. **Configurez** votre reverse proxy (Nginx/Apache)
3. **Activez** SSL avec Let's Encrypt

## 💾 Sauvegardes Automatiques

Les sauvegardes sont créées dans `app_backups` volume :
```bash
# Voir les sauvegardes
docker-compose -f docker-compose.simple.yml exec app ls -la /app/backups

# Restaurer une sauvegarde
docker-compose -f docker-compose.simple.yml exec postgres psql -U postgres -d erp_db < backup.sql
```

---

## 🎉 C'est tout !

Votre ERP est maintenant opérationnel en **une seule commande** !

**Premier utilisateur créé automatiquement = ADMIN**
- Email : votre email d'inscription
- Mot de passe : celui que vous avez choisi

Pour toute question : consultez les logs ou vérifiez le statut des containers.
