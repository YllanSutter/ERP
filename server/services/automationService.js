/**
 * automationService.js
 * Moteur d'exécution des automations côté serveur.
 *
 * Trigger types:
 *   - item_created   : nouvel item ajouté dans une collection
 *   - item_updated   : champs d'un item modifiés
 *   - item_deleted   : item supprimé d'une collection
 *
 * Action types:
 *   - create_item    : crée un item dans une collection cible
 *   - update_item    : met à jour des champs de l'item déclencheur (ou d'un item lié)
 *   - update_field   : met à jour un seul champ de l'item déclencheur
 */

import { randomUUID } from 'crypto';

// ─── Template resolver ────────────────────────────────────────────────────────
// Remplace {{trigger.fieldId}} par la valeur correspondante dans l'item déclencheur
const resolveTemplate = (value, triggerItem, actionResults = {}) => {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{(trigger|action)\.([^}]+)\}\}/g, (_, source, key) => {
    const val = source === 'trigger'
      ? triggerItem?.[key]
      : actionResults?.[key.split('.')[0]]?.[key.split('.').slice(1).join('.')];
    if (val === undefined || val === null) return '';
    return Array.isArray(val) ? val.join(', ') : typeof val === 'object' ? JSON.stringify(val) : String(val);
  });
};

// ─── Math expression evaluator ────────────────────────────────────────────────
// Évalue une expression mathématique simple après résolution des templates.
// Supporte + - * / et parenthèses. Renvoie le résultat numérique ou la valeur
// brute si l'expression n'est pas évaluable.
const SAFE_MATH_RE = /^[0-9\s+*/.()-]+$/;

const evalMathExpression = (expr) => {
  const cleaned = String(expr).trim();
  if (!SAFE_MATH_RE.test(cleaned)) return cleaned; // garde la valeur brute si caractères inattendus
  try {
    const result = new Function(`return (${cleaned})`)();
    if (typeof result === 'number' && Number.isFinite(result)) return String(result);
  } catch (_) { /* ignore */ }
  return cleaned;
};

const resolveFields = (fields, triggerItem, targetCollection, actionResults = {}) => {
  if (!fields || typeof fields !== 'object') return {};
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => {
      const resolved = resolveTemplate(v, triggerItem, actionResults);
      // Pour les champs de type number, tenter d'évaluer l'expression mathématique
      const prop = (targetCollection?.properties || []).find((p) => p.id === k);
      if (prop?.type === 'number') {
        return [k, evalMathExpression(resolved)];
      }
      return [k, resolved];
    })
  );
};

// ─── Relation bidirectional sync ──────────────────────────────────────────────
// Portage de applyRelationChangeInternal (useItems.ts) côté serveur.
// Applique les mises à jour réciproques quand un item source référence des items cibles.
const applyRelationChanges = (collections, sourceCollection, sourceItem, relationProps) => {
  let updatedCollections = collections;

  for (const prop of relationProps) {
    const relation = prop.relation || {};
    const targetCollectionId = relation.targetCollectionId;
    let targetFieldId = relation.targetFieldId;
    const relationType = relation.type || 'many_to_many';

    const targetCollection = updatedCollections.find((c) => c.id === targetCollectionId);
    if (!targetCollection) continue;

    // Auto-detect reciprocal field if not specified
    if (!targetFieldId) {
      const fallback = (targetCollection.properties || []).find(
        (p) => p.type === 'relation' && p.relation?.targetCollectionId === sourceCollection.id
      );
      if (fallback) targetFieldId = fallback.id;
    }
    if (!targetFieldId) continue;

    const newVal = sourceItem[prop.id];
    const isSourceMany = relationType === 'one_to_many' || relationType === 'many_to_many';
    const isTargetMany = relationType === 'many_to_many' ? true : relationType === 'one_to_many' ? false : true;

    const newIds = isSourceMany
      ? (Array.isArray(newVal) ? newVal : newVal ? [newVal] : [])
      : (newVal ? [String(newVal)] : []);

    if (newIds.length === 0) continue;

    const updatedItems = (targetCollection.items || []).map((ti) => {
      if (!newIds.includes(ti.id)) return ti;
      if (isTargetMany) {
        const arr = Array.isArray(ti[targetFieldId]) ? ti[targetFieldId] : [];
        if (arr.includes(sourceItem.id)) return ti;
        return { ...ti, [targetFieldId]: [...arr, sourceItem.id] };
      } else {
        if (ti[targetFieldId] === sourceItem.id) return ti;
        return { ...ti, [targetFieldId]: sourceItem.id };
      }
    });

    updatedCollections = updatedCollections.map((c) =>
      c.id === targetCollectionId ? { ...c, items: updatedItems } : c
    );
  }

  return updatedCollections;
};

