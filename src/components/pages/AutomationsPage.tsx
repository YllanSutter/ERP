import { generateId } from '@/lib/utils/id';
/**
 * AutomationsPage.tsx
 * Page globale de gestion des automations.
 * Accessible depuis la sidebar (onglet Automations).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Zap,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  ArrowRight,
  X,
  GripVertical,
  PenLine,
  Braces,
  ListPlus,
  Package,
  Settings2,
  Link2,
  Calculator,
  History,
  CheckCircle2,
  AlertCircle,
  CircleDashed,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
  Play,
} from 'lucide-react';
import {
  Select as RadixSelect,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ModalWrapper from '@/components/ui/ModalWrapper';

// ─── Types ────────────────────────────────────────────────────────────────────

type TriggerType = 'item_created' | 'item_updated' | 'item_deleted';
type ActionType = 'create_item' | 'update_item' | 'update_field' | 'condition' | 'delay' | 'find_or_create_item';
type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty' | 'greater' | 'less';

interface Condition {
  id: string;
  fieldId: string;
  operator: ConditionOperator;
  value: string;
}

interface AutomationTrigger {
  type: TriggerType;
  collectionId: string;
  conditions: Condition[];
  watchFields?: string[]; // pour item_updated uniquement
  position?: { x: number; y: number };
}

interface ActionField {
  fieldId: string;
  value: string;
}

/** Un item à créer dans une action create_item */
interface ItemDef {
  id: string;
  fields: Record<string, string>;
}

interface AutomationAction {
  id: string;
  type: ActionType;
  collectionId: string;
  /** create_item : liste des items à créer (nouveau format) */
  items?: ItemDef[];
  /**
   * create_item : quantité dynamique — nombre fixe ("3") ou template ("{{trigger.qty}}").
   * Si défini, prime sur items.length. Le premier item sert de template pour tous.
   * Si absent, on crée exactement les items définis dans `items`.
   */
  count?: string;
  /** update_item : champs à mettre à jour sur l'item déclencheur */
  fields?: Record<string, string>;
  fieldId?: string; // pour update_field
  value?: string;   // pour update_field
  conditions?: Condition[];
  thenActions?: AutomationAction[];
  elseActions?: AutomationAction[];
  delaySeconds?: number;
  matchFieldId?: string;
  matchValue?: string;
  position?: { x: number; y: number };
}

interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
}

interface AutomationRun {
  id: string;
  status: 'success' | 'error' | 'ignored';
  details: { eventType?: string; collectionId?: string; itemId?: string; reason?: string; error?: string; steps?: { type: string; status: string; position: number; message?: string }[] };
  createdAt: string;
}

interface AutomationsPageProps {
  collections: any[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<TriggerType, string> = {
  item_created: 'Un item est créé',
  item_updated: 'Un item est modifié',
  item_deleted: 'Un item est supprimé',
};

const ACTION_LABELS: Record<ActionType, string> = {
  create_item: 'Créer un ou plusieurs items',
  update_item: "Mettre à jour l'item déclencheur",
  update_field: "Modifier un champ de l'item déclencheur",
  condition: 'Si / sinon',
  delay: 'Attendre',
  find_or_create_item: 'Rechercher ou créer un item',
};

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'est égal à',
  not_equals: "n'est pas égal à",
  contains: 'contient',
  is_empty: 'est vide',
  is_not_empty: "n'est pas vide",
  greater: 'est supérieur à',
  less: 'est inférieur à',
};

const OPERATOR_HAS_VALUE: Set<ConditionOperator> = new Set([
  'equals', 'not_equals', 'contains', 'greater', 'less',
]);

const uuid = generateId;

const emptyTrigger = (): AutomationTrigger => ({
  type: 'item_created',
  collectionId: '',
  conditions: [],
});

const emptyItemDef = (): ItemDef => ({ id: uuid(), fields: {} });

const emptyAction = (): AutomationAction => ({
  id: uuid(),
  type: 'create_item',
  collectionId: '',
  items: [emptyItemDef()],
});

const emptyAutomation = (): Omit<Automation, 'id'> => ({
  name: 'Nouvelle automation',
  enabled: true,
  trigger: emptyTrigger(),
  actions: [emptyAction()],
});

// ─── Petits composants ────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400 mb-2">
    {children}
  </div>
);

const Select: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, options, placeholder, className = '' }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${className}`}
  >
    {placeholder && <option value="">{placeholder}</option>}
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

const Input: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className = '' }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-800 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${className}`}
  />
);

const ACTION_TYPE_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({ value: value as ActionType, label }));

