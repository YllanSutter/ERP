import React, { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Star, Trash2, Clock, Edit2, History, ChevronLeft } from 'lucide-react';
import EditableProperty from '@/components/fields/EditableProperty';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/auth/AuthProvider';
import {
  getRoundedNow, workDayStart, workDayEnd,
  calculateSegmentsClient, formatSegmentDisplay,
  isEmptyValue,
  extractTextFromTiptap, serializeTiptapLines, isRichTextValue,
  diffLines, areValuesEqual, computePatch, applyPatch, buildSnapshotAt,
  formatValueForDisplay,
  type FieldGroup,
} from '@/components/modals/modalLib';


interface NewItemModalProps {
  collection: any;
  onClose: () => void;
  onSave: (item: any) => void;
  onSaveAndStay?: (item: any) => void;
  onDelete?: (itemId: string) => void;
  editingItem: any;
  collections: any[];
  favorites?: { views: string[]; items: string[] };
  onToggleFavoriteItem?: (itemId: string) => void;
  orderedProperties?: any[];
  onSaveRelatedItem?: (collectionId: string, item: any) => void;
  groupContext?: Record<string, any> | null;
  /** Groupes de champs configurés dans les paramètres de la vue (section Détails) */
  fieldGroups?: FieldGroup[];
}

interface SubItemEntry {
  collection: any;
  item: any;
  formData: any;
  propName: string;
}

interface DraftPayloadState {
  formData: any;
  templateAutoFilled?: Record<string, boolean>;
  baseData?: any;
}


