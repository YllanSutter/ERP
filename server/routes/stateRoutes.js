import { ZodError } from 'zod';
import { statePayloadSchema } from '../../shared/validation.js';
import { loadAutomations, triggerAutomations } from '../services/automationService.js';
import {
  decryptStateSecrets,
  maskStateSecrets,
  encryptStateSecrets,
  prepareStateForStorage,
} from '../services/secretFieldService.js';

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

export const registerStateRoutes = ({
  app,
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
}) => {
  // PATCH /api/state/item
  app.patch('/api/state/item', requireAuth, async (req, res) => {
    try {
      const { collectionId, itemId, fields } = req.body ?? {};
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
        'SELECT data FROM app_state WHERE organization_id = $1 LIMIT 1',
        [organizationId]
      );
      if (stateResult.rows.length === 0) {
        return res.status(404).json({ error: 'State not found' });
      }

      const state = decryptStateSecrets(JSON.parse(stateResult.rows[0].data));
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
        console.error('[Automation] item_updated trigger error', autoErr);
      }
      // ──────────────────────────────────────────────────────────────────────

      const stateStr = JSON.stringify(prepareStateForStorage(newState, state));

      const updateRes = await pool.query(
        'UPDATE app_state SET data = $1 WHERE organization_id = $2',
        [stateStr, organizationId]
      );
      if (updateRes.rowCount === 0) {
        await syncAppStateIdSequence();
        await pool.query(
          'INSERT INTO app_state (organization_id, data) VALUES ($1, $2)',
          [organizationId, stateStr]
        );
      }

      if (global.io) {
        global.io.emit('itemUpdated', {
          userId,
          organizationId,
          collectionId,
          itemId,
          fields: Object.keys(fields),
          item: maskStateSecrets({ collections: [{ ...col, items: [processedItem] }] }).collections[0].items[0],
        });
      }

      return res.json({
        ok: true,
        item: maskStateSecrets({ collections: [{ ...col, items: [processedItem] }] }).collections[0].items[0],
      });
    } catch (err) {
      console.error('Failed to patch item', err);
      return res.status(500).json({ error: 'Failed to patch item' });
    }
  });

  // PATCH /api/state/structure
  app.patch('/api/state/structure', requireAuth, async (req, res) => {
    try {
      const { type, payload } = req.body ?? {};
      const userId = req.auth.user.id;
      const organizationId = req.auth.activeOrganization?.id;

      if (!organizationId) return res.status(400).json({ error: 'No active organization' });
      if (!type || !payload) return res.status(400).json({ error: 'type and payload are required' });

      const stateResult = await pool.query(
        'SELECT data FROM app_state WHERE organization_id = $1 LIMIT 1',
        [organizationId]
      );
      const existingState = stateResult.rows.length > 0
        ? decryptStateSecrets(JSON.parse(stateResult.rows[0].data))
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
      const updateRes = await pool.query(
        'UPDATE app_state SET data = $1 WHERE organization_id = $2',
        [stateStr, organizationId]
      );
      if (updateRes.rowCount === 0) {
        await syncAppStateIdSequence();
        await pool.query(
          'INSERT INTO app_state (organization_id, data) VALUES ($1, $2)',
          [organizationId, stateStr]
        );
      }

      if (global.io) {
        global.io.emit('structureUpdated', { userId, organizationId, type });
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to patch structure', err);
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

      const state = decryptStateSecrets(JSON.parse(stateResult.rows[0].data));
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
        values[propertyId] = item[propertyId] ?? '';
      }

      return res.json({ values });
    } catch (err) {
      console.error('Failed to load password values for PDF export', err);
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
            'UPDATE app_state SET data = $1 WHERE organization_id = $2',
            [JSON.stringify(migratedState), organizationId]
          );
        }
        rawState = decryptStateSecrets(migratedState);
      }
      const state = {
        ...INITIAL_APP_STATE,
        ...rawState,
        favorites: rawState?.favorites || { views: [], items: [] },
      };
      const filtered = filterStateForUser(state, req.auth, hasPermission);
      return res.json({ ...maskStateSecrets(filtered), stateVersion });
    } catch (err) {
      console.error('Failed to load state', err);
      return res.status(500).json({ error: 'Failed to load state' });
    }
  });

  app.post('/api/state', requireAuth, async (req, res) => {
    try {
      const payload = statePayloadSchema.parse(req.body ?? {});
      const expectedVersion = payload.stateVersion;
      const userId = req.auth.user.id;
      const organizationId = req.auth.activeOrganization?.id;
      const calendarConfig = getCalendarConfigForUser(req.auth.user);
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });
      const { stateVersion: _stateVersion, ...stateData } = payload;
      const collections = stateData.collections || [];

      const prevStateResult = await pool.query('SELECT data, version FROM app_state WHERE organization_id = $1 LIMIT 1', [organizationId]);
      const currentVersion = prevStateResult.rows.length > 0
        ? Number(prevStateResult.rows[0].version) || 1
        : 1;
      if (currentVersion !== expectedVersion) {
        return res.status(409).json({
          error: 'State changed since it was loaded',
          stateVersion: currentVersion,
        });
      }
      const prevState = prevStateResult.rows.length > 0
        ? decryptStateSecrets(JSON.parse(prevStateResult.rows[0].data))
        : {};
      const prevCollections = Array.isArray(prevState.collections) ? prevState.collections : [];
      const prevCollectionsById = new Map(prevCollections.map((col) => [col.id, col]));

      const processedCollections = collections.map((col) => {
        if (!col.items) return col;

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
        console.error('[Automation] state.post trigger error', autoErr);
      }
      // ──────────────────────────────────────────────────────────────────────

      // Détecter si les automations ont créé de nouveaux items
      const postAutoItemCount = stateDataWithSegments.collections.reduce(
        (acc, c) => acc + (c.items?.length || 0), 0
      );

      const stateStr = JSON.stringify(prepareStateForStorage(stateDataWithSegments, prevState));

      const updateRes = await pool.query(
        'UPDATE app_state SET data = $1, version = version + 1 WHERE organization_id = $2 AND version = $3',
        [stateStr, organizationId, expectedVersion]
      );
      const nextVersion = expectedVersion + 1;
      if (updateRes.rowCount === 0) {
        const latestState = await pool.query('SELECT version FROM app_state WHERE organization_id = $1 LIMIT 1', [organizationId]);
        if (latestState.rowCount > 0) {
          return res.status(409).json({
            error: 'State changed since it was loaded',
            stateVersion: Number(latestState.rows[0].version) || expectedVersion,
          });
        }
        await syncAppStateIdSequence();
        await pool.query(
          'INSERT INTO app_state (organization_id, data, version) VALUES ($1, $2, $3)',
          [organizationId, stateStr, nextVersion]
        );
      }

      await logAudit(userId, 'state.save', 'organization', organizationId, { collections: processedCollections.length });

      if (global.io) {
        global.io.emit('stateUpdated', { userId, organizationId });
      }

      // Si des automations ont créé de nouveaux items, renvoyer les collections
      // modifiées au client pour qu'il puisse les appliquer immédiatement —
      // le client ignore son propre event socket (userId filter), donc sans ça
      // il ne verrait jamais les items créés côté serveur.
      const hasAutomationChanges = postAutoItemCount > preAutoItemCount;
      const responsePayload = {
        ok: true,
        collections: stateDataWithSegments.collections,
        stateVersion: nextVersion,
      };

      if (hasAutomationChanges) {
        return res.json({ ...responsePayload, automationCollections: stateDataWithSegments.collections });
      }

      return res.json(responsePayload);
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({ error: 'Invalid state payload', details: err.issues });
      }
      console.error('Failed to save state', err);
      return res.status(500).json({ error: 'Failed to save state' });
    }
  });

  app.get('/api/audit', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
    const logs = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
    res.json(logs.rows);
  });
};
