import React, { useState, useMemo, useRef } from 'react';
// Mini composant Tabs local
function Tabs({ tabs, active, onTab, className = "" }: { tabs: string[], active: string, onTab: (tab: string) => void, className?: string }) {
  return (
    <div className={"flex gap-2 border-b border-black/10 dark:border-white/10 mb-4 flex-wrap " + className}>
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onTab(tab)}
          className={
            "px-3 py-1 rounded-t text-sm font-medium transition-all duration-300 " +
            (active === tab ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-black dark:hover:text-white")
          }
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
import { motion } from 'framer-motion';
import { Star, Trash2, Clock, Edit2, History } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import EditableProperty from '@/components/fields/EditableProperty';
import { calculateSegmentsClient, formatSegmentDisplay } from '@/lib/calculateSegmentsClient';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { workDayStart, workDayEnd } from '@/lib/calendarUtils';
import { useAuth } from '@/auth/AuthProvider';


interface NewItemModalProps {
  collection: any;
  onClose: () => void;
  onSave: (item: any) => void;
  editingItem: any;
  collections: any[];
  favorites?: { views: string[]; items: string[] };
  onToggleFavoriteItem?: (itemId: string) => void;
  orderedProperties?: any[];
}


const NewItemModal: React.FC<NewItemModalProps> = ({
  collection,
  onClose,
  onSave,
  editingItem,
  collections,
  favorites,
  onToggleFavoriteItem,
  orderedProperties
}) => {
  // Ajout d'un sélecteur de collection (pour création uniquement)
  const [selectedCollectionId, setSelectedCollectionId] = useState(collection.id);
  const selectedCollection = collections.find((c: any) => c.id === selectedCollectionId) || collection;
  const isReallyEditing = Boolean(editingItem && editingItem.id);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateDialogItems, setTemplateDialogItems] = useState<any[]>([]);
  const [templateDialogSelection, setTemplateDialogSelection] = useState<Record<string, boolean>>({});
  const [templateDialogPayload, setTemplateDialogPayload] = useState<{ nextData: any; nextAutoFilled: Record<string, boolean> } | null>(null);
  const [templateDialogNeedsSegments, setTemplateDialogNeedsSegments] = useState(false);
  const { user } = useAuth();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<{ base: any; versions: any[] } | null>(null);
  const [historySelectedIndex, setHistorySelectedIndex] = useState<number | null>(null);
  const [historyPreview, setHistoryPreview] = useState<any | null>(null);

  const isEmptyTiptapDoc = (doc: any) => {
    if (!doc || doc.type !== 'doc') return false;
    const hasText = (node: any): boolean => {
      if (!node) return false;
      if (typeof node.text === 'string' && node.text.trim() !== '') return true;
      if (Array.isArray(node.content)) return node.content.some(hasText);
      return false;
    };
    return !hasText(doc);
  };

  const isEmptyValue = (val: any) => {
    if (val === null || val === undefined) return true;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return true;
      try {
        const parsed = JSON.parse(trimmed);
        if (isEmptyTiptapDoc(parsed)) return true;
      } catch {
        // ignore JSON parse errors
      }
      return false;
    }
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === 'object' && isEmptyTiptapDoc(val)) return true;
    return false;
  };

  const areValuesEqual = (a: any, b: any) => {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  };

  const extractTextFromTiptap = (doc: any): string => {
    if (!doc || doc.type !== 'doc') return '';
    let text = '';
    const walk = (node: any) => {
      if (!node || text.includes('\n')) return;
      if (typeof node.text === 'string') text += node.text;
      if (Array.isArray(node.content)) node.content.forEach((child: any) => walk(child));
      if (node.type && text && !text.endsWith('\n')) {
        if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem' || node.type === 'taskItem') {
          text += '\n';
        }
      }
    };
    walk(doc);
    return (text.split('\n').find((line) => line.trim() !== '') || '').trim();
  };

  const formatValueForDialog = (val: any) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'number') return `${val}`;
    if (typeof val === 'boolean') return val ? 'Oui' : 'Non';
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return '—';
      try {
        const parsed = JSON.parse(trimmed);
        const tiptapText = extractTextFromTiptap(parsed);
        if (tiptapText) return tiptapText;
      } catch {
        // ignore JSON parse errors
      }
      return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
    }
    if (typeof val === 'object' && val.type === 'doc') {
      const tiptapText = extractTextFromTiptap(val);
      return tiptapText || '—';
    }
    try {
      const str = JSON.stringify(val);
      return str.length > 80 ? `${str.slice(0, 80)}…` : str;
    } catch {
      return '—';
    }
  };

  const getMatchingTemplate = (prop: any, data: any, sourceFieldId?: string) => {
    const templates = Array.isArray(prop.defaultTemplates) ? prop.defaultTemplates : [];
    const defaultTemplate = templates.find((template: any) => template?.isDefault);

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

    if (!sourceFieldId) return defaultTemplate || null;
    return null;
  };

  const applyTemplates = (
    data: any,
    sourceFieldId?: string,
    autoFilledMap: Record<string, boolean> = {},
    allowPrompt = false
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
      const match = getMatchingTemplate(prop, nextData, sourceFieldId);
      if (!match) return;

      const desiredValue = match.value;
      const targetKey = prop.type === 'date' || prop.type === 'date_range'
        ? `${prop.id}_duration`
        : prop.id;
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

  function getRoundedNow() {
    const now = new Date();
    const minutes = now.getMinutes();
    const rounded = Math.round(minutes / 15) * 15;
    now.setMinutes(rounded);
    now.setSeconds(0);
    now.setMilliseconds(0);
    return now;
  }

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

  const computePatch = (prev: any, next: any) => {
    const set: Record<string, any> = {};
    const unset: string[] = [];
    const prevObj = prev || {};
    const nextObj = next || {};
    const prevKeys = Object.keys(prevObj);
    const nextKeys = Object.keys(nextObj);

    nextKeys.forEach((key) => {
      if (!areValuesEqual(prevObj[key], nextObj[key])) {
        set[key] = nextObj[key];
      }
    });

    prevKeys.forEach((key) => {
      if (!(key in nextObj)) unset.push(key);
    });

    return { set, unset };
  };

  const applyPatch = (base: any, patch: { set: Record<string, any>; unset: string[] }) => {
    const next = { ...(base || {}) } as any;
    Object.entries(patch.set || {}).forEach(([key, value]) => {
      next[key] = value;
    });
    (patch.unset || []).forEach((key) => {
      delete next[key];
    });
    return next;
  };

  const buildSnapshotAt = (base: any, versions: any[], index: number) => {
    let snapshot = { ...(base || {}) } as any;
    for (let i = 0; i <= index; i += 1) {
      snapshot = applyPatch(snapshot, versions[i].patch || { set: {}, unset: [] });
    }
    return snapshot;
  };

  const isRichTextValue = (val: any) => {
    if (!val) return false;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed) return false;
      try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === 'object' && parsed.type === 'doc';
      } catch {
        return false;
      }
    }
    return typeof val === 'object' && val.type === 'doc';
  };

  const diffLines = (before: string, after: string) => {
    const a = (before || '').split('\n');
    const b = (after || '').split('\n');
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i += 1) {
      for (let j = 1; j <= n; j += 1) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    const result: { type: 'add' | 'remove'; text: string }[] = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        i -= 1;
        j -= 1;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        result.push({ type: 'add', text: b[j - 1] });
        j -= 1;
      } else if (i > 0) {
        result.push({ type: 'remove', text: a[i - 1] });
        i -= 1;
      }
    }
    return result.reverse().filter((entry) => entry.text.trim() !== '');
  };

  const serializeTiptapLines = (doc: any): string => {
    if (!doc || doc.type !== 'doc') return '';
    const lines: string[] = [];

    const extractNodeText = (node: any): string => {
      if (!node) return '';
      if (typeof node.text === 'string') return node.text;
      if (Array.isArray(node.content)) {
        return node.content.map((child: any) => extractNodeText(child)).join('');
      }
      return '';
    };

    const walk = (node: any) => {
      if (!node) return;
      if (node.type === 'taskItem') {
        const checked = node.attrs?.checked ? '[x] ' : '[ ] ';
        const text = extractNodeText(node);
        lines.push(`${checked}${text}`.trimEnd());
        return;
      }
      if (node.type === 'listItem') {
        const text = extractNodeText(node);
        lines.push(`- ${text}`.trimEnd());
        return;
      }
      if (node.type === 'heading') {
        const level = node.attrs?.level || 1;
        const text = extractNodeText(node);
        lines.push(`${'#'.repeat(level)} ${text}`.trimEnd());
        return;
      }
      if (node.type === 'paragraph') {
        const text = extractNodeText(node);
        lines.push(text.trimEnd());
        return;
      }
      if (Array.isArray(node.content)) {
        node.content.forEach((child: any) => walk(child));
      }
    };

    walk(doc);
    return lines.filter((line) => line.trim() !== '').join('\n');
  };

  // Fusionne l'item prérempli (editingItem) avec les valeurs par défaut
  function getInitialFormData(col = selectedCollection, prefill: any = editingItem) {
    const data: any = { ...(prefill || {}) };
    const autoFilled: Record<string, boolean> = {};
    const props = orderedProperties && orderedProperties.length > 0 ? orderedProperties : col.properties;
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
      let currentData = { ...data };
      let currentAutoFilled = { ...autoFilled };
      for (let i = 0; i < 3; i += 1) {
        const { nextData, nextAutoFilled } = applyTemplates(currentData, undefined, currentAutoFilled, false) as any;
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



  const initialForm = useMemo(
    () => getInitialFormData(selectedCollection, editingItem),
    [selectedCollection, editingItem, orderedProperties]
  );
  const [templateAutoFilled, setTemplateAutoFilled] = useState<Record<string, boolean>>(initialForm.autoFilled);
  const [formData, setFormDataRaw] = useState(initialForm.data);
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [draftPayload, setDraftPayload] = useState<{ formData: any; templateAutoFilled?: Record<string, boolean> } | null>(null);
  const initialDataRef = useRef(initialForm.data);
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
      setDraftPayload({ formData: parsed.formData, templateAutoFilled: parsed.templateAutoFilled });
      setDraftPromptOpen(true);
    } catch {
      // ignore stockage local indisponible
      initialDataRef.current = initialForm.data;
      setFormDataRaw(initialForm.data);
      setTemplateAutoFilled(initialForm.autoFilled);
    } finally {
      draftReadyRef.current = true;
    }
  }, [draftKey, selectedCollectionId, initialForm]);

  const isDraftDirty = useMemo(
    () => !areValuesEqual(formData, initialDataRef.current),
    [formData]
  );

  const applyDraftPayload = React.useCallback(() => {
    if (!draftPayload) return;
    draftAppliedRef.current = true;
    setFormDataRaw(draftPayload.formData);
    if (draftPayload.templateAutoFilled) {
      setTemplateAutoFilled(draftPayload.templateAutoFilled);
    }
    initialDataRef.current = draftPayload.formData;
    setDraftPromptOpen(false);
  }, [draftPayload]);

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
          selectedCollectionId,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch {
        // ignore stockage local indisponible
      }
    };
  }, [formData, templateAutoFilled, selectedCollectionId, draftKey, isDraftDirty]);

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
  }, [selectedCollection]);

  const handleChange = (propId: string, value: any) => {
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
      const prevCol = collections.find((c: any) => c.id === selectedCollectionId) || collection;
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
      const newCol = collections.find((c: any) => c.id === selectedCollectionId) || collection;
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
  }, [editingItem, selectedCollection]);

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
  const propsList = richTextFallback.reduce((acc: any[], prop: any) => {
    if (acc.some((p) => p.id === prop.id)) return acc;
    return [...acc, prop];
  }, basePropsList as any[]);
  const classicProps = propsList.filter((p: any) => p.type !== 'relation');
  const richTextProps = classicProps.filter((p: any) => p.type === 'rich_text');
  const classicPropsSansRichText = classicProps.filter((p: any) => p.type !== 'rich_text');
  const relationProps = propsList.filter((p: any) => p.type === 'relation');
  // Pour chaque champ de type 'date', créer un onglet dédié aux plages horaires
  const dateProps = propsList.filter((p: any) => p.type === 'date');
  const extraTabs = [
    { id: '__relations__', name: 'Relation', type: 'relation' },
    ...dateProps.map((p: any) => ({ id: `_eventSegments_${p.id}`, name: `${p.name}`, type: 'segments', dateProp: p })),
  ];
  const [activeTab, setActiveTab] = useState(extraTabs[0]?.id || '');

  // Calcule les segments prégénérés côté client (pour aperçu dans le modal)
  const previewSegments = useMemo(() => {
    return calculateSegmentsClient(formData, selectedCollection);
  }, [formData, selectedCollection]);

  // Détecte si les segments ont changé et demande confirmation
  const segmentsHaveChanged = useMemo(() => {
    if (!isReallyEditing || !editingItem) return false;
    const oldSegments = editingItem._eventSegments || [];
    const newSegments = previewSegments;
    return JSON.stringify(oldSegments) !== JSON.stringify(newSegments);
  }, [previewSegments, editingItem, isReallyEditing]);

  // État pour gérer l'ouverture du modal d'édition des plages
  const [editingDateProp, setEditingDateProp] = useState<any>(null);

  const timeOptions = useMemo(() => {
    const options: string[] = [];
    const minHour = Math.max(0, workDayStart - 1);
    const maxHour = Math.min(23, workDayEnd + 1);
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

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]"
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
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 border border-black/10 dark:border-white/10 rounded-none w-screen h-screen max-w-[1600px] max-h-[90%] overflow-hidden backdrop-blur flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-8 py-5 border-b border-black/10 dark:border-white/10 bg-white/90 dark:bg-neutral-950/80 backdrop-blur">
          <div className="flex-1 max-w-3xl">
            {classicPropsSansRichText.length > 0 && (
              <EditableProperty
                property={classicPropsSansRichText[0]}
                value={formData[classicPropsSansRichText[0].id]}
                onChange={(val) => handleChange(classicPropsSansRichText[0].id, val)}
                size="xl"
                collections={collections}
                collection={collection}
                currentItem={formData}
                onRelationChange={(property, item, value) => {
                  if (property.type === 'relation' || property.type === 'multi_select') {
                    setFormData({ ...formData, [property.id]: value });
                  } else {
                    setFormData(item);
                  }
                }}
                readOnly={false}
                forceRichEditor={true}
              />
            )}
          </div>
          {!isReallyEditing && (
            <div className="gap-3 flex items-center">
              <label className="block text-xs font-medium text-neutral-500">Collection</label>
              <select
                className="px-3 py-2 rounded-lg bg-neutral-800 text-white border border-black/10 dark:border-white/10 focus:border-violet-500"
                value={selectedCollectionId}
                onChange={handleCollectionChange}
              >
                {collections.map((col: any) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>
          )}
          {(hasLocalDraft || historyData?.versions?.length) && (
            <div className="ml-3 flex items-center gap-2">
              {hasLocalDraft && (
                <div className="px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  Brouillon local
                </div>
              )}
              {historyData?.versions?.length ? (
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-slate-500/10 text-slate-600 dark:text-slate-300 border border-slate-500/20"
                  title="Historique des versions"
                >
                  <History size={12} />
                  {historyData.versions.length} version{historyData.versions.length > 1 ? 's' : ''}
                </button>
              ) : null}
            </div>
          )}
          {editingItem && onToggleFavoriteItem && (
            <button
              onClick={() => onToggleFavoriteItem(editingItem.id)}
              className={cn(
                "p-2 rounded-lg transition-all",
                isFavorite 
                  ? "text-yellow-500 hover:text-yellow-400 bg-yellow-500/10" 
                  : "text-neutral-500 hover:text-yellow-500 hover:bg-yellow-500/10"
              )}
              title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            >
              <Star size={20} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          )}
        </div>
        <div className="flex-1 px-8 py-6 pt-10 z-10 relative overflow-y-auto bg-white dark:bg-transparent">
          <div className="space-y-6">
          
          {/* Relations en haut sur toute la largeur */}
          {relationProps.length > 0 && (
            <div className="pb-10 border-b border-black/10 dark:border-white/10">
              <div className="border-t border-black/10 dark:border-white/10 pt-8 relative">
                <h4 className="absolute -top-3 left-0 px-4 py-1 rounded-full inline-block bg-background dark:bg-neutral-900 text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-4 uppercase tracking-wide">Relations</h4>
              </div>
              <div className="flex gap-4 items-center flex-wrap pl-4">
                {relationProps.map((prop: any) => (
                  <div className="flex items-center gap-3" key={prop.id}>
                    <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                      {prop.name} {prop.required && <span className="text-red-500">*</span>}
                    </label>
                    <EditableProperty
                      property={prop}
                      value={formData[prop.id]}
                      onChange={(val) => handleChange(prop.id, val)}
                      size="md"
                      collections={collections}
                      collection={collection}
                      currentItem={formData}
                      onRelationChange={(property, item, value) => {
                        setFormData({ ...formData, [property.id]: value });
                      }}
                      readOnly={false}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid à 2 colonnes : champs classiques à gauche, horaires à droite */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_0.6fr] gap-6 relative">
          
          {/* Partie gauche : champs classiques */}
          <div className="min-w-[0]">
            <h4 className="absolute -top-[35px] left-0 px-4 py-1 rounded-full inline-block bg-background dark:bg-neutral-900 text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-4 uppercase tracking-wide">Détails</h4>

            {/* Grande barre verticale à droite des labels */}
            <div
              className="pointer-events-none absolute top-0 left-[130px] w-[1px] h-full rounded bg-black/10 dark:bg-white/10 transition-colors duration-100 z-10"
              id="big-label-bar"
            >
              {/* Petites barres alignées à chaque label (calcul dynamique) */}
              {classicPropsSansRichText.slice(1).map((prop: any) => (
                <div
                  key={prop.id}
                  id={`mini-bar-${prop.id}`}
                  className="absolute left-0 w-full h-[32px] rounded bg-black/0 dark:bg-white/0 transition-colors duration-100"
                  style={{ top: 0 }}
                  ref={el => {
                    if (!el) return;
                    const label = document.getElementById(`label-${prop.id}`);
                    if (label) {
                      const parent = el.parentElement?.parentElement;
                      const parentRect = parent?.getBoundingClientRect();
                      const rect = label.getBoundingClientRect();
                      if (parentRect) {
                        el.style.top = `${rect.top - parentRect.top}px`;
                        el.style.height = `${rect.height}px`;
                      }
                    }
                  }}
                />
              ))}
            </div>
            {classicPropsSansRichText.length <= 1 && (
              <div className="text-neutral-500 text-sm">Aucun champ classique supplémentaire</div>
            )}
            <div
              className="flex flex-col space-y-3 group/classic-fields"
            >
              {classicPropsSansRichText.slice(1).map((prop: any) => (
                <div
                  key={prop.id}
                  className="flex gap-0 items-stretch group/item focus-within:z-10 py-2 border-b border-black/10 dark:border-white/10 last:border-b-0"
                  onMouseOver={() => {
                    const mini = document.getElementById(`mini-bar-${prop.id}`);
                    if (mini) mini.style.background = 'rgba(255,255,255,0.15)';
                  }}
                  onMouseOut={() => {
                    const mini = document.getElementById(`mini-bar-${prop.id}`);
                    if (mini) mini.style.background = 'rgba(255,255,255,0)';
                  }}
                  onFocusCapture={() => {
                    const mini = document.getElementById(`mini-bar-${prop.id}`);
                    if (mini) mini.style.background = 'rgba(255,255,255,0.15)';
                  }}
                  onBlurCapture={() => {
                    const mini = document.getElementById(`mini-bar-${prop.id}`);
                    if (mini) mini.style.background = 'rgba(255,255,255,0)';
                  }}
                >
                  <div className="flex items-center w-[130px] overflow-hidden">
                    <label
                      id={`label-${prop.id}`}
                      className={
                        "block text-sm font-medium text-neutral-700 dark:text-neutral-300 whitespace-nowrap w-full px-3 py-2 transition-colors duration-100"
                      }
                      htmlFor={`field-${prop.id}`}
                    >
                      {prop.name}
                    </label>
                  </div>
                  <div className="flex-1 pl-4 flex items-center">
                    <EditableProperty
                      property={prop}
                      value={formData[prop.id]}
                      onChange={(val) => handleChange(prop.id, val)}
                      size="md"
                      collections={collections}
                      collection={collection}
                      currentItem={formData}
                      onRelationChange={(property, item, value) => {
                        if (property.type === 'relation' || property.type === 'multi_select') {
                          setFormData({ ...formData, [property.id]: value });
                        } else {
                          setFormData(item);
                        }
                      }}
                      readOnly={false}
                      forceRichEditor={true}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Colonne droite : Plages horaires */}
          <div className="min-w-[0] relative">
            <div className="mb-4">
              <h4 className="absolute -top-[35px] -left-2 px-4 py-1 rounded-full inline-block bg-background dark:bg-neutral-900 text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-4 uppercase tracking-wide">Horaires</h4>
            </div>
            <div className="space-y-6">
              {dateProps.length === 0 && (
                <div className="text-neutral-500 text-sm">Aucun champ date</div>
              )}
              {dateProps.map((dateProp: any) => {
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
                  <div key={`_eventSegments_${dateProp.id}`} className="pb-4 mb-4 border-b border-black/5 dark:border-white/5 last:border-0 last:pb-0 last:mb-0">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{dateProp.name}</label>
                      <button
                        onClick={() => setEditingDateProp(dateProp)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                      >
                        <Edit2 size={12} />
                        Modifier
                      </button>
                    </div>
                    
                    {/* Résumé lisible */}
                    <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
                      <div className="relative group">
                        <div className="flex items-center gap-1 cursor-default">
                          <Clock size={14} />
                          <span>{segments.length || 0} plage{segments.length > 1 ? 's' : ''}</span>
                        </div>
                        {segments.length > 0 && (
                          <div className="absolute left-0 top-full mt-2 w-72 rounded-md border border-neutral-700 bg-neutral-900 p-3 text-xs text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none group-hover:pointer-events-auto">
                            <div className="text-[11px] font-semibold text-neutral-400 mb-2">Plages personnalisées</div>
                            <div className="space-y-1">
                              {segments.map((seg: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-blue-400">▸</span>
                                  {formatSegmentDisplay(seg)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      {segments.length > 0 && (
                        <span className="text-neutral-500">·</span>
                      )}
                      {segments.length > 0 && (
                        <span>{totalDuration.toFixed(1)}h au total</span>
                      )}
                    </div>

                    {/* Popover avec aperçu automatique au survol */}
                    {autoSegments.length > 0 && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="mt-2 text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1">
                            <span>Plages de base ({autoSegments.length})</span>
                            {segmentsHaveChanged && isReallyEditing && (
                              <span className="px-1.5 py-0.5 bg-orange-500/30 text-orange-300 rounded text-[10px]">Modifié</span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 bg-neutral-900 border-neutral-700">
                          <div className="space-y-2">
                            <div className="text-xs font-semibold text-blue-400 mb-2">Plages calculées automatiquement</div>
                            {autoSegments.map((seg: any, idx: number) => (
                              <div key={idx} className="text-xs text-neutral-300 flex items-center gap-2">
                                <span className="text-blue-400">▸</span>
                                {formatSegmentDisplay(seg)}
                              </div>
                            ))}
                            {isReallyEditing && segmentsHaveChanged && (
                              <button
                                type="button"
                                className="mt-3 w-full px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                                onClick={() => {
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
          </div>

          {/* Rich text en pleine largeur sur les deux colonnes */}
          {richTextProps.length > 0 && (
            <div className="pt-6 relative">
              <div className="space-y-6">
                {richTextProps.map((prop: any) => (
                  <div key={prop.id} className="pb-10 border-b border-black/5 dark:border-white/5 last:border-0 last:pb-0 relative">
                    <div className="absolute -top-3 left-3 px-4 py-1 rounded-full inline-block bg-background dark:bg-neutral-900 text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-4 uppercase tracking-wide z-10">{prop.name}</div>
                    <EditableProperty
                      property={prop}
                      value={formData[prop.id]}
                      onChange={(val) => handleChange(prop.id, val)}
                      size="md"
                      collections={collections}
                      collection={collection}
                      currentItem={formData}
                      readOnly={false}
                      forceRichEditor={true}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-8 py-4 border-t border-black/10 dark:border-white/10 bg-white/90 dark:bg-neutral-950/80 backdrop-blur">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-sm text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          >
            Annuler
          </button>
          <ShinyButton
            onClick={() => {
              disableDraftRef.current = true;
              setHasLocalDraft(false);
              try {
                localStorage.removeItem(draftKey);
              } catch {
                // ignore stockage local indisponible
              }
              let dataToSave = { ...formData, __collectionId: selectedCollectionId };
              
              // Si on crée un nouvel item et que les segments sont vides, appliquer les segments prégénérés
              if (!isReallyEditing && (!dataToSave._eventSegments || dataToSave._eventSegments.length === 0) && previewSegments.length > 0) {
                dataToSave._eventSegments = previewSegments;
                dataToSave._preserveEventSegments = false;
              }
              
              if (!isReallyEditing && !dataToSave.id) {
                dataToSave.id = Date.now().toString();
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
              onSave(dataToSave);
            }}
          >
            {isReallyEditing ? 'Modifier' : 'Créer'}
          </ShinyButton>
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
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-background dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-neutral-300 dark:border-neutral-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-700 dark:text-neutral-100">Modifier les plages - {editingDateProp.name}</h3>
              <button
                onClick={() => setEditingDateProp(null)}
                className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-100 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-4">
                <ShinyButton
                  onClick={() => {
                    const segs = Array.isArray(formData._eventSegments) ? [...formData._eventSegments] : [];
                    const now = new Date();
                    const start = now.toISOString();
                    const end = new Date(now.getTime() + 60*60*1000).toISOString();
                    segs.push({ start, end, label: editingDateProp.name });
                    setManualSegments(segs);
                  }}
                >
                  + Ajouter une plage
                </ShinyButton>
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
                        <div className="font-semibold text-sm text-neutral-600 dark:text-neutral-400 mb-2">{day}</div>
                        <ul className="space-y-2">
                          {segs.map((seg: any, idx: number) => {
                            const startDate = new Date(seg.start || seg.__eventStart);
                            const endDate = new Date(seg.end || seg.__eventEnd);
                            const durationMinutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
                            const durationHoursValue = Math.round((durationMinutes / 60) * 4) / 4;
                            const currentTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;

                            return (
                              <li key={idx} className="p-3 border-b border-neutral-300 dark:border-neutral-700">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_140px_140px] gap-3 items-center">
                                    <div className="flex flex-col">
                                      <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">Date</label>
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
                                        className="w-full px-2 py-1.5 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-100 text-sm rounded focus:border-violet-500 focus:outline-none"
                                      />
                                    </div>

                                    <div className="flex flex-col">
                                      <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">Heure</label>
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
                                        className="w-full px-2 py-1.5 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-100 text-sm rounded focus:border-violet-500 focus:outline-none"
                                      >
                                        {timeOptions.map(opt => (
                                          <option key={opt} value={opt}>
                                            {opt}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="flex flex-col">
                                      <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">Durée</label>
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
                                        className="w-full px-2 py-1.5 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-500 dark:text-neutral-100 text-sm rounded focus:border-violet-500 focus:outline-none"
                                      >
                                        {durationOptions.map(dur => {
                                          const hours = Math.floor(dur);
                                          const mins = Math.round((dur % 1) * 60);
                                          const label = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                                          return (
                                            <option key={dur} value={dur}>
                                              {label}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  </div>

                                  <button
                                    className="p-1 hover:bg-red-500/20 rounded transition-colors"
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
                                    <Trash2 size={16} className="text-red-400" />
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
            <div className="px-6 py-4 border-t border-neutral-300 dark:border-neutral-700 flex justify-end">
              <ShinyButton
                onClick={() => setEditingDateProp(null)}
                className=""
              >
                Fermer
              </ShinyButton>
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
              <label key={item.targetKey} className="flex items-start gap-3 rounded-md border border-black/10 dark:border-white/10 p-3">
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
                  <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                    {item.propName}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    <span className="font-semibold">Actuel :</span> {formatValueForDialog(item.currentValue)}
                  </div>
                  <div className="text-xs text-neutral-500">
                    <span className="font-semibold">Nouveau :</span> {formatValueForDialog(item.desiredValue)}
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
            <div className="border border-black/10 dark:border-white/10 rounded-lg p-3 overflow-y-auto max-h-[45vh]">
              {historySelectedIndex === null || !historyData || !historyPreview ? (
                <div className="text-sm text-neutral-500">Sélectionne une version pour voir le détail.</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Changements</div>
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
                              <div key={key} className="rounded-md border border-black/5 dark:border-white/10 p-2">
                                <div className="font-semibold text-neutral-700 dark:text-neutral-200 mb-1">{key}</div>
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
                            <div key={key} className="rounded-md border border-black/5 dark:border-white/10 p-2">
                              <div className="font-semibold text-neutral-700 dark:text-neutral-200 mb-1">{key}</div>
                              <div className="grid grid-cols-1 gap-2">
                                <div className="bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
                                  <div className="text-[10px] uppercase text-red-500 mb-1">Avant</div>
                                  <div className="text-neutral-600 dark:text-neutral-300">
                                    {formatValueForDialog(before)}
                                  </div>
                                </div>
                                <div className="bg-green-500/10 border border-green-500/20 rounded px-2 py-1">
                                  <div className="text-[10px] uppercase text-green-500 mb-1">Après</div>
                                  <div className="text-neutral-600 dark:text-neutral-300">
                                    {formatValueForDialog(after)}
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
