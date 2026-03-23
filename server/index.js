import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import pkg from 'pg';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const TOKEN_EXPIRES = process.env.JWT_EXPIRES || '7d';
const execFileAsync = promisify(execFile);

const INITIAL_APP_STATE = {
  collections: [],
  views: {},
  dashboards: [],
  dashboardSort: 'created',
  dashboardFilters: {},
  favorites: { views: [], items: [] }
};

const RESERVED_IMPORT_ITEM_KEYS = new Set(['id', '_eventSegments', '_preserveEventSegments', '__collectionId']);

const normalizeImportName = (value, fallback = 'element') => {
  const source = String(value || '').trim();
  if (!source) return fallback;
  return source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
};

const ensureUniqueId = (baseId, usedIds, fallbackPrefix = 'id') => {
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

const parsePotentialJsonArray = (value) => {
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

const normalizeImportScalar = (value) => {
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

const csvContentToObjects = (content) => {
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

const inferPrimitiveType = (values) => {
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

const toBooleanValue = (value) => {
  if (value === null || value === undefined) return false;
  const s = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'oui'].includes(s);
};

const extractRelationTokens = (value) => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  const parsedArray = parsePotentialJsonArray(value);
  if (Array.isArray(parsedArray)) {
    return parsedArray.map((v) => String(v).trim()).filter(Boolean);
  }
  const str = String(value).trim();
  if (!str) return [];
  if (str.includes(',') || str.includes(';')) {
    const sep = str.includes(';') ? ';' : ',';
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

  const idSetsByCollectionId = new Map(
    collectionsCopy.map((c) => [
      c.id,
      new Set((c.items || []).map((item) => String(item?.id || '').trim()).filter(Boolean)),
    ])
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
        const targetIds = idSetsByCollectionId.get(target.id);
        if (!targetIds || targetIds.size === 0) continue;

        let checked = 0;
        let matched = 0;
        let hasMany = false;

        values.forEach((v) => {
          const tokens = extractRelationTokens(v);
          if (!tokens.length) return;
          checked += 1;
          if (tokens.length > 1) hasMany = true;
          const allMatch = tokens.every((token) => targetIds.has(String(token)));
          if (allMatch) matched += 1;
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

      if (bestTarget && (bestRatio >= 0.95 || (relationByNameHint && bestRatio >= 0.75))) {
        prop.type = 'relation';
        prop.relation = {
          targetCollectionId: bestTarget.id,
          type: manyHint || fieldKey.endsWith('_ids') || fieldKey.endsWith('ids') ? 'many_to_many' : 'one_to_many',
        };

        collection.items = (collection.items || []).map((item) => {
          const tokens = extractRelationTokens(item?.[prop.id]);
          const nextVal = prop.relation.type === 'many_to_many'
            ? Array.from(new Set(tokens))
            : (tokens[0] || null);
          return { ...item, [prop.id]: nextVal };
        });
        continue;
      }

      const primitive = inferPrimitiveType(values);
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

    // Fusion automatique des paires "label + id" (ex: tag + tagid) en une seule relation.
    const removablePropertyIds = new Set();
    for (const prop of collection.properties || []) {
      if (!prop || prop.type !== 'relation') continue;

      const relationKey = normalizeImportName(prop.name || prop.id);
      const baseKey = getRelationFieldBase(relationKey);
      if (!baseKey) continue;

      const sibling = (collection.properties || []).find((candidate) => {
        if (!candidate || candidate.id === prop.id) return false;
        if (candidate.type === 'relation') return false;
        const candidateKey = normalizeImportName(candidate.name || candidate.id);
        return candidateKey === baseKey;
      });
      if (!sibling) continue;

      const items = Array.isArray(collection.items) ? collection.items : [];
      let overlapCount = 0;
      let compared = 0;
      for (const item of items) {
        const hasRelation = extractRelationTokens(item?.[prop.id]).length > 0;
        const hasSibling = String(item?.[sibling.id] ?? '').trim() !== '';
        if (hasRelation || hasSibling) compared += 1;
        if (hasRelation && hasSibling) overlapCount += 1;
      }

      // Ne fusionne que si les deux colonnes cohabitent réellement sur la majorité des lignes.
      if (compared > 0 && overlapCount / compared < 0.6) continue;

      removablePropertyIds.add(sibling.id);
      prop.name = sibling.name || toImportLabelFromKey(baseKey, prop.name || 'Relation');
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

const buildImportPreviewOrganizations = ({ format, body }) => {
  const normalizedFormat = String(format || '').toLowerCase();
  if (normalizedFormat === 'csv') {
    return parseOrganizationsFromCsvFiles(body?.files || [], body?.organizationName || '');
  }
  if (normalizedFormat === 'json') {
    return parseOrganizationsFromJsonPayload(body?.payload || {});
  }
  return [];
};

const sanitizeMappedOrganizations = (mappedOrganizations = []) => {
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

const applyOrganizationNameOverride = (organizations = [], overrideName = '') => {
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

// PostgreSQL connection pool
let pool;
if (process.env.DATABASE_PUBLIC_URL) {
  // Use DATABASE_PUBLIC_URL directly (Railway/production)
  pool = new Pool({
    connectionString: process.env.DATABASE_PUBLIC_URL,
  });
} else {
  // Use individual environment variables (local development)
  pool = new Pool({
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres',
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: process.env.PGPORT || process.env.DB_PORT || 5432,
    database: process.env.PGDATABASE || process.env.DB_NAME || 'erp_db',
  });
}

// --- Backup configuration ----------------------------------------------
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
const BACKUP_RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS || 14);
const BACKUP_INTERVAL_MINUTES = Number(process.env.BACKUP_INTERVAL_MINUTES) || 1440; // Par défaut toutes les 24h

const ensureBackupDir = async () => {
  await fs.promises.mkdir(BACKUP_DIR, { recursive: true });
};

const toSafeLabel = (label) => {
  if (!label) return '';
  return String(label).trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
};

const resolveBackupPath = (name) => {
  const safeName = path.basename(String(name || ''));
  if (!safeName || safeName !== name) return null;
  const fullPath = path.resolve(BACKUP_DIR, safeName);
  if (!fullPath.startsWith(path.resolve(BACKUP_DIR))) return null;
  return fullPath;
};

const getDbConnection = () => {
  if (process.env.DATABASE_PUBLIC_URL) {
    return { type: 'url', value: process.env.DATABASE_PUBLIC_URL };
  }
  return {
    type: 'params',
    value: {
      user: process.env.PGUSER || process.env.DB_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.DB_PASSWORD || 'postgres',
      host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
      port: process.env.PGPORT || process.env.DB_PORT || 5432,
      database: process.env.PGDATABASE || process.env.DB_NAME || 'erp_db',
    },
  };
};

const listBackups = async () => {
  await ensureBackupDir();
  const entries = await fs.promises.readdir(BACKUP_DIR);
  const backups = [];
  for (const entry of entries) {
    const fullPath = path.join(BACKUP_DIR, entry);
    const stat = await fs.promises.stat(fullPath);
    if (!stat.isFile()) continue;
    backups.push({
      name: entry,
      size: stat.size,
      createdAt: stat.mtime,
    });
  }
  backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return backups;
};

const pruneBackups = async () => {
  if (!Number.isFinite(BACKUP_RETENTION_DAYS) || BACKUP_RETENTION_DAYS <= 0) return;
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const backups = await listBackups();
  for (const backup of backups) {
    const createdAt = new Date(backup.createdAt).getTime();
    if (createdAt < cutoff) {
      const fullPath = resolveBackupPath(backup.name);
      if (fullPath) {
        await fs.promises.unlink(fullPath);
      }
    }
  }
};

const formatBackupError = (err) => {
  const stderr = typeof err?.stderr === 'string' ? err.stderr.trim() : '';
  const stdout = typeof err?.stdout === 'string' ? err.stdout.trim() : '';

  if (err?.code === 'ENOENT') {
    return 'pg_dump introuvable sur le serveur. Installez postgresql-client (ou ajoutez pg_dump au PATH).';
  }

  if (stderr) return stderr;
  if (stdout) return stdout;
  if (err?.message) return String(err.message);
  return 'Erreur inconnue lors de la création de la sauvegarde.';
};

const createDbBackup = async (label = '') => {
  await ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeLabel = toSafeLabel(label);
  const filename = `db-backup-${timestamp}${safeLabel ? `-${safeLabel}` : ''}.sql`;
  const filePath = path.join(BACKUP_DIR, filename);

  const db = getDbConnection();
  const args = ['-F', 'p', '--no-owner', '--no-privileges', '--file', filePath];
  let env = { ...process.env };
  if (db.type === 'url') {
    args.push('--dbname', db.value);
  } else {
    args.push('-h', String(db.value.host));
    args.push('-p', String(db.value.port));
    args.push('-U', String(db.value.user));
    args.push('-d', String(db.value.database));
    env = { ...env, PGPASSWORD: String(db.value.password || '') };
  }

  await execFileAsync('pg_dump', args, { env });
  await pruneBackups();

  const stat = await fs.promises.stat(filePath);
  return {
    name: filename,
    size: stat.size,
    createdAt: stat.mtime,
  };
};

const restoreDbBackup = async (name) => {
  const filePath = resolveBackupPath(name);
  if (!filePath) throw new Error('Invalid backup name');
  const db = getDbConnection();
  const ext = path.extname(filePath).toLowerCase();
  let env = { ...process.env };

  if (db.type === 'url') {
    if (ext === '.sql') {
      await execFileAsync('psql', ['--dbname', db.value, '-v', 'ON_ERROR_STOP=1', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'], { env });
      await execFileAsync('psql', ['--dbname', db.value, '-v', 'ON_ERROR_STOP=1', '-f', filePath], { env });
    } else {
      await execFileAsync('pg_restore', ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', db.value, filePath], { env });
    }
    return;
  }

  env = { ...env, PGPASSWORD: String(db.value.password || '') };
  if (ext === '.sql') {
    await execFileAsync(
      'psql',
      ['-h', String(db.value.host), '-p', String(db.value.port), '-U', String(db.value.user), '-d', String(db.value.database), '-v', 'ON_ERROR_STOP=1', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'],
      { env }
    );
    await execFileAsync(
      'psql',
      ['-h', String(db.value.host), '-p', String(db.value.port), '-U', String(db.value.user), '-d', String(db.value.database), '-v', 'ON_ERROR_STOP=1', '-f', filePath],
      { env }
    );
  } else {
    await execFileAsync(
      'pg_restore',
      ['--clean', '--if-exists', '--no-owner', '--no-privileges', '-h', String(db.value.host), '-p', String(db.value.port), '-U', String(db.value.user), '-d', String(db.value.database), filePath],
      { env }
    );
  }
};

// CORS configuration - allow same-origin or CLIENT_ORIGIN
app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    // Allow CLIENT_ORIGIN
    if (origin === CLIENT_ORIGIN) return callback(null, true);
    // In production, also allow same-origin requests
    callback(null, true);
  }, 
  credentials: true 
}));
app.use(cookieParser());
app.use(express.json({ limit: '20mb' }));

// --- DB bootstrap -------------------------------------------------------
const bootstrap = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      provider TEXT,
      provider_id TEXT,
      password_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Ajout des colonnes favorite_views et favorite_items si manquantes
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='favorite_views') THEN
        ALTER TABLE users ADD COLUMN favorite_views TEXT[] DEFAULT ARRAY[]::TEXT[];
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='favorite_items') THEN
        ALTER TABLE users ADD COLUMN favorite_items TEXT[] DEFAULT ARRAY[]::TEXT[];
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='user_preferences') THEN
        ALTER TABLE users ADD COLUMN user_preferences JSONB DEFAULT '{}'::jsonb;
      END IF;
    END$$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organization_members (
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (organization_id, user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      is_system BOOLEAN DEFAULT FALSE
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='organization_id') THEN
        ALTER TABLE roles ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
    END$$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `);

  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS roles_org_name_unique_idx ON roles (organization_id, name);');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_roles' AND column_name='organization_id') THEN
        ALTER TABLE user_roles ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
    END$$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `);

  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS user_roles_org_user_role_unique_idx ON user_roles (organization_id, user_id, role_id);');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY,
      role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      collection_id TEXT,
      item_id TEXT,
      field_id TEXT,
      can_read BOOLEAN DEFAULT FALSE,
      can_write BOOLEAN DEFAULT FALSE,
      can_delete BOOLEAN DEFAULT FALSE,
      can_manage_fields BOOLEAN DEFAULT FALSE,
      can_manage_views BOOLEAN DEFAULT FALSE,
      can_manage_permissions BOOLEAN DEFAULT FALSE
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='permissions' AND column_name='organization_id') THEN
        ALTER TABLE permissions ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
    END$$;
  `);

  // Drop old constraint if exists
  await pool.query(`
    DO $$ 
    BEGIN
      ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_role_id_collection_id_item_id_field_id_key;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `);

  // Drop old index if exists
  await pool.query(`DROP INDEX IF EXISTS permissions_unique_idx;`);

  // Clean up duplicates - keep only the most recent one
  await pool.query(`
    DELETE FROM permissions p1
    WHERE EXISTS (
      SELECT 1 FROM permissions p2
      WHERE COALESCE(p2.organization_id::text, '') = COALESCE(p1.organization_id::text, '')
        AND p2.role_id = p1.role_id
        AND COALESCE(p2.collection_id, '') = COALESCE(p1.collection_id, '')
        AND COALESCE(p2.item_id, '') = COALESCE(p1.item_id, '')
        AND COALESCE(p2.field_id, '') = COALESCE(p1.field_id, '')
        AND p2.id > p1.id
    );
  `);

  // Create unique index with COALESCE
  await pool.query(`
    CREATE UNIQUE INDEX permissions_unique_idx 
    ON permissions (organization_id, role_id, COALESCE(collection_id, ''), COALESCE(item_id, ''), COALESCE(field_id, ''));
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id SERIAL PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      UNIQUE(user_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS organization_members (
      organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (organization_id, user_id)
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_state' AND column_name='user_id') THEN
        ALTER TABLE app_state ALTER COLUMN user_id DROP NOT NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_state' AND column_name='organization_id') THEN
        ALTER TABLE app_state ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      END IF;
    END$$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      ALTER TABLE app_state DROP CONSTRAINT IF EXISTS app_state_user_id_key;
    EXCEPTION
      WHEN undefined_object THEN NULL;
    END $$;
  `);

  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS app_state_organization_id_unique ON app_state (organization_id);');
  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('app_state', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM app_state), 0) + 1, 1),
      false
    );
  `);

  const firstUser = await pool.query('SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1');
  if (firstUser.rowCount > 0) {
    await ensureDefaultOrganization(firstUser.rows[0].id);
  }
};

const getRoleByNameInOrganization = async (organizationId, roleName) => {
  return pool.query('SELECT id FROM roles WHERE organization_id = $1 AND name = $2 LIMIT 1', [organizationId, roleName]);
};

const ensureSystemRolesForOrganization = async (organizationId) => {
  if (!organizationId) return;
  const systemRoles = [
    { name: 'admin', description: 'Full access', is_system: true },
    { name: 'editor', description: 'Read/Write/Delete, manage fields/views', is_system: true },
    { name: 'viewer', description: 'Read-only', is_system: true },
  ];

  for (const role of systemRoles) {
    const existing = await pool.query('SELECT id FROM roles WHERE organization_id = $1 AND name = $2', [organizationId, role.name]);
    if (existing.rowCount === 0) {
      await pool.query(
        'INSERT INTO roles (id, organization_id, name, description, is_system) VALUES ($1, $2, $3, $4, $5)',
        [uuidv4(), organizationId, role.name, role.description, role.is_system]
      );
    }
  }

  // Ensure default permissions for system roles
  const admin = await getRoleByNameInOrganization(organizationId, 'admin');
  if (admin.rowCount) {
    await upsertPermission({
      organization_id: organizationId,
      role_id: admin.rows[0].id,
      collection_id: null,
      item_id: null,
      field_id: null,
      can_read: true,
      can_write: true,
      can_delete: true,
      can_manage_fields: true,
      can_manage_views: true,
      can_manage_permissions: true,
    });
  }

  const editor = await getRoleByNameInOrganization(organizationId, 'editor');
  if (editor.rowCount) {
    await upsertPermission({
      organization_id: organizationId,
      role_id: editor.rows[0].id,
      collection_id: null,
      item_id: null,
      field_id: null,
      can_read: true,
      can_write: true,
      can_delete: true,
      can_manage_fields: true,
      can_manage_views: true,
      can_manage_permissions: false,
    });
  }

  const viewer = await getRoleByNameInOrganization(organizationId, 'viewer');
  if (viewer.rowCount) {
    await upsertPermission({
      organization_id: organizationId,
      role_id: viewer.rows[0].id,
      collection_id: null,
      item_id: null,
      field_id: null,
      can_read: true,
      can_write: false,
      can_delete: false,
      can_manage_fields: false,
      can_manage_views: false,
      can_manage_permissions: false,
    });
  }
};

const syncAppStateIdSequence = async () => {
  await pool.query(`
    SELECT setval(
      pg_get_serial_sequence('app_state', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM app_state), 0) + 1, 1),
      false
    );
  `);
};

const ensureAppStateForOrganization = async (organizationId) => {
  if (!organizationId) return;
  const state = await pool.query('SELECT id FROM app_state WHERE organization_id = $1', [organizationId]);
  if (!state.rowCount) {
    await syncAppStateIdSequence();
    await pool.query(
      'INSERT INTO app_state (organization_id, data) VALUES ($1, $2)',
      [organizationId, JSON.stringify(INITIAL_APP_STATE)]
    );
  }
};

const ensureDefaultOrganization = async (ownerUserId) => {
  if (!ownerUserId) return null;

  let orgRes = await pool.query('SELECT id, name FROM organizations ORDER BY created_at ASC, id ASC LIMIT 1');
  if (!orgRes.rowCount) {
    const orgId = uuidv4();
    await pool.query(
      'INSERT INTO organizations (id, name, owner_user_id) VALUES ($1, $2, $3)',
      [orgId, 'Organisation principale', ownerUserId]
    );
    orgRes = { rowCount: 1, rows: [{ id: orgId, name: 'Organisation principale' }] };
  }

  const organizationId = orgRes.rows[0].id;
  await pool.query(
    'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [organizationId, ownerUserId]
  );

  await pool.query(
    'UPDATE app_state SET organization_id = $1 WHERE organization_id IS NULL',
    [organizationId]
  );

  await pool.query(
    'UPDATE roles SET organization_id = $1 WHERE organization_id IS NULL',
    [organizationId]
  );
  await pool.query(
    'UPDATE user_roles SET organization_id = $1 WHERE organization_id IS NULL',
    [organizationId]
  );
  await pool.query(
    'UPDATE permissions SET organization_id = $1 WHERE organization_id IS NULL',
    [organizationId]
  );

  await ensureSystemRolesForOrganization(organizationId);

  await ensureAppStateForOrganization(organizationId);
  return organizationId;
};

const upsertPermission = async (perm) => {
  const result = await pool.query(
    `INSERT INTO permissions (id, organization_id, role_id, collection_id, item_id, field_id, can_read, can_write, can_delete, can_manage_fields, can_manage_views, can_manage_permissions)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (organization_id, role_id, COALESCE(collection_id, ''), COALESCE(item_id, ''), COALESCE(field_id, ''))
     DO UPDATE SET can_read = EXCLUDED.can_read, can_write = EXCLUDED.can_write, can_delete = EXCLUDED.can_delete,
                   can_manage_fields = EXCLUDED.can_manage_fields, can_manage_views = EXCLUDED.can_manage_views,
                   can_manage_permissions = EXCLUDED.can_manage_permissions
     RETURNING *;
    `,
    [
      perm.id || uuidv4(),
      perm.organization_id,
      perm.role_id,
      perm.collection_id || null,
      perm.item_id || null,
      perm.field_id || null,
      !!perm.can_read,
      !!perm.can_write,
      !!perm.can_delete,
      !!perm.can_manage_fields,
      !!perm.can_manage_views,
      !!perm.can_manage_permissions,
    ]
  );
  return result.rows[0];
};

// --- Auth helpers -------------------------------------------------------
const signToken = (userId) => {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES });
};

const setAuthCookie = (res, token) => {
  res.cookie('access_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearAuthCookie = (res) => {
  res.clearCookie('access_token');
};

const getAdminRoleForOrganization = async (organizationId) => {
  if (!organizationId) return null;
  const adminRoleRes = await pool.query(
    'SELECT id FROM roles WHERE organization_id = $1 AND name = $2 LIMIT 1',
    [organizationId, 'admin']
  );
  if (!adminRoleRes.rowCount) return null;
  return adminRoleRes.rows[0];
};

const countOrganizationAdmins = async (organizationId) => {
  const adminRole = await getAdminRoleForOrganization(organizationId);
  if (!adminRole?.id) return 0;
  const countRes = await pool.query(
    'SELECT COUNT(*)::int AS count FROM user_roles WHERE organization_id = $1 AND role_id = $2',
    [organizationId, adminRole.id]
  );
  return Number(countRes.rows[0]?.count || 0);
};

const isUserAdminInOrganization = async (organizationId, userId) => {
  const adminRole = await getAdminRoleForOrganization(organizationId);
  if (!adminRole?.id) return false;
  const row = await pool.query(
    'SELECT 1 FROM user_roles WHERE organization_id = $1 AND user_id = $2 AND role_id = $3 LIMIT 1',
    [organizationId, userId, adminRole.id]
  );
  return row.rowCount > 0;
};

const wouldRemoveLastOrganizationAdmin = async (organizationId, userId) => {
  const userIsAdmin = await isUserAdminInOrganization(organizationId, userId);
  if (!userIsAdmin) return false;
  const totalAdmins = await countOrganizationAdmins(organizationId);
  return totalAdmins <= 1;
};

const createLocalUser = async ({ email, password, name }) => {
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount) {
    throw new Error('email_exists');
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const userId = uuidv4();
  await pool.query(
    'INSERT INTO users (id, email, name, provider, password_hash) VALUES ($1, $2, $3, $4, $5)',
    [userId, email, name || email.split('@')[0] || 'Utilisateur', 'local', passwordHash]
  );

  const totalUsers = await pool.query('SELECT COUNT(*) FROM users');
  if (Number(totalUsers.rows[0].count) === 1) {
    const defaultOrgId = await ensureDefaultOrganization(userId);
    const admin = await getRoleByNameInOrganization(defaultOrgId, 'admin');
    if (admin.rowCount) {
      await pool.query(
        'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [defaultOrgId, userId, admin.rows[0].id]
      );
    }
  } else {
    const defaultOrg = await pool.query('SELECT id FROM organizations ORDER BY created_at ASC, id ASC LIMIT 1');
    if (defaultOrg.rowCount) {
      const defaultOrgId = defaultOrg.rows[0].id;
      await ensureSystemRolesForOrganization(defaultOrgId);
      await pool.query(
        'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [defaultOrgId, userId]
      );
      const viewer = await getRoleByNameInOrganization(defaultOrgId, 'viewer');
      if (viewer.rowCount) {
        await pool.query(
          'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [defaultOrgId, userId, viewer.rows[0].id]
        );
      }
    } else {
      const defaultOrgId = await ensureDefaultOrganization(userId);
      const viewer = await getRoleByNameInOrganization(defaultOrgId, 'viewer');
      if (viewer.rowCount) {
        await pool.query(
          'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [defaultOrgId, userId, viewer.rows[0].id]
        );
      }
    }
  }

  return userId;
};

const getUserOrganizations = async (userId) => {
  const orgsRes = await pool.query(
    `SELECT o.id, o.name, o.created_at, o.owner_user_id
     FROM organizations o
     INNER JOIN organization_members om ON om.organization_id = o.id
     WHERE om.user_id = $1
     ORDER BY o.created_at ASC, o.name ASC`,
    [userId]
  );
  return orgsRes.rows;
};

const resolveActiveOrganization = async (userId, requestedOrganizationId = null) => {
  const organizations = await getUserOrganizations(userId);
  if (!organizations.length) {
    const fallbackOrgId = await ensureDefaultOrganization(userId);
    const fallbackOrgs = await getUserOrganizations(userId);
    return {
      organizations: fallbackOrgs,
      activeOrganization: fallbackOrgs.find((org) => org.id === fallbackOrgId) || fallbackOrgs[0] || null,
    };
  }

  if (requestedOrganizationId) {
    const requested = organizations.find((org) => org.id === requestedOrganizationId);
    if (requested) {
      return { organizations, activeOrganization: requested };
    }
  }

  return { organizations, activeOrganization: organizations[0] };
};

// --- Middleware ---------------------------------------------------------
const loadUserContext = async (userId, impersonateRoleId = null, requestedOrganizationId = null) => {
  const userRes = await pool.query('SELECT id, email, name, user_preferences FROM users WHERE id = $1', [userId]);
  if (!userRes.rowCount) return null;

  const orgContext = await resolveActiveOrganization(userId, requestedOrganizationId);
  const activeOrganizationId = orgContext.activeOrganization?.id || null;
  if (activeOrganizationId) {
    await ensureAppStateForOrganization(activeOrganizationId);
    await ensureSystemRolesForOrganization(activeOrganizationId);
  }

  if (!activeOrganizationId) {
    return {
      user: userRes.rows[0],
      roles: [],
      permissions: [],
      impersonatedRoleId: null,
      organizations: orgContext.organizations,
      activeOrganization: null,
    };
  }

  const rolesRes = await pool.query(
    `SELECT r.*
     FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1
       AND ur.organization_id = $2
       AND r.organization_id = $2`,
    [userId, activeOrganizationId]
  );

  // If impersonation is requested, restrict to that role for permissions/roles
  const roleIds = impersonateRoleId
    ? [impersonateRoleId]
    : rolesRes.rows.map((r) => r.id);

  const permsRes = roleIds.length
    ? await pool.query(
      'SELECT * FROM permissions WHERE organization_id = $1 AND role_id = ANY($2)',
      [activeOrganizationId, roleIds]
    )
    : { rows: [] };

  return {
    user: userRes.rows[0],
    roles: impersonateRoleId ? rolesRes.rows.filter((r) => r.id === impersonateRoleId) : rolesRes.rows,
    permissions: permsRes.rows,
    impersonatedRoleId: impersonateRoleId,
    organizations: orgContext.organizations,
    activeOrganization: orgContext.activeOrganization,
  };
};

const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies.auth_token || req.cookies.access_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const rawOrganizationId = req.headers['x-organization-id'] || req.cookies.active_organization_id || null;
    const requestedOrganizationId = Array.isArray(rawOrganizationId)
      ? rawOrganizationId[0]
      : rawOrganizationId
        ? String(rawOrganizationId)
        : null;
    const baseCtx = await loadUserContext(decoded.sub, null, requestedOrganizationId);
    if (!baseCtx) return res.status(401).json({ error: 'Invalid user' });

    const isAdmin = baseCtx.roles.some((r) => r.name === 'admin');
    const impersonateRoleId = req.cookies.impersonate_role_id || req.headers['x-impersonate-role-id'] || null;

    if (impersonateRoleId && isAdmin) {
      // Vérifier que le rôle existe toujours
      const roleCheck = await pool.query(
        'SELECT id FROM roles WHERE id = $1 AND organization_id = $2',
        [impersonateRoleId, baseCtx.activeOrganization?.id || null]
      );
      if (roleCheck.rows.length === 0) {
        req.auth = { ...baseCtx, baseRoles: baseCtx.roles, baseIsAdmin: isAdmin };
        return next();
      }
      const impCtx = await loadUserContext(decoded.sub, impersonateRoleId, requestedOrganizationId);
      req.auth = {
        ...(impCtx || baseCtx),
        baseRoles: baseCtx.roles,
        baseIsAdmin: isAdmin,
      };
    } else {
      req.auth = { ...baseCtx, baseRoles: baseCtx.roles, baseIsAdmin: isAdmin };
    }
    return next();
  } catch (err) {
    console.error('Auth error', err);
    return res.status(401).json({ error: 'Unauthenticated' });
  }
};

const hasPermission = (ctx, scope, action) => {
  if (!ctx) return false;
  const flag = action;
  const isAdmin = ctx.roles.some((r) => r.name === 'admin');
  if (isAdmin) return true;

  // Priority: field > item > collection > global
  const perms = ctx.permissions || [];

  if (scope.field_id) {
    const match = perms.find(
      (p) => p.field_id === scope.field_id && p.item_id === scope.item_id && p.collection_id === scope.collection_id
    );
    if (match) return Boolean(match[flag]);
  }

  if (scope.item_id) {
    const match = perms.find(
      (p) => p.item_id === scope.item_id && p.collection_id === scope.collection_id && p.field_id === null
    );
    if (match) return Boolean(match[flag]);
  }

  if (scope.collection_id) {
    const match = perms.find((p) => p.collection_id === scope.collection_id && p.item_id === null && p.field_id === null);
    if (match) return Boolean(match[flag]);
  }

  const globalMatch = perms.find((p) => p.collection_id === null && p.item_id === null && p.field_id === null);
  if (globalMatch) return Boolean(globalMatch[flag]);

  return false;
};

const requirePermission = (action, scopeBuilder = () => ({})) => {
  return (req, res, next) => {
    const scope = scopeBuilder(req);
    if (hasPermission(req.auth, scope, action)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
};

const requireBaseAdminOrPermission = (action, scopeBuilder = () => ({})) => {
  return (req, res, next) => {
    if (req.auth?.baseIsAdmin) return next();
    const scope = scopeBuilder(req);
    if (hasPermission(req.auth, scope, action)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  };
};

// --- Segment calculation function (shared logic) ---
const DEFAULT_CALENDAR_CONFIG = {
  breakStart: 12.5,
  breakEnd: 13.5,
  workDayStart: 9,
  workDayEnd: 18,
};

const clampHour = (value, min = 0, max = 24) => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
};

const parseTimeToDecimalHour = (value, fallback) => {
  if (typeof value === 'number' && Number.isFinite(value)) return clampHour(value);
  if (typeof value !== 'string') return clampHour(fallback);
  const [hRaw, mRaw] = value.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return clampHour(fallback);
  return clampHour(h + m / 60);
};

const decimalHourToHM = (value) => {
  const clamped = clampHour(value);
  let hour = Math.floor(clamped);
  let minute = Math.round((clamped - hour) * 60);
  if (minute >= 60) {
    hour += 1;
    minute = 0;
  }
  if (hour >= 24) {
    hour = 23;
    minute = 59;
  }
  return { hour, minute };
};

const setDateToDecimalHour = (date, value) => {
  const { hour, minute } = decimalHourToHM(value);
  date.setHours(hour, minute, 0, 0);
};

const getCalendarConfigForUser = (user) => {
  let prefs = user?.user_preferences;
  if (typeof prefs === 'string') {
    try {
      prefs = JSON.parse(prefs);
    } catch {
      prefs = {};
    }
  }
  if (!prefs || typeof prefs !== 'object') prefs = {};

  const nextStart = parseTimeToDecimalHour(prefs.workStart, DEFAULT_CALENDAR_CONFIG.workDayStart);
  const nextEndRaw = parseTimeToDecimalHour(prefs.workEnd, DEFAULT_CALENDAR_CONFIG.workDayEnd);
  const nextEnd = Math.max(nextStart + 0.25, nextEndRaw);

  let nextBreakStart = parseTimeToDecimalHour(prefs.breakStart, DEFAULT_CALENDAR_CONFIG.breakStart);
  let nextBreakEnd = parseTimeToDecimalHour(prefs.breakEnd, DEFAULT_CALENDAR_CONFIG.breakEnd);

  nextBreakStart = clampHour(nextBreakStart, nextStart, nextEnd);
  nextBreakEnd = clampHour(nextBreakEnd, nextStart, nextEnd);
  if (nextBreakEnd < nextBreakStart) {
    [nextBreakStart, nextBreakEnd] = [nextBreakEnd, nextBreakStart];
  }

  return {
    workDayStart: nextStart,
    workDayEnd: nextEnd,
    breakStart: nextBreakStart,
    breakEnd: nextBreakEnd,
  };
};

const normalizeComparableValue = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

const getDateProperties = (collection) => {
  if (!collection || !Array.isArray(collection.properties)) return [];
  return collection.properties.filter((prop) => prop.type === 'date');
};

const areAllSegmentsModified = (prevItem, nextItem) => {
  const prevSegments = Array.isArray(prevItem?._eventSegments) ? prevItem._eventSegments : [];
  const nextSegments = Array.isArray(nextItem?._eventSegments) ? nextItem._eventSegments : [];

  if (prevSegments.length === 0 || nextSegments.length === 0) return false;
  if (prevSegments.length !== nextSegments.length) return false;

  return nextSegments.every((segment, index) => {
    const prevSegment = prevSegments[index];
    const prevStart = normalizeComparableValue(prevSegment?.start);
    const prevEnd = normalizeComparableValue(prevSegment?.end);
    const nextStart = normalizeComparableValue(segment?.start);
    const nextEnd = normalizeComparableValue(segment?.end);
    return prevStart !== nextStart || prevEnd !== nextEnd;
  });
};

const hasDateOrDurationChange = (prevItem, nextItem, collection, prevCollection) => {
  const dateProps = getDateProperties(collection);
  const prevProps = Array.isArray(prevCollection?.properties) ? prevCollection.properties : [];

  for (const prop of dateProps) {
    const dateKey = prop.id;
    const durationKey = `${prop.id}_duration`;

    const prevDate = normalizeComparableValue(prevItem?.[dateKey]);
    const nextDate = normalizeComparableValue(nextItem?.[dateKey]);
    if (prevDate !== nextDate) return true;

    const prevHasDuration = prevItem && Object.prototype.hasOwnProperty.call(prevItem, durationKey);
    const nextHasDuration = nextItem && Object.prototype.hasOwnProperty.call(nextItem, durationKey);

    const prevDuration = prevHasDuration ? normalizeComparableValue(prevItem[durationKey]) : null;
    const nextDuration = nextHasDuration ? normalizeComparableValue(nextItem[durationKey]) : null;
    if (prevDuration !== nextDuration) return true;

    if (!prevHasDuration && !nextHasDuration) {
      const prevProp = prevProps.find((p) => p.id === prop.id);
      const prevDefault = normalizeComparableValue(prevProp?.defaultDuration ?? null);
      const nextDefault = normalizeComparableValue(prop?.defaultDuration ?? null);
      if (prevDefault !== nextDefault) return true;
    }
  }

  return false;
};

const shouldRecalculateSegments = (prevItem, nextItem, collection, prevCollection) => {
  if (!nextItem) return true;
  if (!Array.isArray(nextItem._eventSegments) || nextItem._eventSegments.length === 0) return true;
  if (!prevItem) return true;

  if (nextItem?._preserveEventSegments) {
    return false;
  }

  if (hasDateOrDurationChange(prevItem, nextItem, collection, prevCollection)) return true;

  return false;
};

/**
 * Calcule les segments de temps pour un item sur une période de jours de travail
 */
function calculateEventSegments(item, collection, calendarConfig = DEFAULT_CALENDAR_CONFIG) {
  if (!collection || !collection.properties) return item;
  
  const segments = [];
  
  collection.properties.forEach((prop) => {
    if (prop.type === 'date' && item[prop.id]) {
      const durationKey = `${prop.id}_duration`;
      let duration = undefined;
      
      if (Object.prototype.hasOwnProperty.call(item, durationKey)) {
        duration = Number(item[durationKey]);
      } else if (prop.defaultDuration !== undefined && prop.defaultDuration !== null) {
        duration = Number(prop.defaultDuration);
      }
      
      // Si pas de durée valide, on ne génère pas de segment
      if (duration === undefined || isNaN(duration) || duration <= 0) {
        return;
      }
      
      // Décale la date au lundi si samedi/dimanche
      let startDate = item[prop.id];
      let startDateObj = new Date(startDate);
      
      if (startDateObj.getDay() === 6) { // samedi
        startDateObj.setDate(startDateObj.getDate() + 2);
        startDateObj.setHours(0, 0, 0, 0);
        startDate = startDateObj.toISOString();
      } else if (startDateObj.getDay() === 0) { // dimanche
        startDateObj.setDate(startDateObj.getDate() + 1);
        startDateObj.setHours(0, 0, 0, 0);
        startDate = startDateObj.toISOString();
      }
      
      // Appelle la fonction de découpe
      const segs = splitEventByWorkdaysServer(
        { startDate, durationHours: duration },
        {
          startCal: calendarConfig.workDayStart,
          endCal: calendarConfig.workDayEnd,
          breakStart: calendarConfig.breakStart,
          breakEnd: calendarConfig.breakEnd,
        }
      );
      
      segs.forEach(seg => {
        segments.push({
          start: seg.__eventStart instanceof Date ? seg.__eventStart.toISOString() : seg.__eventStart,
          end: seg.__eventEnd instanceof Date ? seg.__eventEnd.toISOString() : seg.__eventEnd,
          label: prop.name,
        });
      });
    }
  });
  
  return { ...item, _eventSegments: segments };
}

/**
 * Découpe un événement sur plusieurs jours ouvrés (version serveur)
 */
function splitEventByWorkdaysServer(item, opts) {
  const { startCal, endCal, breakStart, breakEnd } = opts;
  const start = new Date(item.startDate || item.start);
  
  let durationMs = 0;
  if (item.durationHours) {
    durationMs = item.durationHours * 60 * 60 * 1000;
  }
  
  if (!start || isNaN(start.getTime()) || durationMs <= 0) {
    return [];
  }
  
  const events = [];
  let remainingMs = durationMs;
  let current = new Date(start);
  
  while (remainingMs > 0) {
    // Saute les weekends
    while (current.getDay() === 0 || current.getDay() === 6) {
      current.setDate(current.getDate() + 1);
      setDateToDecimalHour(current, startCal);
    }
    
    // Définit les bornes de la journée
    let dayStart = new Date(current);
    let dayEnd = new Date(current);
    setDateToDecimalHour(dayStart, startCal);
    setDateToDecimalHour(dayEnd, endCal);
    
    let segmentStart = new Date(Math.max(dayStart.getTime(), current.getTime()));
    
    let pauseStart = new Date(current);
    setDateToDecimalHour(pauseStart, breakStart);
    let pauseEnd = new Date(current);
    setDateToDecimalHour(pauseEnd, breakEnd);
    
    // Matin (avant pause)
    if (segmentStart < pauseStart && segmentStart < dayEnd && remainingMs > 0) {
      let segmentEnd = new Date(Math.min(pauseStart.getTime(), segmentStart.getTime() + remainingMs));
      const segmentDuration = segmentEnd.getTime() - segmentStart.getTime();
      
      events.push({
        __eventStart: new Date(segmentStart),
        __eventEnd: new Date(segmentEnd),
      });
      
      remainingMs -= segmentDuration;
      segmentStart = new Date(pauseEnd);
    }
    
    // Après-midi (après pause)
    if (segmentStart < dayEnd && remainingMs > 0) {
      let segmentEnd = new Date(Math.min(dayEnd.getTime(), segmentStart.getTime() + remainingMs));
      const segmentDuration = segmentEnd.getTime() - segmentStart.getTime();
      
      if (segmentDuration > 0) {
        events.push({
          __eventStart: new Date(segmentStart),
          __eventEnd: new Date(segmentEnd),
        });
        remainingMs -= segmentDuration;
      }
    }
    
    // Passe au jour suivant
    current.setDate(current.getDate() + 1);
    setDateToDecimalHour(current, startCal);
  }
  
  return events;
}

const logAudit = async (userId, action, targetType, targetId, details = {}) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), userId || null, action, targetType || null, targetId || null, details]
    );
  } catch (err) {
    console.error('Failed to log audit', err);
  }
};