const NewItemModal: React.FC<NewItemModalProps> = ({
  collection,
  onClose,
  onSave,
  onSaveAndStay,
  onDelete,
  editingItem,
  collections,
  favorites,
  onToggleFavoriteItem,
  orderedProperties,
  onSaveRelatedItem,
  groupContext,
  fieldGroups = [],
}) => {
  const { user, isAdmin, isEditor, permissions } = useAuth();

  const canReadCollection = React.useCallback((collectionId?: string | null) => {
    if (!collectionId) return false;
    if (isAdmin || isEditor) return true;
    const perms = permissions || [];
    const collectionPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === collectionId &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (collectionPerm) return Boolean(collectionPerm.can_read);
    const globalPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === null &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (globalPerm) return Boolean(globalPerm.can_read);
    return false;
  }, [isAdmin, isEditor, permissions]);

  const canWriteCollection = React.useCallback((collectionId?: string | null) => {
    if (!collectionId) return false;
    if (isAdmin || isEditor) return true;
    const perms = permissions || [];
    const collectionPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === collectionId &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (collectionPerm) return Boolean(collectionPerm.can_write);
    const globalPerm = perms.find(
      (p: any) =>
        (p.collection_id || null) === null &&
        (p.item_id || null) === null &&
        (p.field_id || null) === null
    );
    if (globalPerm) return Boolean(globalPerm.can_write);
    return false;
  }, [isAdmin, isEditor, permissions]);

  const canReadField = React.useCallback((collectionId: string | null | undefined, fieldId: string) => {
    if (!collectionId || !fieldId) return false;
    if (isAdmin || isEditor) return true;
    const perms = permissions || [];
    const fieldPerm = perms.find(
      (p: any) =>
        (p.field_id || null) === fieldId &&
        (p.collection_id || null) === collectionId &&
        (p.item_id || null) === null
    );
    if (fieldPerm) return Boolean(fieldPerm.can_read);
    return canReadCollection(collectionId);
  }, [isAdmin, isEditor, permissions, canReadCollection]);

  const canWriteField = React.useCallback((collectionId: string | null | undefined, fieldId: string) => {
    if (!collectionId || !fieldId) return false;
    if (isAdmin || isEditor) return true;
    const perms = permissions || [];
    const fieldPerm = perms.find(
      (p: any) =>
        (p.field_id || null) === fieldId &&
        (p.collection_id || null) === collectionId &&
        (p.item_id || null) === null
    );
    if (fieldPerm) return Boolean(fieldPerm.can_write);
    return canWriteCollection(collectionId);
  }, [isAdmin, isEditor, permissions, canWriteCollection]);

  const readableCollections = useMemo(
    () => (collections || []).filter((c: any) => canReadCollection(c.id)),
    [collections, canReadCollection]
  );

  const writableCollections = useMemo(
    () => readableCollections.filter((c: any) => canWriteCollection(c.id)),
    [readableCollections, canWriteCollection]
  );

  // Ajout d'un sélecteur de collection (pour création uniquement)
  const [selectedCollectionId, setSelectedCollectionId] = useState(collection.id);
  const selectedCollection =
    readableCollections.find((c: any) => c.id === selectedCollectionId) ||
    readableCollections[0] ||
    collection;
  const isReallyEditing = Boolean(editingItem && editingItem.id);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateDialogItems, setTemplateDialogItems] = useState<any[]>([]);
  const [templateDialogSelection, setTemplateDialogSelection] = useState<Record<string, boolean>>({});
  const [templateDialogPayload, setTemplateDialogPayload] = useState<{ nextData: any; nextAutoFilled: Record<string, boolean> } | null>(null);
  const [templateDialogNeedsSegments, setTemplateDialogNeedsSegments] = useState(false);
  React.useEffect(() => {
    const exists = readableCollections.some((c: any) => c.id === selectedCollectionId);
    if (exists) return;
    const nextId = writableCollections[0]?.id || readableCollections[0]?.id || collection?.id;
    if (nextId) setSelectedCollectionId(nextId);
  }, [selectedCollectionId, readableCollections, writableCollections, collection?.id]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<{ base: any; versions: any[] } | null>(null);
  const [historySelectedIndex, setHistorySelectedIndex] = useState<number | null>(null);
  const [historyPreview, setHistoryPreview] = useState<any | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);




  const getMatchingTemplate = (prop: any, data: any, sourceFieldId?: string) => {
    const templates = Array.isArray(prop.defaultTemplates) ? prop.defaultTemplates : [];

    // Priorité 1 : template conditionnel dont la condition est vérifiée
    for (const template of templates) {
      const when = template?.when || {};
      if (!when.fieldId) continue;
      if (sourceFieldId && when.fieldId !== sourceFieldId) continue;
      const sourceValue = data[when.fieldId];

      if (Array.isArray(sourceValue)) {
        if (sourceValue.includes(when.value)) return template;
      } else if (sourceValue === when.value) {
        return template;
      }
    }

    // Priorité 2 : fallback — template marqué isDefault OU sans condition
    // (un template sans when.fieldId = valeur par défaut inconditionnelle)
    if (!sourceFieldId) {
      const fallback = templates.find((t: any) => t?.isDefault || !t?.when?.fieldId);
      return fallback || null;
    }
    return null;
  };

  const applyTemplates = (
    data: any,
    sourceFieldId?: string,
    autoFilledMap: Record<string, boolean> = {},
    allowPrompt = false,
    groupCtx?: Record<string, any> | null
  ) => {
    let nextData = { ...data };
    let nextAutoFilled = { ...autoFilledMap };
    let pendingUpdates: any[] = [];
    let didApplyDurationChange = false;
    let hasPendingDurationChange = false;

    const props = (orderedProperties && orderedProperties.length > 0 ? orderedProperties : selectedCollection.properties) || [];
    const templateSourceFieldIds = new Set(
      props.flatMap((prop: any) =>
        (Array.isArray(prop.defaultTemplates) ? prop.defaultTemplates : [])
          .map((tpl: any) => tpl?.when?.fieldId)
          .filter(Boolean)
      )
    );

    if (sourceFieldId && !templateSourceFieldIds.has(sourceFieldId)) {
      return { nextData, nextAutoFilled };
    }

    props.forEach((prop: any) => {
      // Gestion template "groupage actuel" (isCurrentGroupTemplate)
      if (prop.type === 'relation' && !sourceFieldId) {
        const currentGroupTpl = (prop.defaultTemplates || []).find((t: any) => t?.isCurrentGroupTemplate);
        if (currentGroupTpl) {
          const resolvedCtx = groupCtx !== undefined ? groupCtx : groupContextRef?.current;
          const contextValue = resolvedCtx?.[prop.id];
          if (contextValue && !isEmptyValue(contextValue) && isEmptyValue(nextData[prop.id])) {
            nextData[prop.id] = contextValue;
            nextAutoFilled[prop.id] = true;
          }
          return;
        }
      }

      const match = getMatchingTemplate(prop, nextData, sourceFieldId);
      if (!match) return;

      let desiredValue = match.value;
      
      // Gérer le template 'current_date' pour les champs date
      const isDateField = prop.type === 'date' || prop.type === 'date_range';
      if (isDateField && desiredValue === 'current_date') {
        // Pour current_date, on doit remplir le champ date lui-même, pas la durée
        const currentDateValue = nextData[prop.id];
        if (isEmptyValue(currentDateValue)) {
          nextData[prop.id] = new Date().toISOString();
          nextAutoFilled[prop.id] = true;
        } else if (nextAutoFilled[prop.id]) {
          nextData[prop.id] = new Date().toISOString();
        }
        return;
      }
      
      // Pour les autres templates de date (durée), on continue avec la logique existante
      const targetKey = isDateField ? `${prop.id}_duration` : prop.id;
      const currentValue = nextData[targetKey];
      const isDurationTarget = targetKey.endsWith('_duration');

      if (isEmptyValue(currentValue)) {
        nextData[targetKey] = desiredValue;
        nextAutoFilled[targetKey] = true;
        if (isDurationTarget) didApplyDurationChange = true;
        return;
      }

      if (nextAutoFilled[targetKey]) {
        if (!areValuesEqual(currentValue, desiredValue)) {
          nextData[targetKey] = desiredValue;
          if (isDurationTarget) didApplyDurationChange = true;
        }
        nextAutoFilled[targetKey] = true;
        return;
      }

      if (allowPrompt && !isEmptyValue(currentValue) && !areValuesEqual(currentValue, desiredValue)) {
        pendingUpdates.push({
          propId: prop.id,
          propName: prop.name,
          targetKey,
          currentValue,
          desiredValue,
        });
        if (isDurationTarget) hasPendingDurationChange = true;
      }
    });

    return { nextData, nextAutoFilled, pendingUpdates, didApplyDurationChange, hasPendingDurationChange };
  };


  const buildDraftKey = (collectionId: string, itemId?: string) => {
    const itemPart = itemId || 'new';
    return `erp-item-draft:${collectionId}:${itemPart}`;
  };

  const buildHistoryKey = (collectionId: string, itemId: string) => {
    return `erp-item-versions:${collectionId}:${itemId}`;
  };

  const sanitizeVersionData = (data: any) => {
    if (!data || typeof data !== 'object') return data;
    const { __collectionId, ...rest } = data as any;
    return rest;
  };



  // Fusionne l'item prérempli (editingItem) avec les valeurs par défaut
  function getInitialFormData(col = selectedCollection, prefill: any = editingItem) {
    const data: any = { ...(prefill || {}) };
    const autoFilled: Record<string, boolean> = {};
    const props = orderedProperties && orderedProperties.length > 0 ? orderedProperties : col.properties;
    
    // Marquer les champs du prefill comme NON auto-remplis pour qu'ils ne soient pas écrasés par les templates
    const prefillFieldIds = new Set(prefill ? Object.keys(prefill) : []);
    
    props.forEach((prop: any) => {
      if (data[prop.id] === undefined) {
        if (prop.type === 'date') {
          data[prop.id] = getRoundedNow().toISOString();
        }
      }
    });
    // Pour chaque champ *_duration, si pas de valeur, injecte la valeur par défaut
    props.forEach((prop: any) => {
      if (prop.id.endsWith('_duration') && data[prop.id] === undefined) {
        // Initialiser avec 1 heure par défaut pour que les segments se génèrent
        data[prop.id] = 1;
        autoFilled[prop.id] = true;
      }
    });
    // Si on édite, on force l'id dans le formData
    if (editingItem && editingItem.id) {
      data.id = editingItem.id;
    }
    // IMPORTANT: Ne PLUS recalculer les segments côté client
    // Les segments sont maintenant calculés côté serveur dans POST /api/state
    // On garde seulement ceux qui proviennent de la BDD (si édition)
    if (prefill && prefill._eventSegments) {
      data._eventSegments = prefill._eventSegments;
    } else {
      // Initialiser avec un array vide - sera recalculé au serveur
      data._eventSegments = [];
    }

    if (!prefill || !prefill.id) {
      // groupContext peut être null si React a batché les updates — fallback sur prefill
      const effectiveGroupCtx = groupContext ?? (prefill && !prefill.id ? prefill : null);
      let currentData = { ...data };
      let currentAutoFilled = { ...autoFilled };
      // Marquer les champs du prefill comme "NOT auto-filled" pour qu'ils ne soient pas écrasés
      for (const fieldId of prefillFieldIds) {
        if (fieldId !== 'id' && fieldId !== '_eventSegments') {
          currentAutoFilled[fieldId] = false;
        }
      }
      for (let i = 0; i < 3; i += 1) {
        const { nextData, nextAutoFilled } = applyTemplates(currentData, undefined, currentAutoFilled, false, effectiveGroupCtx) as any;
        const prevSerialized = JSON.stringify(currentData);
        const nextSerialized = JSON.stringify(nextData);
        currentData = nextData;
        currentAutoFilled = { ...currentAutoFilled, ...nextAutoFilled };
        if (prevSerialized === nextSerialized) break;
      }
      return { data: currentData, autoFilled: currentAutoFilled };
    }
    return { data, autoFilled: {} };
  }



  // Stabiliser initialForm : ne re-calculer QUE si le schéma (properties) change,
  // PAS quand les items de la collection changent (ex: update distant via socket).
  // Sans ça, chaque patch distant recalcule initialForm → relance l'effet draftKey → prompt parasite.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialForm = useMemo(
    () => getInitialFormData(selectedCollection, editingItem),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      selectedCollectionId,
      // Schéma seulement (properties + méta sans items)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(selectedCollection?.properties ?? []),
      JSON.stringify(orderedProperties ?? []),
      editingItem,
    ]
  );
  const [templateAutoFilled, setTemplateAutoFilled] = useState<Record<string, boolean>>(initialForm.autoFilled);
  const [formData, setFormDataRaw] = useState(initialForm.data);
  // Ref miroir de formData : permet de lire la valeur courante dans un effect
  // sans avoir à l'inclure dans ses deps (ce qui ferait tourner l'effect à chaque frappe).
  const formDataRef = useRef<any>(initialForm.data);
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [draftPayload, setDraftPayload] = useState<DraftPayloadState | null>(null);
  const initialDataRef = useRef(initialForm.data);
  const groupContextRef = useRef<Record<string, any> | null>(null);
  React.useEffect(() => { groupContextRef.current = groupContext ?? null; }, [groupContext]);

  const draftAppliedRef = useRef(false);
  const draftReadyRef = useRef(true);
  const didMountRef = useRef(false);
  const disableDraftRef = useRef(false);
  const draftKey = useMemo(
    () => buildDraftKey(selectedCollectionId, isReallyEditing ? editingItem?.id : undefined),
    [selectedCollectionId, isReallyEditing, editingItem?.id]
  );
  const historyKey = useMemo(() => {
    const itemId = editingItem?.id || formData?.id;
    if (!itemId) return null;
    return buildHistoryKey(selectedCollectionId, itemId);
  }, [selectedCollectionId, editingItem?.id, formData?.id]);

  React.useEffect(() => {
    draftAppliedRef.current = false;
    disableDraftRef.current = false;
    setHasLocalDraft(false);
    setDraftPayload(null);
    setDraftPromptOpen(false);
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) {
        initialDataRef.current = initialForm.data;
        setFormDataRaw(initialForm.data);
        setTemplateAutoFilled(initialForm.autoFilled);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.formData) {
        initialDataRef.current = initialForm.data;
        setFormDataRaw(initialForm.data);
        setTemplateAutoFilled(initialForm.autoFilled);
        return;
      }
      if (parsed.selectedCollectionId && parsed.selectedCollectionId !== selectedCollectionId) {
        initialDataRef.current = initialForm.data;
        setFormDataRaw(initialForm.data);
        setTemplateAutoFilled(initialForm.autoFilled);
        return;
      }
      if (areValuesEqual(parsed.formData, initialForm.data)) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // ignore stockage local indisponible
        }
        initialDataRef.current = initialForm.data;
        setFormDataRaw(initialForm.data);
        setTemplateAutoFilled(initialForm.autoFilled);
        setHasLocalDraft(false);
        return;
      }
      setHasLocalDraft(true);
      setDraftPayload({
        formData: parsed.formData,
        templateAutoFilled: parsed.templateAutoFilled,
        baseData: parsed.baseData,
      });
      setDraftPromptOpen(true);
    } catch {
      // ignore stockage local indisponible
      initialDataRef.current = initialForm.data;
      setFormDataRaw(initialForm.data);
      setTemplateAutoFilled(initialForm.autoFilled);
    } finally {
      draftReadyRef.current = true;
    }
  }, [
    draftKey,
    selectedCollectionId,
    editingItem?.id,
    JSON.stringify(selectedCollection?.properties ?? []),
    JSON.stringify(orderedProperties ?? []),
  ]);

  const isDraftDirty = useMemo(
    () => !areValuesEqual(formData, initialDataRef.current),
    [formData]
  );

  const applyDraftPayload = React.useCallback(() => {
    if (!draftPayload) return;
    const draftBase = draftPayload.baseData && typeof draftPayload.baseData === 'object'
      ? draftPayload.baseData
      : initialForm.data;
    const liveBase = initialForm.data && typeof initialForm.data === 'object'
      ? initialForm.data
      : {};
    const draftFormData = draftPayload.formData && typeof draftPayload.formData === 'object'
      ? draftPayload.formData
      : {};
    const mergedDraft = { ...liveBase };
    const keys = new Set([
      ...Object.keys(liveBase),
      ...Object.keys(draftBase),
      ...Object.keys(draftFormData),
    ]);

    keys.forEach((key) => {
      const draftChanged = !areValuesEqual(draftFormData[key], draftBase[key]);
      if (draftChanged) {
        mergedDraft[key] = draftFormData[key];
      }
    });

    draftAppliedRef.current = true;
    initialDataRef.current = liveBase;
    setFormDataRaw(mergedDraft);
    if (draftPayload.templateAutoFilled) {
      setTemplateAutoFilled(draftPayload.templateAutoFilled);
    }
    setHasLocalDraft(true);
    setDraftPayload(null);
    setDraftPromptOpen(false);
  }, [draftPayload, initialForm]);

  const discardDraftPayload = React.useCallback(() => {
    setDraftPromptOpen(false);
    setDraftPayload(null);
    setHasLocalDraft(false);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore stockage local indisponible
    }
    initialDataRef.current = initialForm.data;
    setFormDataRaw(initialForm.data);
    setTemplateAutoFilled(initialForm.autoFilled);
  }, [draftKey, initialForm]);

  React.useEffect(() => {
    if (disableDraftRef.current) return;
    if (!isDraftDirty) {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore stockage local indisponible
      }
      setHasLocalDraft(false);
      return;
    }
    try {
      const payload = {
        formData,
        templateAutoFilled,
        baseData: initialDataRef.current,
        selectedCollectionId,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftKey, JSON.stringify(payload));
      setHasLocalDraft(true);
    } catch {
      // ignore stockage local indisponible
    }
  }, [formData, templateAutoFilled, selectedCollectionId, draftKey, isDraftDirty]);

  React.useEffect(() => {
    return () => {
      if (disableDraftRef.current) return;
      if (!isDraftDirty) return;
      try {
        const payload = {
          formData,
          templateAutoFilled,
          baseData: initialDataRef.current,
          selectedCollectionId,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch {
        // ignore stockage local indisponible
      }
    };
  }, [formData, templateAutoFilled, selectedCollectionId, draftKey, isDraftDirty]);

  // Garder formDataRef synchronisé avec formData
  React.useEffect(() => {
    formDataRef.current = formData;
  });

  // NOUVEAU COMPORTEMENT: setFormData ne recalcule PLUS côté client
  // Tout recalcul se fait côté serveur via POST /api/state
  const setFormData = (data: any) => {
    if (data && typeof data === 'object') {
      setFormDataRaw({ ...data });
      return;
    }
    setFormDataRaw(data);
  };

  const setManualSegments = (segments: any[]) => {
    setFormData({ ...formData, _eventSegments: segments, _preserveEventSegments: true });
  };

  // Lors d'un changement de collection, garder les segments existants
  React.useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (draftAppliedRef.current) return;
    if (formData && formData._eventSegments) {
      setFormDataRaw({ ...formData });
    } else {
      setFormDataRaw({ ...formData, _eventSegments: [] });
    }
    // eslint-disable-next-line
  }, [selectedCollectionId, JSON.stringify(selectedCollection?.properties ?? [])]);

  const handleChange = (propId: string, value: any) => {
    if (!canWriteField(selectedCollection?.id, propId)) return;
    // Plus besoin de vérifier si c'est un champ date
    // Tous les changements sont envoyés au serveur qui recalculera les segments
    let nextData = { ...formData, [propId]: value };
    let nextAutoFilled = { ...templateAutoFilled, [propId]: false };

    const isDateField = dateProps.some((p: any) => p.id === propId);
    const isDurationField = propId.endsWith('_duration');
    if (isDateField || isDurationField) {
      nextData = { ...nextData, _preserveEventSegments: false };
    }

    const result = applyTemplates(nextData, propId, nextAutoFilled, true);
    const {
      nextData: computedData,
      nextAutoFilled: computedAutoFilled,
      pendingUpdates = [],
      didApplyDurationChange = false,
      hasPendingDurationChange = false,
    } = result as any;
    nextData = computedData;
    nextAutoFilled = computedAutoFilled;

    if (didApplyDurationChange) {
      nextData = { ...nextData, _eventSegments: calculateSegmentsClient(nextData, selectedCollection), _preserveEventSegments: false };
    }

    if (pendingUpdates.length > 0) {
      const selectionMap = pendingUpdates.reduce((acc: Record<string, boolean>, update: any) => {
        acc[update.targetKey] = true;
        return acc;
      }, {});
      setTemplateDialogItems(pendingUpdates);
      setTemplateDialogSelection(selectionMap);
      setTemplateDialogPayload({ nextData, nextAutoFilled });
      setTemplateDialogNeedsSegments(hasPendingDurationChange);
      setTemplateDialogOpen(true);
      setTemplateAutoFilled(nextAutoFilled);
      setFormData(nextData);
      return;
    }

    setTemplateAutoFilled(nextAutoFilled);
    setFormData(nextData);
  };

  const handleTemplateDialogConfirm = () => {
    if (!templateDialogPayload) return;
    let nextData = { ...templateDialogPayload.nextData };
    let nextAutoFilled = { ...templateDialogPayload.nextAutoFilled };
    let shouldRecalcSegments = false;

    templateDialogItems.forEach((item: any) => {
      if (!templateDialogSelection[item.targetKey]) return;
      nextData[item.targetKey] = item.desiredValue;
      nextAutoFilled[item.targetKey] = true;
      if (item.targetKey.endsWith('_duration')) {
        shouldRecalcSegments = true;
      }
    });

    if (templateDialogNeedsSegments || shouldRecalcSegments) {
      nextData = { ...nextData, _eventSegments: calculateSegmentsClient(nextData, selectedCollection), _preserveEventSegments: false };
    }

    setTemplateAutoFilled(nextAutoFilled);
    setFormData(nextData);
    setTemplateDialogOpen(false);
    setTemplateDialogItems([]);
    setTemplateDialogSelection({});
    setTemplateDialogPayload(null);
    setTemplateDialogNeedsSegments(false);
  };

  const handleTemplateDialogCancel = () => {
    setTemplateDialogOpen(false);
    setTemplateDialogItems([]);
    setTemplateDialogSelection({});
    setTemplateDialogPayload(null);
    setTemplateDialogNeedsSegments(false);
  };


  // State temporaire pour propager la valeur du champ date
  const [pendingDateValue, setPendingDateValue] = useState<string | undefined>(undefined);

  const handleCollectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCollectionId = e.target.value;
    if (!editingItem) {
      // Cherche la première valeur trouvée dans formData parmi tous les champs date de la collection courante
      let previousDateValue = undefined;
      const prevCol = readableCollections.find((c: any) => c.id === selectedCollectionId) || collection;
      const prevDateFields = prevCol.properties.filter((p: any) => p.type === 'date');
      if (formData && prevDateFields.length > 0) {
        for (let i = 0; i < prevDateFields.length; i++) {
          const field = prevDateFields[i];
          if (formData[field.id]) {
            previousDateValue = formData[field.id];
            break;
          }
        }
      }
      setPendingDateValue(previousDateValue);
    }
    setSelectedCollectionId(newCollectionId);
  };

  // Quand selectedCollectionId change, si pendingDateValue est défini, on préremplit tous les champs date
  React.useEffect(() => {
    if (!editingItem && pendingDateValue !== undefined && !draftAppliedRef.current) {
      const newCol = readableCollections.find((c: any) => c.id === selectedCollectionId) || collection;
      const dateFields = newCol.properties.filter((p: any) => p.type === 'date');
      let prefill: any = {};
      if (pendingDateValue) {
        dateFields.forEach((field: any) => {
          prefill[field.id] = pendingDateValue;
        });
      }
      const next = getInitialFormData(newCol, prefill);
      initialDataRef.current = next.data;
      setFormData(next.data);
      setPendingDateValue(undefined);
    }
    // eslint-disable-next-line
  }, [selectedCollectionId]);

  // Quand la modal reçoit un nouvel editingItem (préremplissage), on met à jour le formData
  React.useEffect(() => {
    if (!editingItem || draftAppliedRef.current) return;
    // On force la réinitialisation du formData à partir de l'editingItem reçu (qui doit contenir les _eventSegments à jour)
    const next = getInitialFormData(selectedCollection, editingItem);
    initialDataRef.current = next.data;
    setFormDataRaw(next.data);
    setTemplateAutoFilled(next.autoFilled);
  }, [
    editingItem,
    selectedCollectionId,
    JSON.stringify(selectedCollection?.properties ?? []),
    JSON.stringify(orderedProperties ?? []),
  ]);

  // Sync en temps réel : quand un autre utilisateur modifie l'item en cours d'édition,
  // on met à jour UNIQUEMENT les champs que l'utilisateur local n'a PAS encore touchés.
  // On ne mute PAS initialDataRef dans le state updater (effet de bord interdit).
  React.useEffect(() => {
    if (!isReallyEditing || !editingItem?.id) return;
    const liveCollection = collections.find((c: any) => c.id === selectedCollectionId);
    const liveItem = liveCollection?.items?.find((i: any) => i.id === editingItem.id);
    if (!liveItem) return;

    // Calculer en dehors du state updater (accès synchrone à la baseline courante)
    const baseline = initialDataRef.current;
    const updates: Record<string, any> = {};
    const newBaseline: Record<string, any> = { ...baseline };

    // Lire formData via ref pour éviter une dépendance qui ferait tourner l'effet à chaque frappe
    // (formDataRef est tenu à jour via setFormData en dessous)
    const currentFormData = formDataRef.current ?? {};

    for (const key of Object.keys(liveItem)) {
      if (key.startsWith('_')) continue;
      const userModified =
        JSON.stringify(currentFormData[key]) !== JSON.stringify(baseline[key]);
      if (!userModified && JSON.stringify(liveItem[key]) !== JSON.stringify(currentFormData[key])) {
        updates[key] = liveItem[key];
        newBaseline[key] = liveItem[key]; // avance la baseline pour ce champ
      }
    }

    if (Object.keys(updates).length === 0) return;

    // Muter la baseline AVANT le setState (synchrone, pas dans un updater)
    initialDataRef.current = newBaseline;
    setFormDataRaw((prev: any) => ({ ...prev, ...updates }));
  }, [collections, editingItem?.id, selectedCollectionId, isReallyEditing]);

  React.useEffect(() => {
    if (!historyKey) {
      setHistoryData(null);
      setHistorySelectedIndex(null);
      setHistoryPreview(null);
      return;
    }
    try {
      const raw = localStorage.getItem(historyKey);
      if (!raw) {
        setHistoryData(null);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.base || !Array.isArray(parsed.versions)) {
        setHistoryData(null);
        return;
      }
      setHistoryData(parsed);
    } catch {
      setHistoryData(null);
    }
  }, [historyKey]);

  React.useEffect(() => {
    if (!historyOpen || !historyData || historyData.versions.length === 0) return;
    const lastIndex = historyData.versions.length - 1;
    setHistorySelectedIndex(lastIndex);
    setHistoryPreview(buildSnapshotAt(historyData.base, historyData.versions, lastIndex));
  }, [historyOpen, historyData]);

  const isFavorite = favorites && editingItem ? favorites.items.includes(editingItem.id) : false;

  // Pour la création, on recalcule dynamiquement les champs selon la collection sélectionnée
  // Pour l'édition, on garde orderedProperties (pour garder l'ordre de la vue courante)
  // Mode édition si un id existe, même si isNew traîne
  const basePropsList = isReallyEditing
    ? (orderedProperties && orderedProperties.length > 0 ? orderedProperties : selectedCollection.properties)
    : selectedCollection.properties;
  const richTextFallback = (selectedCollection.properties || []).filter(
    (p: any) => p.type === 'rich_text'
  );
  const readableBaseProps = (basePropsList || []).filter((p: any) => canReadField(selectedCollection?.id, p.id));
  const readableRichTextFallback = (richTextFallback || []).filter((p: any) => canReadField(selectedCollection?.id, p.id));
  const propsList = readableRichTextFallback.reduce((acc: any[], prop: any) => {
    if (acc.some((p) => p.id === prop.id)) return acc;
    return [...acc, prop];
  }, readableBaseProps as any[]);
  const classicProps = propsList.filter((p: any) => p.type !== 'relation');
  const richTextProps = classicProps.filter((p: any) => p.type === 'rich_text');
  const classicPropsSansRichText = classicProps.filter((p: any) => p.type !== 'rich_text');
  const relationProps = propsList.filter((p: any) => p.type === 'relation');
  const dateProps = propsList.filter((p: any) => p.type === 'date');

  // On affiche toujours tous les champs si la collection en possède —
  // masquer uniquement quand la collection n'a aucun champ de ce type.
  const detailsPropsForDisplay = classicPropsSansRichText.slice(1);
  const relationPropsForDisplay = relationProps;

  // Calcule les segments prégénérés côté client (pour aperçu dans le modal)
  const previewSegments = useMemo(() => {
    return calculateSegmentsClient(formData, selectedCollection);
  }, [formData, selectedCollection]);

  // Toujours afficher tous les champs date si la collection en a — même vides.
  const datePropsForDisplay = dateProps;

  // Toujours afficher tous les champs rich text si la collection en a.
  const richTextPropsForDisplay = richTextProps;

  const richTextTabs = useMemo(
    () => richTextPropsForDisplay.map((prop: any, index: number) => ({
      id: prop.id,
      label: String(prop?.name || '').trim() || (index === 0 ? 'Tâches' : `Texte ${index + 1}`),
    })),
    [richTextPropsForDisplay]
  );
  const [activeRichTextTab, setActiveRichTextTab] = useState<string>('');
  React.useEffect(() => {
    if (!richTextTabs.length) {
      if (activeRichTextTab !== '') setActiveRichTextTab('');
      return;
    }
    const exists = richTextTabs.some((tab: { id: string; label: string }) => tab.id === activeRichTextTab);
    if (!exists) setActiveRichTextTab(richTextTabs[0].id);
  }, [richTextTabs, activeRichTextTab]);

  // Détecte si les segments ont changé et demande confirmation
  const segmentsHaveChanged = useMemo(() => {
    if (!isReallyEditing || !editingItem) return false;
    const oldSegments = editingItem._eventSegments || [];
    const newSegments = previewSegments;
    return JSON.stringify(oldSegments) !== JSON.stringify(newSegments);
  }, [previewSegments, editingItem, isReallyEditing]);

  // État pour gérer l'ouverture du modal d'édition des plages
  const [editingDateProp, setEditingDateProp] = useState<any>(null);

  // Navigation pile pour les items liés (drill-down relations)
  const [subItemStack, setSubItemStack] = useState<SubItemEntry[]>([]);
  const currentSubItem = subItemStack.length > 0 ? subItemStack[subItemStack.length - 1] : null;

  const navigateToRelatedItem = (propName: string, targetCollection: any, targetItem: any) => {
    setSubItemStack(prev => [...prev, { collection: targetCollection, item: targetItem, formData: { ...targetItem }, propName }]);
  };

  const navigateBack = () => {
    setSubItemStack(prev => prev.slice(0, -1));
  };

  const updateSubFormData = (key: string, value: any) => {
    setSubItemStack(prev => {
      if (!prev.length) return prev;
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], formData: { ...next[next.length - 1].formData, [key]: value } };
      return next;
    });
  };

  const saveSubItem = () => {
    if (!subItemStack.length || !onSaveRelatedItem) return;
    const top = subItemStack[subItemStack.length - 1];
    onSaveRelatedItem(top.collection.id, top.formData);
    navigateBack();
  };

  const timeOptions = useMemo(() => {
    const options: string[] = [];
    const minHour = Math.max(0, Math.floor(workDayStart - 1));
    const maxHour = Math.min(23, Math.ceil(workDayEnd + 1));
    for (let h = minHour; h <= maxHour; h++) {
      for (let m = 0; m < 60; m += 15) {
        if (h === maxHour && m > 0) continue;
        const hh = h.toString().padStart(2, '0');
        const mm = m.toString().padStart(2, '0');
        options.push(`${hh}:${mm}`);
      }
    }
    return options;
  }, []);

  const durationOptions = useMemo(
    () => Array.from({ length: 97 }, (_, i) => i * 0.25),
    []
  );

  const handleSave = (saveFn: (item: any) => void) => {
    if (!canWriteCollection(selectedCollectionId)) {
      alert('Vous n\'avez pas les droits pour modifier cette collection.');
      return;
    }
    disableDraftRef.current = true;
    setHasLocalDraft(false);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore stockage local indisponible
    }
    let dataToSave = { ...formData, __collectionId: selectedCollectionId };

    if (!isReallyEditing && (!dataToSave._eventSegments || dataToSave._eventSegments.length === 0) && previewSegments.length > 0) {
      dataToSave._eventSegments = previewSegments;
      dataToSave._preserveEventSegments = false;
    }

    if (!isReallyEditing && !dataToSave.id) {
      dataToSave.id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    try {
      const historyItemId = dataToSave.id || editingItem?.id;
      if (historyItemId) {
        const key = buildHistoryKey(selectedCollectionId, historyItemId);
        const raw = localStorage.getItem(key);
        const snapshot = sanitizeVersionData(dataToSave);
        const userName = user?.name || user?.email || 'Utilisateur';
        const userId = user?.id || null;
        const entryBase = {
          id: `v_${Date.now()}`,
          ts: new Date().toISOString(),
          userId,
          userName,
        };

        if (!raw) {
          const history = {
            base: snapshot,
            versions: [
              {
                ...entryBase,
                action: 'create',
                patch: { set: {}, unset: [] },
              },
            ],
          };
          localStorage.setItem(key, JSON.stringify(history));
          setHistoryData(history);
        } else {
          const parsed = JSON.parse(raw);
          const base = parsed?.base || {};
          const versions = Array.isArray(parsed?.versions) ? parsed.versions : [];
          const latest = versions.length
            ? buildSnapshotAt(base, versions, versions.length - 1)
            : base;
          const patch = computePatch(latest, snapshot);
          if (Object.keys(patch.set).length > 0 || patch.unset.length > 0) {
            const nextHistory = {
              base,
              versions: [
                ...versions,
                {
                  ...entryBase,
                  action: versions.length === 0 ? 'create' : 'update',
                  patch,
                },
              ],
            };
            localStorage.setItem(key, JSON.stringify(nextHistory));
            setHistoryData(nextHistory);
          }
        }
      }
    } catch {
      // ignore stockage local indisponible
    }

    if (!isReallyEditing && !dataToSave.id) {
      const { id, ...rest } = dataToSave;
      dataToSave = rest;
    }
    saveFn(dataToSave);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[200]"
        onClick={onClose}
      >
      {/* Style global pour masquer les flèches des input[type=number] */}
      <style>{`
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
      <motion.div
        initial={{ scale: 0.97, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="bg-background text-foreground border border-border rounded-2xl w-screen h-screen max-w-[1600px] max-h-[93vh] overflow-hidden flex flex-col shadow-[0_32px_80px_-8px_rgba(0,0,0,0.22)] dark:shadow-[0_32px_80px_-8px_rgba(0,0,0,0.8)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 px-8 py-5 border-b border-border bg-card/70 shrink-0">
          {/* Titre + badge collection */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              {!isReallyEditing ? (
                <>
                  <span className="text-[10px] tracking-widest uppercase text-muted-foreground font-medium shrink-0">Collection</span>
                  <select
                    className="text-[11px] px-2 py-0.5 rounded-md bg-background text-foreground border border-border focus:border-violet-500 focus:outline-none transition-colors"
                    value={selectedCollectionId}
                    onChange={handleCollectionChange}
                  >
                    {writableCollections.map((col: any) => (
                      <option key={col.id} value={col.id} className="bg-background text-foreground">{col.name}</option>
                    ))}
                  </select>
                </>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] tracking-widest uppercase font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  {selectedCollection?.name || 'Collection'}
                </span>
              )}
            </div>
            {classicPropsSansRichText.length > 0 && (
              <div className="[&_input]:text-[22px] [&_input]:font-semibold [&_input]:tracking-tight [&_input]:text-foreground [&_input]:placeholder:text-muted-foreground [&_input]:bg-transparent [&_input]:border-0 [&_input]:outline-none [&_input]:w-full [&_input]:p-0 [&_textarea]:text-[22px] [&_textarea]:font-semibold [&_textarea]:text-foreground">
                <EditableProperty
                  property={classicPropsSansRichText[0]}
                  value={formData[classicPropsSansRichText[0].id]}
                  onChange={(val) => handleChange(classicPropsSansRichText[0].id, val)}
                  size="xl"
                  collections={readableCollections}
                  collection={selectedCollection}
                  currentItem={formData}
                  onRelationChange={(property, item, value) => {
                    if (!canWriteField(selectedCollection?.id, property.id)) return;
                    if (property.type === 'relation' || property.type === 'multi_select') {
                      setFormData({ ...formData, [property.id]: value });
                    } else {
                      setFormData(item);
                    }
                  }}
                  readOnly={!canWriteField(selectedCollection?.id, classicPropsSansRichText[0].id)}
                  forceRichEditor={true}
                />
              </div>
            )}
          </div>
          {/* Actions droite */}
          <div className="flex items-center gap-2 pt-1 shrink-0">
            {hasLocalDraft && (
              <div className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Brouillon
              </div>
            )}
            {historyData?.versions?.length ? (
              <button
                onClick={() => setHistoryOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground border border-border hover:text-foreground hover:border-border/80 transition-all"
                title="Historique des versions"
              >
                <History size={11} />
                {historyData.versions.length}v
              </button>
            ) : null}
            {editingItem && onToggleFavoriteItem && (
              <button
                onClick={() => onToggleFavoriteItem(editingItem.id)}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  isFavorite
                    ? "text-amber-400 bg-amber-500/10"
                    : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                )}
                title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              >
                <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all ml-1"
              title="Fermer"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L12 12M12 1L1 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 px-8 py-7 z-10 relative overflow-y-auto">
          {currentSubItem ? (
            /* Panneau sous-item : drill-down relation */
            <div className="space-y-4">
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm mb-6">
                <button
                  type="button"
                  onClick={navigateBack}
                  className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 transition-colors font-medium"
                >
                  <ChevronLeft size={16} />
                  Retour
                </button>
                <span>/</span>
                <span>{currentSubItem.propName}</span>
                <span>/</span>
                <span className="font-medium text-neutral-200 truncate max-w-[200px]">
                  {(() => {
                    const titleProp = (currentSubItem.collection.properties || [])[0];
                    return titleProp ? currentSubItem.formData[titleProp.id] || 'Sans titre' : 'Sans titre';
                  })()}
                </span>
              </div>

              {/* Champs classiques */}
              <div className="space-y-0.5">
                {(currentSubItem.collection.properties || [])
                  .filter((p: any) => p.type !== 'relation')
                  .map((prop: any) => (
                    <div className="group/sub flex items-stretch rounded-lg hover:bg-white/[0.025] focus-within:bg-white/[0.03] transition-colors" key={prop.id}>
                      <div className="w-[150px] shrink-0 flex items-center px-3 py-2.5">
                        <label className="text-[10px] font-mono tracking-widest uppercase text-neutral-600 group-hover/sub:text-neutral-500 truncate transition-colors">
                          {prop.name}
                        </label>
                      </div>
                      <div className="flex-1 min-w-0 border-l border-white/[0.06] group-focus-within/sub:border-violet-500/40 transition-colors px-3 py-1.5 flex items-center">
                        <EditableProperty
                          property={prop}
                          value={currentSubItem.formData[prop.id]}
                          onChange={(val) => updateSubFormData(prop.id, val)}
                          size="md"
                          collections={readableCollections}
                          collection={currentSubItem.collection}
                          currentItem={currentSubItem.formData}
                          onRelationChange={(property, _item, value) => updateSubFormData(property.id, value)}
                        />
                      </div>
                    </div>
                  ))}
              </div>

              {/* Relations du sous-item */}
              {(currentSubItem.collection.properties || []).some((p: any) => p.type === 'relation') && (
                <div className="pt-4 space-y-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] tracking-widest uppercase font-medium text-neutral-600 shrink-0">Relations</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>
                  {(currentSubItem.collection.properties || [])
                    .filter((p: any) => p.type === 'relation')
                    .map((prop: any) => {
                      const targetCol = readableCollections.find((c: any) => c.id === prop.relation?.targetCollectionId);
                      return (
                        <div key={prop.id} className="group/rel flex items-stretch rounded-lg hover:bg-white/[0.025] transition-colors">
                          <div className="w-[150px] shrink-0 flex items-center px-3 py-2.5">
                            <label className="text-[10px] font-mono tracking-widest uppercase text-neutral-600 truncate">{prop.name}</label>
                          </div>
                          <div className="flex-1 min-w-0 border-l border-white/[0.06] px-3 py-1.5 flex items-center">
                            <EditableProperty
                              property={prop}
                              value={currentSubItem.formData[prop.id]}
                              onChange={(val) => updateSubFormData(prop.id, val)}
                              size="md"
                              collections={readableCollections}
                              collection={currentSubItem.collection}
                              currentItem={currentSubItem.formData}
                              onRelationChange={(property, _item, value) => updateSubFormData(property.id, value)}
                              onNavigateToRelatedItem={(item) => navigateToRelatedItem(prop.name, targetCol, item)}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Bouton enregistrer sous-item */}
              {onSaveRelatedItem && (
                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={saveSubItem}
                    className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
                  >
                    Enregistrer
                  </button>
                </div>
              )}
            </div>
          ) : (
          <div className="space-y-8">

          {/* Relations en haut sur toute la largeur */}
          {relationPropsForDisplay.length > 0 && (
            <div className="pb-8 mb-2">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] tracking-widest uppercase font-medium text-neutral-600 shrink-0">Relations</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <div className="flex gap-x-8 gap-y-3 items-center flex-wrap pl-2">
                {relationPropsForDisplay.map((prop: any) => (
                  <div className="flex items-center gap-3" key={prop.id}>
                    <label className="text-[10px] font-mono tracking-widest uppercase text-neutral-500 whitespace-nowrap">
                      {prop.name}{prop.required && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    <EditableProperty
                      property={prop}
                      value={formData[prop.id]}
                      onChange={(val) => handleChange(prop.id, val)}
                      size="md"
                      collections={readableCollections}
                      collection={selectedCollection}
                      currentItem={formData}
                      onRelationChange={(property, _item, value) => {
                        if (!canWriteField(selectedCollection?.id, property.id)) return;
                        setFormData({ ...formData, [property.id]: value });
                      }}
                      readOnly={!canWriteField(selectedCollection?.id, prop.id)}
                      onNavigateToRelatedItem={(item, targetCol) => navigateToRelatedItem(prop.name, targetCol, item)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid à 2 colonnes : champs classiques à gauche, horaires à droite */}
          <div className={`grid grid-cols-1 ${datePropsForDisplay.length > 0 ? 'xl:grid-cols-[1.6fr_0.55fr]' : ''} gap-8 relative`}>
          
          {/* Partie gauche : champs classiques */}
          {(detailsPropsForDisplay.length > 0 || !isReallyEditing) && (
          <div className="min-w-[0]">
            {detailsPropsForDisplay.length > 0 && (
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] tracking-widest uppercase font-medium text-neutral-600 shrink-0">Détails</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
            )}
            {detailsPropsForDisplay.length === 0 && !isReallyEditing && (
              <div className="text-neutral-600 text-sm">Aucun champ supplémentaire</div>
            )}
            {/* Rendu d'une ligne de champ — factorisé pour usage dans les groupes et hors-groupe */}
            {(() => {
              const renderFieldRow = (prop: any) => (
                <div
                  key={prop.id}
                  className="group/row flex items-stretch rounded-lg hover:bg-white/[0.025] focus-within:bg-white/[0.03] transition-colors duration-100"
                >
                  <div className="flex items-center w-[150px] shrink-0 overflow-hidden">
                    <label
                      id={`label-${prop.id}`}
                      className="block text-[10px] font-mono tracking-widest uppercase text-neutral-600 group-hover/row:text-neutral-500 whitespace-nowrap w-full px-3 py-2.5 transition-colors duration-100 truncate"
                      htmlFor={`field-${prop.id}`}
                    >
                      {prop.name}
                    </label>
                  </div>
                  <div className="flex-1 min-w-0 border-l border-white/[0.06] group-focus-within/row:border-violet-500/50 transition-colors duration-150 pl-3 pr-1 flex items-center">
                    <EditableProperty
                      property={prop}
                      value={formData[prop.id]}
                      onChange={(val) => handleChange(prop.id, val)}
                      size="md"
                      collections={readableCollections}
                      collection={selectedCollection}
                      currentItem={formData}
                      onRelationChange={(property, item, value) => {
                        if (!canWriteField(selectedCollection?.id, property.id)) return;
                        if (property.type === 'relation' || property.type === 'multi_select') {
                          setFormData({ ...formData, [property.id]: value });
                        } else {
                          setFormData(item);
                        }
                      }}
                      readOnly={!canWriteField(selectedCollection?.id, prop.id)}
                      forceRichEditor={true}
                    />
                  </div>
                </div>
              );

              // IDs de tous les champs affectés à au moins un groupe
              const allGroupedIds = new Set(fieldGroups.flatMap((g) => g.fieldIds));
              const ungroupedProps = detailsPropsForDisplay.filter((p: any) => !allGroupedIds.has(p.id));

              return (
                <div className="flex flex-col space-y-0.5">
                  {/* Champs non-groupés */}
                  {ungroupedProps.map(renderFieldRow)}

                  {/* Groupes de champs */}
                  {fieldGroups.map((group) => {
                    const groupProps = group.fieldIds
                      .map((fid) => detailsPropsForDisplay.find((p: any) => p.id === fid))
                      .filter(Boolean);
                    if (groupProps.length === 0) return null;
                    return (
                      <div key={group.id} className="pt-2">
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className="text-[9px] tracking-widest uppercase font-semibold text-neutral-700 shrink-0">{group.label}</span>
                          <div className="flex-1 h-px bg-white/[0.04]" />
                        </div>
                        <div className="flex flex-col space-y-0.5">
                          {groupProps.map(renderFieldRow)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          )}

          {/* Colonne droite : Plages horaires */}
          {datePropsForDisplay.length > 0 && (
          <div className="min-w-[0]">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] tracking-widest uppercase font-medium text-neutral-600 shrink-0">Horaires</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            <div className="space-y-4">
              {datePropsForDisplay.map((dateProp: any) => {
                const canWriteDateProp = canWriteField(selectedCollection?.id, dateProp.id);
                const segments = (formData._eventSegments || []).filter((seg: { label: any; }) => seg.label === dateProp.name);
                const autoSegments = previewSegments.filter((seg: { label: any; }) => seg.label === dateProp.name);
                
                // Résumé : nombre de plages et durée totale
                const getSegmentHours = (seg: any) => {
                  const start = new Date(seg.start || seg.__eventStart);
                  const end = new Date(seg.end || seg.__eventEnd);
                  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
                  const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  if (diffHours >= 0 && diffHours <= 24) return diffHours;
                  const startMinutes = start.getHours() * 60 + start.getMinutes();
                  const endMinutes = end.getHours() * 60 + end.getMinutes();
                  let minutes = endMinutes - startMinutes;
                  if (minutes < 0) minutes += 24 * 60;
                  return minutes / 60;
                };
                const totalDuration = segments.reduce((acc: number, seg: any) => acc + getSegmentHours(seg), 0);

                return (
                  <div key={`_eventSegments_${dateProp.id}`} className="rounded-xl border border-border bg-card/70 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-neutral-300">{dateProp.name}</span>
                      <button
                        onClick={() => {
                          if (!canWriteDateProp) return;
                          setEditingDateProp(dateProp);
                        }}
                        disabled={!canWriteDateProp}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-neutral-500 hover:text-violet-400 hover:bg-violet-500/10 rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Edit2 size={11} />
                        Modifier
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <div className="relative group/seg">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-violet-400" />
                          <span className="text-neutral-400">{segments.length || 0} plage{segments.length > 1 ? 's' : ''}</span>
                        </div>
                        {segments.length > 0 && (
                          <div className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-border bg-popover p-3 text-xs text-popover-foreground opacity-0 group-hover/seg:opacity-100 transition-opacity z-20 pointer-events-none group-hover/seg:pointer-events-auto shadow-xl">
                            <div className="text-[10px] tracking-widest uppercase text-muted-foreground mb-2">Plages personnalisées</div>
                            <div className="space-y-1.5">
                              {segments.map((seg: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-violet-400">▸</span>
                                  {formatSegmentDisplay(seg)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {segments.length > 0 && (
                        <>
                          <span className="text-neutral-700">·</span>
                          <span className="text-neutral-400">{totalDuration.toFixed(1)}h</span>
                        </>
                      )}
                    </div>
                    {autoSegments.length > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="mt-3 flex items-center gap-1.5 text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
                            <span>Plages auto ({autoSegments.length})</span>
                            {segmentsHaveChanged && isReallyEditing && (
                              <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded text-[10px]">Modifié</span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 bg-popover border-border text-popover-foreground">
                          <div className="space-y-2">
                            <div className="text-[10px] tracking-widest uppercase text-violet-400 mb-3">Plages calculées auto</div>
                            {autoSegments.map((seg: any, idx: number) => (
                              <div key={idx} className="text-xs text-neutral-400 flex items-center gap-2">
                                <span className="text-violet-400">▸</span>
                                {formatSegmentDisplay(seg)}
                              </div>
                            ))}
                            {isReallyEditing && segmentsHaveChanged && (
                              <button
                                type="button"
                                className="mt-3 w-full px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors"
                                disabled={!canWriteDateProp}
                                onClick={() => {
                                  if (!canWriteDateProp) return;
                                  const oldManualSegs = (formData._eventSegments || []).filter((seg: { label: any; }) => seg.label !== dateProp.name);
                                  setFormData({ ...formData, _eventSegments: [...oldManualSegs, ...autoSegments], _preserveEventSegments: false });
                                }}
                              >
                                Appliquer ces plages
                              </button>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          )}
          </div>

          {/* Rich text en pleine largeur sur les deux colonnes */}
          {richTextPropsForDisplay.length > 0 && (
            <div className="pt-2">
              <div className="relative space-y-4">
                {richTextTabs.length > 1 ? (
                  <div className="flex items-center gap-0 border-b border-border mb-1">
                    {richTextTabs.map((tab: { id: string; label: string }) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveRichTextTab(tab.id)}
                        className={cn(
                          "px-3 py-2 text-xs font-medium transition-all border-b-2 -mb-px",
                          activeRichTextTab === tab.id
                            ? "border-violet-500 text-violet-300"
                            : "border-transparent text-neutral-600 hover:text-neutral-300"
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] tracking-widest uppercase font-medium text-neutral-600 shrink-0">{richTextTabs[0]?.label || 'Notes'}</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>
                )}
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 min-h-[180px]">
                  {richTextPropsForDisplay
                    .filter((prop: any) => !activeRichTextTab || prop.id === activeRichTextTab)
                    .map((prop: any) => (
                      <div key={prop.id} className="pb-6 last:pb-0">
                        <EditableProperty
                          property={prop}
                          value={formData[prop.id]}
                          onChange={(val) => handleChange(prop.id, val)}
                          size="md"
                          collections={readableCollections}
                          collection={selectedCollection}
                          currentItem={formData}
                          readOnly={!canWriteField(selectedCollection?.id, prop.id)}
                          forceRichEditor={true}
                        />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
          </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-8 py-4 border-t border-border shrink-0">
          <div className="flex items-center gap-3">
            {isReallyEditing && onDelete && editingItem?.id && (
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    className="px-3 py-2 text-xs font-medium text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 hover:border-red-500/40 transition-all"
                  >
                    Supprimer
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cet objet ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. L’objet sera supprimé définitivement.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="mt-6">
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        onDelete(editingItem.id);
                        onClose();
                      }}
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-all"
            >
              Annuler
            </button>
            {isReallyEditing && (
              <button
                type="button"
                onClick={() => handleSave(onSaveAndStay || onSave)}
                className="px-4 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted hover:border-border transition-all"
              >
                Enregistrer
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSave(onSave)}
              className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-all shadow-lg shadow-violet-500/20"
            >
              {isReallyEditing ? 'Enregistrer et quitter' : 'Créer'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Modal d'édition des plages horaires */}
      {editingDateProp && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[300]"
          onClick={() => setEditingDateProp(null)}
        >
          <motion.div
            initial={{ scale: 0.97, opacity: 0, y: 4 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-foreground">Modifier les plages · {editingDateProp.name}</h3>
              <button
                onClick={() => setEditingDateProp(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-5">
                <button
                  onClick={() => {
                    const segs = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                    const now = new Date();
                    const start = now.toISOString();
                    const end = new Date(now.getTime() + 60*60*1000).toISOString();
                    segs.push({ start, end, label: editingDateProp.name });
                    setManualSegments(segs);
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-violet-400 border border-violet-500/30 rounded-lg hover:bg-violet-500/10 hover:border-violet-500/50 transition-all"
                >
                  + Ajouter une plage
                </button>
              </div>

              {(() => {
                const segments = (formData._eventSegments || []).filter((seg: { label: any; }) => seg.label === editingDateProp.name);
                if (!segments || segments.length === 0) {
                  return <div className="text-neutral-500 text-sm">Aucune plage personnalisée</div>;
                }
                const segmentsByDay: Record<string, any[]> = {};
                segments.forEach((seg: any) => {
                  const dayKey = new Date(seg.start || seg.__eventStart).toLocaleDateString('fr-FR');
                  if (!segmentsByDay[dayKey]) segmentsByDay[dayKey] = [];
                  segmentsByDay[dayKey].push(seg);
                });
                return (
                  <div className="space-y-4">
                    {Object.entries(segmentsByDay).map(([day, segs]) => (
                      <div key={day}>
                        <div className="font-semibold text-sm text-muted-foreground mb-2">{day}</div>
                        <ul className="space-y-2">
                          {segs.map((seg: any, idx: number) => {
                            const startDate = new Date(seg.start || seg.__eventStart);
                            const endDate = new Date(seg.end || seg.__eventEnd);
                            const durationMinutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
                            const durationHoursValue = Math.round((durationMinutes / 60) * 4) / 4;
                            const currentTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;

                            return (
                              <li key={idx} className="p-3 rounded-xl border border-border bg-card/60">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_130px_130px] gap-3 items-end">
                                    <div>
                                      <label className="block text-[10px] tracking-widest uppercase text-muted-foreground mb-1.5">Date</label>
                                      <input
                                        type="date"
                                        value={startDate.toISOString().slice(0, 10)}
                                        onChange={e => {
                                          const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                          const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                          if (globalIdx !== -1) {
                                            const start = new Date(seg.start || seg.__eventStart);
                                            const [year, month, day] = e.target.value.split('-');
                                            start.setFullYear(Number(year), Number(month) - 1, Number(day));
                                            const newEnd = new Date(start.getTime() + durationMinutes * 60000);
                                            segsCopy[globalIdx] = { ...segsCopy[globalIdx], start: start.toISOString(), end: newEnd.toISOString() };
                                            setManualSegments(segsCopy);
                                          }
                                        }}
                                        className="w-full px-2.5 py-1.5 bg-background border border-border text-foreground text-xs rounded-lg focus:border-violet-500/60 focus:outline-none transition-colors"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] tracking-widest uppercase text-muted-foreground mb-1.5">Heure</label>
                                      <select
                                        value={currentTime}
                                        onChange={e => {
                                          const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                          const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                          if (globalIdx !== -1) {
                                            const [hours, minutes] = e.target.value.split(':');
                                            const start = new Date(seg.start || seg.__eventStart);
                                            start.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                                            const newEnd = new Date(start.getTime() + durationMinutes * 60000);
                                            segsCopy[globalIdx] = { ...segsCopy[globalIdx], start: start.toISOString(), end: newEnd.toISOString() };
                                            setManualSegments(segsCopy);
                                          }
                                        }}
                                        className="w-full px-2.5 py-1.5 bg-background border border-border text-foreground text-xs rounded-lg focus:border-violet-500/60 focus:outline-none transition-colors"
                                      >
                                        {timeOptions.map(opt => (
                                          <option key={opt} value={opt} className="bg-[#111113]">
                                            {opt}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] tracking-widest uppercase text-muted-foreground mb-1.5">Durée</label>
                                      <select
                                        value={durationHoursValue}
                                        onChange={e => {
                                          const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                          const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                          if (globalIdx !== -1) {
                                            const start = new Date(seg.start || seg.__eventStart);
                                            const newDurationHours = parseFloat(e.target.value) || 0;
                                            const newEnd = new Date(start.getTime() + newDurationHours * 60 * 60000);
                                            segsCopy[globalIdx] = { ...segsCopy[globalIdx], end: newEnd.toISOString() };
                                            setManualSegments(segsCopy);
                                          }
                                        }}
                                        className="w-full px-2.5 py-1.5 bg-background border border-border text-foreground text-xs rounded-lg focus:border-violet-500/60 focus:outline-none transition-colors"
                                      >
                                        {durationOptions.map(dur => {
                                          const hours = Math.floor(dur);
                                          const mins = Math.round((dur % 1) * 60);
                                          const label = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                                          return (
                                            <option key={dur} value={dur} className="bg-[#111113]">
                                              {label}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  </div>
                                  <button
                                    className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors shrink-0"
                                    onClick={() => {
                                      const segsCopy = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                                      const globalIdx = formData._eventSegments.findIndex((s: any) => s === seg);
                                      if (globalIdx !== -1) {
                                        segsCopy.splice(globalIdx, 1);
                                        setManualSegments(segsCopy);
                                      }
                                    }}
                                    type="button"
                                    title="Supprimer la plage"
                                  >
                                    <Trash2 size={14} className="text-red-400" />
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end shrink-0">
              <button
                onClick={() => setEditingDateProp(null)}
                className="px-4 py-2 text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </div>
      <Dialog open={templateDialogOpen} onOpenChange={(open) => (open ? setTemplateDialogOpen(true) : handleTemplateDialogCancel())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appliquer les templates</DialogTitle>
            <DialogDescription>
              Sélectionne les champs à mettre à jour.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {templateDialogItems.map((item: any) => (
              <label key={item.targetKey} className="flex items-start gap-3 rounded-md border border-border p-3 bg-background">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={templateDialogSelection[item.targetKey] ?? false}
                  onChange={(e) =>
                    setTemplateDialogSelection((prev) => ({
                      ...prev,
                      [item.targetKey]: e.target.checked,
                    }))
                  }
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">
                    {item.propName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <span className="font-semibold">Actuel :</span> {formatValueForDisplay(item.currentValue)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold">Nouveau :</span> {formatValueForDisplay(item.desiredValue)}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleTemplateDialogCancel}>Annuler</Button>
            <Button onClick={handleTemplateDialogConfirm}>Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={draftPromptOpen} onOpenChange={setDraftPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Brouillon local détecté</DialogTitle>
            <DialogDescription>
              Un brouillon existe pour cet item. Voulez-vous l’appliquer ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={discardDraftPayload}>Ignorer</Button>
            <Button onClick={applyDraftPayload}>Appliquer le brouillon</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Historique des versions</DialogTitle>
            <DialogDescription>
              Versions locales avec auteur et changements.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh]">
            {(!historyData || historyData.versions.length === 0) && (
              <div className="text-xs text-neutral-500">Aucune version disponible.</div>
            )}
            {historyData && historyData.versions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span>
                    {new Date(historyData.versions[0].ts).toLocaleString('fr-FR')}
                  </span>
                  <span>
                    {new Date(historyData.versions[historyData.versions.length - 1].ts).toLocaleString('fr-FR')}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={historyData.versions.length - 1}
                  value={historySelectedIndex ?? historyData.versions.length - 1}
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    setHistorySelectedIndex(idx);
                    const snapshot = buildSnapshotAt(historyData.base, historyData.versions, idx);
                    setHistoryPreview(snapshot);
                  }}
                  className="w-full"
                />
                {historySelectedIndex !== null && (
                  <div className="text-xs text-neutral-500">
                    Version {historySelectedIndex + 1} / {historyData.versions.length}
                  </div>
                )}
              </div>
            )}
            <div className="border border-border rounded-lg p-3 overflow-y-auto max-h-[45vh] bg-background">
              {historySelectedIndex === null || !historyData || !historyPreview ? (
                <div className="text-sm text-neutral-500">Sélectionne une version pour voir le détail.</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Changements</div>
                      <div className="text-xs text-neutral-500">
                        {new Date(historyData.versions[historySelectedIndex].ts).toLocaleString('fr-FR')} · {historyData.versions[historySelectedIndex].userName || 'Utilisateur'}
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        setFormData(historyPreview);
                        setHistoryOpen(false);
                      }}
                    >
                      Restaurer cette version
                    </Button>
                  </div>
                  {(() => {
                    const ver = historyData.versions[historySelectedIndex];
                    const prevSnapshot = historySelectedIndex > 0
                      ? buildSnapshotAt(historyData.base, historyData.versions, historySelectedIndex - 1)
                      : historyData.base;
                    const currSnapshot = historyPreview;
                    const keys = Array.from(
                      new Set([
                        ...Object.keys(prevSnapshot || {}),
                        ...Object.keys(currSnapshot || {}),
                      ])
                    );
                    const changes = keys
                      .map((key) => ({
                        key,
                        before: prevSnapshot ? prevSnapshot[key] : undefined,
                        after: currSnapshot ? currSnapshot[key] : undefined,
                      }))
                      .filter(({ before, after }) => !areValuesEqual(before, after));

                    if (changes.length === 0) {
                      return <div className="text-xs text-neutral-500">Aucun changement enregistré.</div>;
                    }

                    return (
                      <div className="space-y-3 text-xs">
                        <div className="text-[11px] text-neutral-500">
                          {ver.action === 'create' ? 'Diff initial' : 'Diff vs version précédente'}
                        </div>
                        {changes.map(({ key, before, after }) => {
                          const isRich = isRichTextValue(before) || isRichTextValue(after);
                          if (isRich) {
                            let beforeDoc = before;
                            let afterDoc = after;
                            try {
                              if (typeof before === 'string') beforeDoc = JSON.parse(before);
                            } catch {
                              beforeDoc = before;
                            }
                            try {
                              if (typeof after === 'string') afterDoc = JSON.parse(after);
                            } catch {
                              afterDoc = after;
                            }
                            const beforeText = serializeTiptapLines(beforeDoc) || extractTextFromTiptap(beforeDoc);
                            const afterText = serializeTiptapLines(afterDoc) || extractTextFromTiptap(afterDoc);
                            const lineDiff = diffLines(beforeText, afterText);
                            return (
                              <div key={key} className="rounded-md border border-border p-2 bg-muted/20">
                                <div className="font-semibold text-foreground mb-1">{key}</div>
                                {lineDiff.length === 0 ? (
                                  <div className="text-xs text-neutral-500">Aucun changement de lignes.</div>
                                ) : (
                                  <div className="space-y-1">
                                    {lineDiff.map((entry, idx) => (
                                      <div
                                        key={`${key}-${idx}`}
                                        className={cn(
                                          'rounded px-2 py-1 border text-xs',
                                          entry.type === 'add'
                                            ? 'bg-green-500/10 border-green-500/20 text-green-600'
                                            : 'bg-red-500/10 border-red-500/20 text-red-600'
                                        )}
                                      >
                                        {entry.type === 'add' ? '+' : '-'} {entry.text}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div key={key} className="rounded-md border border-border p-2 bg-muted/20">
                              <div className="font-semibold text-foreground mb-1">{key}</div>
                              <div className="grid grid-cols-1 gap-2">
                                <div className="bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
                                  <div className="text-[10px] uppercase text-red-500 mb-1">Avant</div>
                                  <div className="text-muted-foreground">
                                    {formatValueForDisplay(before)}
                                  </div>
                                </div>
                                <div className="bg-green-500/10 border border-green-500/20 rounded px-2 py-1">
                                  <div className="text-[10px] uppercase text-green-500 mb-1">Après</div>
                                  <div className="text-muted-foreground">
                                    {formatValueForDisplay(after)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NewItemModal;