const WorkflowCanvas: React.FC<{
  trigger: AutomationTrigger;
  triggerName: string;
  collections: any[];
  actions: AutomationAction[];
  selectedId: string;
  onSelect: (id: string) => void;
  onChangeTrigger: (trigger: AutomationTrigger) => void;
  onChangeActions: (actions: AutomationAction[]) => void;
}> = ({ trigger, triggerName, collections, actions, selectedId, onSelect, onChangeTrigger, onChangeActions }) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const nodePosition = (action: AutomationAction, index: number) => action.position || { x: 340, y: 190 + index * 175 };
  const triggerPosition = trigger.position || { x: 340, y: 24 };
  const allPositions = [triggerPosition, ...actions.map(nodePosition)];
  const boardHeight = Math.max(330, ...allPositions.map((pos) => pos.y + 160));

  const addBlock = (type: ActionType, index: number) => {
    const action: AutomationAction = {
      ...emptyAction(),
      type,
      position: { x: 340, y: 190 + index * 175 },
      conditions: type === 'condition' ? [{ id: uuid(), fieldId: '', operator: 'is_not_empty', value: '' }] : undefined,
      thenActions: type === 'condition' ? [emptyAction()] : undefined,
      elseActions: type === 'condition' ? [] : undefined,
      delaySeconds: type === 'delay' ? 1 : undefined,
    };
    const next = [...actions];
    next.splice(index, 0, action);
    onChangeActions(next);
    setInsertAt(null);
    onSelect(action.id);
  };

  const moveNode = (nodeId: string, event: React.DragEvent) => {
    const bounds = boardRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const position = {
      x: Math.max(12, Math.min(650, event.clientX - bounds.left - 140)),
      y: Math.max(8, event.clientY - bounds.top - 26),
    };
    if (nodeId === 'workflow-trigger') onChangeTrigger({ ...trigger, position });
    else onChangeActions(actions.map((action) => action.id === nodeId ? { ...action, position } : action));
  };

  const nodes = [
    { id: 'workflow-trigger', kind: 'trigger' as const, title: 'Déclencheur', subtitle: `${TRIGGER_LABELS[trigger.type]}${triggerName ? ` · ${triggerName}` : ''}`, position: triggerPosition },
    ...actions.map((action, index) => ({
      id: action.id, kind: action.type as ActionType, title: ACTION_LABELS[action.type],
      subtitle: action.type === 'condition'
        ? `OUI : ${action.thenActions?.length || 0} bloc(s) · NON : ${action.elseActions?.length || 0} bloc(s)`
        : action.type === 'delay' ? `Attendre ${action.delaySeconds || 0} seconde(s)`
          : action.collectionId ? collections.find((collection) => collection.id === action.collectionId)?.name || 'À configurer' : 'À configurer',
      position: nodePosition(action, index),
    })),
  ];

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-white/10 bg-[#f7f8fa] dark:bg-[#111318] overflow-auto">
      <div className="relative min-w-[960px]" ref={boardRef} style={{ height: boardHeight }}
        onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData('application/x-automation-node'); if (id) moveNode(id, event); }}>
        <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
          {nodes.slice(0, -1).map((node, index) => {
            const next = nodes[index + 1];
            const startX = node.position.x + 140;
            const startY = node.position.y + 112;
            const endX = next.position.x + 140;
            const endY = next.position.y;
            const curve = Math.max(28, Math.abs(endY - startY) * 0.45);
            return <path key={`${node.id}-${next.id}`} d={`M ${startX} ${startY} C ${startX} ${startY + curve}, ${endX} ${endY - curve}, ${endX} ${endY}`}
              fill="none" stroke="currentColor" strokeWidth="2" className="text-neutral-300 dark:text-neutral-700" />;
          })}
        </svg>

        {nodes.map((node, index) => (
          <React.Fragment key={node.id}>
            <button onClick={() => onSelect(node.id)}
              className={`absolute z-10 w-[280px] min-h-[112px] rounded-xl border bg-white dark:bg-neutral-900 px-4 py-3 text-left shadow-sm transition-shadow hover:shadow-md ${selectedId === node.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-neutral-200 dark:border-white/10'}`}
              style={{ left: node.position.x, top: node.position.y }}>
              <span draggable onDragStart={(event) => { event.dataTransfer.setData('application/x-automation-node', node.id); event.dataTransfer.effectAllowed = 'move'; }}
                onClick={(event) => event.stopPropagation()}
                className="absolute right-3 top-3 cursor-grab text-neutral-300 active:cursor-grabbing" title="Déplacer le bloc"><GripVertical size={15} /></span>
              <span className={`mb-2 inline-flex rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${node.kind === 'trigger' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : node.kind === 'condition' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'}`}>
                {node.kind === 'trigger' ? 'Déclencheur' : node.kind === 'condition' ? 'Branchement' : 'Action'}
              </span>
              <div className="pr-5 text-sm font-semibold text-neutral-800 dark:text-neutral-100">{node.title}</div>
              <div className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">{node.subtitle}</div>
            </button>
            {index < nodes.length - 1 && (() => {
              const next = nodes[index + 1];
              const x = Math.round((node.position.x + next.position.x) / 2 + 128);
              const y = Math.round((node.position.y + 112 + next.position.y) / 2 - 12);
              return <div key={`insert-${node.id}`} className="absolute z-20" style={{ left: x, top: y }}>
                <button onClick={() => setInsertAt(insertAt === index ? null : index)} className="flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 shadow hover:border-blue-500 hover:text-blue-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300" title="Ajouter un bloc"><Plus size={14} /></button>
                {insertAt === index && <div className="absolute left-8 top-0 z-30 w-56 rounded-lg border border-neutral-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-neutral-800">
                  {ACTION_TYPE_OPTIONS.map((option) => <button key={option.value} onClick={() => addBlock(option.value, index)} className="block w-full rounded px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/10">{option.label}</button>)}
                </div>}
              </div>;
            })()}
          </React.Fragment>
        ))}
        <button onClick={() => setInsertAt(insertAt === actions.length ? null : actions.length)}
          className="absolute z-20 flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 shadow hover:border-blue-500 hover:text-blue-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          style={{ left: 466, top: nodes[nodes.length - 1].position.y + 132 }} title="Ajouter un bloc"><Plus size={15} /></button>
        {insertAt === actions.length && <div className="absolute left-[505px] z-30 w-56 rounded-lg border border-neutral-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-neutral-800" style={{ top: nodes[nodes.length - 1].position.y + 132 }}>
          {ACTION_TYPE_OPTIONS.map((option) => <button key={option.value} onClick={() => addBlock(option.value, actions.length)} className="block w-full rounded px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-white/10">{option.label}</button>)}
        </div>}
        {actions.length === 0 && <div className="absolute left-[505px] top-[166px] rounded-md bg-neutral-100 px-2 py-1 text-[10px] text-neutral-500 dark:bg-white/5">Ajoute le premier bloc avec +</div>}
      </div>
      <div className="flex items-center justify-between border-t border-neutral-200 px-3 py-2 text-[10px] text-neutral-400 dark:border-white/10">
        <span>Glisse les poignées pour déplacer les blocs · Clique sur + pour en ajouter</span>
        <span>{actions.length} bloc(s) d’action</span>
      </div>
    </div>
  );
};

// ─── FieldValuePicker ─────────────────────────────────────────────────────────
// Select Radix contextuel + fallback "Autre" → input libre

const MANUAL_SENTINEL = '__manual__';

