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
  SlidersHorizontal,
  Info,
  Check,
  RefreshCw,
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
import { SettingsSheet, SettingsTabs, SettingsTabContent, SettingsSection } from '@/components/ui/settings-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IconButton } from '@/components/ui/icon-button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from '@/components/ui/context-menu';

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
  nodes?: AutomationNode[];
  edges?: AutomationEdge[];
}

interface AutomationNode {
  id: string;
  type: 'trigger' | ActionType;
  position: { x: number; y: number };
  data?: Record<string, any>;
}

interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
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
  actions: [],
  nodes: [{ id: 'workflow-trigger', type: 'trigger', position: { x: 420, y: 80 }, data: emptyTrigger() }],
  edges: [],
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

const AutomationGraphCanvas: React.FC<{
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  selectedId: string;
  collections: any[];
  onSelect: (id: string) => void;
  onChange: (nodes: AutomationNode[], edges: AutomationEdge[], trigger?: AutomationTrigger) => void;
}> = ({ nodes, edges, selectedId, collections, onSelect, onChange }) => {
  const [connecting, setConnecting] = useState<{ id: string; handle: string; x: number; y: number; dragging?: boolean } | null>(null);
  const [draggingNode, setDraggingNode] = useState<{ id: string; x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const portRefs = useRef(new Map<string, HTMLElement>());
  const suppressClickRef = useRef<string | null>(null);
  const nodeDragRef = useRef<{ id: string; pointerId: number; offsetX: number; offsetY: number; startX: number; startY: number; x: number; y: number; moved: boolean } | null>(null);
  const snap = (value: number) => Math.max(12, Math.round(value / 20) * 20);
  const nodeHeight = (type: AutomationNode['type']) => type === 'condition' ? 175 : type === 'trigger' ? 145 : 155;
  const isOverlapping = (position: { x: number; y: number }, node: AutomationNode, candidateType: AutomationNode['type'], ignoredId?: string) => {
    if (node.id === ignoredId) return false;
    const width = 270;
    return position.x < node.position.x + width + 32 && position.x + width + 32 > node.position.x
      && position.y < node.position.y + nodeHeight(node.type) + 32 && position.y + nodeHeight(candidateType) + 32 > node.position.y;
  };
  const keepClear = (start: { x: number; y: number }, candidateType: AutomationNode['type'], ignoredId?: string) => {
    const maxX = Math.max(12, (boardRef.current?.clientWidth || 1100) - 282);
    let position = { x: Math.min(maxX, snap(start.x)), y: snap(start.y) };
    let attempts = 0;
    while (nodes.some((node) => isOverlapping(position, node, candidateType, ignoredId)) && attempts < 40) {
      position = { ...position, y: position.y + 40 };
      attempts += 1;
    }
    return position;
  };
  const toBoardPoint = (clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };
  const beginNodeDrag = (node: AutomationNode, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const point = toBoardPoint(event.clientX, event.clientY);
    nodeDragRef.current = {
      id: node.id,
      pointerId: event.pointerId,
      offsetX: point.x - node.position.x,
      offsetY: point.y - node.position.y,
      startX: event.clientX,
      startY: event.clientY,
      x: node.position.x,
      y: node.position.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const updateNodeDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = toBoardPoint(event.clientX, event.clientY);
    const maxX = Math.max(12, (boardRef.current?.clientWidth || 1100) - 282);
    const x = Math.min(maxX, Math.max(12, point.x - drag.offsetX));
    const y = Math.max(12, point.y - drag.offsetY);
    drag.x = x;
    drag.y = y;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3) drag.moved = true;
    setDraggingNode({ id: drag.id, x, y });
  };
  const finishNodeDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      suppressClickRef.current = drag.id;
      onChange(nodes.map((node) => node.id === drag.id ? { ...node, position: { x: drag.x, y: drag.y } } : node), edges);
    }
    nodeDragRef.current = null;
    setDraggingNode(null);
  };
  const addNode = (type: ActionType) => {
    const id = uuid();
    const defaults: Partial<AutomationAction> = type === 'condition'
      ? { conditions: [{ id: uuid(), fieldId: '', operator: 'is_not_empty', value: '' }] }
      : type === 'delay' ? { delaySeconds: 1 } : {};
    const source = nodes.find((entry) => entry.id === selectedId) || nodes.find((entry) => entry.type === 'trigger');
    const desired = source ? { x: source.position.x, y: source.position.y + 220 } : { x: 420, y: 300 };
    const node: AutomationNode = { id, type, position: keepClear(desired, type), data: { ...emptyAction(), ...defaults, id, type } };
    const nextEdges = [...edges];
    const handle = source?.type === 'condition' ? 'true' : 'default';
    if (source && source.id !== id && !nextEdges.some((edge) => edge.source === source.id && edge.sourceHandle === handle)) nextEdges.push({ id: uuid(), source: source.id, target: id, sourceHandle: handle });
    onChange([...nodes, node], nextEdges);
    onSelect(id);
  };
  const changeNodeType = (node: AutomationNode, type: ActionType) => {
    if (node.type === type) return;
    const triggerCollectionId = nodes.find((entry) => entry.type === 'trigger')?.data?.collectionId || '';
    const defaults: Partial<AutomationAction> = type === 'condition'
      ? { conditions: [{ id: uuid(), fieldId: '', operator: 'is_not_empty', value: '' }] }
      : type === 'delay' ? { delaySeconds: 1 }
        : type === 'create_item' ? { items: [emptyItemDef()] } : {};
    const data: AutomationAction = {
      ...emptyAction(),
      ...defaults,
      id: node.id,
      type,
      collectionId: type === 'update_item' || type === 'update_field' ? triggerCollectionId : '',
    };
    onChange(nodes.map((entry) => entry.id === node.id ? { ...entry, type, data } : entry), edges);
    onSelect(node.id);
  };
  const changeTriggerType = (node: AutomationNode, type: TriggerType) => {
    if (node.type !== 'trigger' || node.data?.type === type) return;
    const trigger = { ...(node.data as AutomationTrigger), type };
    onChange(nodes.map((entry) => entry.id === node.id ? { ...entry, data: trigger } : entry), edges, trigger);
  };
  const removeNode = (node: AutomationNode) => {
    if (node.type === 'trigger') return;
    const nextNodes = nodes.filter((entry) => entry.id !== node.id);
    onChange(nextNodes, edges.filter((edge) => edge.source !== node.id && edge.target !== node.id));
    const triggerNode = nextNodes.find((entry) => entry.type === 'trigger');
    if (selectedId === node.id && triggerNode) onSelect(triggerNode.id);
  };
  const connect = (targetId: string) => {
    if (!connecting) return;
    if (connecting.id === targetId) { setConnecting(null); return; }
    const edge = { id: uuid(), source: connecting.id, target: targetId, sourceHandle: connecting.handle };
    onChange(nodes, [...edges.filter((entry) => !(entry.source === connecting.id && entry.sourceHandle === connecting.handle)), edge]);
    setConnecting(null);
  };
  const setPortRef = (nodeId: string, handle: string) => (element: HTMLElement | null) => {
    const key = `${nodeId}:${handle}`;
    if (element) portRefs.current.set(key, element);
    else portRefs.current.delete(key);
  };
  const portPoint = (node: AutomationNode, handle = 'default') => {
    const element = portRefs.current.get(`${node.id}:${handle}`);
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (element && boardRect) {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - boardRect.left,
        y: rect.top + rect.height / 2 - boardRect.top,
      };
    }
    if (handle === 'input') return { x: node.position.x + 135, y: node.position.y };
    return {
      x: node.position.x + (node.type === 'condition' ? handle === 'true' ? 68 : handle === 'false' ? 202 : 135 : 135),
      y: node.position.y + (node.type === 'condition' ? 145 : node.type === 'trigger' ? 95 : 105),
    };
  };
  const startConnection = (nodeId: string, handle: string, dragging: boolean) => {
    const node = nodeAt(nodeId);
    if (!node) return;
    const point = portPoint(node, handle);
    setConnecting({ id: nodeId, handle, x: point.x, y: point.y, dragging });
  };
  const displayNodes = nodes.map((node) => draggingNode?.id === node.id
    ? { ...node, position: { x: draggingNode.x, y: draggingNode.y } }
    : node);
  const boardHeight = Math.max(680, ...displayNodes.map((node) => node.position.y + 190));
  const nodeAt = (id: string) => displayNodes.find((node) => node.id === id);
  return <div className="overflow-hidden rounded-xl border border-neutral-200 bg-[#f8fafc] dark:border-white/10 dark:bg-[#111318]">
    <div className="flex max-h-[72vh] min-h-[560px]">
      <aside className="w-48 shrink-0 border-r border-neutral-200 bg-white/70 p-3 dark:border-white/10 dark:bg-black/10">
        <div className="mb-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">Blocs à ajouter</div>
        <div className="mb-3 text-[10px] text-neutral-400">Glisse un bloc sur le canevas ou clique pour l’ajouter.</div>
        <div className="space-y-1">
          {ACTION_TYPE_OPTIONS.map((option) => <button key={option.value} draggable onDragStart={(event) => { event.dataTransfer.setData('application/x-flow-type', option.value); event.dataTransfer.effectAllowed = 'copy'; }} onClick={() => addNode(option.value)} className="flex w-full cursor-grab items-center gap-2 rounded-md border border-neutral-200 bg-white px-2 py-2 text-left text-[11px] hover:border-blue-400 dark:border-white/10 dark:bg-neutral-900">
            <span className={`h-2 w-2 rounded-full ${option.value === 'condition' ? 'bg-amber-500' : 'bg-violet-500'}`} />{option.label}
          </button>)}
        </div>
      </aside>
      <div className="min-w-0 flex-1 overflow-auto">
      <div ref={boardRef} className="relative min-h-[680px] min-w-[1100px] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] dark:bg-[radial-gradient(#343741_1px,transparent_1px)]" style={{ height: boardHeight }}
        onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
          const type = event.dataTransfer.getData('application/x-flow-type') as ActionType;
          if (ACTION_TYPE_OPTIONS.some((option) => option.value === type)) {
            if (boardRef.current) {
              const nodeId = uuid();
              const defaults: Partial<AutomationAction> = type === 'condition' ? { conditions: [{ id: uuid(), fieldId: '', operator: 'is_not_empty', value: '' }] } : type === 'delay' ? { delaySeconds: 1 } : {};
              const point = toBoardPoint(event.clientX, event.clientY);
              const node: AutomationNode = { id: nodeId, type, position: { x: Math.max(12, point.x - 135), y: Math.max(12, point.y - 32) }, data: { ...emptyAction(), ...defaults, id: nodeId, type } };
              const source = nodes.find((entry) => entry.id === selectedId) || nodes.find((entry) => entry.type === 'trigger');
              const handle = source?.type === 'condition' ? 'true' : 'default';
              onChange([...nodes, node], source ? [...edges, { id: uuid(), source: source.id, target: nodeId, sourceHandle: handle }] : edges);
              onSelect(nodeId);
            }
          }
        }} onPointerMove={(event) => {
          if (nodeDragRef.current) updateNodeDrag(event);
          if (connecting?.dragging) {
            const point = toBoardPoint(event.clientX, event.clientY);
            setConnecting((current) => current?.dragging ? { ...current, x: point.x, y: point.y } : current);
          }
        }} onPointerUp={(event) => {
          if (nodeDragRef.current) finishNodeDrag(event);
          if (connecting?.dragging) setConnecting((current) => current ? { ...current, dragging: false } : current);
        }} onPointerCancel={(event) => {
          if (nodeDragRef.current) finishNodeDrag(event);
          if (connecting?.dragging) setConnecting((current) => current ? { ...current, dragging: false } : current);
        }}>
        <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
          {edges.map((edge) => { const from = nodeAt(edge.source); const to = nodeAt(edge.target); if (!from || !to) return null;
            const source = portPoint(from, edge.sourceHandle || 'default');
            const target = portPoint(to, 'input');
            const x1 = source.x, y1 = source.y, x2 = target.x, y2 = target.y;
            return <g key={edge.id}><path d={`M${x1},${y1} C${x1},${y1 + 45} ${x2},${y2 - 45} ${x2},${y2}`} fill="none" stroke="#94a3b8" strokeWidth="2" markerEnd="url(#flow-arrow)" />
              <circle cx={(x1+x2)/2} cy={(y1+y2)/2} r="3" fill="#94a3b8" /></g>;
          })}
          <defs><marker id="flow-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0L7 3.5L0 7z" fill="#94a3b8" /></marker></defs>
          {connecting?.dragging && nodeAt(connecting.id) && (() => {
            const point = portPoint(nodeAt(connecting.id)!, connecting.handle);
            return <path d={`M${point.x},${point.y} C${point.x},${point.y + 45} ${connecting.x},${connecting.y - 45} ${connecting.x},${connecting.y}`} fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5 5" />;
          })()}
        </svg>
        {edges.map((edge) => {
          const from = nodeAt(edge.source); const to = nodeAt(edge.target); if (!from || !to) return null;
          const sourcePoint = portPoint(from, edge.sourceHandle || 'default');
          const targetPoint = portPoint(to, 'input');
          return <button key={`remove-${edge.id}`} onClick={() => onChange(nodes, edges.filter((entry) => entry.id !== edge.id))}
            className="absolute z-20 flex h-5 w-5 items-center justify-center rounded-full border border-neutral-300 bg-white text-[11px] text-neutral-500 shadow hover:border-red-400 hover:text-red-500 dark:border-neutral-700 dark:bg-neutral-900"
            style={{ left: (sourcePoint.x + targetPoint.x) / 2 - 10, top: (sourcePoint.y + targetPoint.y) / 2 - 10 }} title="Supprimer cette liaison">×</button>;
        })}
        {displayNodes.map((node) => {
          const isTrigger = node.type === 'trigger';
          const title = isTrigger ? TRIGGER_LABELS[node.data?.type as TriggerType || 'item_created'] : ACTION_LABELS[node.type as ActionType];
          const subtitle = isTrigger ? collections.find((c) => c.id === node.data?.collectionId)?.name || 'Choisir une collection' : collections.find((c) => c.id === node.data?.collectionId)?.name || (node.type === 'condition' ? 'Connecte les sorties OUI / NON' : 'Configurer le bloc');
          const isDragging = draggingNode?.id === node.id;
          return <ContextMenu key={node.id}>
            <ContextMenuTrigger asChild>
              <div onClick={() => { if (suppressClickRef.current === node.id) { suppressClickRef.current = null; return; } onSelect(node.id); }} className={`absolute z-10 w-[270px] rounded-xl border bg-white px-4 py-3 shadow-md dark:bg-neutral-900 ${selectedId === node.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-neutral-200 dark:border-white/10'} ${isDragging ? 'z-30 shadow-2xl ring-2 ring-blue-400/30' : ''}`} style={{ left: node.position.x, top: node.position.y }}>
            <span onPointerDown={(event) => beginNodeDrag(node, event)} onPointerMove={updateNodeDrag} onPointerUp={finishNodeDrag} onPointerCancel={finishNodeDrag}
              className="absolute right-2 top-2 z-10 touch-none cursor-grab text-neutral-400 active:cursor-grabbing" title="Faire glisser pour déplacer"><GripVertical size={17} /></span>
            <button ref={setPortRef(node.id, 'input')} onPointerUp={(event) => { if (connecting?.dragging) { event.stopPropagation(); suppressClickRef.current = node.id; connect(node.id); } }} onClick={(event) => { event.stopPropagation(); connect(node.id); }} className={`absolute -top-2 left-1/2 h-4 w-4 touch-none rounded-full border-2 ${connecting ? 'border-blue-500 bg-blue-100' : 'border-slate-400 bg-white'} dark:bg-neutral-900`} title={connecting ? 'Relier ici' : 'Entrée du bloc'} />
            <div onPointerDown={(event) => beginNodeDrag(node, event)} onPointerMove={updateNodeDrag} onPointerUp={finishNodeDrag} onPointerCancel={finishNodeDrag}
              className="-mx-1 touch-none cursor-grab rounded px-1 pr-4 active:cursor-grabbing" title="Faire glisser cette zone pour déplacer le bloc">
              <span className={`mb-2 inline-block rounded px-2 py-1 text-[9px] font-bold uppercase ${isTrigger ? 'bg-blue-100 text-blue-700' : node.type === 'condition' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>{isTrigger ? 'Événement' : node.type === 'condition' ? 'Branchement' : 'Action'}</span>
              <div className="text-sm font-semibold text-neutral-800 dark:text-white">{title}</div><div className="mt-1 truncate text-xs text-neutral-500">{subtitle}</div>
            </div>
            {isTrigger ? <button ref={setPortRef(node.id, 'default')} onPointerDown={(event) => { event.preventDefault(); startConnection(node.id, 'default', true); }} onClick={(event) => { event.stopPropagation(); startConnection(node.id, 'default', false); }} className="absolute -bottom-2 left-1/2 h-4 w-4 touch-none rounded-full border-2 border-blue-500 bg-white dark:bg-neutral-900" title="Tirer une liaison depuis cette sortie" />
              : node.type === 'condition' ? <div className="mt-3 flex justify-between text-[10px]"><button onPointerDown={(event) => { event.preventDefault(); startConnection(node.id, 'true', true); }} onClick={(e) => { e.stopPropagation(); startConnection(node.id, 'true', false); }} className="flex touch-none items-center gap-1 text-emerald-600"><span ref={setPortRef(node.id, 'true')} className="h-3 w-3 shrink-0 rounded-full border-2 border-emerald-500 bg-white dark:bg-neutral-900" />OUI</button><button onPointerDown={(event) => { event.preventDefault(); startConnection(node.id, 'false', true); }} onClick={(e) => { e.stopPropagation(); startConnection(node.id, 'false', false); }} className="flex touch-none items-center gap-1 text-amber-600">NON<span ref={setPortRef(node.id, 'false')} className="h-3 w-3 shrink-0 rounded-full border-2 border-amber-500 bg-white dark:bg-neutral-900" /></button></div>
                : <button ref={setPortRef(node.id, 'default')} onPointerDown={(event) => { event.preventDefault(); startConnection(node.id, 'default', true); }} onClick={(event) => { event.stopPropagation(); startConnection(node.id, 'default', false); }} className="absolute -bottom-2 left-1/2 h-4 w-4 touch-none rounded-full border-2 border-violet-500 bg-white dark:bg-neutral-900" title="Tirer une liaison depuis cette sortie" />}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="min-w-[220px]">
              <ContextMenuLabel className="max-w-[240px] truncate text-xs text-muted-foreground">{title}</ContextMenuLabel>
              <ContextMenuSeparator />
              {isTrigger ? <ContextMenuSub>
                <ContextMenuSubTrigger><RefreshCw size={14} className="mr-2" />Changer l’événement</ContextMenuSubTrigger>
                <ContextMenuSubContent className="min-w-[220px]">
                  {Object.entries(TRIGGER_LABELS).map(([type, label]) => <ContextMenuItem key={type} onSelect={() => changeTriggerType(node, type as TriggerType)}>
                    {node.data?.type === type ? <Check size={14} className="mr-2" /> : <span className="mr-2 h-3.5 w-3.5" />}{label}
                  </ContextMenuItem>)}
                </ContextMenuSubContent>
              </ContextMenuSub> : <ContextMenuSub>
                <ContextMenuSubTrigger><RefreshCw size={14} className="mr-2" />Changer le type</ContextMenuSubTrigger>
                <ContextMenuSubContent className="min-w-[230px]">
                  {ACTION_TYPE_OPTIONS.map((option) => <ContextMenuItem key={option.value} onSelect={() => changeNodeType(node, option.value)}>
                    {node.type === option.value ? <Check size={14} className="mr-2" /> : <span className="mr-2 h-3.5 w-3.5" />}{option.label}
                  </ContextMenuItem>)}
                </ContextMenuSubContent>
              </ContextMenuSub>}
              {!isTrigger && <>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => removeNode(node)} className="text-destructive focus:text-destructive"><Trash2 size={14} className="mr-2" />Supprimer l’élément</ContextMenuItem>
              </>}
            </ContextMenuContent>
          </ContextMenu>;
        })}
        {connecting && <div className="absolute bottom-3 left-3 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white shadow">{connecting.dragging ? 'Relâche la liaison sur le point d’entrée du bloc cible' : 'Sortie sélectionnée · Clique sur le point d’entrée cible'}<button onClick={() => setConnecting(null)} className="ml-2 underline">Annuler</button></div>}
      </div>
      </div>
    </div>
  </div>;
};

const MANUAL_SENTINEL = '__manual__';

const TemplateValueEditor: React.FC<{
  value: string;
  onChange: (value: string) => void;
  triggerProps: any[];
  triggerLabel: string;
  previousCreateActions: { id: string; label: string; properties?: any[] }[];
}> = ({ value, onChange, triggerProps, triggerLabel, previousCreateActions }) => {
  const sourceOptions = [
    ...triggerProps.map((property) => ({ value: `{{trigger.${property.id}}}`, label: `${triggerLabel} · ${property.name || property.id}` })),
    ...previousCreateActions.flatMap((source) => (source.properties || []).map((property) => ({
      value: `{{action.${source.id}.${property.id}}}`,
      label: `${source.label} · ${property.name || property.id}`,
    }))),
  ];
  const tokens = value.match(/\{\{(?:trigger|action)\.[^}]+\}\}/g) || [];

  return <div className="min-w-0 flex-1 space-y-2">
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Texte libre, puis ajoute des champs sources…"
      className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-white/10 dark:bg-neutral-900 dark:text-white"
    />
    <div className="flex flex-wrap items-center gap-1.5">
      {tokens.length > 0 ? tokens.map((token, index) => {
        const option = sourceOptions.find((item) => item.value === token);
        return <span key={`${token}-${index}`} className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-800 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300">
          <Braces size={11} className="shrink-0" />
          <span className="truncate">{option?.label || token}</span>
        </span>;
      }) : <span className="text-[11px] text-neutral-500">La valeur saisie s’affiche ici. Les champs dynamiques apparaîtront en badges.</span>}
      {sourceOptions.length > 0 && <Select
        value=""
        onChange={(token) => { if (token) onChange(`${value}${value && !/\s$/.test(value) ? ' ' : ''}${token}`); }}
        options={sourceOptions}
        placeholder="+ Insérer un champ"
        className="h-7 rounded-full border-blue-200 py-0 text-[11px] dark:border-blue-400/20"
      />}
    </div>
  </div>;
};

const FieldValuePicker: React.FC<{
  value: string;
  onChange: (v: string) => void;
  /** Propriété cible (pour afficher ses options select/multiselect/relation) */
  targetProp?: any;
  /** Propriétés du déclencheur (pour les templates {{trigger.X}}) */
  triggerProps?: any[];
  /** Résultats accessibles des actions create_item précédentes */
  previousCreateActions?: { id: string; label: string; properties?: any[] }[];
  triggerLabel?: string;
  className?: string;
}> = ({ value, onChange, targetProp, triggerProps = [], previousCreateActions = [], triggerLabel = 'Déclencheur', className = '' }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const isRelationField = targetProp?.type === 'relation';
  const isNumberField = targetProp?.type === 'number';

  // Options prédéfinies pour le Select
  const triggerOptions = triggerProps.map((p: any) => ({
    value: `{{trigger.${p.id}}}`,
    label: p.name || p.id,
  }));
  const createdObjectOptions = previousCreateActions.flatMap((action) => (action.properties || []).map((property: any) => ({
    value: `{{action.${action.id}.${property.id}}}`,
    label: property.name || property.id,
    source: action.label,
  })));

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
    ...createdObjectOptions.map((o) => o.value),
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
  const hasCreatedObjects = createdObjectOptions.length > 0;
  const hasFixed = fixedOptions.length > 0;
  const hasRelationShortcuts = relationShortcuts.length > 0;
  const hasAnyOptions = hasTrigger || hasCreatedObjects || hasFixed || hasRelationShortcuts;

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

            {hasRelationShortcuts && (hasTrigger || hasCreatedObjects) && <SelectSeparator />}

            {hasTrigger && (
              <SelectGroup>
                  <SelectLabel className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <Braces size={11} /> {triggerLabel}
                </SelectLabel>
                {triggerOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-xs">{o.label}</span>
                      <span className="shrink-0 font-mono text-[10px] text-blue-600 dark:text-blue-400">{o.value}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            )}

            {(hasTrigger || hasCreatedObjects) && hasFixed && <SelectSeparator />}

            {previousCreateActions.map((action) => {
              const options = createdObjectOptions.filter((option) => option.source === action.label);
              if (!options.length) return null;
              return <React.Fragment key={action.id}>
                {(hasTrigger || hasFixed) && <SelectSeparator />}
                <SelectGroup>
                  <SelectLabel className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                    <Package size={11} /> {action.label}
                  </SelectLabel>
                  {options.map((option) => <SelectItem key={option.value} value={option.value}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-xs">{option.label}</span>
                      <span className="shrink-0 font-mono text-[10px] text-neutral-400">{option.value}</span>
                    </span>
                  </SelectItem>)}
                </SelectGroup>
              </React.Fragment>;
            })}

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

const getUpstreamCreatedSources = (nodeId: string, nodes: AutomationNode[], edges: AutomationEdge[], collections: any[]) => {
  const upstream = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of edges.filter((entry) => entry.target === current)) {
      if (upstream.has(edge.source)) continue;
      upstream.add(edge.source);
      queue.push(edge.source);
    }
  }
  return nodes.filter((node) => upstream.has(node.id) && (node.type === 'create_item' || node.type === 'find_or_create_item')).map((node, index) => {
    const collection = collections.find((entry) => entry.id === node.data?.collectionId);
    return { id: node.id, label: `${collection?.name || 'Item créé'} · bloc ${index + 1}`, properties: collection?.properties || [] };
  });
};

const AutomationEditor: React.FC<{
  automation: Automation;
  collections: any[];
  onChange: (updated: Automation) => void;
  onDelete: () => void;
}> = ({ automation, collections, onChange, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState('workflow-trigger');
  const [showBlockSettings, setShowBlockSettings] = useState(false);
  const [blockSettingsTab, setBlockSettingsTab] = useState('parameters');
  const [showRuns, setShowRuns] = useState(false);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItemId, setPreviewItemId] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ changes: { type: string; collection: string; item: string }[]; message?: string } | null>(null);
  const [previewError, setPreviewError] = useState('');

  const update = (patch: Partial<Automation>) => onChange({ ...automation, ...patch });

  const graphNodes: AutomationNode[] = automation.nodes?.length ? automation.nodes : [
    { id: 'workflow-trigger', type: 'trigger', position: automation.trigger.position || { x: 420, y: 70 }, data: { ...automation.trigger } },
    ...automation.actions.map((action, index) => ({ id: action.id, type: action.type, position: action.position || { x: 420, y: 250 + index * 170 }, data: action })),
  ];
  const graphEdges: AutomationEdge[] = automation.nodes?.some((node) => node.type === 'trigger') ? (automation.edges || []) : graphNodes.slice(1).map((node, index) => ({
    id: `legacy-${index}`, source: graphNodes[index].id, target: node.id, sourceHandle: graphNodes[index].type === 'condition' ? 'true' : 'default',
  }));
  const triggerNodeId = graphNodes.find((node) => node.type === 'trigger')?.id || 'workflow-trigger';
  const selectedNode = graphNodes.find((node) => node.id === selectedStepId);
  const selectedAction = selectedNode && selectedNode.type !== 'trigger'
    ? { ...(selectedNode.data || {}), id: selectedNode.id, type: selectedNode.type } as AutomationAction
    : null;
  useEffect(() => { setBlockSettingsTab('parameters'); }, [selectedStepId]);
  const saveGraph = (nodes: AutomationNode[], edges: AutomationEdge[], trigger?: AutomationTrigger) => update({
    nodes,
    edges,
    ...(trigger ? { trigger } : {}),
    actions: nodes.filter((node) => node.type !== 'trigger').map((node) => ({ ...(node.data || {}), id: node.id, type: node.type, position: node.position }) as AutomationAction),
  });

  const updateTrigger = (patch: Partial<AutomationTrigger>) => {
    const trigger = { ...automation.trigger, ...patch };
    const nodes = graphNodes.map((node) => node.type === 'trigger' ? { ...node, data: { ...trigger } } : node);
    update({ trigger, nodes, edges: graphEdges, actions: nodes.filter((node) => node.type !== 'trigger').map((node) => ({ ...(node.data || {}), id: node.id, type: node.type, position: node.position }) as AutomationAction) });
  };

  const updateAction = (actionId: string, patch: Partial<AutomationAction>) => {
    const nodes = graphNodes.map((node) => node.id === actionId ? { ...node, ...(patch.type ? { type: patch.type } : {}), data: { ...(node.data || {}), ...patch } } : node);
    saveGraph(nodes, graphEdges);
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

          <AutomationGraphCanvas
            nodes={graphNodes}
            edges={graphEdges}
            selectedId={selectedStepId}
            collections={collections}
            onSelect={(id) => { setSelectedStepId(id); setShowBlockSettings(true); }}
            onChange={saveGraph}
          />

          <SettingsSheet
            open={showBlockSettings}
            onOpenChange={setShowBlockSettings}
            title="Configurer le bloc"
            description={selectedStepId === triggerNodeId ? `Déclencheur · ${triggerCollection?.name || 'Choisir une collection'}` : selectedAction ? ACTION_LABELS[selectedAction.type] : 'Paramètres du bloc'}
          >
            <SettingsTabs
              value={blockSettingsTab}
              onValueChange={setBlockSettingsTab}
              label="Sections des réglages du bloc"
              items={[
                { id: 'parameters', label: 'Paramètres', icon: Settings2 },
                { id: 'advanced', label: 'Avancé', icon: SlidersHorizontal },
              ]}
            >
              <SettingsTabContent value="parameters" scrollable>
                {selectedStepId === triggerNodeId && <div className="space-y-5">
                  <SettingsSection title="Événement de départ" icon={Zap} appearance="plain" ruled>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="min-w-0 space-y-1.5">
                        <span className="text-xs text-muted-foreground">Quand</span>
                        <Select value={automation.trigger.type} onChange={(v) => updateTrigger({ type: v as TriggerType })}
                          options={Object.entries(TRIGGER_LABELS).map(([k, v]) => ({ value: k, label: v }))} className="w-full" />
                      </label>
                      <label className="min-w-0 space-y-1.5">
                        <span className="text-xs text-muted-foreground">Dans la collection</span>
                        <Select value={automation.trigger.collectionId} onChange={(v) => updateTrigger({ collectionId: v })}
                          options={collectionOptions} placeholder="Choisir une collection…" className="w-full" />
                      </label>
                    </div>
                  </SettingsSection>

                  {automation.trigger.type === 'item_updated' && triggerProps.length > 0 && <SettingsSection title="Champs surveillés" icon={Braces} appearance="plain" ruled>
                    <p className="mb-2 text-xs text-muted-foreground">L’automatisation démarre quand l’un de ces champs change.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {triggerProps.map((property: any) => {
                        const watched = (automation.trigger.watchFields || []).includes(property.id);
                        return <button key={property.id} onClick={() => {
                          const current = automation.trigger.watchFields || [];
                          updateTrigger({ watchFields: watched ? current.filter((id) => id !== property.id) : [...current, property.id] });
                        }} className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${watched ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                          {property.type === 'relation' && <Link2 size={12} />}{property.name}
                        </button>;
                      })}
                    </div>
                  </SettingsSection>}

                  {automation.trigger.collectionId && <SettingsSection title="Conditions" icon={SlidersHorizontal} appearance="plain" ruled action={
                    <button onClick={addCondition} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-primary hover:bg-accent"><Plus size={13} /> Ajouter</button>
                  }>
                    <div className="space-y-2">
                      {(automation.trigger.conditions || []).map((condition) => <div key={condition.id} className={`grid min-w-0 items-center gap-2 ${OPERATOR_HAS_VALUE.has(condition.operator) ? 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'}`}>
                        <Select value={condition.fieldId} onChange={(value) => updateCondition(condition.id, { fieldId: value })}
                          options={triggerProps.map((property: any) => ({ value: property.id, label: property.name }))} placeholder="Champ…" className="w-full min-w-0" />
                        <Select value={condition.operator} onChange={(value) => updateCondition(condition.id, { operator: value as ConditionOperator })}
                          options={Object.entries(OPERATOR_LABELS).map(([value, label]) => ({ value, label }))} className="w-full min-w-0" />
                        <IconButton label="Supprimer cette condition" onClick={() => removeCondition(condition.id)} className="text-muted-foreground hover:text-destructive"><X size={14} /></IconButton>
                        {OPERATOR_HAS_VALUE.has(condition.operator) && <Input value={condition.value} onChange={(value) => updateCondition(condition.id, { value })} placeholder="Valeur…" className="w-full min-w-0" />}
                      </div>)}
                      {(automation.trigger.conditions || []).length === 0 && <p className="text-xs text-muted-foreground">Aucune condition. L’événement déclenchera toujours l’automatisation.</p>}
                    </div>
                  </SettingsSection>}
                </div>}

                {selectedStepId !== triggerNodeId && selectedAction && <ActionEditor
                  key={selectedAction.id}
                  index={graphNodes.findIndex((node) => node.id === selectedAction.id) - 1}
                  action={selectedAction}
                  collections={collections}
                  triggerCollectionId={automation.trigger.collectionId}
                  inSidebar
                  previousCreateActions={getUpstreamCreatedSources(selectedAction.id, graphNodes, graphEdges, collections)}
                  onChange={(patch) => updateAction(selectedAction.id, patch)}
                  onRemove={() => { const nextNodes = graphNodes.filter((node) => node.id !== selectedAction.id); saveGraph(nextNodes, graphEdges.filter((edge) => edge.source !== selectedAction.id && edge.target !== selectedAction.id)); setSelectedStepId(triggerNodeId); }}
                />}
              </SettingsTabContent>

              <SettingsTabContent value="advanced" scrollable>
                <div className="space-y-5">
                  <SettingsSection title="Informations du bloc" icon={Info} appearance="plain" ruled>
                    <dl className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                      <dt className="text-muted-foreground">Type</dt>
                      <dd className="min-w-0 truncate text-foreground">{selectedStepId === triggerNodeId ? 'Déclencheur' : selectedAction ? ACTION_LABELS[selectedAction.type] : 'Bloc'}</dd>
                      <dt className="text-muted-foreground">Collection</dt>
                      <dd className="min-w-0 truncate text-foreground">{selectedStepId === triggerNodeId ? triggerCollection?.name || 'Non définie' : collections.find((collection) => collection.id === selectedAction?.collectionId)?.name || 'Non définie'}</dd>
                      <dt className="text-muted-foreground">Identifiant</dt>
                      <dd className="truncate font-mono text-xs text-muted-foreground">{selectedStepId}</dd>
                    </dl>
                  </SettingsSection>
                  {selectedAction && <SettingsSection title="Zone sensible" icon={Trash2} appearance="plain" ruled>
                    <p className="mb-3 text-xs text-muted-foreground">Supprimer ce bloc retire aussi ses liaisons du canevas.</p>
                    <button onClick={() => { const nextNodes = graphNodes.filter((node) => node.id !== selectedAction.id); saveGraph(nextNodes, graphEdges.filter((edge) => edge.source !== selectedAction.id && edge.target !== selectedAction.id)); setSelectedStepId(triggerNodeId); setBlockSettingsTab('parameters'); }}
                      className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"><Trash2 size={14} /> Supprimer ce bloc</button>
                  </SettingsSection>}
                </div>
              </SettingsTabContent>
            </SettingsTabs>
          </SettingsSheet>
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
  triggerLabel?: string;
  previousCreateActions?: { id: string; label: string; properties?: any[] }[];
  usedFieldIds: string[];
  onChangeFieldId: (newId: string) => void;
  onChangeValue: (v: string) => void;
  onRemove: () => void;
}> = ({ fieldId, value, targetProps, triggerProps, triggerLabel, previousCreateActions, usedFieldIds, onChangeFieldId, onChangeValue, onRemove }) => {
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
        triggerLabel={triggerLabel}
        previousCreateActions={previousCreateActions}
        className="flex-1 min-w-0"
      />
      <IconButton label="Retirer ce champ" onClick={onRemove} className="shrink-0 text-neutral-400 hover:text-red-500"><X size={14} /></IconButton>
    </div>
  );
};

