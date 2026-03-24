export const RESERVED_IMPORT_ITEM_KEYS = new Set(['id', '_eventSegments', '_preserveEventSegments', '__collectionId']);

export const normalizeImportName = (value, fallback = 'element') => {
  const source = String(value || '').trim();
  if (!source) return fallback;
  return source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
};

export const ensureUniqueId = (baseId, usedIds, fallbackPrefix = 'id') => {
  let candidate = String(baseId || '').trim() || `${fallbackPrefix}_${Math.random().toString(36).slice(2, 8)}`;
  if (!usedIds.has(candidate)) {
    usedIds.add(candidate);
    return candidate;
  }
  let i = 2;
  while (usedIds.has(`${candidate}_${i}`)) i += 1;
  const unique = `${candidate}_${i}`;
  usedIds.add(unique);
  return unique;
};

export const parsePotentialJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const parsePotentialJsonObject = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const normalizeImportScalar = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return trimmed;
};

const detectCsvDelimiter = (headerLine = '') => {
  const candidates = [',', ';', '\t', '|'];
  const counts = candidates.map((sep) => ({
    sep,
    count: (headerLine.match(new RegExp(`\\${sep === '\t' ? 't' : sep}`, 'g')) || []).length,
  }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0]?.count > 0 ? counts[0].sep : ',';
};

const parseCsvRows = (content, delimiter) => {
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      row.push(current);
      current = '';
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += ch;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
};

export const csvContentToObjects = (content) => {
  const lines = String(content || '').trim();
  if (!lines) return [];

  const firstLine = lines.split(/\r?\n/)[0] || '';
  const delimiter = detectCsvDelimiter(firstLine);
  const rows = parseCsvRows(lines, delimiter);
  if (!rows.length) return [];

  const headers = rows[0].map((h, idx) => {
    const clean = String(h || '').trim();
    return clean || `colonne_${idx + 1}`;
  });

  const objects = [];
  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const hasData = row.some((cell) => String(cell || '').trim() !== '');
    if (!hasData) continue;
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = normalizeImportScalar(row[index]);
    });
    objects.push(obj);
  }
  return objects;
};

export const inferPrimitiveType = (values) => {
  const nonNull = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  if (!nonNull.length) return 'text';

  const boolLike = nonNull.every((v) => {
    const s = String(v).trim().toLowerCase();
    return ['true', 'false', '1', '0', 'yes', 'no', 'oui', 'non'].includes(s);
  });
  if (boolLike) return 'checkbox';

  const numberLike = nonNull.every((v) => Number.isFinite(Number(String(v).replace(',', '.'))));
  if (numberLike) return 'number';

  const dateLike = nonNull.every((v) => {
    const d = new Date(String(v));
    return !Number.isNaN(d.getTime());
  });
  if (dateLike) return 'date';

  return 'text';
};

export const toBooleanValue = (value) => {
  if (value === null || value === undefined) return false;
  const s = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'oui'].includes(s);
};