const FieldValuePicker: React.FC<{
  value: string;
  onChange: (v: string) => void;
  /** Propriété cible (pour afficher ses options select/multiselect/relation) */
  targetProp?: any;
  /** Propriétés du déclencheur (pour les templates {{trigger.X}}) */
  triggerProps?: any[];
  /** Résultats accessibles des actions create_item précédentes */
  previousCreateActions?: { id: string; label: string }[];
  className?: string;
}> = ({ value, onChange, targetProp, triggerProps = [], previousCreateActions = [], className = '' }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const isRelationField = targetProp?.type === 'relation';
  const isNumberField = targetProp?.type === 'number';

  // Options prédéfinies pour le Select
  const triggerOptions = triggerProps.map((p: any) => ({
    value: `{{trigger.${p.id}}}`,
    label: p.name || p.id,
  }));

  // Pour les champs relation, proposer {{trigger.id}} en raccourci
  const relationShortcuts: { value: string; label: string }[] = isRelationField
    ? [
        { value: '{{trigger.id}}', label: 'ID de l\'item déclencheur' },
        ...previousCreateActions.map((a) => ({ value: `{{action.${a.id}.id}}`, label: `ID créé · ${a.label}` })),
      ]
    : [];

  const fixedOptions: { value: string; label: string }[] =
    (targetProp?.type === 'select' || targetProp?.type === 'multiselect')
      ? (targetProp?.options || []).map((o: any) => ({
          value: o.label ?? o.id,
          label: o.label ?? o.id,
        }))
      : [];

  const allPresetValues = new Set([
    ...triggerOptions.map((o) => o.value),
    ...fixedOptions.map((o) => o.value),
    ...relationShortcuts.map((o) => o.value),
  ]);

  // Est-ce que la valeur courante est dans les presets ?
  const isManual = value !== '' && !allPresetValues.has(value);
  const selectValue = isManual ? MANUAL_SENTINEL : (value || '');

  const [showManualInput, setShowManualInput] = useState(isManual);

  // Sync quand la valeur change de l'extérieur
  const prevValueRef = useRef(value);
  if (prevValueRef.current !== value) {
    prevValueRef.current = value;
    const nextIsManual = value !== '' && !allPresetValues.has(value);
    if (nextIsManual !== showManualInput) setShowManualInput(nextIsManual);
  }

  const handleSelect = (v: string) => {
    if (v === MANUAL_SENTINEL) {
      setShowManualInput(true);
      onChange('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setShowManualInput(false);
      onChange(v);
    }
  };

  const hasTrigger = triggerOptions.length > 0;
  const hasFixed = fixedOptions.length > 0;
  const hasRelationShortcuts = relationShortcuts.length > 0;
  const hasAnyOptions = hasTrigger || hasFixed || hasRelationShortcuts;

  return (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
      <div className="flex gap-1.5 items-center min-w-0">
        {/* Select Radix */}
        <RadixSelect value={selectValue || undefined} onValueChange={handleSelect}>
          <SelectTrigger className="h-9 text-sm flex-1 min-w-0 bg-white dark:bg-neutral-800 border-neutral-200 dark:border-white/10">
            <SelectValue placeholder={
              showManualInput
                ? <span className="flex items-center gap-1.5 text-neutral-400"><PenLine size={12} />Saisie libre</span>
                : <span className="text-neutral-400">Choisir…</span>
            } />
          </SelectTrigger>
          <SelectContent className="z-[500]">
            {hasRelationShortcuts && (
              <SelectGroup>
                <SelectLabel className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <Link2 size={11} /> Raccourcis relation
                </SelectLabel>
                {relationShortcuts.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-purple-600 dark:text-purple-400">{o.value}</span>
                      <span className="text-xs text-neutral-500">{o.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {hasRelationShortcuts && hasTrigger && <SelectSeparator />}

            {hasTrigger && (
              <SelectGroup>
                <SelectLabel className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <Braces size={11} /> Champs du déclencheur
                </SelectLabel>
                {triggerOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400">{`{{trigger.${triggerProps.find((p: any) => `{{trigger.${p.id}}}` === o.value)?.name || o.value}}}`}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {hasTrigger && hasFixed && <SelectSeparator />}

            {hasFixed && (
              <SelectGroup>
                <SelectLabel className="text-[10px] text-neutral-500">Valeurs fixes</SelectLabel>
                {fixedOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectGroup>
            )}

            {hasAnyOptions && <SelectSeparator />}

            <SelectItem value={MANUAL_SENTINEL}>
              <span className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                <PenLine size={12} /> Autre (saisie libre)
              </span>
            </SelectItem>
          </SelectContent>
        </RadixSelect>

        {/* Input libre (visible quand "Autre" ou valeur non prédéfinie) */}
        {showManualInput && (
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isNumberField ? 'ex: {{trigger.prix}} / 3' : 'Texte + {{trigger.champ}} + …'}
            className="flex-1 min-w-0 h-9 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-lg px-3 text-sm text-neutral-800 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        )}
      </div>

      {/* Hints contextuels */}
      {showManualInput && isNumberField && (
        <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
          <Calculator size={10} />
          <span>Expressions mathématiques supportées : <code className="font-mono">{'{{trigger.prix}} / {{trigger.qty}}'}</code></span>
        </div>
      )}
      {showManualInput && isRelationField && (
        <div className="flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400">
          <Link2 size={10} />
          <span>Choisis l’ID d’une action précédente pour lier l’item créé, ou <code className="font-mono">{'{{trigger.id}}'}</code> pour l’item déclencheur.</span>
        </div>
      )}
      {showManualInput && !isRelationField && triggerProps.length > 0 && (
        <div className="text-[10px] text-neutral-400">Tu peux combiner plusieurs champs, par exemple : <code className="font-mono">{'{{trigger.type}} · {{trigger.sites}}'}</code></div>
      )}
    </div>
  );
};

// ─── Editor ───────────────────────────────────────────────────────────────────

const AutomationEditor: React.FC<{
  automation: Automation;
  collections: any[];
  onChange: (updated: Automation) => void;
  onDelete: () => void;
}> = ({ automation, collections, onChange, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState('workflow-trigger');
  const [showBlockSettings, setShowBlockSettings] = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItemId, setPreviewItemId] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ changes: { type: string; collection: string; item: string }[]; message?: string } | null>(null);
  const [previewError, setPreviewError] = useState('');

  const update = useCallback((patch: Partial<Automation>) => {
    onChange({ ...automation, ...patch });
  }, [automation, onChange]);

  const updateTrigger = useCallback((patch: Partial<AutomationTrigger>) => {
    update({ trigger: { ...automation.trigger, ...patch } });
  }, [automation.trigger, update]);

  const updateAction = useCallback((actionId: string, patch: Partial<AutomationAction>) => {
    update({
      actions: automation.actions.map((a) =>
        a.id === actionId ? { ...a, ...patch } : a
      ),
    });
  }, [automation.actions, update]);

  const addAction = () => update({ actions: [...automation.actions, emptyAction()] });

  const removeAction = (actionId: string) =>
    update({ actions: automation.actions.filter((a) => a.id !== actionId) });

  const moveAction = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= automation.actions.length) return;
    const actions = [...automation.actions];
    [actions[index], actions[nextIndex]] = [actions[nextIndex], actions[index]];
    update({ actions });
  };

  const moveActionToIndex = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= automation.actions.length) return;
    const actions = [...automation.actions];
    const [moved] = actions.splice(fromIndex, 1);
    actions.splice(toIndex, 0, moved);
    update({ actions });
  };

  const addCondition = () =>
    updateTrigger({
      conditions: [
        ...(automation.trigger.conditions || []),
        { id: uuid(), fieldId: '', operator: 'equals', value: '' },
      ],
    });

  const updateCondition = (condId: string, patch: Partial<Condition>) =>
    updateTrigger({
      conditions: (automation.trigger.conditions || []).map((c) =>
        c.id === condId ? { ...c, ...patch } : c
      ),
    });

  const removeCondition = (condId: string) =>
    updateTrigger({
      conditions: (automation.trigger.conditions || []).filter((c) => c.id !== condId),
    });

  const triggerCollection = collections.find((c) => c.id === automation.trigger.collectionId);
  const triggerProps = triggerCollection?.properties || [];
  const sampleItems = triggerCollection?.items || [];

  const runPreview = async () => {
    if (!previewItemId) return;
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewResult(null);
    try {
      const response = await fetch(`/api/automations/${automation.id}/preview`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: previewItemId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Échec de la simulation');
      setPreviewResult(result);
    } catch (err: any) {
      setPreviewError(err.message || 'Échec de la simulation');
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleRuns = async () => {
    const next = !showRuns;
    setShowRuns(next);
    if (!next) return;
    setRunsLoading(true);
    try {
      const response = await fetch(`/api/automations/${automation.id}/runs`, { credentials: 'include' });
      if (response.ok) setRuns(await response.json());
      else setRuns([]);
    } catch {
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  };

  const collectionOptions = collections.map((c) => ({ value: c.id, label: c.name || 'Sans nom' }));

  return (
    <div className="border border-neutral-200 dark:border-white/10 rounded-xl bg-white dark:bg-neutral-900 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Zap size={16} className="text-yellow-500 flex-shrink-0" />

        <input
          type="text"
          value={automation.name}
          onChange={(e) => { e.stopPropagation(); update({ name: e.target.value }); }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent text-sm font-medium text-neutral-800 dark:text-white focus:outline-none min-w-0"
        />

        {/* Toggle enabled */}
        <button
          onClick={(e) => { e.stopPropagation(); update({ enabled: !automation.enabled }); }}
          className={`flex-shrink-0 transition-colors ${automation.enabled ? 'text-blue-500' : 'text-neutral-400'}`}
          title={automation.enabled ? 'Désactiver' : 'Activer'}
        >
          {automation.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>

        {/* Status badge */}
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
          automation.enabled
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            : 'bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400'
        }`}>
          {automation.enabled ? 'Active' : 'Inactive'}
        </span>

        <button
          onClick={(e) => { e.stopPropagation(); setPreviewOpen((value) => !value); setPreviewResult(null); setPreviewError(''); }}
          className={`flex-shrink-0 flex items-center gap-1 text-xs transition-colors ${previewOpen ? 'text-blue-500' : 'text-neutral-400 hover:text-blue-500'}`}
          title="Simuler cette automatisation sans enregistrer les changements"
        >
          <Play size={13} /> Tester
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); void toggleRuns(); }}
          className={`flex-shrink-0 flex items-center gap-1 text-xs transition-colors ${showRuns ? 'text-blue-500' : 'text-neutral-400 hover:text-blue-500'}`}
          title="Historique des exécutions"
        >
          <History size={14} /> Historique
        </button>

        {/* Expand/collapse */}
        {expanded
          ? <ChevronDown size={16} className="text-neutral-400 flex-shrink-0" />
          : <ChevronRight size={16} className="text-neutral-400 flex-shrink-0" />
        }

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex-shrink-0 text-neutral-400 hover:text-red-500 transition-colors"
          title="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Résumé compact (fermé) */}
      {!expanded && automation.trigger.collectionId && (
        <div className="px-4 pb-3 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="font-medium text-blue-600 dark:text-blue-400">
            {TRIGGER_LABELS[automation.trigger.type]}
          </span>
          <span>dans</span>
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {triggerCollection?.name || '…'}
          </span>
          <ArrowRight size={12} />
          <span>{automation.actions.length} action{automation.actions.length > 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Expanded body */}
      {showRuns && (
        <div className="px-4 py-3 border-t border-neutral-100 dark:border-white/5 bg-neutral-50/70 dark:bg-black/10">
          <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-2">Dernières exécutions</div>
          {runsLoading ? <div className="text-xs text-neutral-400">Chargement…</div> : runs.length === 0 ? (
            <div className="text-xs text-neutral-400">Aucune exécution enregistrée.</div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {runs.map((run) => {
                const Icon = run.status === 'success' ? CheckCircle2 : run.status === 'error' ? AlertCircle : CircleDashed;
                const label = run.status === 'success' ? 'Réussie' : run.status === 'error' ? 'Erreur' : 'Ignorée';
                return <div key={run.id} className="flex items-start gap-2 text-xs">
                  <Icon size={14} className={run.status === 'success' ? 'text-emerald-500 mt-0.5' : run.status === 'error' ? 'text-red-500 mt-0.5' : 'text-neutral-400 mt-0.5'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex gap-2 text-neutral-600 dark:text-neutral-300"><span>{label}</span><span className="text-neutral-400">{new Date(run.createdAt).toLocaleString()}</span></div>
                    {run.details.reason && <div className="text-neutral-400 mt-0.5">{run.details.reason}</div>}
                    {run.details.error && <div className="text-red-500 mt-0.5">{run.details.error}</div>}
                    {!!run.details.steps?.length && <div className="text-neutral-400 mt-0.5">{run.details.steps.map((step) => `Action ${step.position} : ${step.status === 'success' ? 'OK' : step.message || 'erreur'}`).join(' · ')}</div>}
                  </div>
                </div>;
              })}
            </div>
          )}
        </div>
      )}

      {previewOpen && (
        <div className="px-4 py-3 border-t border-neutral-100 dark:border-white/5 bg-blue-50/50 dark:bg-blue-950/10 space-y-2">
          <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Simulation sans sauvegarde</div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={previewItemId} onChange={(v) => { setPreviewItemId(v); setPreviewResult(null); }}
              options={sampleItems.map((item: any) => ({ value: item.id, label: item.name || item.title || item.id }))}
              placeholder="Choisir un item de test…" />
            <button onClick={() => void runPreview()} disabled={!previewItemId || previewLoading}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
              <Play size={12} /> {previewLoading ? 'Simulation…' : 'Lancer le test'}
            </button>
          </div>
          {previewError && <div className="text-xs text-red-500">{previewError}</div>}
          {previewResult && <div className="text-xs text-neutral-600 dark:text-neutral-300">
            {previewResult.changes.length ? <div className="space-y-1">{previewResult.changes.map((change, i) => <div key={`${change.type}-${i}`}>
              {change.type === 'created' ? 'Créerait' : 'Modifierait'} « {change.item} » dans {change.collection}.
            </div>)}</div> : <div>{previewResult.message}</div>}
          </div>}
          <div className="text-[10px] text-neutral-400">Les changements affichés sont simulés et ne sont pas enregistrés.</div>
        </div>
      )}

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-neutral-100 dark:border-white/5 space-y-5">

          <WorkflowCanvas
            trigger={automation.trigger}
            triggerName={triggerCollection?.name || ''}
            collections={collections}
            actions={automation.actions}
            selectedId={selectedStepId}
            onSelect={(id) => { setSelectedStepId(id); setShowBlockSettings(true); }}
            onChangeTrigger={(trigger) => update({ trigger })}
            onChangeActions={(actions) => update({ actions })}
          />

          <details open={showBlockSettings} onToggle={(event) => setShowBlockSettings((event.currentTarget as HTMLDetailsElement).open)} className="rounded-xl border border-neutral-200 dark:border-white/10">
            <summary className="cursor-pointer select-none px-4 py-3 text-xs font-medium text-neutral-600 dark:text-neutral-300">Réglages du bloc sélectionné</summary>
            <div className="border-t border-neutral-100 p-3 dark:border-white/5">

          {/* ── TRIGGER ── */}
          {selectedStepId === 'workflow-trigger' && <div>
            <SectionLabel>Déclencheur</SectionLabel>
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <Select
                  value={automation.trigger.type}
                  onChange={(v) => updateTrigger({ type: v as TriggerType })}
                  options={Object.entries(TRIGGER_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                />
                <span className="text-sm text-neutral-500 dark:text-neutral-400">dans la collection</span>
                <Select
                  value={automation.trigger.collectionId}
                  onChange={(v) => updateTrigger({ collectionId: v })}
                  options={collectionOptions}
                  placeholder="Choisir une collection…"
                />
              </div>

              {/* Champs surveillés (item_updated uniquement) */}
              {automation.trigger.type === 'item_updated' && triggerProps.length > 0 && (
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                    Déclencher seulement si ces champs changent (optionnel) :
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {triggerProps.map((p: any) => {
                      const watched = (automation.trigger.watchFields || []).includes(p.id);
                      const isRel = p.type === 'relation';
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            const current = automation.trigger.watchFields || [];
                            updateTrigger({
                              watchFields: watched
                                ? current.filter((id) => id !== p.id)
                                : [...current, p.id],
                            });
                          }}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                            watched
                              ? 'bg-blue-500 border-blue-500 text-white'
                              : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-400 hover:border-blue-400'
                          }`}
                        >
                          {isRel && <Link2 size={10} className="flex-shrink-0" />}
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Conditions */}
              {automation.trigger.collectionId && (
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                    Conditions supplémentaires (optionnel) :
                  </div>
                  <div className="space-y-2">
                    {(automation.trigger.conditions || []).map((cond) => (
                      <div key={cond.id} className="flex flex-wrap gap-2 items-center">
                        <Select
                          value={cond.fieldId}
                          onChange={(v) => updateCondition(cond.id, { fieldId: v })}
                          options={triggerProps.map((p: any) => ({ value: p.id, label: p.name }))}
                          placeholder="Champ…"
                          className="flex-1 min-w-28"
                        />
                        <Select
                          value={cond.operator}
                          onChange={(v) => updateCondition(cond.id, { operator: v as ConditionOperator })}
                          options={Object.entries(OPERATOR_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                          className="flex-1 min-w-36"
                        />
                        {OPERATOR_HAS_VALUE.has(cond.operator) && (
                          <Input
                            value={cond.value}
                            onChange={(v) => updateCondition(cond.id, { value: v })}
                            placeholder="Valeur…"
                            className="flex-1 min-w-24"
                          />
                        )}
                        <button
                          onClick={() => removeCondition(cond.id)}
                          className="text-neutral-400 hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addCondition}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Ajouter une condition
                  </button>
                </div>
              )}
            </div>
          </div>}

          {/* ── ACTIONS ── */}
          {selectedStepId !== 'workflow-trigger' && <div>
            <SectionLabel>Actions</SectionLabel>
            <div className="space-y-3">
              {automation.actions.map((action, idx) => action.id === selectedStepId ? (
                <ActionEditor
                  key={action.id}
                  index={idx}
                  action={action}
                  collections={collections}
                  triggerCollectionId={automation.trigger.collectionId}
                  previousCreateActions={automation.actions.slice(0, idx).filter((a) => a.type === 'create_item' || a.type === 'find_or_create_item').map((a, i) => ({ id: a.id, label: collections.find((c) => c.id === a.collectionId)?.name || `Action ${i + 1}` }))}
                  onMoveUp={() => moveAction(idx, -1)}
                  onMoveDown={() => moveAction(idx, 1)}
                  onMoveToIndex={(toIndex) => moveActionToIndex(idx, toIndex)}
                  onChange={(patch) => updateAction(action.id, patch)}
                  onRemove={() => { removeAction(action.id); setSelectedStepId('workflow-trigger'); }}
                />
              ) : null)}
            </div>
          </div>}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

// ─── CreateItemsModal ─────────────────────────────────────────────────────────
// Modal ModalWrapper pour configurer les items à créer (liste de N items,
// chacun avec son propre mapping de champs)

const ItemFieldRow: React.FC<{
  fieldId: string;
  value: string;
  targetProps: any[];
  triggerProps: any[];
  usedFieldIds: string[];
  onChangeFieldId: (newId: string) => void;
  onChangeValue: (v: string) => void;
  onRemove: () => void;
}> = ({ fieldId, value, targetProps, triggerProps, usedFieldIds, onChangeFieldId, onChangeValue, onRemove }) => {
  const prop = targetProps.find((p: any) => p.id === fieldId);
  return (
    <div className="flex gap-2 items-center">
      <Select
        value={fieldId}
        onChange={onChangeFieldId}
        options={[
          { value: fieldId, label: prop?.name || fieldId },
          ...targetProps
            .filter((p: any) => !usedFieldIds.includes(p.id) || p.id === fieldId)
            .filter((p: any) => p.id !== fieldId)
            .map((p: any) => ({ value: p.id, label: p.name })),
        ]}
        className="w-36 flex-shrink-0"
      />
      <FieldValuePicker
        value={value}
        onChange={onChangeValue}
        targetProp={prop}
        triggerProps={triggerProps}
        className="flex-1 min-w-0"
      />
      <button
        onClick={onRemove}
        className="text-neutral-400 hover:text-red-500 transition-colors flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
};

const CreateItemsModal: React.FC<{
  items: ItemDef[];
  count?: string;
  onChange: (items: ItemDef[], count: string) => void;
  onClose: () => void;
  targetProps: any[];
  triggerProps: any[];
  collectionName: string;
}> = ({ items, count: initialCount = '', onChange, onClose, targetProps, triggerProps, collectionName }) => {
  const [draft, setDraft] = useState<ItemDef[]>(() =>
    items.length > 0 ? items : [emptyItemDef()]
  );
  // Quantité dynamique — vide = utiliser la liste, sinon nombre ou {{trigger.X}}
  const [draftCount, setDraftCount] = useState(initialCount);

  const isDynamic = draftCount.trim() !== '';

  const addItem = () => setDraft((d) => [...d, emptyItemDef()]);
  const removeItem = (id: string) => setDraft((d) => d.filter((it) => it.id !== id));

  const updateItemField = (itemId: string, fieldId: string, value: string) =>
    setDraft((d) =>
      d.map((it) =>
        it.id === itemId ? { ...it, fields: { ...it.fields, [fieldId]: value } } : it
      )
    );

  const changeItemFieldKey = (itemId: string, oldKey: string, newKey: string) =>
    setDraft((d) =>
      d.map((it) => {
        if (it.id !== itemId) return it;
        const next = { ...it.fields };
        const val = next[oldKey];
        delete next[oldKey];
        next[newKey] = val ?? '';
        return { ...it, fields: next };
      })
    );

  const removeItemField = (itemId: string, fieldId: string) =>
    setDraft((d) =>
      d.map((it) => {
        if (it.id !== itemId) return it;
        const next = { ...it.fields };
        delete next[fieldId];
        return { ...it, fields: next };
      })
    );

  const addFieldToItem = (itemId: string) => {
    const item = draft.find((it) => it.id === itemId);
    const usedIds = Object.keys(item?.fields || {});
    const first = targetProps.find((p: any) => !usedIds.includes(p.id));
    if (!first) return;
    updateItemField(itemId, first.id, '');
  };

  const handleSave = () => {
    onChange(draft, draftCount.trim());
    onClose();
  };

  // Quand quantité dynamique activée, on masque les items supplémentaires (seul le 1er = template)
  const visibleItems = isDynamic ? draft.slice(0, 1) : draft;

  return (
    <ModalWrapper
      title={
        <div className="flex items-center gap-2">
          <ListPlus size={18} className="text-blue-500" />
          <span>Items à créer dans <span className="font-bold">{collectionName}</span></span>
        </div>
      }
      onClose={onClose}
      onSave={handleSave}
      saveLabel="Appliquer"
      size="lg"
    >
      <div className="space-y-4">

        {/* ── Quantité ── */}
        <div className="bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Quantité d'items à créer</div>
              <div className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                Laisse vide pour créer exactement les items listés ci-dessous.
                {triggerProps.length > 0 && ' Ou utilise un champ du déclencheur pour un nombre dynamique.'}
              </div>
            </div>
          </div>
          <FieldValuePicker
            value={draftCount}
            onChange={setDraftCount}
            targetProp={null}
            triggerProps={triggerProps}
            className="max-w-xs"
          />
          {isDynamic && (
            <div className="flex items-start gap-2 mt-1 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-[11px] text-amber-700 dark:text-amber-300">
              <span className="mt-0.5">⚡</span>
              <span>
                Le nombre d'items sera calculé à l'exécution. Le <strong>template ci-dessous</strong> sera utilisé pour chaque item créé — les valeurs peuvent référencer <code className="bg-amber-100 dark:bg-white/10 px-1 rounded">{'{{trigger.X}}'}</code>.
              </span>
            </div>
          )}
        </div>

        {/* ── Items / Template ── */}
        {visibleItems.map((item, idx) => {
          const fieldEntries = Object.entries(item.fields);
          const usedFieldIds = Object.keys(item.fields);
          const unusedProps = targetProps.filter((p: any) => !usedFieldIds.includes(p.id));

          return (
            <div
              key={item.id}
              className="border border-neutral-200 dark:border-white/10 rounded-xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-blue-500" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {isDynamic ? 'Template (appliqué à chaque item)' : `Item ${idx + 1}`}
                  </span>
                  {!isDynamic && (
                    <span className="text-xs text-neutral-400 dark:text-neutral-500">
                      · {fieldEntries.length} champ{fieldEntries.length !== 1 ? 's' : ''} configuré{fieldEntries.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                {!isDynamic && draft.length > 1 && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <div className="px-4 py-3 space-y-2">
                {fieldEntries.length === 0 && (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">
                    Aucun champ configuré — l'item sera créé vide.
                  </p>
                )}
                {fieldEntries.map(([fieldId, value]) => (
                  <ItemFieldRow
                    key={fieldId}
                    fieldId={fieldId}
                    value={value}
                    targetProps={targetProps}
                    triggerProps={triggerProps}
                    usedFieldIds={usedFieldIds}
                    onChangeFieldId={(newId) => changeItemFieldKey(item.id, fieldId, newId)}
                    onChangeValue={(v) => updateItemField(item.id, fieldId, v)}
                    onRemove={() => removeItemField(item.id, fieldId)}
                  />
                ))}
                {unusedProps.length > 0 && (
                  <button
                    onClick={() => addFieldToItem(item.id)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <Plus size={12} /> Ajouter un champ
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Ajouter un item (seulement si liste fixe) */}
        {!isDynamic && (
          <button
            onClick={addItem}
            className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-neutral-200 dark:border-white/10 rounded-xl text-sm text-neutral-500 dark:text-neutral-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ListPlus size={15} />
            Ajouter un item à créer
          </button>
        )}

        {triggerProps.length > 0 && !isDynamic && (
          <div className="text-[11px] text-neutral-400 dark:text-neutral-500">
            Utilise <code className="bg-neutral-100 dark:bg-white/10 px-1 rounded">{'{{trigger.nomDuChamp}}'}</code> pour copier une valeur de l'item déclencheur.
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

// ─── ActionEditor ─────────────────────────────────────────────────────────────

const ActionEditor: React.FC<{
  index: number;
  action: AutomationAction;
  collections: any[];
  triggerCollectionId: string;
  previousCreateActions?: { id: string; label: string }[];
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToIndex?: (toIndex: number) => void;
  onChange: (patch: Partial<AutomationAction>) => void;
  onRemove: () => void;
}> = ({ index, action, collections, triggerCollectionId, previousCreateActions = [], onMoveUp, onMoveDown, onMoveToIndex, onChange, onRemove }) => {
  const [isDragging, setIsDragging] = useState(false);
  const targetCollection = collections.find((c) => c.id === action.collectionId);
  const targetProps = targetCollection?.properties || [];
  const triggerCollection = collections.find((c) => c.id === triggerCollectionId);
  const triggerProps = triggerCollection?.properties || [];

  const collectionOptions = collections.map((c) => ({ value: c.id, label: c.name || 'Sans nom' }));

  // Modal "créer plusieurs items"
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Normalise les items (rétro-compat : si pas d'items mais fields présent)
  const normalizedItems: ItemDef[] = (() => {
    if (Array.isArray(action.items) && action.items.length > 0) return action.items;
    if (action.fields && Object.keys(action.fields).length > 0) return [{ id: uuid(), fields: action.fields }];
    return [emptyItemDef()];
  })();

  // Pour update_item / update_field : liste de paires fieldId → value (inchangé)
  const fieldEntries: ActionField[] = Object.entries(action.fields || {}).map(([fieldId, value]) => ({
    fieldId,
    value: value as string,
  }));

  const setFieldValue = (fieldId: string, value: string) => {
    onChange({ fields: { ...(action.fields || {}), [fieldId]: value } });
  };

  const removeField = (fieldId: string) => {
    const next = { ...(action.fields || {}) };
    delete next[fieldId];
    onChange({ fields: next });
  };

  const addField = () => {
    const unusedProp = targetProps.find((p: any) => !Object.keys(action.fields || {}).includes(p.id));
    if (unusedProp) setFieldValue(unusedProp.id, '');
  };

  const unusedProps = targetProps.filter((p: any) => !Object.keys(action.fields || {}).includes(p.id));

  return (
    <div
      onDragOver={(event) => { if (onMoveToIndex) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
      onDrop={(event) => { if (!onMoveToIndex) return; event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) onMoveToIndex(from); setIsDragging(false); }}
      className={`bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 rounded-xl p-3 space-y-3 ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Header action */}
      <div className="flex items-center gap-2">
        <span draggable={!!onMoveToIndex} onDragStart={(event) => { event.dataTransfer.setData('text/plain', String(index)); event.dataTransfer.effectAllowed = 'move'; setIsDragging(true); }} onDragEnd={() => setIsDragging(false)} className="cursor-grab active:cursor-grabbing">
          <GripVertical size={14} className="text-neutral-300 dark:text-neutral-600 flex-shrink-0" />
        </span>
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 w-16 flex-shrink-0">
          Étape {index + 1}
        </span>
        {onMoveUp && <button onClick={onMoveUp} disabled={index === 0} className="text-neutral-400 disabled:opacity-30" title="Monter l’étape"><ChevronUp size={14} /></button>}
        {onMoveDown && <button onClick={onMoveDown} className="text-neutral-400" title="Descendre l’étape"><ChevronDownIcon size={14} /></button>}
        <Select
          value={action.type}
          onChange={(v) => onChange({
            type: v as ActionType,
            fields: {},
            items: v === 'create_item' ? [emptyItemDef()] : undefined,
            fieldId: '',
            value: '',
            conditions: v === 'condition' ? [{ id: uuid(), fieldId: '', operator: 'is_not_empty', value: '' }] : undefined,
            thenActions: v === 'condition' ? [emptyAction()] : undefined,
            elseActions: v === 'condition' ? [] : undefined,
            delaySeconds: v === 'delay' ? 1 : undefined,
          })}
          options={Object.entries(ACTION_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          className="flex-1"
        />
        <button
          onClick={onRemove}
          className="text-neutral-400 hover:text-red-500 transition-colors flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {/* create_item */}
      {action.type === 'create_item' && (
        <div className="space-y-2 pl-5">
          {/* Sélecteur de collection */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Dans la collection</span>
            <Select
              value={action.collectionId}
              onChange={(v) => onChange({ collectionId: v, items: [emptyItemDef()] })}
              options={collectionOptions}
              placeholder="Choisir une collection…"
            />
          </div>

          {/* Bouton de configuration des items */}
          {action.collectionId && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-700/50 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm text-neutral-700 dark:text-neutral-300 hover:text-blue-700 dark:hover:text-blue-300 transition-colors w-full"
            >
              <Settings2 size={14} className="text-blue-500 flex-shrink-0" />
              <span className="flex-1 text-left">
                Configurer les items à créer
              </span>
              <span className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                <Package size={11} />
                {action.count
                  ? <>{action.count} item{action.count === '1' ? '' : 's'}</>
                  : <>{normalizedItems.length} item{normalizedItems.length > 1 ? 's' : ''}</>
                }
              </span>
            </button>
          )}
        </div>
      )}

      {/* Modal de configuration des items */}
      {showCreateModal && action.type === 'create_item' && action.collectionId && (
        <CreateItemsModal
          items={normalizedItems}
          count={action.count || ''}
          onChange={(items, count) => onChange({ items, count: count || undefined })}
          onClose={() => setShowCreateModal(false)}
          targetProps={targetProps}
          triggerProps={triggerProps}
          collectionName={targetCollection?.name || '…'}
        />
      )}

      {/* update_item */}
      {action.type === 'update_item' && (
        <div className="space-y-2 pl-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Mettre à jour ces champs sur l'item déclencheur :
          </div>
          {fieldEntries.map(({ fieldId, value }) => {
            const prop = triggerProps.find((p: any) => p.id === fieldId);
            return (
              <div key={fieldId} className="flex gap-2 items-center">
                <Select
                  value={fieldId}
                  onChange={(newFId) => {
                    const next = { ...(action.fields || {}) };
                    const oldVal = next[fieldId];
                    delete next[fieldId];
                    next[newFId] = oldVal || '';
                    onChange({ fields: next, collectionId: triggerCollectionId });
                  }}
                  options={[
                    { value: fieldId, label: prop?.name || fieldId },
                    ...triggerProps
                      .filter((p: any) => !Object.keys(action.fields || {}).includes(p.id))
                      .map((p: any) => ({ value: p.id, label: p.name })),
                  ]}
                  className="flex-1 min-w-0"
                />
                <FieldValuePicker
                  value={value}
                  onChange={(v) => setFieldValue(fieldId, v)}
                  targetProp={triggerProps.find((p: any) => p.id === fieldId)}
                  triggerProps={triggerProps}
                  previousCreateActions={previousCreateActions}
                  className="flex-1 min-w-0"
                />
                <button onClick={() => removeField(fieldId)} className="text-neutral-400 hover:text-red-500 transition-colors">
                  <X size={14} />
                </button>
              </div>
            );
          })}
          {triggerProps.filter((p: any) => !Object.keys(action.fields || {}).includes(p.id)).length > 0 && (
            <button
              onClick={() => {
                const unusedProp = triggerProps.find((p: any) => !Object.keys(action.fields || {}).includes(p.id));
                if (unusedProp) {
                  onChange({
                    fields: { ...(action.fields || {}), [unusedProp.id]: '' },
                    collectionId: triggerCollectionId,
                  });
                }
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Plus size={12} /> Ajouter un champ
            </button>
          )}
        </div>
      )}

      {/* update_field */}
      {action.type === 'update_field' && (
        <div className="flex flex-wrap gap-2 items-center pl-5">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Champ</span>
          <Select
            value={action.fieldId || ''}
            onChange={(v) => onChange({ fieldId: v, collectionId: triggerCollectionId })}
            options={triggerProps.map((p: any) => ({ value: p.id, label: p.name }))}
            placeholder="Choisir un champ…"
          />
          <span className="text-xs text-neutral-500 dark:text-neutral-400">→</span>
          <FieldValuePicker
            value={action.value || ''}
            onChange={(v) => onChange({ value: v })}
            targetProp={triggerProps.find((p: any) => p.id === action.fieldId)}
            triggerProps={triggerProps}
            previousCreateActions={previousCreateActions}
            className="flex-1 min-w-32"
          />
        </div>
      )}

      {action.type === 'delay' && (
        <div className="flex items-center gap-2 pl-5 text-sm text-neutral-600 dark:text-neutral-300">
          <span>Attendre</span>
          <input type="number" min={0} max={60} value={action.delaySeconds ?? 1}
            onChange={(e) => onChange({ delaySeconds: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
            className="w-20 h-9 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800 px-2" />
          <span>secondes (maximum 60)</span>
        </div>
      )}

      {action.type === 'find_or_create_item' && (
        <div className="space-y-3 pl-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span>Dans</span>
            <Select value={action.collectionId} onChange={(v) => onChange({ collectionId: v, matchFieldId: '', fields: {} })}
              options={collectionOptions} placeholder="Choisir une collection…" />
            <span>chercher un item où</span>
            <Select value={action.matchFieldId || ''} onChange={(v) => onChange({ matchFieldId: v })}
              options={targetProps.map((p: any) => ({ value: p.id, label: p.name }))} placeholder="Champ…" />
            <span>vaut</span>
          </div>
          {action.matchFieldId && <FieldValuePicker value={action.matchValue || ''} onChange={(v) => onChange({ matchValue: v })}
            targetProp={targetProps.find((p: any) => p.id === action.matchFieldId)} triggerProps={triggerProps}
            previousCreateActions={previousCreateActions} />}
          <div className="text-xs text-neutral-500">S’il existe, l’item est mis à jour. Sinon, il est créé.</div>
          {Object.entries(action.fields || {}).map(([fieldId, value]) => (
            <div key={fieldId} className="flex gap-2 items-center">
              <Select value={fieldId} onChange={(nextId) => {
                const next = { ...(action.fields || {}) }; const old = next[fieldId]; delete next[fieldId]; next[nextId] = old;
                onChange({ fields: next });
              }} options={targetProps.map((p: any) => ({ value: p.id, label: p.name }))} />
              <FieldValuePicker value={String(value)} onChange={(v) => onChange({ fields: { ...(action.fields || {}), [fieldId]: v } })}
                targetProp={targetProps.find((p: any) => p.id === fieldId)} triggerProps={triggerProps}
                previousCreateActions={previousCreateActions} className="flex-1" />
              <button onClick={() => { const next = { ...(action.fields || {}) }; delete next[fieldId]; onChange({ fields: next }); }}><X size={14} /></button>
            </div>
          ))}
          {targetProps.some((p: any) => !Object.hasOwn(action.fields || {}, p.id)) && <button className="text-xs text-blue-500"
            onClick={() => { const prop = targetProps.find((p: any) => !Object.hasOwn(action.fields || {}, p.id)); if (prop) onChange({ fields: { ...(action.fields || {}), [prop.id]: '' } }); }}>
            <Plus size={12} /> Ajouter un champ à remplir
          </button>}
        </div>
      )}

      {action.type === 'condition' && (
        <div className="space-y-3 pl-5">
          <div className="text-xs text-neutral-500">Si toutes ces conditions sont vraies :</div>
          {(action.conditions || []).map((condition, conditionIndex) => (
            <div key={condition.id} className="flex flex-wrap items-center gap-2">
              <Select value={condition.fieldId} onChange={(fieldId) => onChange({ conditions: action.conditions!.map((c, i) => i === conditionIndex ? { ...c, fieldId } : c) })}
                options={triggerProps.map((p: any) => ({ value: p.id, label: p.name }))} placeholder="Champ…" />
              <Select value={condition.operator} onChange={(operator) => onChange({ conditions: action.conditions!.map((c, i) => i === conditionIndex ? { ...c, operator: operator as ConditionOperator } : c) })}
                options={Object.entries(OPERATOR_LABELS).map(([value, label]) => ({ value, label }))} />
              {OPERATOR_HAS_VALUE.has(condition.operator) && <Input value={condition.value} onChange={(value) => onChange({ conditions: action.conditions!.map((c, i) => i === conditionIndex ? { ...c, value } : c) })} placeholder="Valeur…" />}
              <button onClick={() => onChange({ conditions: (action.conditions || []).filter((c) => c.id !== condition.id) })}><X size={14} /></button>
            </div>
          ))}
          <button className="text-xs text-blue-500" onClick={() => onChange({ conditions: [...(action.conditions || []), { id: uuid(), fieldId: '', operator: 'is_not_empty', value: '' }] })}><Plus size={12} /> Ajouter une condition</button>
          {(['thenActions', 'elseActions'] as const).map((branchKey) => {
            const branch = action[branchKey] || [];
            const isThen = branchKey === 'thenActions';
            const changeBranch = (next: AutomationAction[]) => onChange({ [branchKey]: next } as Partial<AutomationAction>);
            return <div key={branchKey} className="rounded-lg border border-neutral-200 dark:border-white/10 p-3 space-y-2">
              <div className={`text-xs font-semibold ${isThen ? 'text-emerald-600' : 'text-amber-600'}`}>{isThen ? 'OUI — exécuter' : 'NON — sinon'}</div>
              {branch.map((nested, nestedIndex) => <ActionEditor key={nested.id} index={nestedIndex} action={nested} collections={collections}
                triggerCollectionId={triggerCollectionId} previousCreateActions={[...previousCreateActions, ...branch.slice(0, nestedIndex).filter((entry) => entry.type === 'create_item' || entry.type === 'find_or_create_item').map((entry, i) => ({ id: entry.id, label: `Action créée ${i + 1}` }))]}
                onChange={(patch) => changeBranch(branch.map((entry) => entry.id === nested.id ? { ...entry, ...patch } : entry))}
                onRemove={() => changeBranch(branch.filter((entry) => entry.id !== nested.id))}
                onMoveToIndex={(toIndex) => { const next = [...branch]; const [moved] = next.splice(nestedIndex, 1); next.splice(toIndex, 0, moved); changeBranch(next); }} />)}
              <button className="text-xs text-blue-500" onClick={() => changeBranch([...branch, emptyAction()])}><Plus size={12} /> Ajouter une action</button>
            </div>;
          })}
        </div>
      )}
    </div>
  );
};

// ─── Page principale ──────────────────────────────────────────────────────────

const AutomationsPage: React.FC<AutomationsPageProps> = ({ collections }) => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // ── Chargement ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/automations', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAutomations(data);
    } catch (e: any) {
      setError(e.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Créer ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    const body = emptyAutomation();
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created: Automation = await res.json();
      setAutomations((prev) => [...prev, created]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // ── Sauvegarder ───────────────────────────────────────────────────────────
  const handleChange = useCallback(async (updated: Automation) => {
    // Mise à jour optimiste
    setAutomations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));

    setSaving((s) => new Set(s).add(updated.id));
    try {
      await fetch(`/api/automations/${updated.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving((s) => {
        const next = new Set(s);
        next.delete(updated.id);
        return next;
      });
    }
  }, []);

  // ── Supprimer ─────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id: string) => {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    try {
      await fetch(`/api/automations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  return (
    <div className="flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900">
        <div className="flex items-center gap-3">
          <Zap size={20} className="text-yellow-500" />
          <div>
            <h1 className="text-base font-semibold text-neutral-900 dark:text-white">Automations</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Déclenchez des actions automatiquement quand des items sont créés, modifiés ou supprimés.
            </p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nouvelle automation
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading && (
          <div className="text-sm text-neutral-500 dark:text-neutral-400">Chargement…</div>
        )}

        {!loading && error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {!loading && automations.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center mb-4">
              <Zap size={24} className="text-yellow-500" />
            </div>
            <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Aucune automation pour l'instant
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mb-4">
              Crée ta première automation pour lier automatiquement des collections entre elles.
            </div>
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={14} />
              Créer une automation
            </button>
          </div>
        )}

        {!loading && automations.length > 0 && (
          <div className="space-y-3 max-w-6xl">
            {automations.map((auto) => (
              <div key={auto.id} className="relative">
                {saving.has(auto.id) && (
                  <div className="absolute top-3 right-14 text-[10px] text-neutral-400 dark:text-neutral-500 animate-pulse z-10">
                    Sauvegarde…
                  </div>
                )}
                <AutomationEditor
                  automation={auto}
                  collections={collections}
                  onChange={handleChange}
                  onDelete={() => handleDelete(auto.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomationsPage;