// ─── Condition checker ────────────────────────────────────────────────────────
// conditions : [{ fieldId, operator, value }]
// operators  : equals, not_equals, contains, is_empty, is_not_empty, greater, less
const checkCondition = (item, condition, actionResults = {}) => {
  const { fieldId, operator, value } = condition;
  const match = String(fieldId || '').match(/^action\.([^.]+)\.(.+)$/);
  const fieldVal = match ? actionResults?.[match[1]]?.[match[2]] : item?.[fieldId];
  const resolvedValue = resolveTemplate(value ?? '', item, actionResults);

  switch (operator) {
    case 'equals':       return String(fieldVal ?? '') === String(resolvedValue ?? '');
    case 'not_equals':   return String(fieldVal ?? '') !== String(resolvedValue ?? '');
    case 'contains':     return String(fieldVal ?? '').toLowerCase().includes(String(resolvedValue ?? '').toLowerCase());
    case 'is_empty':     return fieldVal === null || fieldVal === undefined || fieldVal === '' || (Array.isArray(fieldVal) && fieldVal.length === 0);
    case 'is_not_empty': return !(fieldVal === null || fieldVal === undefined || fieldVal === '' || (Array.isArray(fieldVal) && fieldVal.length === 0));
    case 'greater':      return Number(fieldVal) > Number(resolvedValue);
    case 'less':         return Number(fieldVal) < Number(resolvedValue);
    default:             return true;
  }
};

const checkConditions = (item, conditions, actionResults = {}) => {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  return conditions.every((c) => checkCondition(item, c, actionResults));
};