const normalizeRelationLookupToken = (value) => {
  const s = String(value || '').trim();
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const isLikelyLabelField = (prop) => {
  const key = normalizeImportName(prop?.name || prop?.id || '');
  if (!key) return false;
  return [
    'name', 'nom', 'title', 'label', 'code', 'slug', 'reference', 'ref',
  ].some((hint) => key === hint || key.endsWith(`_${hint}`) || key.startsWith(`${hint}_`));
};

const getPreferredRelationDisplayFieldIds = (collection) => {
  const props = Array.isArray(collection?.properties) ? collection.properties : [];
  if (!props.length) return [];
  const best = props.find((p) => isLikelyLabelField(p)) || props[0];
  return best?.id ? [best.id] : [];
};

const buildRelationLookupForCollection = (collection) => {
  const idSet = new Set();
  const tokenToId = new Map();
  const props = Array.isArray(collection?.properties) ? collection.properties : [];
  const labelFields = props.filter((p) => isLikelyLabelField(p)).map((p) => p.id);

  (collection?.items || []).forEach((item) => {
    const itemId = String(item?.id || '').trim();
    if (!itemId) return;
    idSet.add(itemId);
    tokenToId.set(normalizeRelationLookupToken(itemId), itemId);

    labelFields.forEach((fieldId) => {
      const labelTokens = extractRelationTokens(item?.[fieldId]);
      labelTokens.forEach((token) => {
        const normalized = normalizeRelationLookupToken(token);
        if (normalized) tokenToId.set(normalized, itemId);
      });
    });
  });

  return { idSet, tokenToId };
};

const resolveRelationTokenToId = (token, lookup) => {
  const raw = String(token || '').trim();
  if (!raw) return null;
  if (lookup?.idSet?.has(raw)) return raw;
  const normalized = normalizeRelationLookupToken(raw);
  return (normalized && lookup?.tokenToId?.get(normalized)) || null;
};

const extractRelationTokens = (value) => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return Array.from(new Set(value.flatMap((v) => extractRelationTokens(v)).filter(Boolean)));
  }
  if (typeof value === 'object') {
    const dynamicIdCandidates = Object.keys(value)
      .filter((k) => /(^id$|_id$|Id$|^id_)/.test(String(k)))
      .map((k) => value[k]);
    const dynamicLabelCandidates = Object.keys(value)
      .filter((k) => /(^name$|^label$|^title$|^code$|^slug$|_name$|_label$|_title$)/i.test(String(k)))
      .map((k) => value[k]);
    const candidates = [
      value.id,
      value._id,
      value.uuid,
      value.value,
      value.key,
      value.code,
      value.slug,
      value.name,
      value.label,
      value.title,
      ...dynamicIdCandidates,
      ...dynamicLabelCandidates,
    ];
    return Array.from(
      new Set(
        candidates
          .filter((v) => v !== null && v !== undefined)
          .map((v) => String(v).trim())
          .filter(Boolean)
      )
    );
  }
  const parsedArray = parsePotentialJsonArray(value);
  if (Array.isArray(parsedArray)) {
    return Array.from(new Set(parsedArray.flatMap((v) => extractRelationTokens(v)).filter(Boolean)));
  }
  const parsedObject = parsePotentialJsonObject(value);
  if (parsedObject && typeof parsedObject === 'object') {
    return extractRelationTokens(parsedObject);
  }
  const str = String(value).trim();
  if (!str) return [];
  if (str.includes(',') || str.includes(';') || str.includes('|')) {
    const sep = str.includes(';') ? ';' : (str.includes('|') ? '|' : ',');
    return str.split(sep).map((v) => v.trim()).filter(Boolean);
  }
  return [str];
};

const getRelationFieldBase = (fieldKey = '') => {
  const key = String(fieldKey || '').trim().toLowerCase();
  if (!key) return null;

  if (key.endsWith('_ids') && key.length > 4) return key.slice(0, -4);
  if (key.endsWith('_id') && key.length > 3) return key.slice(0, -3);

  if (key.endsWith('ids') && key.length > 4) return key.slice(0, -3);
  if (key.endsWith('id') && key.length > 3) return key.slice(0, -2);

  return null;
};

