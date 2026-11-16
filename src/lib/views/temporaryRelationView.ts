export function createTemporaryRelationView() {
  return {
    id: `temporary-relation-${crypto.randomUUID()}`,
    name: 'Relations · temporaire',
    type: 'table',
    temporaryRelationView: true,
    filters: [],
    groups: [],
    hiddenFields: [],
  };
}

/** Keep session-only view configuration out of the saved views. */
export function splitTemporaryView(views: Record<string, any[]>, collectionId: string, viewId: string) {
  const temporary = views[collectionId]?.find(view => view.id === viewId) ?? null;
  const saved = { ...views, [collectionId]: (views[collectionId] || []).filter(view => view.id !== viewId) };
  return { temporary, saved };
}
