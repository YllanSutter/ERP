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
const resolveTemplate = (value, triggerItem) => {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{trigger\.([^}]+)\}\}/g, (_, fieldId) => {
    const val = triggerItem?.[fieldId];
    return val !== undefined && val !== null ? String(val) : '';
  });
};

// ─── Math expression evaluator ────────────────────────────────────────────────
// Évalue une expression mathématique simple après résolution des templates.
// Supporte + - * / et parenthèses. Renvoie le résultat numérique ou la valeur
// brute si l'expression n'est pas évaluable.
const SAFE_MATH_RE = /^[0-9\s\+\-\*\/\.\(\)]+$/;

const evalMathExpression = (expr) => {
  const cleaned = String(expr).trim();
  if (!SAFE_MATH_RE.test(cleaned)) return cleaned; // garde la valeur brute si caractères inattendus
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${cleaned})`)();
    if (typeof result === 'number' && Number.isFinite(result)) return String(result);
  } catch (_) { /* ignore */ }
  return cleaned;
};

const resolveFields = (fields, triggerItem, targetCollection) => {
  if (!fields || typeof fields !== 'object') return {};
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => {
      const resolved = resolveTemplate(v, triggerItem);
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
const checkCondition = (item, condition) => {
  const { fieldId, operator, value } = condition;
  const fieldVal = item?.[fieldId];

  switch (operator) {
    case 'equals':       return String(fieldVal ?? '') === String(value ?? '');
    case 'not_equals':   return String(fieldVal ?? '') !== String(value ?? '');
    case 'contains':     return String(fieldVal ?? '').toLowerCase().includes(String(value ?? '').toLowerCase());
    case 'is_empty':     return fieldVal === null || fieldVal === undefined || fieldVal === '' || (Array.isArray(fieldVal) && fieldVal.length === 0);
    case 'is_not_empty': return !(fieldVal === null || fieldVal === undefined || fieldVal === '' || (Array.isArray(fieldVal) && fieldVal.length === 0));
    case 'greater':      return Number(fieldVal) > Number(value);
    case 'less':         return Number(fieldVal) < Number(value);
    default:             return true;
  }
};

const checkConditions = (item, conditions) => {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  return conditions.every((c) => checkCondition(item, c));
};

// ─── Action executor ──────────────────────────────────────────────────────────
const executeAction = async (action, triggerItem, state, pool, organizationId, calculateEventSegments, getDefaultCalendarConfig) => {
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
        const raw = resolveTemplate(String(action.count), triggerItem);
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
        const resolvedFields = resolveFields(def.fields || {}, triggerItem, col);
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

      break;
    }

    case 'update_item': {
      // Met à jour l'item déclencheur lui-même
      const targetCollectionId = collectionId || triggerItem.__collectionId;
      if (!targetCollectionId || !triggerItem?.id) break;

      const targetCol = (state.collections || []).find((c) => c.id === targetCollectionId);
      const resolvedFields = resolveFields(fields || {}, triggerItem, targetCol);

      state.collections = (state.collections || []).map((c) => {
        if (c.id !== targetCollectionId) return c;
        return {
          ...c,
          items: (c.items || []).map((it) =>
            it.id === triggerItem.id ? { ...it, ...resolvedFields } : it
          ),
        };
      });
      break;
    }

    case 'update_field': {
      // Raccourci : met à jour un seul champ de l'item déclencheur
      const targetCollectionId = collectionId || triggerItem.__collectionId;
      const { fieldId, value } = action;
      if (!targetCollectionId || !triggerItem?.id || !fieldId) break;
      const ufCol = (state.collections || []).find((c) => c.id === targetCollectionId);
      const ufProp = (ufCol?.properties || []).find((p) => p.id === fieldId);
      const rawResolved = resolveTemplate(value, triggerItem);
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
      break;
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
    'SELECT id, name, enabled, trigger_data, actions_data FROM automations WHERE organization_id = $1 AND enabled = TRUE',
    [organizationId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    trigger: typeof row.trigger_data === 'string' ? JSON.parse(row.trigger_data) : row.trigger_data,
    actions: typeof row.actions_data === 'string' ? JSON.parse(row.actions_data) : row.actions_data,
  }));
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
}) => {
  if (!Array.isArray(automations) || automations.length === 0) return state;

  const enrichedTriggerItem = { ...triggerItem, __collectionId: collectionId };

  for (const automation of automations) {
    const trigger = automation.trigger || {};
    if (trigger.type !== eventType) continue;
    if (trigger.collectionId && trigger.collectionId !== collectionId) continue;

    // Vérification des conditions du trigger
    if (!checkConditions(enrichedTriggerItem, trigger.conditions || [])) continue;

    // Pour item_updated : vérifier que les champs surveillés ont changé
    if (eventType === 'item_updated' && Array.isArray(trigger.watchFields) && trigger.watchFields.length > 0) {
      const hasChange = trigger.watchFields.some(
        (fId) => JSON.stringify(enrichedTriggerItem[fId]) !== JSON.stringify(prevItem?.[fId])
      );
      if (!hasChange) continue;
    }

    // Exécuter les actions en séquence
    const actions = Array.isArray(automation.actions) ? automation.actions : [];
    for (const action of actions) {
      await executeAction(
        action,
        enrichedTriggerItem,
        state,
        pool,
        organizationId,
        calculateEventSegments,
        getDefaultCalendarConfig,
      );
    }
  }

  return state;
};
