/** Account-wide appearance preferences; collection/view state remains scoped. */
export const ACCOUNT_STORAGE_KEYS = ['erp-theme', 'erp:animated-backdrop', 'erp:recent-colors', 'erp_sidebar_open'];
export const isAccountStorageKey = key => ACCOUNT_STORAGE_KEYS.includes(key);

export async function migrateAccountState(pool, userId, organizationId) {
  // Preserve legacy organization copies for rollback. Current organization wins
  // on the first migration; once a global value exists it is authoritative.
  await pool.query(`WITH legacy AS (
    SELECT DISTINCT ON (key) key, value FROM browser_state
    WHERE owner_key = $1::text AND key = ANY($3::text[])
    ORDER BY key, (organization_id = $2::uuid) DESC, organization_id
  ) INSERT INTO user_state (user_id, key, value)
    SELECT $1::uuid, key, value FROM legacy
    ON CONFLICT (user_id, key) DO NOTHING`, [userId, organizationId, ACCOUNT_STORAGE_KEYS]);
}