const toImportLabelFromKey = (key = '', fallback = 'Relation') => {
  const base = String(key || '').trim();
  if (!base) return fallback;
  const words = base.split('_').filter(Boolean);
  if (!words.length) return fallback;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const buildDefaultViewsFromCollections = (collections) => {
  const views = {};
  for (const collection of collections) {
    const firstDate = (collection.properties || []).find((p) => p.type === 'date')?.id || null;
    views[collection.id] = [
      {
        id: 'default',
        name: 'Vue par défaut',
        type: 'table',
        hiddenFields: [],
        filters: [],
        groups: [],
        groupBy: null,
        dateProperty: firstDate,
        fieldOrder: (collection.properties || []).map((p) => p.id),
      },
    ];
  }
  return views;
};

const normalizeCollectionFromRows = (name, rows = []) => {
  const collectionName = String(name || '').trim() || 'Collection importée';
  const collectionId = `col_${normalizeImportName(collectionName, 'collection')}`;
  const keySet = new Set();
  rows.forEach((row) => {
    if (row && typeof row === 'object') {
      Object.keys(row).forEach((k) => keySet.add(k));
    }
  });

  if (!keySet.size) keySet.add('name');
  const keyList = Array.from(keySet);
  const hasExplicitId = keyList.some((k) => normalizeImportName(k) === 'id');
  if (!hasExplicitId) keyList.unshift('id');

  const usedFieldIds = new Set();
  const keyToFieldId = new Map();
  const properties = keyList
    .filter((key) => !RESERVED_IMPORT_ITEM_KEYS.has(normalizeImportName(key)))
    .map((key, index) => {
      const normalizedKey = normalizeImportName(key, `champ_${index + 1}`);
      const fieldId = ensureUniqueId(normalizedKey, usedFieldIds, 'champ');
      keyToFieldId.set(key, fieldId);
      return {
        id: fieldId,
        name: String(key || fieldId),
        type: normalizedKey === 'id' ? 'text' : 'text',
      };
    });

  const usedItemIds = new Set();
  const explicitIdKey = keyList.find((k) => normalizeImportName(k) === 'id') || null;
  const idFieldId = properties.find((p) => normalizeImportName(p.name) === 'id')?.id || properties[0]?.id;

  const items = rows.map((row, idx) => {
    const sourceId = explicitIdKey ? normalizeImportScalar(row?.[explicitIdKey]) : null;
    const itemId = ensureUniqueId(sourceId || `${normalizeImportName(collectionName, 'item')}_${idx + 1}`, usedItemIds, 'item');
    const item = { id: itemId };

    properties.forEach((prop) => {
      if (prop.id === idFieldId) {
        item[prop.id] = itemId;
        return;
      }
      const sourceKey = keyList.find((k) => keyToFieldId.get(k) === prop.id);
      const raw = sourceKey ? row?.[sourceKey] : null;
      item[prop.id] = normalizeImportScalar(raw);
    });

    return item;
  });

  return {
    id: collectionId,
    name: collectionName,
    icon: 'database',
    color: '#06b6d4',
    properties,
    items,
  };
};

const enrichCollectionsWithAutoTypesAndRelations = (collections) => {
  const collectionsCopy = (collections || []).map((c) => ({
    ...c,
    properties: Array.isArray(c.properties) ? [...c.properties] : [],
    items: Array.isArray(c.items) ? [...c.items] : [],
  }));

  const relationLookupByCollectionId = new Map(
    collectionsCopy.map((c) => [c.id, buildRelationLookupForCollection(c)])
  );

  for (const collection of collectionsCopy) {
    for (const prop of collection.properties || []) {
      if (!prop || prop.id === 'id') continue;
      const values = (collection.items || []).map((item) => item?.[prop.id]);
      let bestTarget = null;
      let bestRatio = 0;
      let manyHint = false;

      for (const target of collectionsCopy) {
        if (target.id === collection.id) continue;
        const targetLookup = relationLookupByCollectionId.get(target.id);
        if (!targetLookup?.idSet || targetLookup.idSet.size === 0) continue;

        let checked = 0;
        let matched = 0;
        let hasMany = false;

        values.forEach((v) => {
          const tokens = extractRelationTokens(v);
          if (!tokens.length) return;
          checked += 1;
          if (tokens.length > 1) hasMany = true;
          const matchedTokens = tokens.filter((token) => Boolean(resolveRelationTokenToId(token, targetLookup))).length;
          if (matchedTokens > 0) matched += 1;
        });

        if (checked === 0) continue;
        const ratio = matched / checked;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestTarget = target;
          manyHint = hasMany;
        }
      }

      const fieldKey = normalizeImportName(prop.name || prop.id);
      const relationBase = getRelationFieldBase(fieldKey);
      const relationByNameHint = /(_id|_ids|^id_|^ids_)/.test(fieldKey) || !!relationBase;
      const forceTextField = [
        'name', 'nom', 'title', 'label', 'slug', 'code', 'ref', 'reference',
      ].some((hint) => fieldKey === hint || fieldKey.endsWith(`_${hint}`) || fieldKey.startsWith(`${hint}_`));

      // Seuils améliorés : 0.9 strict, 0.6 avec indice de nom
      if (bestTarget && (bestRatio >= 0.9 || (relationByNameHint && bestRatio >= 0.6))) {
        const displayFieldIds = getPreferredRelationDisplayFieldIds(bestTarget);
        prop.type = 'relation';
        prop.relation = {
          targetCollectionId: bestTarget.id,
          type: manyHint || fieldKey.endsWith('_ids') || fieldKey.endsWith('ids') ? 'many_to_many' : 'one_to_many',
          ...(displayFieldIds.length ? { displayFieldIds } : {}),
        };

        const bestTargetLookup = relationLookupByCollectionId.get(bestTarget.id);
        collection.items = (collection.items || []).map((item) => {
          const tokens = extractRelationTokens(item?.[prop.id]);
          const resolved = Array.from(new Set(
            tokens
              .map((token) => resolveRelationTokenToId(token, bestTargetLookup))
              .filter(Boolean)
          ));
          const nextVal = prop.relation.type === 'many_to_many'
            ? resolved
            : (resolved[0] || null);
          return { ...item, [prop.id]: nextVal };
        });
        continue;
      }

      const primitive = forceTextField ? 'text' : inferPrimitiveType(values);
      prop.type = primitive;
      collection.items = (collection.items || []).map((item) => {
        const raw = item?.[prop.id];
        if (raw === null || raw === undefined || String(raw).trim?.() === '') {
          return { ...item, [prop.id]: raw === undefined ? null : raw };
        }
        if (primitive === 'checkbox') return { ...item, [prop.id]: toBooleanValue(raw) };
        if (primitive === 'number') return { ...item, [prop.id]: Number(String(raw).replace(',', '.')) };
        return item;
      });
    }

    // Fusion automatique des paires "label + id" (ex: tag + tag_id) en conservant le champ humain.
    const removablePropertyIds = new Set();
    const props = Array.isArray(collection.properties) ? collection.properties : [];
    const propByNormalizedKey = new Map(
      props.map((p) => [normalizeImportName(p?.name || p?.id), p])
    );

    for (const prop of props) {
      if (!prop || prop.type !== 'relation') continue;

      const relationKey = normalizeImportName(prop.name || prop.id);
      const baseKey = getRelationFieldBase(relationKey);
      if (!baseKey) continue;

      const baseField = propByNormalizedKey.get(baseKey);
      if (!baseField || baseField.id === prop.id) continue;

      const items = Array.isArray(collection.items) ? collection.items : [];
      let overlapCount = 0;
      let compared = 0;
      for (const item of items) {
        const hasIdField = extractRelationTokens(item?.[prop.id]).length > 0;
        const hasBaseField = extractRelationTokens(item?.[baseField.id]).length > 0
          || String(item?.[baseField.id] ?? '').trim() !== '';
        if (hasIdField || hasBaseField) compared += 1;
        if (hasIdField && hasBaseField) overlapCount += 1;
      }

      if (compared > 0 && overlapCount / compared < 0.6) continue;

      // Conserver le champ humain (baseField), supprimer le champ technique (prop = *_id)
      const targetCollection = (collectionsCopy || []).find((c) => c?.id === prop?.relation?.targetCollectionId);
      const displayFieldIds = getPreferredRelationDisplayFieldIds(targetCollection);
      baseField.type = 'relation';
      baseField.relation = {
        ...(baseField.relation || {}),
        ...(prop.relation || {}),
        ...(displayFieldIds.length ? { displayFieldIds } : {}),
      };
      baseField.name = baseField.name || toImportLabelFromKey(baseKey, prop.name || 'Relation');

      collection.items = items.map((item) => {
        const idTokens = extractRelationTokens(item?.[prop.id]);
        const baseTokens = extractRelationTokens(item?.[baseField.id]);
        const merged = Array.from(new Set([...idTokens, ...baseTokens].map((v) => String(v).trim()).filter(Boolean)));
        const nextVal = (baseField.relation?.type || 'many_to_many') === 'many_to_many'
          ? merged
          : (merged[0] || null);
        return { ...item, [baseField.id]: nextVal };
      });

      removablePropertyIds.add(prop.id);
    }

    if (removablePropertyIds.size > 0) {
      collection.properties = (collection.properties || []).filter((prop) => !removablePropertyIds.has(prop.id));
      collection.items = (collection.items || []).map((item) => {
        const nextItem = { ...item };
        removablePropertyIds.forEach((fieldId) => {
          delete nextItem[fieldId];
        });
        return nextItem;
      });
    }
  }

  return collectionsCopy;
};

