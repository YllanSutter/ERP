const internalFields = new Set(['_eventSegments', '_preserveEventSegments', '_steamExchangeReceivedIds']);
export const isSyncableItemField = (key) => !key.startsWith('_') || internalFields.has(key);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Les champs métier restent libres : aucun nom de collection/propriété n'est codé ici.
export function buildItemChanges(previous, next, includePrevious = false) {
  const before = new Map(previous.map((col) => [col.id, col]));
  const changes = [];
  for (const col of next) {
    const base = before.get(col.id);
    if (!base) throw new Error('Collection not found');
    const passwordFields = new Set((base.properties || []).filter(({ type }) => type === 'password').map(({ id }) => id));
    const oldItems = new Map((base.items || []).map((item) => [item.id, item]));
    const nextIds = new Set((col.items || []).map((item) => item.id));
    const added = [], updated = [], deleted = [];
    for (const item of col.items || []) {
      const old = oldItems.get(item.id);
      if (!old) { added.push(item); continue; }
      const fields = {}, unset = [];
      const previousFields = {};
      for (const key of new Set([...Object.keys(old), ...Object.keys(item)])) {
        if (key === 'id' || !isSyncableItemField(key) || equal(old[key], item[key])) continue;
        if (includePrevious && !passwordFields.has(key) && Object.hasOwn(old, key)) previousFields[key] = old[key];
        if (Object.hasOwn(item, key)) fields[key] = item[key];
        else unset.push(key);
      }
      if (Object.keys(fields).length || unset.length) updated.push({ itemId: item.id, fields, unset, ...(includePrevious ? { previous: previousFields } : {}) });
    }
    for (const item of base.items || []) if (!nextIds.has(item.id)) deleted.push(item.id);
    // Ajouts en fin et suppressions conservent déjà l'ordre sans envoyer tous les IDs.
    const naturalOrder = [...(base.items || []).filter((item) => nextIds.has(item.id)).map((item) => item.id), ...added.map((item) => item.id)];
    const order = (col.items || []).map((item) => item.id);
    const reordered = !equal(naturalOrder, order);
    if (added.length || updated.length || deleted.length || reordered) {
      changes.push({ collectionId: col.id, added, updated, deleted, ...(reordered ? { order } : {}) });
    }
  }
  return changes;
}

export function applyItemChanges(collections, changes) {
  const byId = new Map(changes.map((change) => [change.collectionId, change]));
  if (byId.size !== changes.length || changes.some((change) => !collections.some((col) => col.id === change.collectionId))) {
    throw new Error('Invalid collection changes');
  }
  return collections.map((col) => {
    const change = byId.get(col.id);
    if (!change) return col;
    const items = new Map((col.items || []).map((item) => [item.id, item]));
    const touched = new Set();
    const touch = (id) => {
      if (touched.has(id)) throw new Error('Duplicate item operation');
      touched.add(id);
    };
    for (const id of change.deleted) {
      touch(id);
      if (!items.delete(id)) throw new Error('Item not found');
    }
    for (const update of change.updated) {
      touch(update.itemId);
      if (!items.has(update.itemId)) throw new Error('Item not found');
      if (Object.hasOwn(update.fields, 'id') || update.unset.includes('id')) throw new Error('Cannot change item ID');
      const item = { ...items.get(update.itemId), ...update.fields };
      for (const key of update.unset) delete item[key];
      items.set(update.itemId, item);
    }
    for (const item of change.added) {
      touch(item.id);
      if (items.has(item.id)) throw new Error('Item already exists');
      items.set(item.id, { ...item });
    }
    if (change.order) {
      if (new Set(change.order).size !== items.size || change.order.length !== items.size || change.order.some((id) => !items.has(id))) {
        throw new Error('Invalid item order');
      }
      return { ...col, items: change.order.map((id) => items.get(id)) };
    }
    return { ...col, items: [...items.values()] };
  });
}