// --- Routes: health -----------------------------------------------------
app.get('/api', (_req, res) => {
  res.json({ ok: true, message: 'API server is running' });
});

// --- Auth routes --------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const userId = await createLocalUser({ email: String(email).trim().toLowerCase(), password, name });
    const token = signToken(userId);
    setAuthCookie(res, token);
    const ctx = await loadUserContext(userId);
    return res.json({ user: ctx?.user || null, roles: ctx?.roles || [] });
  } catch (err) {
    if (err.message === 'email_exists') {
      return res.status(400).json({ error: 'email already registered' });
    }
    console.error('Register failed', err);
    return res.status(500).json({ error: 'Register failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const userRes = await pool.query('SELECT * FROM users WHERE email = $1 AND provider = $2', [String(email).trim().toLowerCase(), 'local']);
    if (!userRes.rowCount) return res.status(401).json({ error: 'Invalid credentials' });
    const user = userRes.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user.id);
    setAuthCookie(res, token);
    const ctx = await loadUserContext(user.id);
    return res.json({ user: ctx?.user || null, roles: ctx?.roles || [] });
  } catch (err) {
    console.error('Login failed', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  if (req.auth.activeOrganization?.id) {
    res.cookie('active_organization_id', req.auth.activeOrganization.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
  res.json({
    user: req.auth.user,
    roles: req.auth.roles,
    baseRoles: req.auth.baseRoles || req.auth.roles,
    permissions: req.auth.permissions || [],
    impersonatedRoleId: req.auth.impersonatedRoleId || null,
    organizations: req.auth.organizations || [],
    activeOrganizationId: req.auth.activeOrganization?.id || null,
  });
});

app.post('/api/auth/impersonate', requireAuth, async (req, res) => {
  // Only real admins can impersonate (use base roles)
  const isAdmin = (req.auth.baseRoles || req.auth.roles || []).some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

  const { roleId } = req.body || {};

  if (!roleId) {
    res.clearCookie('impersonate_role_id');
    return res.json({ ok: true, impersonatedRoleId: null });
  }

  const roleRes = await pool.query(
    'SELECT id FROM roles WHERE id = $1 AND organization_id = $2',
    [roleId, req.auth.activeOrganization?.id || null]
  );
  if (!roleRes.rowCount) return res.status(404).json({ error: 'role not found' });

  res.cookie('impersonate_role_id', roleId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  });

  return res.json({ ok: true, impersonatedRoleId: roleId });
});

const createOrganizationFromImportedState = async (ownerUserId, organizationName, state) => {
  const orgId = uuidv4();
  const trimmedName = String(organizationName || '').trim() || `Organisation importée ${new Date().toLocaleDateString('fr-FR')}`;
  const safeState = state && typeof state === 'object'
    ? state
    : { ...INITIAL_APP_STATE };

  await pool.query(
    'INSERT INTO organizations (id, name, owner_user_id) VALUES ($1, $2, $3)',
    [orgId, trimmedName, ownerUserId]
  );
  await pool.query(
    'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [orgId, ownerUserId]
  );

  await ensureSystemRolesForOrganization(orgId);
  const adminRole = await getRoleByNameInOrganization(orgId, 'admin');
  if (adminRole.rowCount) {
    await pool.query(
      'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [orgId, ownerUserId, adminRole.rows[0].id]
    );
  }

  await syncAppStateIdSequence();
  await pool.query(
    `INSERT INTO app_state (organization_id, user_id, data)
     VALUES ($1, $2, $3)
     ON CONFLICT (organization_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       data = EXCLUDED.data`,
    [orgId, ownerUserId, JSON.stringify(safeState)]
  );

  return { id: orgId, name: trimmedName };
};

app.post('/api/import/organizations', requireAuth, async (req, res) => {
  try {
    const isBaseAdmin = !!req.auth.baseIsAdmin;
    if (!isBaseAdmin) {
      return res.status(403).json({ error: 'Forbidden: import requires base admin' });
    }

    const manualMapped = sanitizeMappedOrganizations(req.body?.mappedOrganizations || []);
    const format = String(req.body?.format || '').toLowerCase();
    let parsedOrganizations = manualMapped.length
      ? manualMapped
      : buildImportPreviewOrganizations({ format, body: req.body });

    parsedOrganizations = applyOrganizationNameOverride(parsedOrganizations, req.body?.organizationName || '');

    if (!manualMapped.length && !['csv', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Expected json or csv.' });
    }

    if (!Array.isArray(parsedOrganizations) || parsedOrganizations.length === 0) {
      return res.status(400).json({ error: 'Aucune organisation exploitable trouvée dans le fichier.' });
    }

    const created = [];
    for (const org of parsedOrganizations) {
      if (!org?.state || !Array.isArray(org.state.collections) || org.state.collections.length === 0) {
        continue;
      }
      const createdOrg = await createOrganizationFromImportedState(req.auth.user.id, org.name, org.state);
      created.push(createdOrg);
      await logAudit(req.auth?.user?.id, 'organization.import', 'organization', createdOrg.id, {
        source: manualMapped.length ? 'manual-mapped' : format,
        name: createdOrg.name,
      });
    }

    if (!created.length) {
      return res.status(400).json({ error: 'Import vide: aucune organisation créée.' });
    }

    return res.status(201).json({ ok: true, createdCount: created.length, organizations: created });
  } catch (err) {
    console.error('Import organizations failed', err);
    return res.status(500).json({ error: 'Import organizations failed' });
  }
});

app.post('/api/import/organizations/preview', requireAuth, async (req, res) => {
  try {
    const isBaseAdmin = !!req.auth.baseIsAdmin;
    if (!isBaseAdmin) {
      return res.status(403).json({ error: 'Forbidden: import preview requires base admin' });
    }

    const format = String(req.body?.format || '').toLowerCase();
    if (!['csv', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Expected json or csv.' });
    }

    const organizations = applyOrganizationNameOverride(
      buildImportPreviewOrganizations({ format, body: req.body }),
      req.body?.organizationName || ''
    );
    if (!organizations.length) {
      return res.status(400).json({ error: 'Aucune organisation exploitable trouvée dans le fichier.' });
    }

    return res.json({ ok: true, organizations });
  } catch (err) {
    console.error('Import preview failed', err);
    return res.status(500).json({ error: 'Import preview failed' });
  }
});

app.get('/api/organizations', requireAuth, async (req, res) => {
  const organizations = req.auth.organizations || [];
  return res.json({ organizations, activeOrganizationId: req.auth.activeOrganization?.id || null });
});

app.post('/api/organizations', requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });

    const orgId = uuidv4();
    await pool.query(
      'INSERT INTO organizations (id, name, owner_user_id) VALUES ($1, $2, $3)',
      [orgId, name, req.auth.user.id]
    );
    await pool.query(
      'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [orgId, req.auth.user.id]
    );
    await ensureSystemRolesForOrganization(orgId);
    const adminRole = await getRoleByNameInOrganization(orgId, 'admin');
    if (adminRole.rowCount) {
      await pool.query(
        'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [orgId, req.auth.user.id, adminRole.rows[0].id]
      );
    }
    await ensureAppStateForOrganization(orgId);
    await logAudit(req.auth?.user?.id, 'organization.create', 'organization', orgId, { name });

    res.cookie('active_organization_id', orgId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const organizations = await getUserOrganizations(req.auth.user.id);
    return res.status(201).json({
      ok: true,
      organization: organizations.find((o) => o.id === orgId) || null,
      organizations,
      activeOrganizationId: orgId,
    });
  } catch (err) {
    console.error('Create organization failed', err);
    return res.status(500).json({ error: 'Create organization failed' });
  }
});

app.patch('/api/organizations/:id', requireAuth, async (req, res) => {
  try {
    const organizationId = String(req.params.id || '').trim();
    const name = String(req.body?.name || '').trim();
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });
    if (!name) return res.status(400).json({ error: 'name required' });

    const organization = await pool.query(
      'SELECT id, owner_user_id FROM organizations WHERE id = $1 LIMIT 1',
      [organizationId]
    );
    if (!organization.rowCount) return res.status(404).json({ error: 'organization not found' });

    const isOwner = String(organization.rows[0].owner_user_id || '') === String(req.auth.user.id || '');
    const isOrgAdmin = await isUserAdminInOrganization(organizationId, req.auth.user.id);
    const canManage = !!req.auth.baseIsAdmin || isOwner || isOrgAdmin;
    if (!canManage) return res.status(403).json({ error: 'Forbidden' });

    const updated = await pool.query(
      'UPDATE organizations SET name = $2 WHERE id = $1 RETURNING id, name, owner_user_id, created_at',
      [organizationId, name]
    );

    await logAudit(req.auth?.user?.id, 'organization.rename', 'organization', organizationId, { name });

    const organizations = await getUserOrganizations(req.auth.user.id);
    return res.json({
      ok: true,
      organization: updated.rows[0],
      organizations,
      activeOrganizationId: req.auth.activeOrganization?.id || organizations[0]?.id || null,
    });
  } catch (err) {
    console.error('Rename organization failed', err);
    return res.status(500).json({ error: 'Rename organization failed' });
  }
});

