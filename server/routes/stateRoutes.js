const filterStateForUser = (data, ctx, hasPermission) => {
  if (!data || !data.collections) return data;
  const filteredCollections = (data.collections || []).map((col) => {
    const canReadCollection = hasPermission(ctx, { collection_id: col.id }, 'can_read');
    const visibleProps = (col.properties || []).filter((prop) =>
      hasPermission(ctx, { collection_id: col.id, field_id: prop.id }, 'can_read')
    );

    if (!canReadCollection) {
      const allowedItems = (col.items || []).filter((item) =>
        hasPermission(ctx, { collection_id: col.id, item_id: item.id }, 'can_read')
      );
      if (allowedItems.length === 0) return null;
      return { ...col, properties: visibleProps, items: allowedItems };
    }

    const items = (col.items || []).map((item) => {
      const canReadItem = hasPermission(ctx, { collection_id: col.id, item_id: item.id }, 'can_read') || canReadCollection;
      if (!canReadItem) return null;
      let next = { ...item };
      visibleProps.forEach((prop) => {
        const canReadField = hasPermission(ctx, { collection_id: col.id, item_id: item.id, field_id: prop.id }, 'can_read');
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

      const state = JSON.parse(stateResult.rows[0].data);
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

      const newState = { ...state, collections: newCollections };
      const stateStr = JSON.stringify(newState);

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
          item: processedItem,
        });
      }

      return res.json({ ok: true, item: processedItem });
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
        ? JSON.parse(stateResult.rows[0].data)
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

      const stateStr = JSON.stringify(newState);
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

  app.get('/api/state', requireAuth, async (req, res) => {
    try {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });

      const userStateResult = await pool.query('SELECT data FROM app_state WHERE organization_id = $1 LIMIT 1', [organizationId]);
      const rawState = userStateResult.rows.length > 0 ? JSON.parse(userStateResult.rows[0].data) : INITIAL_APP_STATE;
      const state = {
        ...INITIAL_APP_STATE,
        ...rawState,
        favorites: rawState?.favorites || { views: [], items: [] },
      };
      const filtered = filterStateForUser(state, req.auth, hasPermission);
      return res.json(filtered);
    } catch (err) {
      console.error('Failed to load state', err);
      return res.status(500).json({ error: 'Failed to load state' });
    }
  });

  app.post('/api/state', requireAuth, async (req, res) => {
    try {
      const payload = req.body ?? {};
      const userId = req.auth.user.id;
      const organizationId = req.auth.activeOrganization?.id;
      const calendarConfig = getCalendarConfigForUser(req.auth.user);
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });

      const { ...stateData } = payload;
      const collections = stateData.collections || [];

      const prevStateResult = await pool.query('SELECT data FROM app_state WHERE organization_id = $1 LIMIT 1', [organizationId]);
      const prevState = prevStateResult.rows.length > 0 ? JSON.parse(prevStateResult.rows[0].data) : {};
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
      const stateDataWithSegments = {
        ...INITIAL_APP_STATE,
        ...stateData,
        collections: processedCollections,
        favorites: {
          views: Array.isArray(nextFavorites.views) ? nextFavorites.views : [],
          items: Array.isArray(nextFavorites.items) ? nextFavorites.items : [],
        },
      };
      const stateStr = JSON.stringify(stateDataWithSegments);

      const updateRes = await pool.query('UPDATE app_state SET data = $1 WHERE organization_id = $2', [stateStr, organizationId]);
      if (updateRes.rowCount === 0) {
        await syncAppStateIdSequence();
        await pool.query('INSERT INTO app_state (organization_id, data) VALUES ($1, $2)', [organizationId, stateStr]);
      }

      await logAudit(userId, 'state.save', 'organization', organizationId, { collections: processedCollections.length });

      if (global.io) {
        global.io.emit('stateUpdated', { userId, organizationId });
      }

      return res.json({ ok: true });
    } catch (err) {
      console.error('Failed to save state', err);
      return res.status(500).json({ error: 'Failed to save state' });
    }
  });

  app.get('/api/audit', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
    const logs = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
    res.json(logs.rows);
  });
};