const CreateItemsEditor: React.FC<{
  items: ItemDef[];
  count?: string;
  onChange: (items: ItemDef[], count: string) => void;
  targetProps: any[];
  triggerProps: any[];
  triggerLabel?: string;
  previousCreateActions?: { id: string; label: string; properties?: any[] }[];
  collectionName: string;
}> = ({ items, count: initialCount = '', onChange, targetProps, triggerProps, triggerLabel, previousCreateActions = [], collectionName }) => {
  const [draft, setDraft] = useState<ItemDef[]>(() =>
    items.length > 0 ? items : [emptyItemDef()]
  );
  // Quantité dynamique — vide = utiliser la liste, sinon nombre ou {{trigger.X}}
  const [draftCount, setDraftCount] = useState(initialCount);
  const [activeItemId, setActiveItemId] = useState(items[0]?.id || '');

  const isDynamic = draftCount.trim() !== '';

  const commit = (nextItems: ItemDef[], nextCount = draftCount) => {
    setDraft(nextItems);
    onChange(nextItems, nextCount.trim());
  };

  const addItem = () => { const item = emptyItemDef(); commit([...draft, item]); setActiveItemId(item.id); };
  const removeItem = (id: string) => { const next = draft.filter((it) => it.id !== id); commit(next); if (activeItemId === id) setActiveItemId(next[0]?.id || ''); };

  const updateItemField = (itemId: string, fieldId: string, value: string) =>
    commit(draft.map((it) => it.id === itemId ? { ...it, fields: { ...it.fields, [fieldId]: value } } : it));

  const changeItemFieldKey = (itemId: string, oldKey: string, newKey: string) =>
    commit(draft.map((it) => {
      if (it.id !== itemId) return it;
      const next = { ...it.fields };
      const val = next[oldKey];
      delete next[oldKey];
      next[newKey] = val ?? '';
      return { ...it, fields: next };
    }));

  const removeItemField = (itemId: string, fieldId: string) =>
    commit(draft.map((it) => {
      if (it.id !== itemId) return it;
      const next = { ...it.fields };
      delete next[fieldId];
      return { ...it, fields: next };
    }));

  const addFieldsToItem = (itemId: string, fieldIds: string[]) => {
    const item = draft.find((it) => it.id === itemId);
    if (!item || !fieldIds.length) return;
    const next = draft.map((it) => it.id === itemId
      ? { ...it, fields: { ...it.fields, ...Object.fromEntries(fieldIds.map((id) => [id, ''])) } }
      : it);
    commit(next);
  };

  // Quand quantité dynamique activée, on masque les items supplémentaires (seul le 1er = template)
  const visibleItems = isDynamic ? draft.slice(0, 1) : draft;
  useEffect(() => {
    if (!visibleItems.some((item) => item.id === activeItemId)) setActiveItemId(visibleItems[0]?.id || '');
  }, [visibleItems, activeItemId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2 dark:border-white/10">
        <ListPlus size={15} className="shrink-0 text-blue-500" />
        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Items à créer</span>
        <span className="truncate text-xs text-neutral-500">· {collectionName}</span>
        <span className="ml-auto hidden text-[11px] text-neutral-400 sm:block">Enregistrement automatique</span>
      </div>

      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
        <span className="text-xs text-neutral-500">Quantité</span>
        <FieldValuePicker
          value={draftCount}
          onChange={(value) => { setDraftCount(value); onChange(draft, value.trim()); }}
          targetProp={null}
          triggerProps={triggerProps}
          triggerLabel={triggerLabel}
          previousCreateActions={previousCreateActions}
          className="max-w-sm"
        />
        <span />
        <span className="text-[11px] text-neutral-400">Vide : crée les onglets ci-dessous. Une valeur : utilise le premier comme modèle.</span>
      </div>

      <Tabs value={activeItemId || visibleItems[0]?.id} onValueChange={setActiveItemId}>
        <div className="flex min-w-0 items-center gap-2 border-b border-neutral-200 dark:border-white/10">
          <TabsList className="h-auto min-w-0 justify-start gap-1 overflow-x-auto bg-transparent p-0">
            {visibleItems.map((item, idx) => <TabsTrigger key={item.id} value={item.id} className="rounded-t-md border-b-2 border-transparent px-3 py-2 text-xs data-[state=active]:border-blue-500">{isDynamic ? 'Modèle' : `Item ${idx + 1}`}</TabsTrigger>)}
          </TabsList>
          {!isDynamic && <button onClick={addItem} className="mb-1 flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"><Plus size={13} /> Ajouter un item</button>}
        </div>
        {visibleItems.map((item, idx) => {
          const fieldEntries = Object.entries(item.fields);
          const usedFieldIds = Object.keys(item.fields);
          const unusedProps = targetProps.filter((p: any) => !usedFieldIds.includes(p.id));

          return <TabsContent key={item.id} value={item.id} className="mt-3 space-y-3 border-0 p-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{isDynamic ? 'Champs du modèle' : `Champs de l’item ${idx + 1}`}</span>
                <span className="text-[11px] text-neutral-400">{fieldEntries.length} champ{fieldEntries.length !== 1 ? 's' : ''}</span>
              </div>
              {fieldEntries.length === 0 && <p className="text-xs text-neutral-400">Aucun champ ajouté. L’item sera créé vide.</p>}
              <div className="space-y-2">
                {fieldEntries.map(([fieldId, value]) => (
                  <ItemFieldRow
                    key={fieldId}
                    fieldId={fieldId}
                    value={value}
                    targetProps={targetProps}
                    triggerProps={triggerProps}
                    triggerLabel={triggerLabel}
                    previousCreateActions={previousCreateActions}
                    usedFieldIds={usedFieldIds}
                    onChangeFieldId={(newId) => changeItemFieldKey(item.id, fieldId, newId)}
                    onChangeValue={(v) => updateItemField(item.id, fieldId, v)}
                    onRemove={() => removeItemField(item.id, fieldId)}
                  />
                ))}
              </div>
              {unusedProps.length > 0 && <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => addFieldsToItem(item.id, [unusedProps[0].id])} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 text-xs text-neutral-700 hover:bg-neutral-50 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/5"><Plus size={12} /> Ajouter un champ</button>
                {unusedProps.length > 1 && <button onClick={() => addFieldsToItem(item.id, unusedProps.map((prop: any) => prop.id))} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"><ListPlus size={13} /> Ajouter les {unusedProps.length} champs restants</button>}
              </div>}
              {!isDynamic && draft.length > 1 && <button onClick={() => removeItem(item.id)} className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"><Trash2 size={12} /> Supprimer cet item</button>}
            </TabsContent>;
        })}
      </Tabs>
    </div>
  );
};

// ─── ActionEditor ─────────────────────────────────────────────────────────────

const ActionEditor: React.FC<{
  index: number;
  action: AutomationAction;
  collections: any[];
  triggerCollectionId: string;
  previousCreateActions?: { id: string; label: string; properties?: any[] }[];
  inSidebar?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveToIndex?: (toIndex: number) => void;
  onChange: (patch: Partial<AutomationAction>) => void;
  onRemove: () => void;
}> = ({ index, action, collections, triggerCollectionId, previousCreateActions = [], inSidebar = false, onMoveUp, onMoveDown, onMoveToIndex, onChange, onRemove }) => {
  const [isDragging, setIsDragging] = useState(false);
  const targetCollection = collections.find((c) => c.id === action.collectionId);
  const targetProps = targetCollection?.properties || [];
  const triggerCollection = collections.find((c) => c.id === triggerCollectionId);
  const triggerProps = triggerCollection?.properties || [];
  const triggerLabel = `Déclencheur · ${triggerCollection?.name || 'item'}`;

  const collectionOptions = collections.map((c) => ({ value: c.id, label: c.name || 'Sans nom' }));

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
      className={`${inSidebar ? 'min-w-0 space-y-4' : 'rounded-xl border border-neutral-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-800'} ${isDragging ? 'opacity-50' : ''}`}
    >
      {!inSidebar && <div className="flex items-center gap-2">
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
      </div>}
      {/* create_item */}
      {action.type === 'create_item' && (
        <div className="space-y-3">
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

          {action.collectionId && <CreateItemsEditor
            key={`${action.id}-${action.collectionId}`}
            items={normalizedItems}
            count={action.count || ''}
            onChange={(items, count) => onChange({ items, count: count || undefined })}
            targetProps={targetProps}
            triggerProps={triggerProps}
            triggerLabel={triggerLabel}
            previousCreateActions={previousCreateActions}
            collectionName={targetCollection?.name || '…'}
          />}
        </div>
      )}

      {/* update_item */}
      {action.type === 'update_item' && (
        <div className="space-y-3">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Mettre à jour ces champs sur l'item déclencheur :
          </div>
          {fieldEntries.map(({ fieldId, value }) => {
            const prop = triggerProps.find((p: any) => p.id === fieldId);
            return (
              <div key={fieldId} className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 dark:border-white/10 dark:bg-neutral-900/50">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Champ à modifier</span>
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
                    className="h-9 min-w-0 flex-1"
                  />
                  <IconButton label="Retirer ce champ" onClick={() => removeField(fieldId)} className="text-neutral-400 hover:text-red-500"><X size={14} /></IconButton>
                </div>
                <TemplateValueEditor value={value} onChange={(nextValue) => setFieldValue(fieldId, nextValue)} triggerProps={triggerProps} triggerLabel={triggerLabel} previousCreateActions={previousCreateActions} />
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
              className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              <Plus size={12} /> Ajouter un champ
            </button>
          )}
        </div>
      )}

      {/* update_field */}
      {action.type === 'update_field' && (
        <div className="space-y-3">
          <div className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 dark:border-white/10 dark:bg-neutral-900/50">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Champ à modifier</span>
              <Select
                value={action.fieldId || ''}
                onChange={(v) => onChange({ fieldId: v, collectionId: triggerCollectionId })}
                options={triggerProps.map((p: any) => ({ value: p.id, label: p.name || p.id }))}
                placeholder="Choisir un champ…"
                className="h-9 min-w-0 flex-1"
              />
            </div>
            <TemplateValueEditor value={action.value || ''} onChange={(v) => onChange({ value: v })} triggerProps={triggerProps} triggerLabel={triggerLabel} previousCreateActions={previousCreateActions} />
          </div>
          {triggerProps.some((p: any) => p.id !== action.fieldId) && (
            <button
              type="button"
              onClick={() => {
                const nextField = triggerProps.find((p: any) => p.id !== action.fieldId);
                if (!nextField) return;
                onChange({
                  type: 'update_item',
                  collectionId: triggerCollectionId,
                  fields: { ...(action.fieldId ? { [action.fieldId]: action.value || '' } : {}), [nextField.id]: '' },
                  fieldId: undefined,
                  value: undefined,
                });
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-blue-300 px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-400/30 dark:text-blue-300 dark:hover:bg-blue-400/10"
            >
              <Plus size={13} /> Ajouter un champ à modifier
            </button>
          )}
        </div>
      )}

      {action.type === 'delay' && (
        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
          <span>Attendre</span>
          <input type="number" min={0} max={60} value={action.delaySeconds ?? 1}
            onChange={(e) => onChange({ delaySeconds: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
            className="w-20 h-9 rounded-lg border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-800 px-2" />
          <span>secondes (maximum 60)</span>
        </div>
      )}

      {action.type === 'find_or_create_item' && (
        <div className="space-y-3">
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
            targetProp={targetProps.find((p: any) => p.id === action.matchFieldId)} triggerProps={triggerProps} triggerLabel={triggerLabel}
            previousCreateActions={previousCreateActions} />}
          <div className="text-xs text-neutral-500">S’il existe, l’item est mis à jour. Sinon, il est créé.</div>
          {Object.entries(action.fields || {}).map(([fieldId, value]) => (
            <div key={fieldId} className="flex gap-2 items-center">
              <Select value={fieldId} onChange={(nextId) => {
                const next = { ...(action.fields || {}) }; const old = next[fieldId]; delete next[fieldId]; next[nextId] = old;
                onChange({ fields: next });
              }} options={targetProps.map((p: any) => ({ value: p.id, label: p.name }))} />
              <FieldValuePicker value={String(value)} onChange={(v) => onChange({ fields: { ...(action.fields || {}), [fieldId]: v } })}
                targetProp={targetProps.find((p: any) => p.id === fieldId)} triggerProps={triggerProps} triggerLabel={triggerLabel}
                previousCreateActions={previousCreateActions} className="flex-1" />
              <button onClick={() => { const next = { ...(action.fields || {}) }; delete next[fieldId]; onChange({ fields: next }); }}><X size={14} /></button>
            </div>
          ))}
          {targetProps.some((p: any) => !Object.hasOwn(action.fields || {}, p.id)) && <button className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap text-xs text-blue-500"
            onClick={() => { const prop = targetProps.find((p: any) => !Object.hasOwn(action.fields || {}, p.id)); if (prop) onChange({ fields: { ...(action.fields || {}), [prop.id]: '' } }); }}>
            <Plus size={12} /> Ajouter un champ à remplir
          </button>}
        </div>
      )}

      {action.type === 'condition' && (
        <div className="space-y-3">
          <div className="text-xs text-neutral-500">Si toutes ces conditions sont vraies :</div>
          {(action.conditions || []).map((condition, conditionIndex) => (
            <div key={condition.id} className="flex flex-wrap items-center gap-2">
              <Select value={condition.fieldId} onChange={(fieldId) => onChange({ conditions: action.conditions!.map((c, i) => i === conditionIndex ? { ...c, fieldId } : c) })}
                options={[
                  ...triggerProps.map((p: any) => ({ value: p.id, label: `${triggerLabel} · ${p.name}` })),
                  ...previousCreateActions.flatMap((source) => (source.properties || []).map((p: any) => ({
                    value: `action.${source.id}.${p.id}`,
                    label: `${source.label} · ${p.name || p.id}`,
                  }))),
                ]} placeholder="Champ…" />
              <Select value={condition.operator} onChange={(operator) => onChange({ conditions: action.conditions!.map((c, i) => i === conditionIndex ? { ...c, operator: operator as ConditionOperator } : c) })}
                options={Object.entries(OPERATOR_LABELS).map(([value, label]) => ({ value, label }))} />
              {OPERATOR_HAS_VALUE.has(condition.operator) && <Input value={condition.value} onChange={(value) => onChange({ conditions: action.conditions!.map((c, i) => i === conditionIndex ? { ...c, value } : c) })} placeholder="Valeur…" />}
              <IconButton label="Supprimer cette condition" onClick={() => onChange({ conditions: (action.conditions || []).filter((c) => c.id !== condition.id) })} className="text-neutral-400 hover:text-red-500"><X size={14} /></IconButton>
            </div>
          ))}
          <button className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap text-xs text-blue-600 hover:underline dark:text-blue-400" onClick={() => onChange({ conditions: [...(action.conditions || []), { id: uuid(), fieldId: '', operator: 'is_not_empty', value: '' }] })}><Plus size={13} /> Ajouter une condition</button>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400"><Link2 size={12} className="shrink-0" /> Relie OUI ou NON à un bloc sur le canevas.</div>
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
  const saveQueues = useRef(new Map<string, Promise<void>>());

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
  const handleChange = useCallback((updated: Automation) => {
    // Mise à jour optimiste
    setAutomations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));

    setSaving((s) => new Set(s).add(updated.id));
    const previousSave = saveQueues.current.get(updated.id) || Promise.resolve();
    const currentSave = previousSave.catch(() => undefined).then(async () => {
      const response = await fetch(`/api/automations/${updated.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Échec de sauvegarde (HTTP ${response.status})`);
      if (Array.isArray(updated.nodes) && JSON.stringify(result.nodes || []) !== JSON.stringify(updated.nodes)) {
        throw new Error('Le serveur n’a pas confirmé la sauvegarde des blocs. Redémarre le serveur API puis réessaie.');
      }
      if (Array.isArray(updated.edges) && JSON.stringify(result.edges || []) !== JSON.stringify(updated.edges)) {
        throw new Error('Le serveur n’a pas confirmé la sauvegarde des liaisons. Redémarre le serveur API puis réessaie.');
      }
    });
    saveQueues.current.set(updated.id, currentSave);
    const finish = () => {
      if (saveQueues.current.get(updated.id) !== currentSave) return;
      saveQueues.current.delete(updated.id);
      setSaving((s) => {
        const next = new Set(s);
        next.delete(updated.id);
        return next;
      });
    };
    void currentSave.then(() => { setError(null); finish(); }, (e: any) => { setError(e.message || 'Erreur de sauvegarde'); finish(); });
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
