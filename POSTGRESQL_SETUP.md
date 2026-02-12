# Configuration PostgreSQL pour le projet ERP

## Installation de PostgreSQL sur Linux Mint

### 1. Installer PostgreSQL
```bash
sudo apt-get install postgresql postgresql-contrib
```

### 2. Démarrer le service
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 3. Créer la base de données et l'utilisateur

Accédez au shell PostgreSQL :
```bash
sudo -u postgres psql
```

Puis exécutez :
```sql
CREATE USER postgres WITH PASSWORD 'postgres';
CREATE DATABASE erp_db OWNER postgres;
GRANT ALL PRIVILEGES ON DATABASE erp_db TO postgres;
\q
```

### 4. Configuration du fichier .env

Copiez `.env.example` en `.env` et adaptez les variables si nécessaire :
```bash
cp .env.example .env
```

### 5. Lancer le serveur API

```bash
npm run api
```

Ou pour lancer le frontend + API ensemble :
```bash
npm run dev:all
```
