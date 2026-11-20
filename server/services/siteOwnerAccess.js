// Record the first account once; organization imports cannot transfer site ownership.
const SITE_OWNER_KEY = 'site_owner_user_id';
const SITE_ADMINS_KEY = 'site_admin_user_ids';

export async function ensureSiteCreator(pool) {
  await pool.query(`INSERT INTO site_settings (key, value)
    SELECT $1, id::text FROM users ORDER BY created_at ASC, id ASC LIMIT 1
    ON CONFLICT (key) DO NOTHING`, [SITE_OWNER_KEY]);

  await pool.query(`INSERT INTO site_settings (key, value)
    SELECT $1, json_build_array(value)::text FROM site_settings WHERE key = $2
    ON CONFLICT (key) DO NOTHING`, [SITE_ADMINS_KEY, SITE_OWNER_KEY]);
}

const parseUserIds = (value) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export async function isSiteCreator(pool, userId) {
  if (!userId) return false;
  const result = await pool.query('SELECT key, value FROM site_settings WHERE key = ANY($1)', [[SITE_OWNER_KEY, SITE_ADMINS_KEY]]);
  const settings = new Map(result.rows.map((row) => [row.key, row.value]));
  return settings.get(SITE_OWNER_KEY) === userId || parseUserIds(settings.get(SITE_ADMINS_KEY)).includes(userId);
}

export async function setSiteAdministrator(pool, userId, enabled) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT key, value FROM site_settings WHERE key = ANY($1) FOR UPDATE', [[SITE_OWNER_KEY, SITE_ADMINS_KEY]]);
    const settings = new Map(result.rows.map((row) => [row.key, row.value]));
    const ownerId = settings.get(SITE_OWNER_KEY);
    if (!ownerId) throw new Error('Compte principal introuvable');
    if (userId === ownerId && !enabled) throw new Error('Le compte principal doit rester super administrateur');

    const adminIds = new Set(parseUserIds(settings.get(SITE_ADMINS_KEY)));
    adminIds.add(ownerId);
    if (enabled) adminIds.add(userId);
    else adminIds.delete(userId);

    await client.query(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [SITE_ADMINS_KEY, JSON.stringify([...adminIds])]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
