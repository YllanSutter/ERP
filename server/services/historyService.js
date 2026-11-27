import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

const internalItemFields = new Set(['_eventSegments', '_preserveEventSegments', '_steamExchangeReceivedIds', '_archivedAt']);
const publicValues = (value, secretIds = new Set()) => Object.fromEntries(
  Object.entries(value || {}).filter(([key]) => !internalItemFields.has(key) && !secretIds.has(key))
);

const collectionFields = (collection) => {
  const { items: _items, ...fields } = collection || {};
  const result = publicValues(fields);
  const secretIds = new Set((collection?.properties || []).filter(property => property.type === 'password').map(property => property.id));
  if (Array.isArray(result.collectionTemplates)) {
    result.collectionTemplates = result.collectionTemplates.map(template => {
      const values = Object.fromEntries(Object.entries(template.values || {}).filter(([key]) => !secretIds.has(key)));
      const dateDefaults = Object.fromEntries(Object.entries(template.dateDefaults || {}).filter(([key]) => !secretIds.has(key)));
      return {
        ...template,
        fieldIds: (template.fieldIds || []).filter(fieldId => !secretIds.has(fieldId)),
        values,
        dateDefaults,
      };
    });
  }
  return result;
};

const viewFields = (view) => Object.fromEntries(
  Object.entries(view || {}).filter(([key]) => [
    'name', 'type', 'fieldGroups', 'fieldGroupsLayout', 'hiddenFields',
    'fieldOrder', 'visibleFields', 'visibleProperties', 'columns',
  ].includes(key))
);

function compactUpdatedValues(before = {}, after = {}) {
  const changedIds = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(fieldId => Object.hasOwn(before, fieldId) !== Object.hasOwn(after, fieldId) ||
      (Object.hasOwn(before, fieldId) && !isDeepStrictEqual(before[fieldId], after[fieldId])));
  return {
    before: Object.fromEntries(changedIds.filter(id => Object.hasOwn(before, id)).map(id => [id, before[id]])),
    after: Object.fromEntries(changedIds.filter(id => Object.hasOwn(after, id)).map(id => [id, after[id]])),
  };
}

const itemLabel = (item, collection) => {
  const titleProperty = (collection?.properties || []).find(property => property.isTitle || property.id === 'name' || property.id === 'title');
  if (titleProperty?.type === 'password') return String(item?.id || 'Objet');
  const value = titleProperty ? item?.[titleProperty.id] : item?.name || item?.title;
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 240);
  return String(item?.id || 'Objet');
};

const itemLabelFieldId = (collection) => {
  const property = (collection?.properties || []).find(entry => entry.isTitle || entry.id === 'name' || entry.id === 'title');
  return property?.type === 'password' ? null : property?.id || null;
};

function makeEvent({ entityType, collectionId, entityId, entityLabel, entityLabelFieldId = null, action, before, after, actor, source, mutationId }) {
  // Updates store only changed fields. Creation/deletion events retain the
  // full object snapshot because undo needs it to remove or recreate the item.
  const values = action === 'updated' ? compactUpdatedValues(before, after) : { before, after };
  return {
    id: randomUUID(),
    entityType,
    collectionId,
    entityId,
    entityLabel,
    entityLabelFieldId,
    action,
    beforeValues: values.before,
    afterValues: values.after,
    actorId: actor?.id || null,
    actorName: actor?.name || actor?.email || 'Utilisateur',
    source: source || 'user',
    mutationId: mutationId || randomUUID(),
  };
}

/** Build append-only events from the authoritative pre-save and post-save states. */
export function buildHistoryEvents(previousState, nextState, { actor, source = 'user', mutationId } = {}) {
  const batchId = mutationId || randomUUID();
  const previousCollections = previousState?.collections || [];
  const nextCollections = nextState?.collections || [];
  const previousById = new Map(previousCollections.map(collection => [collection.id, collection]));
  const nextById = new Map(nextCollections.map(collection => [collection.id, collection]));
  const events = [];

  const previousViews = previousState?.views || {};
  const nextViews = nextState?.views || {};
  for (const collectionId of new Set([...Object.keys(previousViews), ...Object.keys(nextViews)])) {
    const beforeViews = new Map((previousViews[collectionId] || []).map(view => [view.id, view]));
    const afterViews = new Map((nextViews[collectionId] || []).map(view => [view.id, view]));
    for (const viewId of new Set([...beforeViews.keys(), ...afterViews.keys()])) {
      const beforeView = beforeViews.get(viewId);
      const afterView = afterViews.get(viewId);
      const before = beforeView ? viewFields(beforeView) : {};
      const after = afterView ? viewFields(afterView) : {};
      if (isDeepStrictEqual(before, after)) continue;
      events.push(makeEvent({
        entityType: 'view', collectionId, entityId: viewId,
        entityLabel: afterView?.name || beforeView?.name || 'Vue',
        action: !beforeView ? 'created' : !afterView ? 'deleted' : 'updated',
        before, after, actor, source, mutationId: batchId,
      }));
    }
  }

  for (const collectionId of new Set([...previousById.keys(), ...nextById.keys()])) {
    const previous = previousById.get(collectionId);
    const next = nextById.get(collectionId);
    const collection = next || previous;
    const beforeCollection = previous ? collectionFields(previous) : {};
    const afterCollection = next ? collectionFields(next) : {};
    if (!isDeepStrictEqual(beforeCollection, afterCollection)) {
      events.push(makeEvent({
        entityType: 'collection', collectionId, entityId: collectionId,
        entityLabel: next?.name || previous?.name || 'Collection',
        action: !previous ? 'created' : !next ? 'deleted' : 'updated',
        before: beforeCollection, after: afterCollection, actor, source, mutationId: batchId,
      }));
    }

    const secrets = new Set([
      ...(previous?.properties || []), ...(next?.properties || []),
    ].filter(property => property.type === 'password').map(property => property.id));
    const previousItems = new Map((previous?.items || []).map(item => [item.id, item]));
    const nextItems = new Map((next?.items || []).map(item => [item.id, item]));
    for (const itemId of new Set([...previousItems.keys(), ...nextItems.keys()])) {
      const beforeItem = previousItems.get(itemId);
      const afterItem = nextItems.get(itemId);
      const before = beforeItem ? publicValues(beforeItem, secrets) : {};
      const after = afterItem ? publicValues(afterItem, secrets) : {};
      if (isDeepStrictEqual(before, after)) continue;
      events.push(makeEvent({
        entityType: 'item', collectionId, entityId: itemId,
        entityLabel: itemLabel(afterItem || beforeItem, collection),
        entityLabelFieldId: itemLabelFieldId(collection),
        action: !beforeItem ? 'created' : !afterItem ? 'deleted' : 'updated',
        before, after, actor, source, mutationId: batchId,
      }));
    }
  }

  return events;
}

export async function insertHistoryEvents(db, organizationId, events) {
  for (const event of events) {
    await db.query(`INSERT INTO history_events
      (id, organization_id, entity_type, collection_id, entity_id, entity_label, entity_label_field_id, action,
       before_values, after_values, actor_id, actor_name, source, mutation_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14)
      ON CONFLICT (organization_id, mutation_id, entity_type, entity_id) DO NOTHING`, [
      event.id, organizationId, event.entityType, event.collectionId, event.entityId,
      event.entityLabel, event.entityLabelFieldId, event.action,
      JSON.stringify(event.beforeValues), JSON.stringify(event.afterValues),
      event.actorId, event.actorName, event.source, event.mutationId,
    ]);
  }
}

