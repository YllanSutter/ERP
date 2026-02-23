#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "erp_superuser" --dbname "erp_db" <<-EOSQL
    -- Force le mdp même après restore
    ALTER USER erp_superuser PASSWORD 'KL&XZGG2W#W2#5';
    -- Permissions explicites
    GRANT ALL PRIVILEGES ON DATABASE erp_db TO erp_superuser;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO erp_superuser;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO erp_superuser;
    GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO erp_superuser;
EOSQL