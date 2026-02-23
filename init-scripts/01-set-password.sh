#!/bin/bash
set -e

# Attend que Postgres soit prêt
until pg_isready -U postgres; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

# CRÉE le rôle s'il n'existe PAS + donne TOUS les droits
psql -v ON_ERROR_STOP=1 --username "postgres" <<-EOSQL
    DO \$\$
    BEGIN
        -- Crée l'utilisateur s'il n'existe pas
        IF NOT EXISTS (
            SELECT FROM pg_catalog.pg_roles 
            WHERE  rolname = 'erp_superuser'
        ) THEN
            CREATE USER erp_superuser 
            WITH SUPERUSER 
            PASSWORD 'KL&XZGG2W#W2#5';
        END IF;
        
        -- Donne TOUS les droits (même si déjà créé)
        GRANT ALL PRIVILEGES ON DATABASE erp_db TO erp_superuser;
        GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO erp_superuser;
        GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO erp_superuser;
        GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO erp_superuser;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO erp_superuser;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO erp_superuser;
        
        -- Force le mdp (au cas où)
        ALTER USER erp_superuser PASSWORD 'KL&XZGG2W#W2#5';
    END\$\$;
    
    SELECT '✅ erp_superuser créé/configuré avec succès' AS status;
EOSQL

echo "✅ Init script terminé"
