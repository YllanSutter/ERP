#!/bin/bash

# Script pour synchroniser la base de données locale vers Railway
# Usage: npm run sync:db:railway

set -e

# Charger les variables d'environnement
source .env

echo "🚀 Synchronisation de la base de données locale vers Railway..."
echo ""

# Vérifier que la base locale existe
echo "✓ Vérification de la base de données locale..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1" > /dev/null 2>&1 || {
  echo "✗ Erreur: Impossible de se connecter à la base locale"
  exit 1
}

echo "✓ Export de toutes les tables..."
PGPASSWORD=$DB_PASSWORD pg_dump \
  -h $DB_HOST \
  -U $DB_USER \
  -d $DB_NAME \
  --no-owner \
  --no-privileges \
  > /tmp/railway_sync.sql

echo "✓ Restauration sur Railway..."
psql "$DATABASE_PUBLIC_URL" -f /tmp/railway_sync.sql > /dev/null 2>&1 || {
  echo "✗ Erreur: Impossible de restaurer la base sur Railway"
  rm /tmp/railway_sync.sql
  exit 1
}

# Nettoyage
rm /tmp/railway_sync.sql

echo ""
echo "✅ Synchronisation réussie ! La base locale a été copiée vers Railway"


