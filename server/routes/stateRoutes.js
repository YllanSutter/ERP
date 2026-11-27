import { validateSteamExchanges } from '../plugins/steam/exchanges.js';
import { organizationRoom } from '../services/socketPresence.js';
import { isDeepStrictEqual } from 'node:util';
import { notifyServerPluginsStateSaved } from '../plugins/registry.js';
import { buildItemChanges, applyItemChanges } from '../../shared/itemChanges.js';
import { ZodError } from 'zod';
import { statePayloadSchema, itemChangesPayloadSchema } from '../../shared/validation.js';
import { loadAutomations, triggerAutomations } from '../services/automationService.js';
import {
  decryptSecret,
  decryptStateSecrets,
  maskStateSecrets,
  encryptStateSecrets,
  prepareStateForStorage,
} from '../services/secretFieldService.js';
import { buildHistoryEvents, insertHistoryEvents } from '../services/historyService.js';

const filterStateForUser = (data, ctx, hasPermission) => {
  if (!data || !data.collections) return data;
  const permissionCache = new Map();
  const checkPermission = (scope, action) => {
    const key = `${scope.collection_id || ''}|${scope.item_id || ''}|${scope.field_id || ''}|${action}`;
    if (permissionCache.has(key)) return permissionCache.get(key);
    const result = hasPermission(ctx, scope, action);
    permissionCache.set(key, result);
    return result;
  };

  const filteredCollections = (data.collections || []).map((col) => {
    const canReadCollection = checkPermission({ collection_id: col.id }, 'can_read');
    const visibleProps = (col.properties || []).filter((prop) =>
      checkPermission({ collection_id: col.id, field_id: prop.id }, 'can_read')
    );

    if (!canReadCollection) {
      const allowedItems = (col.items || []).filter((item) =>
        checkPermission({ collection_id: col.id, item_id: item.id }, 'can_read')
      );
      if (allowedItems.length === 0) return null;
      return { ...col, properties: visibleProps, items: allowedItems };
    }

    const items = (col.items || []).map((item) => {
      const canReadItem = checkPermission({ collection_id: col.id, item_id: item.id }, 'can_read') || canReadCollection;
      if (!canReadItem) return null;
      let next = { ...item };
      visibleProps.forEach((prop) => {
        const canReadField = checkPermission({ collection_id: col.id, item_id: item.id, field_id: prop.id }, 'can_read');
        if (!canReadField) {
          next = { ...next };
          delete next[prop.id];
        }
      });
      return next;
    }).filter(Boolean);

    return { ...col, properties: visibleProps, items };
  }).filter(Boolean);

  return { ...data, collections: filteredCollections };
};

const getItemConflicts = (collections, changes) => {
  const conflicts = [];
  for (const change of changes) {
    if (change.added.length || change.deleted.length || change.order) return null;
    const collection = collections.find(({ id }) => id === change.collectionId);
    if (!collection) return null;
    for (const { itemId, fields, unset, previous } of change.updated) {
      const item = collection.items?.find(({ id }) => id === itemId);
      if (!item || !previous) return null;
      for (const key of [...Object.keys(fields), ...unset]) {
        if (collection.properties?.some((property) => property.id === key && property.type === 'password')) return null;
        const current = Object.hasOwn(item, key) ? item[key] : undefined;
        const before = Object.hasOwn(previous, key) ? previous[key] : undefined;
        const desired = unset.includes(key) ? undefined : fields[key];
        if (!isDeepStrictEqual(current, before) && !isDeepStrictEqual(current, desired)) {
          conflicts.push({ collectionId: collection.id, itemId, key, current });
        }
      }
    }
  }
  return conflicts;
};