app.delete('/api/organizations/:id', requireAuth, async (req, res) => {
  try {
    const organizationId = String(req.params.id || '').trim();
    if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

    const organization = await pool.query(
      'SELECT id, owner_user_id FROM organizations WHERE id = $1 LIMIT 1',
      [organizationId]
    );
    if (!organization.rowCount) return res.status(404).json({ error: 'organization not found' });

    const isOwner = String(organization.rows[0].owner_user_id || '') === String(req.auth.user.id || '');
    const isOrgAdmin = await isUserAdminInOrganization(organizationId, req.auth.user.id);
    const canManage = !!req.auth.baseIsAdmin || isOwner || isOrgAdmin;
    if (!canManage) return res.status(403).json({ error: 'Forbidden' });

    const userOrganizations = await getUserOrganizations(req.auth.user.id);
    const belongsToUser = userOrganizations.some((org) => org.id === organizationId);
    if (belongsToUser && userOrganizations.length <= 1) {
      return res.status(400).json({ error: 'Vous devez conserver au moins une organisation.' });
    }

    await pool.query('DELETE FROM app_state WHERE organization_id = $1', [organizationId]);
    const deleted = await pool.query('DELETE FROM organizations WHERE id = $1 RETURNING id, name', [organizationId]);
    if (!deleted.rowCount) return res.status(404).json({ error: 'organization not found' });

    await logAudit(req.auth?.user?.id, 'organization.delete', 'organization', organizationId, {
      name: deleted.rows[0]?.name || null,
    });

    let organizations = await getUserOrganizations(req.auth.user.id);
    if (!organizations.length) {
      const fallbackOrgId = await ensureDefaultOrganization(req.auth.user.id);
      organizations = await getUserOrganizations(req.auth.user.id);
      if (fallbackOrgId) {
        res.cookie('active_organization_id', fallbackOrgId, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }
    }

    const currentActiveId = req.auth.activeOrganization?.id || null;
    const nextActiveId = currentActiveId && currentActiveId !== organizationId
      ? currentActiveId
      : organizations[0]?.id || null;

    if (nextActiveId) {
      res.cookie('active_organization_id', nextActiveId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    res.clearCookie('impersonate_role_id');

    return res.json({ ok: true, organizations, activeOrganizationId: nextActiveId });
  } catch (err) {
    console.error('Delete organization failed', err);
    return res.status(500).json({ error: 'Delete organization failed' });
  }
});

app.post('/api/organizations/switch', requireAuth, async (req, res) => {
  const organizationId = String(req.body?.organizationId || '').trim();
  if (!organizationId) return res.status(400).json({ error: 'organizationId required' });

  const allowed = (req.auth.organizations || []).some((org) => org.id === organizationId);
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });

  res.cookie('active_organization_id', organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.clearCookie('impersonate_role_id');

  return res.json({ ok: true, activeOrganizationId: organizationId });
});

app.post('/api/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.clearCookie('impersonate_role_id');
  res.clearCookie('active_organization_id');
  res.json({ ok: true });
});

// --- Users / Roles / Permissions ---------------------------------------
app.get('/api/organization/members', requireAuth, requireBaseAdminOrPermission('can_manage_permissions'), async (req, res) => {
  const organizationId = req.auth.activeOrganization?.id;
  if (!organizationId) return res.status(400).json({ error: 'No active organization' });

  const members = await pool.query(
    `SELECT u.id, u.email, u.name, u.provider,
            COALESCE(json_agg(ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), '[]') as role_ids
     FROM organization_members om
     INNER JOIN users u ON u.id = om.user_id
     LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.organization_id = om.organization_id
     WHERE om.organization_id = $1
     GROUP BY u.id
     ORDER BY u.email ASC`,
    [organizationId]
  );

  return res.json(members.rows);
});

app.get('/api/organization/member-candidates', requireAuth, requireBaseAdminOrPermission('can_manage_permissions'), async (req, res) => {
  const organizationId = req.auth.activeOrganization?.id;
  if (!organizationId) return res.status(400).json({ error: 'No active organization' });

  const candidates = await pool.query(
    `SELECT u.id, u.email, u.name, u.provider
     FROM users u
     WHERE NOT EXISTS (
       SELECT 1
       FROM organization_members om
       WHERE om.organization_id = $1
         AND om.user_id = u.id
     )
     ORDER BY u.email ASC`,
    [organizationId]
  );

  return res.json(candidates.rows);
});

app.post('/api/organization/members', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  const organizationId = req.auth.activeOrganization?.id;
  if (!organizationId) return res.status(400).json({ error: 'No active organization' });

  const userId = String(req.body?.userId || '').trim();
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
  if (!userCheck.rowCount) return res.status(404).json({ error: 'user not found' });

  await pool.query(
    'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [organizationId, userId]
  );
  await logAudit(req.auth?.user?.id, 'organization_members.add', 'organization', organizationId, { userId });
  return res.json({ ok: true });
});