const VALID_IMPORT_PROPERTY_TYPES = new Set([
  'text',
  'number',
  'select',
  'multi_select',
  'multiselect',
  'date',
  'date_range',
  'checkbox',
  'url',
  'email',
  'phone',
  'relation',
]);

const normalizeImportedCollectionsManual = (collections) => {
  const sourceCollections = Array.isArray(collections) ? collections : [];
  const usedCollectionIds = new Set();
  const collectionIdMap = new Map();

  const nextCollections = sourceCollections.map((collection, cIdx) => {
    const rawCollectionId = String(collection?.id || '').trim() || `collection_${cIdx + 1}`;
    const nextCollectionId = ensureUniqueId(rawCollectionId, usedCollectionIds, 'collection');
    collectionIdMap.set(rawCollectionId, nextCollectionId);

    const usedFieldIds = new Set();
    const properties = (Array.isArray(collection?.properties) ? collection.properties : []).map((prop, pIdx) => {
      const rawFieldId = String(prop?.id || '').trim() || `champ_${pIdx + 1}`;
      const nextFieldId = ensureUniqueId(rawFieldId, usedFieldIds, 'champ');
      const normalizedType = VALID_IMPORT_PROPERTY_TYPES.has(String(prop?.type || '').trim())
        ? String(prop.type).trim()
        : 'text';
      return {
        ...prop,
        id: nextFieldId,
        name: String(prop?.name || nextFieldId),
        type: normalizedType,
      };
    });

    const usedItemIds = new Set();
    const items = (Array.isArray(collection?.items) ? collection.items : []).map((item, iIdx) => {
      const itemId = ensureUniqueId(String(item?.id || '').trim() || `${nextCollectionId}_item_${iIdx + 1}`, usedItemIds, 'item');
      return { ...item, id: itemId };
    });

    return {
      ...collection,
      id: nextCollectionId,
      name: String(collection?.name || `Collection ${cIdx + 1}`),
      properties,
      items,
    };
  });

  const allCollectionIds = new Set(nextCollections.map((c) => c.id));

  return nextCollections.map((collection) => {
    const properties = (collection.properties || []).map((prop) => {
      const relation = prop?.relation && typeof prop.relation === 'object' ? { ...prop.relation } : null;
      if (prop.type !== 'relation' || !relation) {
        return { ...prop, relation: prop.type === 'relation' ? relation || {} : undefined };
      }

      const rawTarget = String(relation.targetCollectionId || '').trim();
      const mappedTarget = collectionIdMap.get(rawTarget) || rawTarget;
      if (!allCollectionIds.has(mappedTarget)) {
        return { ...prop, type: 'text', relation: undefined };
      }

      relation.targetCollectionId = mappedTarget;
      relation.type = ['one_to_one', 'one_to_many', 'many_to_many'].includes(String(relation.type || ''))
        ? relation.type
        : 'many_to_many';

      if (!Array.isArray(relation.displayFieldIds) || relation.displayFieldIds.length === 0) {
        const targetCollection = nextCollections.find((c) => c?.id === mappedTarget);
        const displayFieldIds = getPreferredRelationDisplayFieldIds(targetCollection);
        if (displayFieldIds.length) relation.displayFieldIds = displayFieldIds;
      }

      return { ...prop, relation };
    });

    const relationPropsById = new Map(properties.filter((p) => p.type === 'relation').map((p) => [p.id, p]));

    const items = (collection.items || []).map((item) => {
      const nextItem = { ...item };

      properties.forEach((prop) => {
        const raw = nextItem[prop.id];
        if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
          nextItem[prop.id] = raw ?? null;
          return;
        }

        if (prop.type === 'checkbox') {
          nextItem[prop.id] = toBooleanValue(raw);
          return;
        }

        if (prop.type === 'number') {
          const num = Number(String(raw).replace(',', '.'));
          nextItem[prop.id] = Number.isFinite(num) ? num : null;
          return;
        }

        if (prop.type === 'relation') {
          const relation = relationPropsById.get(prop.id)?.relation || {};
          const relType = relation.type || 'many_to_many';
          const tokens = extractRelationTokens(raw);
          nextItem[prop.id] = relType === 'many_to_many' ? Array.from(new Set(tokens)) : (tokens[0] || null);
          return;
        }
      });

      return nextItem;
    });

    return { ...collection, properties, items };
  });
};