// ─── Action executor ──────────────────────────────────────────────────────────
const executeAction = async (action, triggerItem, state, pool, organizationId, calculateEventSegments, getDefaultCalendarConfig, actionResults = {}, dryRun = false) => {
  const { type, collectionId, fields } = action;

  switch (type) {
    case 'create_item': {
      if (!collectionId) break;
      const col = (state.collections || []).find((c) => c.id === collectionId);
      if (!col) break;

      // Support nouveau format `items[]` et ancien format `fields` (rétro-compat)
      const itemDefs = Array.isArray(action.items) && action.items.length > 0
        ? action.items
        : [{ id: randomUUID(), fields: fields || {} }];

      // Quantité dynamique : count peut être un entier ou un template {{trigger.X}}
      let resolvedCount = null;
      if (action.count && String(action.count).trim() !== '') {
        const raw = resolveTemplate(String(action.count), triggerItem, actionResults);
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n > 0) resolvedCount = Math.min(n, 500); // plafond de sécurité
      }

      // Si count défini : répéter le 1er template autant de fois
      // Sinon : utiliser la liste d'items telle quelle
      const defsToCreate = resolvedCount !== null
        ? Array.from({ length: resolvedCount }, () => itemDefs[0] || { fields: {} })
        : itemDefs;

      const calendarConfig = getDefaultCalendarConfig();
      const newItems = defsToCreate.map((def) => {
        const resolvedFields = resolveFields(def.fields || {}, triggerItem, col, actionResults);
        const raw = {
          id: randomUUID(),
          name: '',
          ...resolvedFields,
          _createdByAutomation: true,
        };
        return calculateEventSegments
          ? calculateEventSegments(raw, col, calendarConfig)
          : raw;
      });

      state.collections = (state.collections || []).map((c) =>
        c.id === collectionId ? { ...c, items: [...(c.items || []), ...newItems] } : c
      );

      // ── Sync bidirectionnel des relations ──────────────────────────────────
      // Pour chaque nouvel item créé, si un champ est une relation, mettre à
      // jour l'item cible dans l'autre collection pour qu'il pointe en retour.
      const relationProps = (col.properties || []).filter((p) => p.type === 'relation');
      if (relationProps.length > 0) {
        for (const newItem of newItems) {
          state.collections = applyRelationChanges(state.collections, col, newItem, relationProps);
        }
      }
      return newItems[0] || null;
    }

    case 'update_item': {
      // Met à jour l'item déclencheur lui-même
      const targetCollectionId = collectionId || triggerItem.__collectionId;
      if (!targetCollectionId || !triggerItem?.id) break;

      const targetCol = (state.collections || []).find((c) => c.id === targetCollectionId);
      const resolvedFields = resolveFields(fields || {}, triggerItem, targetCol, actionResults);

      state.collections = (state.collections || []).map((c) => {
        if (c.id !== targetCollectionId) return c;
        return {
          ...c,
          items: (c.items || []).map((it) =>
            it.id === triggerItem.id ? { ...it, ...resolvedFields } : it
          ),
        };
      });
      const updatedTrigger = { ...triggerItem, ...resolvedFields };
      const changedRelationProps = (targetCol?.properties || []).filter(
        (p) => p.type === 'relation' && Object.prototype.hasOwnProperty.call(resolvedFields, p.id)
      );
      if (changedRelationProps.length > 0) {
        state.collections = applyRelationChanges(state.collections, targetCol, updatedTrigger, changedRelationProps);
      }
      return updatedTrigger;
    }

    case 'update_field': {
      // Raccourci : met à jour un seul champ de l'item déclencheur
      const targetCollectionId = collectionId || triggerItem.__collectionId;
      const { fieldId, value } = action;
      if (!targetCollectionId || !triggerItem?.id || !fieldId) break;
      const ufCol = (state.collections || []).find((c) => c.id === targetCollectionId);
      const ufProp = (ufCol?.properties || []).find((p) => p.id === fieldId);
      const rawResolved = resolveTemplate(value, triggerItem, actionResults);
      const resolvedValue = ufProp?.type === 'number' ? evalMathExpression(rawResolved) : rawResolved;

      state.collections = (state.collections || []).map((c) => {
        if (c.id !== targetCollectionId) return c;
        return {
          ...c,
          items: (c.items || []).map((it) =>
            it.id === triggerItem.id ? { ...it, [fieldId]: resolvedValue } : it
          ),
        };
      });
      const updatedTrigger = { ...triggerItem, [fieldId]: resolvedValue };
      if (ufProp?.type === 'relation') {
        state.collections = applyRelationChanges(state.collections, ufCol, updatedTrigger, [ufProp]);
      }
      return updatedTrigger;
    }

    case 'condition': {
      const branch = checkConditions(triggerItem, action.conditions || [], actionResults);
      const nestedActions = branch ? action.thenActions || [] : action.elseActions || [];
      let lastResult = null;
      for (const nestedAction of nestedActions) {
        lastResult = await executeAction(nestedAction, triggerItem, state, pool, organizationId, calculateEventSegments, getDefaultCalendarConfig, actionResults, dryRun);
        if (lastResult && nestedAction?.id) actionResults[nestedAction.id] = lastResult;
      }
      return lastResult;
    }

    case 'delay': {
      const seconds = Math.max(0, Math.min(60, Number(action.delaySeconds) || 0));
      if (seconds > 0 && !dryRun) await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return { delayedSeconds: seconds };
    }

    case 'find_or_create_item': {
      const col = (state.collections || []).find((c) => c.id === collectionId);
      if (!col || !action.matchFieldId) break;
      const matchValue = resolveTemplate(action.matchValue || '', triggerItem, actionResults);
      const existing = (col.items || []).find((item) => String(item[action.matchFieldId] ?? '') === String(matchValue));
      const resolvedFields = resolveFields(fields || {}, triggerItem, col, actionResults);
      if (existing) {
        const updated = { ...existing, ...resolvedFields };
        state.collections = state.collections.map((entry) => entry.id === collectionId
          ? { ...entry, items: entry.items.map((item) => item.id === existing.id ? updated : item) }
          : entry);
        const relationProps = (col.properties || []).filter((p) => p.type === 'relation' && Object.hasOwn(resolvedFields, p.id));
        if (relationProps.length) state.collections = applyRelationChanges(state.collections, col, updated, relationProps);
        return updated;
      }
      const created = { id: randomUUID(), name: '', ...resolvedFields, [action.matchFieldId]: matchValue, _createdByAutomation: true };
      state.collections = state.collections.map((entry) => entry.id === collectionId
        ? { ...entry, items: [...(entry.items || []), created] }
        : entry);
      const relationProps = (col.properties || []).filter((p) => p.type === 'relation');
      if (relationProps.length) state.collections = applyRelationChanges(state.collections, col, created, relationProps);
      return created;
    }

    default:
      break;
  }
};