app.delete('/api/organization/members/:userId', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  const organizationId = req.auth.activeOrganization?.id;
  if (!organizationId) return res.status(400).json({ error: 'No active organization' });

  const userId = String(req.params.userId || '').trim();
  if (!userId) return res.status(400).json({ error: 'userId required' });
  if (req.auth?.user?.id === userId) return res.status(400).json({ error: 'cannot remove own membership' });

  const removingLastAdmin = await wouldRemoveLastOrganizationAdmin(organizationId, userId);
  if (removingLastAdmin) {
    return res.status(400).json({ error: 'cannot remove last admin from organization' });
  }

  await pool.query('DELETE FROM user_roles WHERE organization_id = $1 AND user_id = $2', [organizationId, userId]);
  const del = await pool.query('DELETE FROM organization_members WHERE organization_id = $1 AND user_id = $2', [organizationId, userId]);
  if (!del.rowCount) return res.status(404).json({ error: 'member not found' });

  await logAudit(req.auth?.user?.id, 'organization_members.remove', 'organization', organizationId, { userId });
  return res.json({ ok: true });
});

app.get('/api/users', requireAuth, requireBaseAdminOrPermission('can_manage_permissions'), async (_req, res) => {
  const organizationId = _req.auth.activeOrganization?.id;
  if (!organizationId) return res.status(400).json({ error: 'No active organization' });
  const users = await pool.query(
    `SELECT u.id, u.email, u.name, u.provider,
            COALESCE(u.user_preferences, '{}'::jsonb) AS user_preferences,
            COALESCE(json_agg(ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), '[]') as role_ids
     FROM users u
     INNER JOIN organization_members om ON om.user_id = u.id AND om.organization_id = $1
     LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.organization_id = $1
     GROUP BY u.id`,
    [organizationId]
  );
  res.json(users.rows);
});

