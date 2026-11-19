// Record the first account once; organization imports cannot transfer site ownership.
export async function ensureSiteCreator(pool) {
  await pool.query(`INSERT INTO site_settings (key, value)
    SELECT 'site_owner_user_id', id::text FROM users ORDER BY created_at ASC, id ASC LIMIT 1
    ON CONFLICT (key) DO NOTHING`);
}
export async function isSiteCreator(pool, userId) {
  if (!userId) return false;
  const result = await pool.query("SELECT value FROM site_settings WHERE key='site_owner_user_id'");
  return result.rows[0]?.value === userId;
}
