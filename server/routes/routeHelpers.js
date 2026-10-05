export const mergePreferences = (baseValue, patchValue) => {
  if (Array.isArray(baseValue) || Array.isArray(patchValue)) {
    return Array.isArray(patchValue) ? patchValue : baseValue;
  }
  if (!patchValue || typeof patchValue !== 'object') return patchValue;
  const baseObject = baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue)
    ? baseValue
    : {};
  const result = { ...baseObject };
  for (const [key, value] of Object.entries(patchValue)) {
    const current = baseObject[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' && !Array.isArray(current)) {
      result[key] = mergePreferences(current, value);
    } else {
      result[key] = value;
    }
  }
  return result;
};

export const createOrganizationFromImportedState = async ({ pool, uuidv4, INITIAL_APP_STATE, ensureSystemRolesForOrganization, getRoleByNameInOrganization, syncAppStateIdSequence }, ownerUserId, organizationName, state) => {
  const orgId = uuidv4();
  const trimmedName = String(organizationName || '').trim() || `Organisation importée ${new Date().toLocaleDateString('fr-FR')}`;
  const safeState = state && typeof state === 'object' ? state : { ...INITIAL_APP_STATE };
  await pool.query('INSERT INTO organizations (id, name, owner_user_id) VALUES ($1, $2, $3)', [orgId, trimmedName, ownerUserId]);
  await pool.query('INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [orgId, ownerUserId]);
  await ensureSystemRolesForOrganization(orgId);
  const adminRole = await getRoleByNameInOrganization(orgId, 'admin');
  if (adminRole.rowCount) {
    await pool.query('INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [orgId, ownerUserId, adminRole.rows[0].id]);
  }
  await syncAppStateIdSequence();
  await pool.query(`INSERT INTO app_state (organization_id, user_id, data)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         data = EXCLUDED.data`, [orgId, ownerUserId, JSON.stringify(safeState)]);
  return { id: orgId, name: trimmedName };
};