app.patch('/api/users/:id/preferences', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  try {
    const organizationId = req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });

    const userId = String(req.params.id || '').trim();
    if (!userId) return res.status(400).json({ error: 'user id required' });

    const membership = await pool.query(
      'SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
      [organizationId, userId]
    );
    if (!membership.rowCount) {
      return res.status(404).json({ error: 'user not found in active organization' });
    }

    const payload = req.body?.preferences;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return res.status(400).json({ error: 'preferences object required' });
    }

    const normalized = {
      accentColor: typeof payload.accentColor === 'string' ? payload.accentColor : '#06b6d4',
      workStart: typeof payload.workStart === 'string' ? payload.workStart : '09:00',
      workEnd: typeof payload.workEnd === 'string' ? payload.workEnd : '18:00',
      breakStart: typeof payload.breakStart === 'string' ? payload.breakStart : '12:30',
      breakEnd: typeof payload.breakEnd === 'string' ? payload.breakEnd : '13:30',
      timezone: typeof payload.timezone === 'string' ? payload.timezone : 'Europe/Paris',
      weekStartsOn: payload.weekStartsOn === 'sunday' ? 'sunday' : 'monday',
      density: ['compact', 'comfortable', 'spacious'].includes(payload.density) ? payload.density : 'comfortable',
      notificationsEnabled: Boolean(payload.notificationsEnabled),
    };

    const updated = await pool.query(
      `UPDATE users
       SET user_preferences = $1::jsonb
       WHERE id = $2
       RETURNING id, COALESCE(user_preferences, '{}'::jsonb) AS user_preferences`,
      [JSON.stringify(normalized), userId]
    );
    if (!updated.rowCount) return res.status(404).json({ error: 'user not found' });

    await logAudit(req.auth?.user?.id, 'user.preferences.update', 'user', userId, { userId });
    return res.json({ ok: true, user: updated.rows[0] });
  } catch (err) {
    console.error('Update user preferences failed', err);
    return res.status(500).json({ error: 'Update user preferences failed' });
  }
});

