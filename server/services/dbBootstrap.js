export const bootstrapDatabase = async ({ pool, ensureDefaultOrganization }) => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      provider TEXT,
      provider_id TEXT,
      password_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='favorite_views') THEN
        ALTER TABLE users ADD COLUMN favorite_views TEXT[] DEFAULT ARRAY[]::TEXT[];
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='favorite_items') THEN
        ALTER TABLE users ADD COLUMN favorite_items TEXT[] DEFAULT ARRAY[]::TEXT[];
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='user_preferences') THEN
        ALTER TABLE users ADD COLUMN user_preferences JSONB DEFAULT '{}'::jsonb;
      END IF;
    END$$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organization_members (
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (organization_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS plugin_configs (
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      plugin_id TEXT NOT NULL,
      enabled BOOLEAN DEFAULT FALSE,
      config JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (organization_id, plugin_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT FALSE
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='organization_id') THEN
        ALTER TABLE roles ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
    END$$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `);

  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS roles_org_name_unique_idx ON roles (organization_id, name);');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_roles' AND column_name='organization_id') THEN
        ALTER TABLE user_roles ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
    END$$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `);

  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS user_roles_org_user_role_unique_idx ON user_roles (organization_id, user_id, role_id);');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY,
      role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      collection_id TEXT,
      item_id TEXT,
      field_id TEXT,
      can_read BOOLEAN DEFAULT FALSE,
      can_write BOOLEAN DEFAULT FALSE,
      can_delete BOOLEAN DEFAULT FALSE,
      can_manage_fields BOOLEAN DEFAULT FALSE,
      can_manage_views BOOLEAN DEFAULT FALSE,
      can_manage_permissions BOOLEAN DEFAULT FALSE
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='organization_id') THEN
        ALTER TABLE permissions ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
    END$$;
  `);

  await pool.query(`
    DO $$ 
    BEGIN
      ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_role_id_collection_id_item_id_field_id_key;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `);

  await pool.query('DROP INDEX IF EXISTS permissions_unique_idx;');

  await pool.query(`
    DELETE FROM permissions p1
    WHERE EXISTS (
      SELECT 1 FROM permissions p2
      WHERE COALESCE(p2.organization_id::text, '') = COALESCE(p1.organization_id::text, '')
        AND p2.role_id = p1.role_id
        AND COALESCE(p2.collection_id, '') = COALESCE(p1.collection_id, '')
        AND COALESCE(p2.item_id, '') = COALESCE(p1.item_id, '')
        AND COALESCE(p2.field_id, '') = COALESCE(p1.field_id, '')
        AND p2.id > p1.id
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX permissions_unique_idx 
    ON permissions (organization_id, role_id, COALESCE(collection_id, ''), COALESCE(item_id, ''), COALESCE(field_id, ''));
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      UNIQUE(user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organization_members (
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (organization_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS plugin_configs (
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      plugin_id TEXT NOT NULL,
      enabled BOOLEAN DEFAULT FALSE,
      config JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (organization_id, plugin_id)
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_state' AND column_name='user_id') THEN
        ALTER TABLE app_state ALTER COLUMN user_id DROP NOT NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_state' AND column_name='organization_id') THEN
        ALTER TABLE app_state ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
    END$$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE app_state DROP CONSTRAINT IF EXISTS app_state_user_id_key;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `);

  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS app_state_organization_id_unique ON app_state (organization_id);');
  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('app_state', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM app_state), 0) + 1, 1),
      false
    );
  `);

  // Automations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS automations (
      id UUID PRIMARY KEY,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Nouvelle automation',
      enabled BOOLEAN DEFAULT TRUE,
      trigger_data JSONB NOT NULL DEFAULT '{}',
      actions_data JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS automations_org_idx ON automations (organization_id);');

  const firstUser = await pool.query('SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1');
  if (firstUser.rowCount > 0) {
    await ensureDefaultOrganization(firstUser.rows[0].id);
  }
};