// ─── Main entry points ────────────────────────────────────────────────────────

/**
 * Charge toutes les automations actives pour une organisation.
 */
export const loadAutomations = async (pool, organizationId) => {
  const result = await pool.query(
    'SELECT id, name, enabled, trigger_data, actions_data, nodes_data, edges_data FROM automations WHERE organization_id = $1 AND enabled = TRUE',
    [organizationId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    trigger: typeof row.trigger_data === 'string' ? JSON.parse(row.trigger_data) : row.trigger_data,
    actions: typeof row.actions_data === 'string' ? JSON.parse(row.actions_data) : row.actions_data,
    nodes: typeof row.nodes_data === 'string' ? JSON.parse(row.nodes_data) : row.nodes_data || [],
    edges: typeof row.edges_data === 'string' ? JSON.parse(row.edges_data) : row.edges_data || [],
  }));
};

const persistAutomationRun = async (pool, organizationId, automationId, status, details) => {
  try {
    await pool.query(
      `INSERT INTO automation_runs (id, organization_id, automation_id, status, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), organizationId, automationId, status, JSON.stringify(details)]
    );
  } catch (err) {
    // Journal indisponible ne doit pas empêcher l'automatisation de fonctionner.
    console.error('[Automation] impossible d’enregistrer l’exécution', err);
  }
};

/**
 * Déclenche les automations pour un événement donné.
 * Modifie `state` en place et retourne le state mis à jour.
 *
 * @param {Object} params
 * @param {'item_created'|'item_updated'|'item_deleted'} params.eventType
 * @param {string} params.collectionId  — collection d'origine
 * @param {Object} params.triggerItem   — item concerné (avec __collectionId)
 * @param {Object} params.prevItem      — version précédente (pour item_updated)
 * @param {Object} params.state         — app state courant (muté en place)
 * @param {Array}  params.automations   — automations pré-chargées
 * @param {Object} params.pool
 * @param {string} params.organizationId
 * @param {Function} params.calculateEventSegments
 * @param {Function} params.getDefaultCalendarConfig
 */
export const triggerAutomations = async ({
  eventType,
  collectionId,
  triggerItem,
  prevItem,
  state,
  automations,
  pool,
  organizationId,
  calculateEventSegments,
  getDefaultCalendarConfig,
  dryRun = false,
}) => {
  if (!Array.isArray(automations) || automations.length === 0) return state;
  const saveRun = (...args) => dryRun ? Promise.resolve() : persistAutomationRun(...args);

  const enrichedTriggerItem = { ...triggerItem, __collectionId: collectionId };

  for (const automation of automations) {
    const trigger = automation.trigger || {};
    const eventDetails = { eventType, collectionId, itemId: triggerItem?.id, steps: [] };
    if (trigger.type !== eventType || (trigger.collectionId && trigger.collectionId !== collectionId)) continue;

    // Vérification des conditions du trigger
    if (!checkConditions(enrichedTriggerItem, trigger.conditions || [])) {
      await saveRun(pool, organizationId, automation.id, 'ignored', {
        ...eventDetails, reason: 'Les conditions du déclencheur ne sont pas remplies.',
      });
      continue;
    }

    // Pour item_updated : vérifier que les champs surveillés ont changé
    if (eventType === 'item_updated' && Array.isArray(trigger.watchFields) && trigger.watchFields.length > 0) {
      const hasChange = trigger.watchFields.some(
        (fId) => JSON.stringify(enrichedTriggerItem[fId]) !== JSON.stringify(prevItem?.[fId])
      );
      if (!hasChange) {
        await saveRun(pool, organizationId, automation.id, 'ignored', {
          ...eventDetails, reason: 'Aucun champ surveillé n’a changé.',
        });
        continue;
      }
    }

    // Exécuter les actions en séquence
    const actions = Array.isArray(automation.actions) ? automation.actions : [];
    const actionResults = {};
    try {
      const flowNodes = Array.isArray(automation.nodes) ? automation.nodes : [];
      const flowEdges = Array.isArray(automation.edges) ? automation.edges : [];
      const triggerNode = flowNodes.find((node) => node.type === 'trigger');
      let sequencePosition = 0;
      const executeNode = async (node, branch) => {
        const action = { ...(node.data || {}), id: node.id, type: node.type };
        try {
          let result = null;
          if (node.type === 'condition') {
            const nestedActions = branch === 'true' ? node.data?.thenActions || [] : node.data?.elseActions || [];
            for (const nestedAction of nestedActions) {
              result = await executeAction(nestedAction, enrichedTriggerItem, state, pool, organizationId, calculateEventSegments, getDefaultCalendarConfig, actionResults, dryRun);
              if (result && nestedAction.id) actionResults[nestedAction.id] = result;
            }
          } else {
            result = await executeAction(action, enrichedTriggerItem, state, pool, organizationId, calculateEventSegments, getDefaultCalendarConfig, actionResults, dryRun);
          }
          if (result && action.id) actionResults[action.id] = result;
          eventDetails.steps.push({ actionId: node.id, type: node.type, status: 'success', position: ++sequencePosition, ...(branch ? { branch } : {}) });
        } catch (error) {
          eventDetails.steps.push({ actionId: action.id, type: action.type, status: 'error', position: ++sequencePosition, message: error?.message || 'Erreur inconnue' });
          throw error;
        }
      };
      if (triggerNode && flowEdges.length) {
        const outgoing = new Map();
        flowEdges.forEach((edge) => outgoing.set(edge.source, [...(outgoing.get(edge.source) || []), edge]));
        const queue = (outgoing.get(triggerNode.id) || [])
          .filter((edge) => !edge.sourceHandle || edge.sourceHandle === 'default')
          .map((edge) => edge.target);
        const visited = new Set([triggerNode.id]);
        while (queue.length && visited.size < 250) {
          const nodeId = queue.shift();
          if (visited.has(nodeId)) continue;
          visited.add(nodeId);
          const node = flowNodes.find((entry) => entry.id === nodeId);
          if (!node) continue;
          let branch;
          if (node.type === 'condition') {
            const passes = checkConditions(enrichedTriggerItem, node.data?.conditions || [], actionResults);
            branch = passes ? 'true' : 'false';
            const handles = passes ? ['true', 'yes'] : ['false', 'no'];
            for (const edge of outgoing.get(nodeId) || []) {
              if (handles.includes(edge.sourceHandle)) queue.push(edge.target);
            }
          } else {
            for (const edge of outgoing.get(nodeId) || []) queue.push(edge.target);
          }
          await executeNode(node, branch);
        }
      } else {
        for (const action of actions) await executeNode({ id: action.id, type: action.type, data: action });
      }
      await saveRun(pool, organizationId, automation.id, 'success', eventDetails);
    } catch (error) {
      await saveRun(pool, organizationId, automation.id, 'error', { ...eventDetails, error: error?.message || 'Erreur inconnue' });
      throw error;
    }
  }

  return state;
};