const normalizeImportedStateFromCollections = (collections, rawState = {}, options = {}) => {
  const infer = options?.infer !== false;
  const safeCollections = infer
    ? enrichCollectionsWithAutoTypesAndRelations(collections)
    : normalizeImportedCollectionsManual(collections);
  const views = rawState.views && typeof rawState.views === 'object'
    ? rawState.views
    : buildDefaultViewsFromCollections(safeCollections);

  return {
    collections: safeCollections,
    views,
    dashboards: Array.isArray(rawState.dashboards) ? rawState.dashboards : [],
    dashboardSort: rawState.dashboardSort || 'created',
    dashboardFilters: rawState.dashboardFilters && typeof rawState.dashboardFilters === 'object'
      ? rawState.dashboardFilters
      : {},
    favorites: rawState.favorites && typeof rawState.favorites === 'object'
      ? {
          views: Array.isArray(rawState.favorites.views) ? rawState.favorites.views : [],
          items: Array.isArray(rawState.favorites.items) ? rawState.favorites.items : [],
        }
      : { views: [], items: [] },
  };
};

const parseOrganizationsFromJsonPayload = (payload) => {
  const organizations = [];
  const data = payload || {};

  const isArrayOfObjects = (value) => {
    return Array.isArray(value)
      && value.length > 0
      && value.every((row) => row && typeof row === 'object' && !Array.isArray(row));
  };

  const pushFromState = (organizationName, stateObj) => {
    if (!stateObj || typeof stateObj !== 'object') return;
    const collections = Array.isArray(stateObj.collections) ? stateObj.collections : [];
    if (!collections.length) return;
    organizations.push({
      name: String(organizationName || 'Organisation importée').trim(),
      state: normalizeImportedStateFromCollections(collections, stateObj),
    });
  };

  if (data?.scope === 'global' && Array.isArray(data.organizations) && Array.isArray(data.app_state)) {
    data.organizations.forEach((org) => {
      const stateRow = data.app_state.find((row) => row.organization_id === org.id);
      if (!stateRow?.data) return;
      try {
        const parsedState = typeof stateRow.data === 'string' ? JSON.parse(stateRow.data) : stateRow.data;
        pushFromState(org.name || 'Organisation importée', parsedState);
      } catch {
        // Ignore state row invalide
      }
    });
    return organizations;
  }

  if (data?.scope === 'organization' && Array.isArray(data.app_state) && data.app_state[0]?.data) {
    try {
      const parsedState = typeof data.app_state[0].data === 'string'
        ? JSON.parse(data.app_state[0].data)
        : data.app_state[0].data;
      pushFromState(data.organization?.name || data.name || 'Organisation importée', parsedState);
    } catch {
      // Ignore
    }
    return organizations;
  }

  if (Array.isArray(data.organizations)) {
    data.organizations.forEach((org, index) => {
      if (org?.state && typeof org.state === 'object') {
        pushFromState(org.name || `Organisation importée ${index + 1}`, org.state);
        return;
      }

      if (Array.isArray(org?.collections)) {
        const collections = org.collections.map((col, colIdx) => {
          if (Array.isArray(col?.items)) return col;
          if (Array.isArray(col?.rows)) return normalizeCollectionFromRows(col.name || `Collection ${colIdx + 1}`, col.rows);
          return col;
        });
        organizations.push({
          name: org.name || `Organisation importée ${index + 1}`,
          state: normalizeImportedStateFromCollections(collections, org),
        });
      }
    });
    return organizations;
  }

  if (Array.isArray(data.collections)) {
    organizations.push({
      name: data.organizationName || data.name || 'Organisation importée',
      state: normalizeImportedStateFromCollections(data.collections, data),
    });
    return organizations;
  }

  if (Array.isArray(data)) {
    const allObjects = data.every((row) => row && typeof row === 'object' && !Array.isArray(row));
    if (allObjects) {
      const collection = normalizeCollectionFromRows(data.name || 'Collection importée', data);
      organizations.push({
        name: 'Organisation importée',
        state: normalizeImportedStateFromCollections([collection], {}),
      });
    }
  }

  // Fallback générique : objet racine avec plusieurs tableaux de lignes
  // Ex: { users: [...], products: [...], orders: [...] }
  if (!organizations.length && data && typeof data === 'object' && !Array.isArray(data)) {
    const genericCollections = Object.entries(data)
      .filter(([, value]) => isArrayOfObjects(value))
      .map(([key, value]) => normalizeCollectionFromRows(key, value));

    if (genericCollections.length > 0) {
      organizations.push({
        name: data.organizationName || data.name || 'Organisation importée (JSON générique)',
        state: normalizeImportedStateFromCollections(genericCollections, {}),
      });
    }
  }

  return organizations;
};