app.patch('/api/users/:id/password', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { password } = req.body || {};

    if (!password || typeof password !== 'string' || password.trim().length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
    }

    const userRes = await pool.query('SELECT id, provider FROM users WHERE id = $1', [userId]);
    if (!userRes.rowCount) return res.status(404).json({ error: 'user not found' });
    if (userRes.rows[0].provider && userRes.rows[0].provider !== 'local') {
      return res.status(400).json({ error: 'password update not allowed for non-local user' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await logAudit(req.auth?.user?.id, 'user.password.update', 'user', userId, { userId });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Update password failed', err);
    return res.status(500).json({ error: 'Update password failed' });
  }
});

app.delete('/api/users/:id', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  try {
    const organizationId = req.auth.activeOrganization?.id;
    if (!organizationId) return res.status(400).json({ error: 'No active organization' });

    const userId = req.params.id;
    if (req.auth?.user?.id === userId) {
      return res.status(400).json({ error: 'cannot delete own account' });
    }

    const deletingLastAdmin = await wouldRemoveLastOrganizationAdmin(organizationId, userId);
    if (deletingLastAdmin) {
      return res.status(400).json({ error: 'cannot delete last admin from organization' });
    }

    const userRes = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (!userRes.rowCount) return res.status(404).json({ error: 'user not found' });

    await pool.query('UPDATE audit_logs SET user_id = NULL WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await logAudit(req.auth?.user?.id, 'user.delete', 'user', userId, { userId });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete user failed', err);
    return res.status(500).json({ error: 'Delete user failed' });
  }
});

app.get('/api/roles', requireAuth, requireBaseAdminOrPermission('can_manage_permissions'), async (_req, res) => {
  const organizationId = _req.auth.activeOrganization?.id;
  if (!organizationId) return res.status(400).json({ error: 'No active organization' });
  const roles = await pool.query('SELECT * FROM roles WHERE organization_id = $1', [organizationId]);
  res.json(roles.rows);
});

app.post('/api/roles', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  const organizationId = req.auth.activeOrganization?.id;
  if (!organizationId) return res.status(400).json({ error: 'No active organization' });
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const roleId = uuidv4();
  await pool.query(
    'INSERT INTO roles (id, organization_id, name, description, is_system) VALUES ($1, $2, $3, $4, false)',
    [roleId, organizationId, name, description || null]
  );
  await logAudit(req.auth?.user?.id, 'role.create', 'role', roleId, { name });
  res.json({ ok: true, id: roleId });
});

app.post('/api/user_roles', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  const organizationId = req.auth.activeOrganization?.id;
  if (!organizationId) return res.status(400).json({ error: 'No active organization' });
  const { userId, roleId, action } = req.body;
  if (!userId || !roleId) return res.status(400).json({ error: 'userId and roleId required' });

  const roleCheck = await pool.query('SELECT id FROM roles WHERE id = $1 AND organization_id = $2', [roleId, organizationId]);
  if (!roleCheck.rowCount) return res.status(404).json({ error: 'role not found in active organization' });

  if (action === 'remove') {
    const adminRole = await getAdminRoleForOrganization(organizationId);
    if (adminRole?.id === roleId) {
      const targetHasAdminRole = await pool.query(
        'SELECT 1 FROM user_roles WHERE organization_id = $1 AND user_id = $2 AND role_id = $3 LIMIT 1',
        [organizationId, userId, roleId]
      );
      if (targetHasAdminRole.rowCount) {
        const adminCount = await countOrganizationAdmins(organizationId);
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'cannot remove last admin from organization' });
        }
      }
    }
    await pool.query('DELETE FROM user_roles WHERE organization_id = $1 AND user_id = $2 AND role_id = $3', [organizationId, userId, roleId]);
    await logAudit(req.auth?.user?.id, 'user_roles.remove', 'user', userId, { roleId });
  } else {
    await pool.query(
      'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [organizationId, userId]
    );
    await pool.query(
      'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [organizationId, userId, roleId]
    );
    await logAudit(req.auth?.user?.id, 'user_roles.add', 'user', userId, { roleId });
  }
  res.json({ ok: true });
});

app.get('/api/permissions', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
  const organizationId = _req.auth.activeOrganization?.id;
  if (!organizationId) return res.status(400).json({ error: 'No active organization' });
  const perms = await pool.query('SELECT * FROM permissions WHERE organization_id = $1', [organizationId]);
  res.json(perms.rows);
});