export const registerStateRoutes = ({ app, appContext }) => {
  const {
    logger,
    requireAuth,
    requirePermission,
    pool,
    hasPermission,
    INITIAL_APP_STATE,
    syncAppStateIdSequence,
    getCalendarConfigForUser,
    shouldRecalculateSegments,
    calculateEventSegments,
    logAudit,
    defaultCalendarConfig,
  } = appContext;
  const stateConflict = (res) => res.status(409).json({ error: 'State changed since it was loaded' });

  const writeStatePatch = async (organizationId, previousRow, data, historyEvents = []) => {
    if (!previousRow) await syncAppStateIdSequence();
    // Query-only adapters are used by isolated route tests; production pg Pool supports connect().
    if (typeof pool.connect !== 'function') {
      return previousRow
        ? pool.query(
          'UPDATE app_state SET data = $1, version = version + 1 WHERE organization_id = $2 AND version = $3 AND data = $4 RETURNING version',
          [data, organizationId, previousRow.version, previousRow.data]
        )
        : pool.query(
          'INSERT INTO app_state (organization_id, data, version) VALUES ($1, $2, 2) ON CONFLICT (organization_id) DO NOTHING RETURNING version',
          [organizationId, data]
        );
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = previousRow
        ? await client.query(
          'UPDATE app_state SET data = $1, version = version + 1 WHERE organization_id = $2 AND version = $3 AND data = $4 RETURNING version',
          [data, organizationId, previousRow.version, previousRow.data]
        )
        : await client.query(
          'INSERT INTO app_state (organization_id, data, version) VALUES ($1, $2, 2) ON CONFLICT (organization_id) DO NOTHING RETURNING version',
          [organizationId, data]
        );
      if (result.rowCount) await insertHistoryEvents(client, organizationId, historyEvents);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };

  // PATCH /api/state/item
  app.patch('/api/state/item', requireAuth, async (req, res) => {
    try {
      const { collectionId, itemId, fields, stateVersion } = req.body ?? {};
      const userId = req.auth.user.id;
      const organizationId = req.auth.activeOrganization?.id;
      const calendarConfig = getCalendarConfigForUser(req.auth.user);

      if (!organizationId) return res.status(400).json({ error: 'No active organization' });
      if (!collectionId || !itemId || !fields || typeof fields !== 'object') {
        return res.status(400).json({ error: 'collectionId, itemId and fields are required' });
      }
      if (!hasPermission(req.auth, { collection_id: collectionId }, 'can_write')) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const stateResult = await pool.query(
        'SELECT data, version FROM app_state WHERE organization_id = $1 LIMIT 1',
        [organizationId]
      );
      if (stateResult.rows.length === 0) {
        return res.status(404).json({ error: 'State not found' });
      }

      const previousRow = stateResult.rows[0];
      if (stateVersion != null && stateVersion !== Number(previousRow.version)) return stateConflict(res);

      const state = decryptStateSecrets(JSON.parse(previousRow.data), { preserveUnreadable: true });
      const collections = Array.isArray(state.collections) ? state.collections : [];

      const colIdx = collections.findIndex((c) => c.id === collectionId);
      if (colIdx === -1) return res.status(404).json({ error: 'Collection not found' });

      const col = collections[colIdx];
      const items = Array.isArray(col.items) ? col.items : [];
      const itemIdx = items.findIndex((i) => i.id === itemId);
      if (itemIdx === -1) return res.status(404).json({ error: 'Item not found' });

      const prevItem = items[itemIdx];
      const mergedItem = { ...prevItem, ...fields };

      const processedItem = shouldRecalculateSegments(prevItem, mergedItem, col, col)
        ? calculateEventSegments(mergedItem, col, calendarConfig)
        : mergedItem;

      const newItems = items.map((it, idx) => (idx === itemIdx ? processedItem : it));
      const newCollections = collections.map((c, idx) =>
        idx === colIdx ? { ...c, items: newItems } : c
      );

      let newState = { ...state, collections: newCollections };

      // ── Automation triggers: item_updated ──────────────────────────────────
      try {
        const automations = await loadAutomations(pool, organizationId);
        if (automations.length > 0) {
          newState = await triggerAutomations({
            eventType: 'item_updated',
            collectionId,
            triggerItem: processedItem,
            prevItem,
            state: newState,
            automations,
            pool,
            organizationId,
            calculateEventSegments,
            getDefaultCalendarConfig: () => calendarConfig,
          });
        }
      } catch (autoErr) {
        logger.error('[Automation] item_updated trigger error', autoErr);
      }
      // ──────────────────────────────────────────────────────────────────────

      const stateStr = JSON.stringify(prepareStateForStorage(newState, state));

      const historyEvents = buildHistoryEvents(state, newState, {
        actor: req.auth.user,
        mutationId: req.body?.mutationId,
      });
      const updateRes = await writeStatePatch(organizationId, previousRow, stateStr, historyEvents);
      if (updateRes.rowCount === 0) return stateConflict(res);

      await notifyServerPluginsStateSaved({ appContext, auth: req.auth, previousState: state, state: newState });

      if (global.io) {
        global.io.to(organizationRoom(organizationId)).emit('stateUpdated', { userId, organizationId });
      }

      return res.json({
        ok: true,
        stateVersion: Number(updateRes.rows[0].version),
        item: maskStateSecrets({ collections: [{ ...col, items: [processedItem] }] }).collections[0].items[0],
      });
    } catch (err) {
      logger.error('Failed to patch item', err);
      return res.status(500).json({ error: 'Failed to patch item' });
    }
  });

  // PATCH /api/state/structure
  app.patch('/api/state/structure', requireAuth, async (req, res) => {
    try {
      const { type, payload, stateVersion } = req.body ?? {};
      const userId = req.auth.user.id;
      const organizationId = req.auth.activeOrganization?.id;

      if (!organizationId) return res.status(400).json({ error: 'No active organization' });
      if (!type || !payload) return res.status(400).json({ error: 'type and payload are required' });

      const stateResult = await pool.query(
        'SELECT data, version FROM app_state WHERE organization_id = $1 LIMIT 1',
        [organizationId]
      );
      const previousRow = stateResult.rows[0];
      if (stateVersion != null && stateVersion !== Number(previousRow?.version ?? 1)) return stateConflict(res);

      const existingState = previousRow
        ? decryptStateSecrets(JSON.parse(previousRow.data), { preserveUnreadable: true })
        : { ...INITIAL_APP_STATE };

      let newState = { ...existingState };

      if (type === 'views') {
        newState = { ...newState, views: payload };
      } else if (type === 'dashboards') {
        newState = { ...newState, dashboards: payload };
      } else if (type === 'dashboardSort') {
        newState = { ...newState, dashboardSort: payload };
      } else if (type === 'dashboardFilters') {
        newState = { ...newState, dashboardFilters: payload };
      } else if (type === 'favorites') {
        newState = { ...newState, favorites: payload };
      } else if (type === 'collectionMeta') {
        const { collectionId, patch } = payload;
        newState = {
          ...newState,
          collections: (newState.collections || []).map((c) =>
            c.id === collectionId ? { ...c, ...patch, items: c.items } : c
          ),
        };
      } else if (type === 'addCollection') {
        newState = { ...newState, collections: [...(newState.collections || []), payload] };
      } else if (type === 'deleteCollection') {
        newState = {
          ...newState,
          collections: (newState.collections || []).filter((c) => c.id !== payload.collectionId),
        };
      }

      const stateStr = JSON.stringify(prepareStateForStorage(newState, existingState));
      const historyEvents = buildHistoryEvents(existingState, newState, {
        actor: req.auth.user,
        mutationId: req.body?.mutationId,
      });
      const updateRes = await writeStatePatch(organizationId, previousRow, stateStr, historyEvents);
      if (updateRes.rowCount === 0) return stateConflict(res);

      await notifyServerPluginsStateSaved({ appContext, auth: req.auth, previousState: existingState, state: newState });

      if (global.io) {
        global.io.to(organizationRoom(organizationId)).emit('structureUpdated', { userId, organizationId, type });
      }

      return res.json({ ok: true, stateVersion: Number(updateRes.rows[0].version) });
    } catch (err) {
      logger.error('Failed to patch structure', err);
      return res.status(500).json({ error: 'Failed to patch structure' });
    }
  });

  // Les secrets ne sont jamais inclus dans /api/state. Cette route très ciblée
  // sert uniquement à préparer un export PDF autorisé.
  app.post('/api/state/password-values', requireAuth, async (req, res) => {
    try {
      const { collectionId, itemId, propertyIds } = req.body ?? {};
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId || !collectionId || !itemId || !Array.isArray(propertyIds)) {
        return res.status(400).json({ error: 'collectionId, itemId and propertyIds are required' });
      }

      const stateResult = await pool.query(
        'SELECT data FROM app_state WHERE organization_id = $1 LIMIT 1',
        [organizationId]
      );
      if (stateResult.rows.length === 0) return res.status(404).json({ error: 'State not found' });

      const state = JSON.parse(stateResult.rows[0].data);
      const collection = (state.collections || []).find((entry) => entry.id === collectionId);
      const item = collection?.items?.find((entry) => entry.id === itemId);
      if (!collection || !item) return res.status(404).json({ error: 'Collection or item not found' });

      const values = {};
      for (const propertyId of propertyIds) {
        const property = (collection.properties || []).find((entry) => entry.id === propertyId);
        if (!property || property.type !== 'password') {
          return res.status(400).json({ error: `Property ${propertyId} is not a password field` });
        }
        if (!hasPermission(req.auth, {
          collection_id: collectionId,
          item_id: itemId,
          field_id: propertyId,
        }, 'can_read')) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        try {
          values[propertyId] = decryptSecret(item[propertyId]);
        } catch {
          return res.status(422).json({ error: 'Ce champ secret ne peut pas être déchiffré sur ce serveur.' });
        }
      }

      return res.json({ values });
    } catch (err) {
      logger.error('Failed to load password values for PDF export', err);
      return res.status(500).json({ error: 'Failed to load password values' });
    }
  });

  app.get('/api/state', requireAuth, async (req, res) => {
    try {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });

      const userStateResult = await pool.query('SELECT data, version FROM app_state WHERE organization_id = $1 LIMIT 1', [organizationId]);
      let stateVersion = 1;
      let rawState = INITIAL_APP_STATE;
      if (userStateResult.rows.length > 0) {
        stateVersion = Number(userStateResult.rows[0].version) || 1;
        const storedState = JSON.parse(userStateResult.rows[0].data);
        const migratedState = encryptStateSecrets(storedState);
        if (JSON.stringify(storedState) !== JSON.stringify(migratedState)) {
          await pool.query(
            'UPDATE app_state SET data = $1 WHERE organization_id = $2 AND version = $3 AND data = $4',
            [JSON.stringify(migratedState), organizationId, userStateResult.rows[0].version, userStateResult.rows[0].data]
          );
        }
        rawState = migratedState;
      }
      const state = {
        ...INITIAL_APP_STATE,
        ...rawState,
        favorites: rawState?.favorites || { views: [], items: [] },
      };
      const filtered = filterStateForUser(state, req.auth, hasPermission);
      const { _lastItemMutation, ...publicState } = maskStateSecrets(filtered);
      return res.json({ ...publicState, stateVersion, supportsItemChanges: true });
    } catch (err) {
      logger.error('Failed to load state', err);
      return res.status(500).json({ error: 'Failed to load state' });
    }
  });

  const saveState = async (req, res, attempt = 0) => {
    try {
      const isItemDelta = req.method === 'PATCH';
      const payload = (isItemDelta ? itemChangesPayloadSchema : statePayloadSchema).parse(req.body ?? {});
      const expectedVersion = payload.stateVersion;
      const userId = req.auth.user.id;
      const organizationId = req.auth.activeOrganization?.id;
      const calendarConfig = getCalendarConfigForUser(req.auth.user);
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });
      const { stateVersion: _stateVersion, ...submittedState } = payload;
      let stateData = submittedState;

      const prevStateResult = await pool.query('SELECT data, version FROM app_state WHERE organization_id = $1 LIMIT 1', [organizationId]);
      const currentVersion = prevStateResult.rows.length > 0
        ? Number(prevStateResult.rows[0].version) || 1
        : 1;
      const prevState = prevStateResult.rows.length > 0
        ? decryptStateSecrets(JSON.parse(prevStateResult.rows[0].data), { preserveUnreadable: true })
        : {};
      const touchedIds = new Set(isItemDelta ? payload.itemChanges.map((change) => change.collectionId) : []);
      if (isItemDelta) {
        for (const collectionId of touchedIds) {
          if (!hasPermission(req.auth, { collection_id: collectionId }, 'can_write')) {
            return res.status(403).json({ error: 'Forbidden' });
          }
        }
      }
      const rebased = currentVersion > expectedVersion && isItemDelta;
      const conflictReply = (stateVersion, conflicts) => {
        const readable = conflicts?.length && conflicts.every(({ collectionId, itemId, key }) =>
          hasPermission(req.auth, { collection_id: collectionId, item_id: itemId }, 'can_read') &&
          hasPermission(req.auth, { collection_id: collectionId, item_id: itemId, field_id: key }, 'can_read')
        );
        return res.status(409).json({
          error: 'State changed since it was loaded',
          stateVersion,
          ...(readable ? { conflicts } : {}),
        });
      };
      const itemReply = (state, receipt, stateVersion) => ({
        ok: true,
        itemChanges: receipt.itemChanges,
        stateVersion,
        ...(receipt.rebased ? {
          rebasedCollections: maskStateSecrets(filterStateForUser(state, req.auth, hasPermission)).collections,
        } : {}),
      });
      // Une réponse perdue peut être redemandée sans rejouer les automations.
      if (isItemDelta && prevState._lastItemMutation?.id === payload.mutationId && prevState._lastItemMutation.userId === userId) {
        return res.json(itemReply(prevState, prevState._lastItemMutation, currentVersion));
      }
      if (currentVersion !== expectedVersion) {
        const conflicts = rebased ? getItemConflicts(prevState.collections || [], payload.itemChanges) : null;
        if (conflicts?.length !== 0) return conflictReply(currentVersion, conflicts);
      }
      if (isItemDelta) {
        try {
          stateData = { ...prevState, collections: applyItemChanges(prevState.collections || [], payload.itemChanges) };
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
      }
      const collections = stateData.collections || [];
      const prevCollections = Array.isArray(prevState.collections) ? prevState.collections : [];
      const prevCollectionsById = new Map(prevCollections.map((col) => [col.id, col]));

      for (const collection of collections) {
        if (isItemDelta && !touchedIds.has(collection.id)) continue;
        const error = validateSteamExchanges(collection, prevCollectionsById.get(collection.id));
        if (error) return res.status(400).json({ error });
      }

      const processedCollections = collections.map((col) => {
        if (!col.items || (isItemDelta && !touchedIds.has(col.id))) return col;

        const prevCol = prevCollectionsById.get(col.id);
        const prevItems = Array.isArray(prevCol?.items) ? prevCol.items : [];
        const prevItemsById = new Map(prevItems.map((item) => [item.id, item]));

        const processedItems = col.items.map((item) => {
          const prevItem = prevItemsById.get(item.id);

          if (!shouldRecalculateSegments(prevItem, item, col, prevCol)) {
            const preservedSegments = Array.isArray(item._eventSegments)
              ? item._eventSegments
              : Array.isArray(prevItem?._eventSegments)
                ? prevItem._eventSegments
                : [];
            return { ...item, _eventSegments: preservedSegments };
          }

          return calculateEventSegments(item, col, calendarConfig);
        });

        return { ...col, items: processedItems };
      });

      for (const col of processedCollections) {
        if (isItemDelta && !touchedIds.has(col.id)) continue;
        if (!hasPermission(req.auth, { collection_id: col.id }, 'can_write')) {
          return res.status(403).json({ error: `Forbidden to write collection ${col.id}` });
        }
      }

      const nextFavorites = stateData.favorites || { views: [], items: [] };
      let stateDataWithSegments = {
        ...INITIAL_APP_STATE,
        ...stateData,
        collections: processedCollections,
        favorites: {
          views: Array.isArray(nextFavorites.views) ? nextFavorites.views : [],
          items: Array.isArray(nextFavorites.items) ? nextFavorites.items : [],
        },
      };

      // Clean up _preserveEventSegments flag from all items before saving (it's transitive only)
      if (stateDataWithSegments.collections && Array.isArray(stateDataWithSegments.collections)) {
        stateDataWithSegments.collections = stateDataWithSegments.collections.map((col) => {
          if (!col.items || !Array.isArray(col.items)) return col;
          return {
            ...col,
            items: col.items.map((item) => {
              const { _preserveEventSegments, ...cleanItem } = item;
              return cleanItem;
            }),
          };
        });
      }

      // ── Automation triggers: item_created / item_deleted ──────────────────
      // Snapshot du nombre total d'items avant automations, pour détecter si
      // elles ont créé de nouveaux items (nécessaire pour sync client).
      const preAutoItemCount = processedCollections.reduce(
        (acc, c) => acc + (c.items?.length || 0), 0
      );

      try {
        const automations = await loadAutomations(pool, organizationId);
        if (automations.length > 0) {
          // Détecter les items créés et supprimés collection par collection
          const createdEvents = [];
          const deletedEvents = [];

          for (const col of processedCollections) {
            const prevCol = prevCollectionsById.get(col.id);
            const prevIds = new Set((prevCol?.items || []).map((i) => i.id));
            const newIds = new Set((col.items || []).map((i) => i.id));

            for (const item of (col.items || [])) {
              if (!prevIds.has(item.id)) {
                createdEvents.push({ collectionId: col.id, item });
              }
            }
            for (const item of (prevCol?.items || [])) {
              if (!newIds.has(item.id)) {
                deletedEvents.push({ collectionId: col.id, item });
              }
            }
          }

          if (isItemDelta) {
            for (const change of payload.itemChanges) {
              const col = processedCollections.find((entry) => entry.id === change.collectionId);
              const prevCol = prevCollectionsById.get(change.collectionId);
              for (const update of change.updated) {
                const item = col.items.find((entry) => entry.id === update.itemId);
                stateDataWithSegments = await triggerAutomations({
                  eventType: 'item_updated', collectionId: change.collectionId, triggerItem: item,
                  prevItem: prevCol.items.find((entry) => entry.id === update.itemId),
                  state: stateDataWithSegments, automations, pool, organizationId,
                  calculateEventSegments, getDefaultCalendarConfig: () => calendarConfig,
                });
              }
            }
          }

          for (const { collectionId: cId, item } of createdEvents) {
            stateDataWithSegments = await triggerAutomations({
              eventType: 'item_created',
              collectionId: cId,
              triggerItem: item,
              prevItem: null,
              state: stateDataWithSegments,
              automations,
              pool,
              organizationId,
              calculateEventSegments,
              getDefaultCalendarConfig: () => calendarConfig,
            });
          }

          for (const { collectionId: cId, item } of deletedEvents) {
            stateDataWithSegments = await triggerAutomations({
              eventType: 'item_deleted',
              collectionId: cId,
              triggerItem: item,
              prevItem: item,
              state: stateDataWithSegments,
              automations,
              pool,
              organizationId,
              calculateEventSegments,
              getDefaultCalendarConfig: () => calendarConfig,
            });
          }
        }
      } catch (autoErr) {
        logger.error('[Automation] state.post trigger error', autoErr);
      }
      // ──────────────────────────────────────────────────────────────────────

      // Détecter si les automations ont créé de nouveaux items
      const postAutoItemCount = stateDataWithSegments.collections.reduce(
        (acc, c) => acc + (c.items?.length || 0), 0
      );

      let responseChanges;
      if (isItemDelta) {
        const before = maskStateSecrets(filterStateForUser(prevState, req.auth, hasPermission));
        const after = maskStateSecrets(filterStateForUser(stateDataWithSegments, req.auth, hasPermission));
        responseChanges = buildItemChanges(before.collections || [], after.collections || []);
        // Ne stocker que des valeurs déjà masquées dans le reçu de la dernière écriture.
        stateDataWithSegments._lastItemMutation = { id: payload.mutationId, userId, itemChanges: responseChanges, rebased };
      } else {
        delete stateDataWithSegments._lastItemMutation;
      }
      const stateStr = JSON.stringify(prepareStateForStorage(stateDataWithSegments, prevState));
      const nextVersion = currentVersion + 1;
      const historyEvents = buildHistoryEvents(prevState, stateDataWithSegments, {
        actor: req.auth.user,
        source: 'user',
        mutationId: payload.mutationId,
      });
      let updateRes;
      if (typeof pool.connect !== 'function') {
        updateRes = await pool.query(
          'UPDATE app_state SET data = $1, version = version + 1 WHERE organization_id = $2 AND version = $3 AND data = $4',
          [stateStr, organizationId, currentVersion, prevStateResult.rows[0]?.data]
        );
      } else {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          if (prevStateResult.rows.length > 0) {
            updateRes = await client.query(
              'UPDATE app_state SET data = $1, version = version + 1 WHERE organization_id = $2 AND version = $3 AND data = $4',
              [stateStr, organizationId, currentVersion, prevStateResult.rows[0].data]
            );
          } else {
            await syncAppStateIdSequence();
            updateRes = await client.query(
              'INSERT INTO app_state (organization_id, data, version) VALUES ($1, $2, $3) ON CONFLICT (organization_id) DO NOTHING',
              [organizationId, stateStr, nextVersion]
            );
          }
          if (updateRes.rowCount > 0) {
            await insertHistoryEvents(client, organizationId, historyEvents);
            await client.query('COMMIT');
          } else {
            await client.query('ROLLBACK');
          }
        } catch (error) {
          await client.query('ROLLBACK').catch(() => {});
          throw error;
        } finally {
          client.release();
        }
      }
      if (updateRes.rowCount === 0) {
        const latestState = await pool.query('SELECT data, version FROM app_state WHERE organization_id = $1 LIMIT 1', [organizationId]);
        if (latestState.rowCount > 0) {
          const latest = JSON.parse(latestState.rows[0].data);
          const receipt = latest._lastItemMutation;
          if (isItemDelta && receipt?.id === payload.mutationId && receipt.userId === userId) {
            return res.json(itemReply(latest, receipt, Number(latestState.rows[0].version)));
          }
          const conflicts = isItemDelta
            ? getItemConflicts(decryptStateSecrets(latest, { preserveUnreadable: true }).collections || [], payload.itemChanges)
            : null;
          if (conflicts?.length === 0 && attempt < 2) return saveState(req, res, attempt + 1);
          return conflictReply(Number(latestState.rows[0].version) || expectedVersion, conflicts);
        }
        return conflictReply(Number(latestState.rows[0]?.version) || expectedVersion, null);
      }

      await notifyServerPluginsStateSaved({ appContext, auth: req.auth, previousState: prevState, state: stateDataWithSegments });

      await logAudit(userId, 'state.save', 'organization', organizationId, { collections: processedCollections.length });

      if (global.io) {
        global.io.to(organizationRoom(organizationId)).emit('stateUpdated', { userId, organizationId });
      }

      // Si des automations ont créé de nouveaux items, renvoyer les collections
      // modifiées au client pour qu'il puisse les appliquer immédiatement —
      // le client ignore son propre event socket (userId filter), donc sans ça
      // il ne verrait jamais les items créés côté serveur.
      if (isItemDelta) return res.json(itemReply(stateDataWithSegments, stateDataWithSegments._lastItemMutation, nextVersion));
      const hasAutomationChanges = postAutoItemCount > preAutoItemCount;
      const publicCollections = maskStateSecrets(stateDataWithSegments).collections;
      const responsePayload = {
        ok: true,
        collections: publicCollections,
        stateVersion: nextVersion,
      };

      if (hasAutomationChanges) {
        return res.json({ ...responsePayload, automationCollections: publicCollections });
      }

      return res.json(responsePayload);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Invalid state payload', details: err.issues });
      }
      logger.error('Failed to save state', err);
      return res.status(500).json({ error: 'Failed to save state' });
    }
  };
  app.post('/api/state', requireAuth, (req, res) => saveState(req, res));
  app.patch('/api/state/items', requireAuth, (req, res) => saveState(req, res));

  const historyResponse = (row, req, collection) => {
    const before = row.before_values || {};
    const after = row.after_values || {};
    // History rows keep snapshots so undo can restore the event. Only expose
    // fields whose value or presence actually changed in this event.
    const fieldIds = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter(fieldId => Object.hasOwn(before, fieldId) !== Object.hasOwn(after, fieldId) ||
        (Object.hasOwn(before, fieldId) && !isDeepStrictEqual(before[fieldId], after[fieldId])));
    const systemFields = new Set(['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy']);
    const canUndo = row.entity_type === 'item' && Boolean(collection) && hasPermission(req.auth, {
      collection_id: row.collection_id, item_id: row.entity_id,
    }, 'can_write') && ![...fieldIds].some(fieldId => collection?.properties?.some(property => property.id === fieldId && property.type === 'password')) && [...fieldIds].every(fieldId => systemFields.has(fieldId) || (
      hasPermission(req.auth, { collection_id: row.collection_id, item_id: row.entity_id, field_id: fieldId }, 'can_read') &&
      hasPermission(req.auth, { collection_id: row.collection_id, item_id: row.entity_id, field_id: fieldId }, 'can_write')
    ));
    const changes = [];
    const labels = {
      name: 'Nom', icon: 'Icône', color: 'Couleur', isPrimary: 'Collection principale',
      defaultVisibleFieldIds: 'Champs visibles par défaut', properties: 'Champs',
      collectionTemplates: 'Templates', fieldGroups: 'Groupes de champs',
      fieldGroupsLayout: 'Affichage des groupes', hiddenFields: 'Champs masqués',
      fieldOrder: 'Ordre des champs',
    };
    for (const fieldId of fieldIds) {
      const property = (collection?.properties || []).find(entry => entry.id === fieldId);
      if (row.entity_type === 'item' && property?.type === 'password') continue;
      if (row.entity_type === 'item' && !hasPermission(req.auth, {
        collection_id: row.collection_id, item_id: row.entity_id, field_id: fieldId,
      }, 'can_read')) continue;
      const filterViewFields = value => {
        if (row.entity_type !== 'view' || !collection) return value;
        const readable = fieldId => {
          const field = collection.properties?.find(property => property.id === fieldId);
          return field?.type !== 'password' && hasPermission(req.auth, { collection_id: row.collection_id, field_id }, 'can_read');
        };
        if (['fieldOrder', 'hiddenFields', 'visibleFields', 'visibleProperties'].includes(fieldId) && Array.isArray(value)) {
          const ids = value.filter(readable);
          return ids.map(id => (collection.properties || []).find(property => property.id === id)?.name || id);
        }
        if (fieldId === 'fieldGroups' && Array.isArray(value)) {
          return value.map(group => {
            const fieldIds = (group.fieldIds || []).filter(readable);
            return {
              ...group,
              fieldIds,
              fieldNames: fieldIds.map(id => (collection.properties || []).find(property => property.id === id)?.name || id),
            };
          });
        }
        return value;
      };
      const filterCollectionTemplates = value => {
        if (row.entity_type === 'collection' && fieldId === 'defaultVisibleFieldIds' && Array.isArray(value)) {
          return value.filter(id => hasPermission(req.auth, { collection_id: row.collection_id, field_id: id }, 'can_read'))
            .map(id => (collection?.properties || []).find(property => property.id === id)?.name || id);
        }
        if (row.entity_type !== 'collection' || fieldId !== 'collectionTemplates' || !Array.isArray(value)) return value;
        return value.map(template => {
          const readableIds = (template.fieldIds || []).filter(id => {
            const property = collection?.properties?.find(entry => entry.id === id);
            return property?.type !== 'password' && hasPermission(req.auth, {
              collection_id: row.collection_id, field_id: id,
            }, 'can_read');
          });
          const readable = new Set(readableIds);
          const filterValues = source => Object.fromEntries(Object.entries(source || {}).filter(([id]) => readable.has(id)));
          return {
            ...template,
            fieldIds: readableIds,
            fieldNames: readableIds.map(id => (collection?.properties || []).find(property => property.id === id)?.name || id),
            values: filterValues(template.values),
            dateDefaults: filterValues(template.dateDefaults),
          };
        });
      };
      changes.push({
        fieldId,
        label: property?.name || labels[fieldId] || fieldId,
        beforeExists: Object.hasOwn(before, fieldId),
        before: filterCollectionTemplates(filterViewFields(before[fieldId])),
        afterExists: Object.hasOwn(after, fieldId),
        after: filterCollectionTemplates(filterViewFields(after[fieldId])),
      });
    }
    return {
      id: row.id,
      entityType: row.entity_type,
      collectionId: row.collection_id,
      entityId: row.entity_id,
      entityLabel: row.entity_label,
      action: row.action,
      actorId: row.actor_id,
      actorName: row.actor_name,
      source: row.source,
      createdAt: row.created_at,
      changes,
      canUndo,
    };
  };

  const listHistory = (scope) => async (req, res) => {
    const organizationId = req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });
    const collectionId = scope === 'collection' ? req.params.collectionId : req.query.collectionId;
    const itemId = scope === 'item' ? req.params.itemId : null;
    if (!collectionId || !hasPermission(req.auth, { collection_id: collectionId }, 'can_read')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (itemId && !hasPermission(req.auth, { collection_id: collectionId, item_id: itemId }, 'can_read')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    let cursor = null;
    if (req.query.cursor) {
      try { cursor = JSON.parse(Buffer.from(String(req.query.cursor), 'base64url').toString('utf8')); }
      catch { return res.status(400).json({ error: 'Invalid history cursor' }); }
      if (!cursor?.createdAt || !Number.isFinite(Date.parse(cursor.createdAt)) ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id || '')) {
        return res.status(400).json({ error: 'Invalid history cursor' });
      }
    }
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 30, 100));
    try {
      const result = await pool.query(`SELECT * FROM history_events
        WHERE organization_id = $1 AND collection_id = $2
          AND ($3::text IS NULL OR entity_type = 'item' AND entity_id = $3)
          AND ($4::timestamptz IS NULL OR (created_at, id) < ($4::timestamptz, $5::uuid))
        ORDER BY created_at DESC, id DESC LIMIT $6`,
      [organizationId, collectionId, itemId, cursor?.createdAt || null, cursor?.id || null, limit + 1]);
      const hasMore = result.rows.length > limit;
      const page = result.rows.slice(0, limit);
      const stateResult = await pool.query('SELECT data FROM app_state WHERE organization_id = $1 LIMIT 1', [organizationId]);
      const storedState = stateResult.rows[0]?.data ? JSON.parse(stateResult.rows[0].data) : {};
      const collection = (storedState.collections || []).find(entry => entry.id === collectionId);
      const events = page.filter(row => {
        if (row.entity_type === 'item') return hasPermission(req.auth, { collection_id: collectionId, item_id: row.entity_id }, 'can_read');
        if (row.entity_type === 'view') return hasPermission(req.auth, { collection_id: collectionId }, 'can_manage_views');
        return hasPermission(req.auth, { collection_id: collectionId }, 'can_manage_fields');
      }).map(row => {
        const event = historyResponse(row, req, collection);
        if (row.entity_type === 'item') {
          const titleProperty = (collection?.properties || []).find(property => property.isTitle || property.id === 'name' || property.id === 'title');
          const labelFieldId = row.entity_label_field_id || titleProperty?.id;
          if (labelFieldId && !hasPermission(req.auth, { collection_id: collectionId, item_id: row.entity_id, field_id: labelFieldId }, 'can_read')) {
            event.entityLabel = 'Objet';
          }
        }
        return event;
      });
      const last = page.at(-1);
      return res.json({ events, nextCursor: hasMore && last
        ? Buffer.from(JSON.stringify({ createdAt: last.created_at, id: last.id })).toString('base64url')
        : null });
    } catch (error) {
      logger.error('Failed to load history', error);
      return res.status(500).json({ error: 'History load failed' });
    }
  };
  app.get('/api/history/collections/:collectionId', requireAuth, listHistory('collection'));
  app.get('/api/history/items/:itemId', requireAuth, listHistory('item'));

  app.post('/api/history/events/:eventId/undo', requireAuth, async (req, res) => {
    const organizationId = req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.eventId || '')) {
      return res.status(400).json({ error: 'Invalid history event id' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const eventResult = await client.query(
        'SELECT * FROM history_events WHERE organization_id = $1 AND id = $2 FOR SHARE',
        [organizationId, req.params.eventId]
      );
      const event = eventResult.rows[0];
      if (!event || event.entity_type !== 'item') {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Undoable item history not found' });
      }
      const scope = { collection_id: event.collection_id, item_id: event.entity_id };
      if (!hasPermission(req.auth, scope, 'can_read') || !hasPermission(req.auth, scope, 'can_write')) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Forbidden' });
      }
      const before = event.before_values || {};
      const after = event.after_values || {};
      const fieldIds = [...new Set([...Object.keys(before), ...Object.keys(after)])]
        .filter(fieldId => Object.hasOwn(before, fieldId) !== Object.hasOwn(after, fieldId) ||
          (Object.hasOwn(before, fieldId) && !isDeepStrictEqual(before[fieldId], after[fieldId])));
      const systemFields = new Set(['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy']);
      if ([...fieldIds].some(fieldId => !systemFields.has(fieldId) && (
        !hasPermission(req.auth, { ...scope, field_id: fieldId }, 'can_read') ||
        !hasPermission(req.auth, { ...scope, field_id: fieldId }, 'can_write')
      ))) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Cannot undo fields without write permission' });
      }

      const stateResult = await client.query('SELECT data, version FROM app_state WHERE organization_id = $1 FOR UPDATE', [organizationId]);
      if (!stateResult.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'State not found' });
      }
      const rawState = JSON.parse(stateResult.rows[0].data);
      const previousState = decryptStateSecrets(rawState, { preserveUnreadable: true });
      const collections = previousState.collections || [];
      const collection = collections.find(entry => entry.id === event.collection_id);
      if (!collection) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Collection not found' });
      }
      const liveItem = (collection.items || []).find(entry => entry.id === event.entity_id);
      if ([...fieldIds].some(fieldId => collection.properties?.some(property => property.id === fieldId && property.type === 'password'))) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Password fields cannot be restored from history' });
      }
      const matches = (item, values) => [...fieldIds].every(fieldId =>
        Object.hasOwn(item || {}, fieldId) === Object.hasOwn(values, fieldId) &&
        (!Object.hasOwn(values, fieldId) || isDeepStrictEqual(item[fieldId], values[fieldId])));
      let nextItem;
      let nextItems;
      if (event.action === 'deleted') {
        if (liveItem) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Item already exists; history cannot be restored safely' });
        }
        nextItem = { ...before };
        if (!nextItem.id) nextItem.id = event.entity_id;
        nextItems = [...(collection.items || []), nextItem];
      } else {
        if (!liveItem || !matches(liveItem, after)) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'The item has changed since this history entry' });
        }
        if (event.action === 'created') {
          nextItems = collection.items.filter(entry => entry.id !== event.entity_id);
          nextItem = null;
        } else {
          nextItem = { ...liveItem };
          for (const fieldId of fieldIds) {
            if (Object.hasOwn(before, fieldId)) nextItem[fieldId] = before[fieldId];
            else delete nextItem[fieldId];
          }
          nextItems = collection.items.map(entry => entry.id === event.entity_id ? nextItem : entry);
        }
      }

      const calendarConfig = getCalendarConfigForUser(req.auth.user);
      if (nextItem && shouldRecalculateSegments(liveItem, nextItem, collection, collection)) {
        nextItem = calculateEventSegments(nextItem, collection, calendarConfig);
        nextItems = nextItems.map(entry => entry.id === event.entity_id ? nextItem : entry);
      }
      let nextState = {
        ...previousState,
        collections: collections.map(entry => entry.id === event.collection_id ? { ...entry, items: nextItems } : entry),
      };
      try {
        const automations = await loadAutomations(pool, organizationId);
        const eventType = event.action === 'created' ? 'item_deleted' : event.action === 'deleted' ? 'item_created' : 'item_updated';
        if (automations.length) nextState = await triggerAutomations({
          eventType, collectionId: event.collection_id, triggerItem: liveItem || nextItem,
          prevItem: liveItem || null, state: nextState, automations, pool, organizationId,
          calculateEventSegments, getDefaultCalendarConfig: () => calendarConfig,
        });
      } catch (automationError) {
        logger.error('History undo automation failed', automationError);
      }
      delete nextState._lastItemMutation;
      const historyEvents = buildHistoryEvents(previousState, nextState, {
        actor: req.auth.user, source: 'undo', mutationId: `undo:${event.id}:${randomUUID()}`,
      });
      for (const historyEvent of historyEvents) {
        if (historyEvent.entityType === 'item' && historyEvent.entityId === event.entity_id) historyEvent.action = 'restored';
      }
      const version = Number(stateResult.rows[0].version) || 1;
      const serialized = JSON.stringify(prepareStateForStorage(nextState, previousState));
      const updated = await client.query(
        'UPDATE app_state SET data = $1, version = version + 1 WHERE organization_id = $2 AND version = $3 RETURNING version',
        [serialized, organizationId, version]
      );
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'State changed since it was loaded' });
      }
      await insertHistoryEvents(client, organizationId, historyEvents);
      await client.query('COMMIT');
      try {
        await notifyServerPluginsStateSaved({ appContext, auth: req.auth, previousState, state: nextState });
      } catch (pluginError) {
        logger.error('History undo post-save notification failed', pluginError);
      }
      try { await logAudit(req.auth.user.id, 'history.undo', 'item', event.entity_id, { collectionId: event.collection_id, eventId: event.id }); }
      catch (auditError) { logger.error('History undo audit log failed', auditError); }
      if (global.io) global.io.to(organizationRoom(organizationId)).emit('stateUpdated', { organizationId, source: 'history.undo' });
      return res.json({ ok: true, stateVersion: updated.rows[0].version });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error('Failed to undo item history', error);
      return res.status(500).json({ error: 'History undo failed' });
    } finally {
      client.release();
    }
  });

  app.get('/api/audit', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
    const logs = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
    res.json(logs.rows);
  });
};