export const buildImportPreviewOrganizations = ({ format, body }) => {
  const normalizedFormat = String(format || '').toLowerCase();
  if (normalizedFormat === 'csv') {
    return parseOrganizationsFromCsvFiles(body?.files || [], body?.organizationName || '');
  }
  if (normalizedFormat === 'json') {
    return parseOrganizationsFromJsonPayload(body?.payload || {});
  }
  return [];
};

export const sanitizeMappedOrganizations = (mappedOrganizations = []) => {
  if (!Array.isArray(mappedOrganizations)) return [];

  const out = [];
  mappedOrganizations.forEach((org, index) => {
    const orgName = String(org?.name || `Organisation importée ${index + 1}`).trim();
    const state = org?.state && typeof org.state === 'object' ? org.state : {};
    const collections = Array.isArray(state.collections)
      ? state.collections
      : (Array.isArray(org?.collections) ? org.collections : []);
    if (!collections.length) return;

    out.push({
      name: orgName,
      state: normalizeImportedStateFromCollections(collections, state, { infer: false }),
    });
  });

  return out;
};

export const applyOrganizationNameOverride = (organizations = [], overrideName = '') => {
  const forcedName = String(overrideName || '').trim();
  if (!forcedName) return organizations;
  if (!Array.isArray(organizations) || organizations.length === 0) return organizations;

  if (organizations.length === 1) {
    return [{ ...organizations[0], name: forcedName }];
  }

  return organizations.map((org, index) => ({
    ...org,
    name: `${forcedName} ${index + 1}`,
  }));
};

const parseOrganizationsFromCsvFiles = (files = [], organizationName = '') => {
  const normalizedFiles = Array.isArray(files) ? files : [];
  const collections = [];

  normalizedFiles.forEach((file, index) => {
    const filename = String(file?.name || `collection_${index + 1}.csv`);
    const rawName = filename.replace(/\.csv$/i, '').trim() || `Collection ${index + 1}`;
    const rows = csvContentToObjects(file?.content || file?.text || '');
    if (!rows.length) return;
    collections.push(normalizeCollectionFromRows(rawName, rows));
  });

  if (!collections.length) return [];

  return [
    {
      name: String(organizationName || 'Organisation importée CSV').trim(),
      state: normalizeImportedStateFromCollections(collections, {}),
    },
  ];
};