app.post('/api/permissions', requireAuth, requirePermission('can_manage_permissions'), async (req, res) => {
  const organizationId = req.auth.activeOrganization?.id;
  if (!organizationId) return res.status(400).json({ error: 'No active organization' });
  const perm = req.body || {};
  if (!perm.role_id) return res.status(400).json({ error: 'role_id required' });
  const roleCheck = await pool.query('SELECT id FROM roles WHERE id = $1 AND organization_id = $2', [perm.role_id, organizationId]);
  if (!roleCheck.rowCount) return res.status(404).json({ error: 'role not found in active organization' });
  const result = await upsertPermission({ ...perm, organization_id: organizationId });
  await logAudit(req.auth?.user?.id, 'permission.upsert', 'permission', perm.role_id, perm);
  res.json(result);
});

// --- DB Backups (admin only) ------------------------------------------
app.get('/api/db/backups', requireAuth, async (req, res) => {
  const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const backups = await listBackups();
    return res.json(backups);
  } catch (err) {
    console.error('Failed to list backups', err);
    return res.status(500).json({ error: 'Failed to list backups' });
  }
});

app.post('/api/db/backups', requireAuth, async (req, res) => {
  const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  try {
    const label = req.body?.label || '';
    const backup = await createDbBackup(label);
    await logAudit(req.auth?.user?.id, 'db.backup.create', 'backup', backup.name, backup);
    return res.json({ ok: true, backup });
  } catch (err) {
    console.error('Failed to create backup', err);
    return res.status(500).json({ error: 'Failed to create backup', detail: formatBackupError(err) });
  }
});

app.get('/api/db/backups/:name', requireAuth, async (req, res) => {
  const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const filePath = resolveBackupPath(req.params.name);
  if (!filePath) return res.status(400).json({ error: 'Invalid backup name' });
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    await logAudit(req.auth?.user?.id, 'db.backup.download', 'backup', req.params.name, {});
    return res.download(filePath);
  } catch (err) {
    console.error('Failed to download backup', err);
    return res.status(404).json({ error: 'Backup not found' });
  }
});

app.delete('/api/db/backups/:name', requireAuth, async (req, res) => {
  const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const filePath = resolveBackupPath(req.params.name);
  if (!filePath) return res.status(400).json({ error: 'Invalid backup name' });
  try {
    await fs.promises.unlink(filePath);
    await logAudit(req.auth?.user?.id, 'db.backup.delete', 'backup', req.params.name, {});
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete backup', err);
    return res.status(404).json({ error: 'Backup not found' });
  }
});

