/** Unscoped legacy values have no reliable owner: require an explicit claim. */
export function legacyStorageScope(key, userId, organizationId) {
  if (!/^(erp[-_:]|calendarViewMode)/.test(key)) return 'foreign';
  if (key.startsWith('erp-pinned-item-fields:')) {
    const [org, user] = key.slice('erp-pinned-item-fields:'.length).split(':');
    return org === organizationId && user === userId ? 'owned' : 'foreign';
  }
  if (key.startsWith('erp-item-versions:')) {
    const parts = key.slice('erp-item-versions:'.length).split(':');
    if (parts.length === 3) return parts[0] === organizationId ? 'owned' : 'foreign';
  }
  const suffix = key.match(/^erp_(?:activeCollection|activeView|activeDashboard|showViewSettings)_(.+)$/);
  if (suffix && suffix[1] !== organizationId) return 'foreign';
  const lastView = key.match(/^erp_lastView_([^_]+)_/);
  if (lastView && lastView[1] !== organizationId) return 'foreign';
  return 'claim';
}