app.post('/api/db/backups/:name/restore', requireAuth, async (req, res) => {
  const isAdmin = req.auth.roles.some((r) => r.name === 'admin');
  if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
  const filePath = resolveBackupPath(req.params.name);
  if (!filePath) return res.status(400).json({ error: 'Invalid backup name' });
  try {
    await restoreDbBackup(req.params.name);
    await logAudit(req.auth?.user?.id, 'db.backup.restore', 'backup', req.params.name, {});
    if (global.io) {
      global.io.emit('stateUpdated', { userId: req.auth?.user?.id || null, source: 'db.restore' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to restore backup', err);
    return res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// --- State routes (protected + filtered) -------------------------------

// --- Export/Import app_state (admin only) ---
// --- Export/Import global state (admin only) ---
app.get('/api/appstate', requireAuth, async (req, res) => {
  const rawScope = req.query?.scope;
  const scope = rawScope === 'global' ? 'global' : 'organization';

  const isOrgAdmin = req.auth.roles.some((r) => r.name === 'admin');
  const isBaseAdmin = !!req.auth.baseIsAdmin;

  if (scope === 'global' && !isBaseAdmin) {
    return res.status(403).json({ error: 'Forbidden: global export requires base admin' });
  }
  if (scope === 'organization' && !isOrgAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    if (scope === 'organization') {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });

      const organization = (
        await pool.query('SELECT * FROM organizations WHERE id = $1', [organizationId])
      ).rows[0] || null;

      const organization_members = (
        await pool.query('SELECT * FROM organization_members WHERE organization_id = $1 ORDER BY user_id ASC', [organizationId])
      ).rows;

      const users = (
        await pool.query(
          `SELECT u.*
           FROM users u
           INNER JOIN organization_members om ON om.user_id = u.id
           WHERE om.organization_id = $1
           ORDER BY u.id ASC`,
          [organizationId]
        )
      ).rows;

      const app_state = (
        await pool.query('SELECT * FROM app_state WHERE organization_id = $1 ORDER BY id ASC', [organizationId])
      ).rows;

      const roles = (
        await pool.query('SELECT * FROM roles WHERE organization_id = $1 ORDER BY id ASC', [organizationId])
      ).rows;

      const permissions = (
        await pool.query('SELECT * FROM permissions WHERE organization_id = $1 ORDER BY id ASC', [organizationId])
      ).rows;

      const user_roles = (
        await pool.query('SELECT * FROM user_roles WHERE organization_id = $1 ORDER BY user_id, role_id ASC', [organizationId])
      ).rows;

      return res.json({
        scope,
        organization,
        users,
        app_state,
        roles,
        permissions,
        user_roles,
        organization_members,
      });
    }

    const users = (await pool.query('SELECT * FROM users ORDER BY id ASC')).rows;
    const app_state = (await pool.query('SELECT * FROM app_state ORDER BY id ASC')).rows;
    const organizations = (await pool.query('SELECT * FROM organizations ORDER BY created_at ASC, id ASC')).rows;
    const organization_members = (await pool.query('SELECT * FROM organization_members ORDER BY organization_id, user_id ASC')).rows;
    const roles = (await pool.query('SELECT * FROM roles ORDER BY id ASC')).rows;
    const permissions = (await pool.query('SELECT * FROM permissions ORDER BY id ASC')).rows;
    const user_roles = (await pool.query('SELECT * FROM user_roles ORDER BY user_id, role_id ASC')).rows;
    res.json({ scope, users, app_state, organizations, organization_members, roles, permissions, user_roles });
  } catch (err) {
    console.error('Failed to export global state', err);
    res.status(500).json({ error: 'Failed to export global state' });
  }
});

app.post('/api/appstate', requireAuth, async (req, res) => {
  const rawScope = req.query?.scope;
  const scope = rawScope === 'global' ? 'global' : 'organization';

  const isOrgAdmin = req.auth.roles.some((r) => r.name === 'admin');
  const isBaseAdmin = !!req.auth.baseIsAdmin;

  if (scope === 'global' && !isBaseAdmin) {
    return res.status(403).json({ error: 'Forbidden: global import requires base admin' });
  }
  if (scope === 'organization' && !isOrgAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { users, app_state, organizations, organization_members, roles, permissions, user_roles } = req.body || {};
    if (!Array.isArray(users) || !Array.isArray(app_state) || !Array.isArray(roles) || !Array.isArray(permissions) || !Array.isArray(user_roles)) {
      return res.status(400).json({ error: 'Invalid import format' });
    }

    if (scope === 'organization') {
      const organizationId = req.auth.activeOrganization?.id;
      if (!organizationId) return res.status(400).json({ error: 'No active organization' });

      const userIdMap = new Map();
      const roleIdMap = new Map();

      // Upsert users (nécessaire si un membre importé n'existe pas encore localement)
      for (const user of users) {
        const existingUserRes = await pool.query(
          'SELECT id FROM users WHERE id = $1 OR email = $2 ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END LIMIT 1',
          [user.id, user.email]
        );

        if (existingUserRes.rowCount > 0) {
          const persistedUserId = existingUserRes.rows[0].id;
          await pool.query(
            `UPDATE users SET
               email = $2,
               name = $3,
               provider = $4,
               provider_id = $5,
               password_hash = $6,
               created_at = $7,
               favorite_views = $8,
               favorite_items = $9,
               user_preferences = $10
             WHERE id = $1`,
            [
              persistedUserId,
              user.email,
              user.name,
              user.provider,
              user.provider_id,
              user.password_hash,
              user.created_at,
              user.favorite_views || [],
              user.favorite_items || [],
              user.user_preferences || {}
            ]
          );
          userIdMap.set(user.id, persistedUserId);
        } else {
          await pool.query(
            'INSERT INTO users (id, email, name, provider, provider_id, password_hash, created_at, favorite_views, favorite_items, user_preferences) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
            [
              user.id,
              user.email,
              user.name,
              user.provider,
              user.provider_id,
              user.password_hash,
              user.created_at,
              user.favorite_views || [],
              user.favorite_items || [],
              user.user_preferences || {}
            ]
          );
          userIdMap.set(user.id, user.id);
        }
      }

      // Nettoyage strict de l'organisation active uniquement
      await pool.query('DELETE FROM user_roles WHERE organization_id = $1', [organizationId]);
      await pool.query('DELETE FROM permissions WHERE organization_id = $1', [organizationId]);
      await pool.query('DELETE FROM roles WHERE organization_id = $1', [organizationId]);
      await pool.query('DELETE FROM app_state WHERE organization_id = $1', [organizationId]);
      await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [organizationId]);

      // Membres : ceux importés + l'utilisateur courant (anti lock-out)
      const importedMemberIds = new Set(
        (Array.isArray(organization_members) ? organization_members : [])
          .map((m) => userIdMap.get(m?.user_id) || m?.user_id)
          .filter(Boolean)
      );
      importedMemberIds.add(req.auth.user.id);

      for (const memberUserId of importedMemberIds) {
        await pool.query(
          'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [organizationId, memberUserId]
        );
      }

      for (const role of roles) {
        const roleRes = await pool.query(
          `INSERT INTO roles (id, organization_id, name, description, is_system)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (organization_id, name) DO UPDATE SET
             description = EXCLUDED.description,
             is_system = EXCLUDED.is_system
           RETURNING id`,
          [role.id, organizationId, role.name, role.description, role.is_system]
        );
        roleIdMap.set(role.id, roleRes.rows[0].id);
      }

      for (const perm of permissions) {
        await upsertPermission({
          id: perm.id,
          organization_id: organizationId,
          role_id: roleIdMap.get(perm.role_id) || perm.role_id,
          collection_id: perm.collection_id,
          item_id: perm.item_id,
          field_id: perm.field_id,
          can_read: perm.can_read,
          can_write: perm.can_write,
          can_delete: perm.can_delete,
          can_manage_fields: perm.can_manage_fields,
          can_manage_views: perm.can_manage_views,
          can_manage_permissions: perm.can_manage_permissions,
        });
      }

      for (const row of app_state) {
        await pool.query(
          `INSERT INTO app_state (id, user_id, organization_id, data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (organization_id) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             data = EXCLUDED.data`,
          [row.id, userIdMap.get(row.user_id) || row.user_id || null, organizationId, row.data]
        );
      }

      await syncAppStateIdSequence();

      for (const ur of user_roles) {
        await pool.query(
          'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [organizationId, userIdMap.get(ur.user_id) || ur.user_id, roleIdMap.get(ur.role_id) || ur.role_id]
        );
      }

      // Assure l'existence des rôles système + 1 admin minimum
      await ensureSystemRolesForOrganization(organizationId);
      const hasAdmin = await countOrganizationAdmins(organizationId);
      if (hasAdmin === 0) {
        const adminRole = await getAdminRoleForOrganization(organizationId);
        if (adminRole?.id) {
          await pool.query(
            'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [organizationId, req.auth.user.id, adminRole.id]
          );
        }
      }

      await ensureAppStateForOrganization(organizationId);
      return res.json({ ok: true, scope });
    }

    // Désactiver les contraintes FK temporairement
    await pool.query('SET session_replication_role = replica;');
    // Vider toutes les tables dans l'ordre inverse des dépendances
    await pool.query('DELETE FROM organization_members');
    await pool.query('DELETE FROM organizations');
    await pool.query('DELETE FROM user_roles');
    await pool.query('DELETE FROM permissions');
    await pool.query('DELETE FROM roles');
    await pool.query('DELETE FROM app_state');
    await pool.query('DELETE FROM users');
    // Réinsérer dans l'ordre des dépendances
    for (const user of users) {
      await pool.query(
        'INSERT INTO users (id, email, name, provider, provider_id, password_hash, created_at, favorite_views, favorite_items, user_preferences) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [user.id, user.email, user.name, user.provider, user.provider_id, user.password_hash, user.created_at, user.favorite_views || [], user.favorite_items || [], user.user_preferences || {}]
      );
    }
    if (Array.isArray(organizations)) {
      for (const org of organizations) {
        await pool.query(
          'INSERT INTO organizations (id, name, owner_user_id, created_at) VALUES ($1,$2,$3,$4)',
          [org.id, org.name, org.owner_user_id || null, org.created_at || new Date().toISOString()]
        );
      }
    }
    if (Array.isArray(organization_members)) {
      for (const member of organization_members) {
        await pool.query(
          'INSERT INTO organization_members (organization_id, user_id) VALUES ($1, $2)',
          [member.organization_id, member.user_id]
        );
      }
    }
    for (const role of roles) {
      await pool.query(
        'INSERT INTO roles (id, organization_id, name, description, is_system) VALUES ($1,$2,$3,$4,$5)',
        [role.id, role.organization_id || null, role.name, role.description, role.is_system]
      );
    }
    for (const perm of permissions) {
      await pool.query(
        'INSERT INTO permissions (id, organization_id, role_id, collection_id, item_id, field_id, can_read, can_write, can_delete, can_manage_fields, can_manage_views, can_manage_permissions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [perm.id, perm.organization_id || null, perm.role_id, perm.collection_id, perm.item_id, perm.field_id, perm.can_read, perm.can_write, perm.can_delete, perm.can_manage_fields, perm.can_manage_views, perm.can_manage_permissions]
      );
    }
    for (const row of app_state) {
      await pool.query(
        'INSERT INTO app_state (id, user_id, organization_id, data) VALUES ($1, $2, $3, $4)',
        [row.id, row.user_id || null, row.organization_id || null, row.data]
      );
    }
    await syncAppStateIdSequence();
    for (const ur of user_roles) {
      await pool.query(
        'INSERT INTO user_roles (organization_id, user_id, role_id) VALUES ($1, $2, $3)',
        [ur.organization_id || null, ur.user_id, ur.role_id]
      );
    }
    // Réactiver les contraintes FK
    await pool.query('SET session_replication_role = DEFAULT;');
    res.json({ ok: true, scope });
  } catch (err) {
    console.error('Failed to import global state', err);
    // Toujours réactiver les contraintes FK en cas d'erreur
    await pool.query('SET session_replication_role = DEFAULT;');
    res.status(500).json({ error: 'Failed to import global state' });
  }
});
const filterStateForUser = (data, ctx) => {
  if (!data || !data.collections) return data;
  const filteredCollections = (data.collections || []).map((col) => {
    const canReadCollection = hasPermission(ctx, { collection_id: col.id }, 'can_read');
    const visibleProps = (col.properties || []).filter((prop) =>
      hasPermission(ctx, { collection_id: col.id, field_id: prop.id }, 'can_read')
    );
    if (!canReadCollection) {
      // allow per-item read
      const allowedItems = (col.items || []).filter((item) =>
        hasPermission(ctx, { collection_id: col.id, item_id: item.id }, 'can_read')
      );
      if (allowedItems.length === 0) return null;
      return { ...col, properties: visibleProps, items: allowedItems };
    }
    // Field-level filtering (hide values user cannot read)
    const items = (col.items || []).map((item) => {
      const canReadItem = hasPermission(ctx, { collection_id: col.id, item_id: item.id }, 'can_read') || canReadCollection;
      if (!canReadItem) return null;
      let next = { ...item };
      visibleProps.forEach((prop) => {
        // Field-level check: a false at field scope must hide the value even if item/collection/global allow read
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

// --- Mise à jour chirurgicale d'un seul item (multi-utilisateur temps réel) ---
// PATCH /api/state/item  { collectionId, itemId, fields: { fieldId: value, ... } }
// Merge au niveau du champ : seuls les champs envoyés écrasent la valeur existante
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

    // Merge champ par champ (ne touche pas aux champs non envoyés)
    const prevItem = items[itemIdx];
    const mergedItem = { ...prevItem, ...fields };

    // Recalcul segments si nécessaire
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

    // Émettre un event ciblé : seul l'item modifié sera rechargé chez les autres
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

// --- Mise à jour chirurgicale de la structure (views, collection meta, dashboards) ---
// PATCH /api/state/structure  { type: 'view'|'collection'|'dashboard'|'views'|'dashboards', payload }
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
      // payload: { collectionId, patch }
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
      favorites: rawState?.favorites || { views: [], items: [] }
    };
    const filtered = filterStateForUser(state, req.auth);
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
    
    // IMPORTANT: Recalculer les segments côté serveur pour chaque item
    // Cela garantit que les segments sont TOUJOURS en accord avec les champs date/durée
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

        // Recalcule _eventSegments basé sur les champs date/durée de la collection
        return calculateEventSegments(item, col, calendarConfig);
      });
      
      return { ...col, items: processedItems };
    });
    
    // Vérifier les permissions pour les collections
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
    
    // Upsert : si la ligne existe, update, sinon insert
    const updateRes = await pool.query('UPDATE app_state SET data = $1 WHERE organization_id = $2', [stateStr, organizationId]);
    if (updateRes.rowCount === 0) {
      await syncAppStateIdSequence();
      await pool.query('INSERT INTO app_state (organization_id, data) VALUES ($1, $2)', [organizationId, stateStr]);
    }

    await logAudit(userId, 'state.save', 'organization', organizationId, { collections: processedCollections.length });
    
    // Émettre l'événement socket.io pour le hot reload, avec l'id de l'utilisateur auteur
    if (global.io) {
      // console.log('[SOCKET] Emission de stateUpdated à tous les clients (userId: ' + userId + ')');
      global.io.emit('stateUpdated', { userId, organizationId });
    }
    
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to save state', err);
    return res.status(500).json({ error: 'Failed to save state' });
  }
});

// --- Audit -------------------------------------------------------------
app.get('/api/audit', requireAuth, requirePermission('can_manage_permissions'), async (_req, res) => {
  const logs = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200');
  res.json(logs.rows);
});

// Serve static files from the dist folder
app.use(express.static(path.join(__dirname, '../dist')));

// Catch-all: serve index.html for any non-API routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// --- Bootstrap and start -----------------------------------------------
let serverInstance;
(async () => {
  try {
    await bootstrap();
    serverInstance = app.listen(PORT, () => {});
    // Initialisation socket.io
    const io = new SocketIOServer(serverInstance, {
      cors: { origin: CLIENT_ORIGIN, credentials: true }
    });
    global.io = io;

    // Sauvegardes automatiques (optionnelles)
    if (BACKUP_INTERVAL_MINUTES > 0 && !isNaN(BACKUP_INTERVAL_MINUTES)) {
      const intervalMs = BACKUP_INTERVAL_MINUTES * 60 * 1000;
      console.log(`[BACKUP] Sauvegardes automatiques toutes les ${BACKUP_INTERVAL_MINUTES} minutes`);
      setInterval(async () => {
        try {
          await createDbBackup('auto');
        } catch (err) {
          console.error('[BACKUP] Échec sauvegarde automatique', err);
        }
      }, intervalMs);
    } else {
      console.log('[BACKUP] Sauvegardes automatiques désactivées');
    }

    // Nettoyage initial des anciennes sauvegardes
    try {
      await pruneBackups();
    } catch (err) {
      console.error('[BACKUP] Échec du nettoyage initial', err);
    }

    // --- Gestion utilisateurs connectés ---
    // Map socket.id -> user info
    const connectedUsers = new Map();

    // Helper pour envoyer la liste à tous
    function broadcastUsers() {
      const users = Array.from(connectedUsers.values());
      io.emit('usersConnected', users);
    }

    io.on('connection', async (socket) => {
        // Identification par événement 'identify' (plus fiable que le cookie)
        let user = null;
        socket.on('identify', async (payload) => {
          if (payload && payload.id && payload.name) {
            user = { id: payload.id, name: payload.name };
            connectedUsers.set(socket.id, user);
            broadcastUsers();
          }
        });

        // (Optionnel) fallback cookie pour compatibilité ancienne version
        try {
          const cookie = socket.handshake.headers.cookie || '';
          // Accepte auth_token OU access_token
          let match = cookie.match(/auth_token=([^;]+)/);
          if (!match) {
            match = cookie.match(/access_token=([^;]+)/);
          }
          if (match) {
            const token = match[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [decoded.id]);
            if (result.rowCount) {
              user = result.rows[0];
              connectedUsers.set(socket.id, user);
              broadcastUsers();
            }
          }
        } catch (e) {
        }

        socket.on('whoIsConnected', () => {
          broadcastUsers();
        });

        socket.on('disconnect', () => {
          connectedUsers.delete(socket.id);
          broadcastUsers();
        });
    });
  } catch (err) {
    console.error('Failed to bootstrap server', err);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
   console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});

// Better error logging
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
