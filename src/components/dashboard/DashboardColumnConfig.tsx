
import React, { useState } from 'react';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';
import { LightSelect } from '@/components/inputs/LightSelect';

// ─── Icons ──────────────────────────────────────────────────────────────────
const IconGroup = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconColumn = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M9 3v18M15 3v18"/>
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
  >
    <path d="M9 18l6-6-6-6"/>
  </svg>
);
const IconPlus = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M12 5v14M5 12h14"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
  </svg>
);
const IconWand = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 4l5 5-9 9-5-5 9-9zM9 15l-5 5"/>
    <path d="M20 7l1-3 3-1-3-1-1-3-1 3-3 1 3 1 1 3z"/>
  </svg>
);
const IconReset = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>
);

// ─── Depth palette ───────────────────────────────────────────────────────────
const DEPTH_COLORS = [
  { border: '#6366f1', bg: 'rgba(99,102,241,0.05)', badge: '#6366f1', badgeText: '#fff' },
  { border: '#8b5cf6', bg: 'rgba(139,92,246,0.05)', badge: '#8b5cf6', badgeText: '#fff' },
  { border: '#06b6d4', bg: 'rgba(6,182,212,0.05)', badge: '#06b6d4', badgeText: '#fff' },
  { border: '#10b981', bg: 'rgba(16,185,129,0.05)', badge: '#10b981', badgeText: '#fff' },
];
const getDepthColor = (depth: number) => DEPTH_COLORS[depth % DEPTH_COLORS.length];

// ─── Field label input ───────────────────────────────────────────────────────
const FieldSection = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1 min-w-0">
    <span style={{ fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}
      className="text-neutral-400 dark:text-neutral-500">{label}</span>
    {children}
  </div>
);

// ─── Main component ──────────────────────────────────────────────────────────
const DashboardColumnConfig = ({ dashboard, collections, onUpdate }: any) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const collection = collections.find((c: any) => c.id === dashboard.sourceCollectionId);

  const normalizeOption = (opt: any) =>
    typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label || opt.value };

  const getRootGroup = (node: any): any => {
    if (!node._parentPath || node._parentPath.length === 0) return node;
    return node._parentPath[0];
  };

  const getNodeCollection = (node: any): any => {
    const rootGroup = getRootGroup(node);
    const groupCollectionId = rootGroup?.collectionId || dashboard.sourceCollectionId;
    return collections.find((c: any) => c.id === groupCollectionId) || collection;
  };

  const getNodeProperties = (node: any): any[] =>
    (getNodeCollection(node)?.properties || []);

  // Extrait les valeurs distinctes directement depuis les items de la collection,
  // pour les champs sans options prédéfinies (number, date, text…)
  const getUniqueValuesFromItems = (propId: string, node: any): { value: string; label: string }[] => {
    const nodeCollection = getNodeCollection(node);
    if (!nodeCollection) return [];
    const items: any[] = nodeCollection.items || [];
    const props: any[] = nodeCollection.properties || [];
    const prop = props.find((p: any) => p.id === propId);
    if (!prop) return [];

    const seen = new Set<string>();
    items.forEach((item: any) => {
      const val = item[propId];
      if (val == null || val === '') return;

      if (prop.type === 'date') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) seen.add(String(d.getFullYear()));
      } else if (prop.type === 'date_range') {
        const dateStr = val?.start || val?.end || val;
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) seen.add(String(d.getFullYear()));
      } else if (Array.isArray(val)) {
        val.forEach((v: any) => { if (v != null && v !== '') seen.add(String(v)); });
      } else {
        seen.add(String(val));
      }
    });

    return Array.from(seen)
      .sort((a, b) => {
        const na = Number(a), nb = Number(b);
        return !isNaN(na) && !isNaN(nb) ? na - nb : a.localeCompare(b);
      })
      .map((v) => ({ value: v, label: v }));
  };

  const getOptions = (propId: string, node: any) => {
    const props = getNodeProperties(node);
    const prop = props.find((p: any) => p.id === propId);
    if (!prop) return [];
    if (prop.type === 'relation') {
      if (Array.isArray(prop.options)) return prop.options.map(normalizeOption);
      if (typeof prop.options === 'function') {
        try {
          const opts = prop.options();
          if (Array.isArray(opts)) return opts.map(normalizeOption);
        } catch (_) {}
      }
      const rel = prop.relation || prop.relationTo || prop.target || {};
      const relatedCollectionId = rel.collectionId || rel.targetCollectionId || rel.id;
      if (!relatedCollectionId) return [{ value: '', label: 'Aucune collection liée' }];
      const relatedCollection = collections.find((c: any) => c.id === relatedCollectionId);
      if (!relatedCollection) return [{ value: '', label: 'Collection liée introuvable' }];
      if (!Array.isArray(relatedCollection.items) || relatedCollection.items.length === 0)
        return [{ value: '', label: 'Aucun item dans la collection liée' }];
      let items = relatedCollection.items;
      const filterCfg = rel.filter;
      if (filterCfg && relatedCollection.properties) {
        const propFilter = relatedCollection.properties.find((p: any) => p.id === filterCfg.fieldId);
        if (propFilter) {
          const filterVal = String(filterCfg.value || '').toLowerCase();
          items = items.filter((it: any) => {
            const val = it[filterCfg.fieldId];
            if (val == null) return false;
            if (Array.isArray(val)) return val.map((v: any) => String(v).toLowerCase()).includes(filterVal);
            return String(val).toLowerCase() === filterVal;
          });
        }
      }
      return items.map((item: any) => {
        let label = item.name || item.label || item.title;
        if (!label && item.prenom && item.nom) label = item.prenom + ' ' + item.nom;
        else if (!label && item.nom) label = item.nom;
        else if (!label && item.prenom) label = item.prenom;
        if (!label) {
          for (const key in item) {
            if (key !== 'id' && typeof item[key] === 'string' && item[key].length > 0) { label = item[key]; break; }
          }
        }
        if (!label) label = item.id || 'Sans nom';
        return { value: item.id, label };
      });
    }
    return prop.options?.map(normalizeOption) || [];
  };

  const handleAddGroup = () => {
    const newGroup = { id: Date.now().toString(), label: 'Nouveau groupe', groupField: null, groupValue: '', children: [] };
    onUpdate({ columnTree: [...(dashboard.columnTree || []), newGroup] });
    setExpandedGroups((prev) => ({ ...prev, [newGroup.id]: true }));
  };

  const handleAddChild = (parentId: string | null) => {
    const addRecursive = (nodes: any[]): any[] =>
      nodes.map((node) => {
        if (node.id === parentId) {
          const newChild = {
            id: Date.now().toString(), label: 'Nouvelle colonne',
            filterField: null, typeValues: [], dateFieldOverride: {}, children: [],
          };
          return { ...node, children: [...(node.children || []), newChild] };
        }
        if (node.children && node.children.length) return { ...node, children: addRecursive(node.children) };
        return node;
      });
    onUpdate({ columnTree: addRecursive(dashboard.columnTree || []) });
    setExpandedGroups((prev) => ({ ...prev, [parentId as string]: true }));
  };

  const handleUpdateNode = (nodeId: string, patch: any) => {
    const updateRecursive = (nodes: any[]): any[] =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          let next = { ...node, ...patch };
          if (
            ('filterField' in patch || 'typeValues' in patch) &&
            next.filterField &&
            Array.isArray(next.typeValues) && next.typeValues.length === 1 && next.typeValues[0]
          ) {
            const options = getOptions(next.filterField, next);
            const opt = options.find((o: any) => o.value === next.typeValues[0]);
            next.label = opt ? opt.label : next.typeValues[0];
          }
          return next;
        }
        if (node.children && node.children.length) return { ...node, children: updateRecursive(node.children) };
        return node;
      });
    onUpdate({ columnTree: updateRecursive(dashboard.columnTree || []) });
  };

  const handleRemoveNode = (nodeId: string) => {
    const removeRecursive = (nodes: any[]): any[] =>
      nodes.filter((node) => node.id !== nodeId)
           .map((node) => ({ ...node, children: node.children ? removeRecursive(node.children) : [] }));
    onUpdate({ columnTree: removeRecursive(dashboard.columnTree || []) });
  };

  const toggleNode = (nodeId: string) =>
    setExpandedGroups((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));

  const applyAutoChildren = (nodeId: string, field: string, values: string[], options: any[]) => {
    const labels = new Map(options.map((opt: any) => [opt.value, opt.label ?? opt.value]));
    const updateRecursive = (nodes: any[]): any[] =>
      nodes.map((node) => {
        if (node.id === nodeId) {
          const nextChildren = values.map((val, idx) => ({
            id: `${nodeId}-${val}-${idx}-${Date.now()}`,
            label: labels.get(val) || val,
            filterField: field, typeValues: [val], dateFieldOverride: {}, children: [],
          }));
          return { ...node, childFilterField: field || null, childFilterValues: values, children: nextChildren };
        }
        if (node.children && node.children.length) return { ...node, children: updateRecursive(node.children) };
        return node;
      });
    onUpdate({ columnTree: updateRecursive(dashboard.columnTree || []) });
  };

  const renderValueInput = (fieldId: string, values: string[], nodeContext: any, onChange: (next: string[]) => void) => {
    if (!fieldId) return null;
    const options = getOptions(fieldId, nodeContext);
    const props = getNodeProperties(nodeContext);
    const prop = props.find((p: any) => p.id === fieldId);
    if (!prop) return null;
    if (prop.type === 'relation' || prop.type === 'multi_select' || prop.type === 'select') {
      return <LightMultiSelect options={options} values={values || []} onChange={onChange} placeholder="Toutes les valeurs" sizeClass="text-xs h-7" />;
    }
    if (prop.type === 'text' || prop.type === 'url' || prop.type === 'email') {
      return <input type="text" value={values?.[0] || ''} onChange={(e) => onChange([e.target.value])}
        className="w-full border border-black/10 dark:border-white/10 bg-background rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
        placeholder="Valeur..." />;
    }
    if (prop.type === 'number') {
      return <input type="number" value={values?.[0] || ''} onChange={(e) => onChange([e.target.value])}
        className="w-full border border-black/10 dark:border-white/10 bg-background rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
        placeholder="Valeur..." />;
    }
    if (Array.isArray(options) && options.length > 0) {
      return <LightMultiSelect options={options} values={values || []} onChange={onChange} placeholder="Toutes les valeurs" sizeClass="text-xs h-7" />;
    }
    return <input type="text" value={values?.[0] || ''} onChange={(e) => onChange([e.target.value])}
      className="w-full border border-black/10 dark:border-white/10 bg-background rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
      placeholder="Valeur..." />;
  };

  const renderNode = (node: any, depth = 0, parentPath: any[] = []) => {
    const nodeWithParent = { ...node, _parentPath: parentPath };
    const isGroup = !!node.groupField;
    const isLeaf = !isGroup;
    const dc = getDepthColor(depth);
    const isOpen = !!expandedGroups[node.id];

    let groupCollection = null;
    let groupDateFields: any[] = [];
    if (depth === 0) {
      const groupCollectionId = node.collectionId || dashboard.sourceCollectionId;
      groupCollection = collections.find((c: any) => c.id === groupCollectionId) || collection;
      groupDateFields = (groupCollection?.properties || []).filter((p: any) => p.type === 'date' || p.type === 'date_range');
    }

    const nodeProperties = getNodeProperties(nodeWithParent);
    const primaryFilterField = node.filterField || '';
    const childFilterField = node.childFilterField || '';
    const effectiveChildField = childFilterField || primaryFilterField;
    const childValuesFromChildren = Array.isArray(node.children)
      ? node.children.filter((child: any) => child.filterField === effectiveChildField && Array.isArray(child.typeValues) && child.typeValues.length === 1).map((child: any) => child.typeValues[0])
      : [];
    const childValues = Array.isArray(node.childFilterValues) && node.childFilterValues.length > 0
      ? node.childFilterValues : childValuesFromChildren;

    const childCount = (node.children || []).length;

    return (
      <div
        key={node.id}
        style={{
          borderLeft: `3px solid ${dc.border}`,
          background: dc.bg,
          marginLeft: depth > 0 ? 20 : 0,
        }}
        className="rounded-r-lg border border-l-0 border-black/8 dark:border-white/8 mb-2 overflow-hidden"
      >
        {/* ── Node header ── */}
        <div className="flex items-center gap-2 px-3 py-2">
          {/* Toggle */}
          <button
            onClick={() => toggleNode(node.id)}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          >
            <IconChevron open={isOpen} />
          </button>

          {/* Type badge */}
          <span
            style={{ background: dc.badge, color: dc.badgeText, fontSize: 10, letterSpacing: '0.04em' }}
            className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold uppercase"
          >
            {isGroup ? <><IconGroup /><span>Groupe</span></> : <><IconColumn /><span>Colonne</span></>}
          </span>

          {/* Label */}
          <input
            value={node.label}
            onChange={(e) => handleUpdateNode(node.id, { label: e.target.value })}
            placeholder="Nom..."
            className="flex-1 min-w-0 bg-transparent border-b border-black/15 dark:border-white/15 px-1 py-0.5 text-sm font-medium focus:outline-none focus:border-indigo-400 text-neutral-800 dark:text-neutral-100"
          />

          {/* Child count badge */}
          {childCount > 0 && (
            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-black/8 dark:bg-white/10 text-neutral-500 dark:text-neutral-400">
              {childCount} {childCount === 1 ? 'enfant' : 'enfants'}
            </span>
          )}

          {/* Actions */}
          <button
            onClick={() => handleAddChild(node.id)}
            title="Ajouter une colonne enfant"
            className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[11px] text-indigo-600 dark:text-indigo-400 border border-indigo-300/50 dark:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
          >
            <IconPlus /><span>Ajouter</span>
          </button>
          <button
            onClick={() => handleRemoveNode(node.id)}
            title="Supprimer"
            className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <IconTrash />
          </button>
        </div>

        {/* ── Node body (expanded) ── */}
        {isOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-black/6 dark:border-white/6 pt-3">

            {/* Depth-0 : Collection + champ date */}
            {depth === 0 && (
              <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-black/3 dark:bg-white/3 border border-black/5 dark:border-white/5">
                <FieldSection label="Collection source">
                  <select
                    value={node.collectionId || ''}
                    onChange={e => handleUpdateNode(node.id, { collectionId: e.target.value })}
                    className="h-7 text-xs bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 min-w-[140px]"
                  >
                    <option value="">Collection par défaut</option>
                    {collections.map((col: any) => <option key={col.id} value={col.id}>{col.name}</option>)}
                  </select>
                </FieldSection>
                {groupDateFields.length > 0 && (
                  <FieldSection label="Champ date">
                    <select
                      value={node.dateFieldId || ''}
                      onChange={e => handleUpdateNode(node.id, { dateFieldId: e.target.value })}
                      className="h-7 text-xs bg-white dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-indigo-400 min-w-[140px]"
                    >
                      <option value="">Auto</option>
                      {groupDateFields.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </FieldSection>
                )}
              </div>
            )}

            {/* Groupe : champ de groupage */}
            {isGroup && (
              <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-black/3 dark:bg-white/3 border border-black/5 dark:border-white/5">
                <FieldSection label="Grouper par">
                  <LightSelect
                    options={nodeProperties.map((prop: any) => ({ value: prop.id, label: prop.name }))}
                    value={node.groupField || ''}
                    onChange={(val) => handleUpdateNode(node.id, { groupField: val || null })}
                    placeholder="Choisir un champ"
                    sizeClass="text-xs h-7"
                  />
                </FieldSection>
                {node.groupField && (
                  <FieldSection label="Valeur du groupe">
                    <LightSelect
                      options={getOptions(node.groupField, node).map((opt: any) => ({ value: opt.value, label: opt.label }))}
                      value={node.groupValue || ''}
                      onChange={(val) => handleUpdateNode(node.id, { groupValue: val })}
                      placeholder="Choisir une valeur"
                      sizeClass="text-xs h-7"
                    />
                  </FieldSection>
                )}
              </div>
            )}

            {/* Colonne feuille : filtre principal + générateur de sous-colonnes */}
            {isLeaf && (
              <div className="space-y-3">
                {/* Filtre principal */}
                <div className="p-3 rounded-lg bg-black/3 dark:bg-white/3 border border-black/5 dark:border-white/5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2">Filtre de cette colonne</div>
                  <div className="flex flex-wrap gap-3">
                    <FieldSection label="Champ">
                      <LightSelect
                        options={nodeProperties.map((prop: any) => ({ value: prop.id, label: prop.name }))}
                        value={node.filterField || ''}
                        onChange={(val) => handleUpdateNode(node.id, { filterField: val || null, typeValues: [], childFilterValues: [], childFilterField: '' })}
                        placeholder="Aucun filtre"
                        sizeClass="text-xs h-7"
                      />
                    </FieldSection>
                    {node.filterField && (
                      <FieldSection label="Valeur(s)">
                        {renderValueInput(node.filterField, node.typeValues || [], nodeWithParent, (vals) =>
                          handleUpdateNode(node.id, { typeValues: vals })
                        )}
                      </FieldSection>
                    )}
                  </div>
                </div>

                {/* Générateur de sous-colonnes */}
                <div className="p-3 rounded-lg border border-dashed border-black/15 dark:border-white/15">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-2 flex items-center gap-1.5">
                    <IconWand />
                    Générer des sous-colonnes automatiquement
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <FieldSection label="Répartir par champ">
                      <LightSelect
                        options={nodeProperties.map((prop: any) => ({ value: prop.id, label: prop.name }))}
                        value={node.childFilterField || ''}
                        onChange={(val) => handleUpdateNode(node.id, { childFilterField: val || null, childFilterValues: [] })}
                        placeholder="Choisir un champ"
                        sizeClass="text-xs h-7"
                      />
                    </FieldSection>
                    {effectiveChildField && (() => {
                      // Pour les champs sans options prédéfinies (number, date…), on propose
                      // les valeurs distinctes trouvées dans les items comme fallback
                      const baseOptions = getOptions(effectiveChildField, nodeWithParent);
                      const fallbackOptions = baseOptions.length === 0
                        ? getUniqueValuesFromItems(effectiveChildField, nodeWithParent)
                        : [];
                      const displayOptions = baseOptions.length > 0 ? baseOptions : fallbackOptions;
                      const hasOptions = displayOptions.length > 0;
                      return (
                        <FieldSection label={hasOptions ? `Valeurs (vide = toutes · ${displayOptions.length} trouvées)` : 'Valeurs (vide = toutes)'}>
                          {hasOptions ? (
                            <LightMultiSelect
                              options={displayOptions}
                              values={childValues || []}
                              onChange={(vals) => handleUpdateNode(node.id, { childFilterValues: vals })}
                              placeholder="Toutes les valeurs"
                              sizeClass="text-xs h-7"
                            />
                          ) : (
                            renderValueInput(effectiveChildField, childValues || [], nodeWithParent, (vals) =>
                              handleUpdateNode(node.id, { childFilterValues: vals })
                            )
                          )}
                        </FieldSection>
                      );
                    })()}
                    <div className="flex items-center gap-2 pb-0.5">
                      <button
                        onClick={() => {
                          if (!effectiveChildField) return;
                          const baseOptions = getOptions(effectiveChildField, nodeWithParent);
                          const fallbackOptions = baseOptions.length === 0
                            ? getUniqueValuesFromItems(effectiveChildField, nodeWithParent)
                            : [];
                          const allOptions = baseOptions.length > 0 ? baseOptions : fallbackOptions;
                          const valuesToUse =
                            childValues && childValues.length > 0
                              ? childValues
                              : allOptions.map((o: any) => o.value).filter(Boolean);
                          applyAutoChildren(node.id, effectiveChildField, valuesToUse, allOptions);
                        }}
                        disabled={!effectiveChildField}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold
                          bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed
                          transition-colors shadow-sm"
                      >
                        <IconWand />
                        Générer
                      </button>
                      {childCount > 0 && (
                        <button
                          onClick={() => handleUpdateNode(node.id, { childFilterValues: [], children: [] })}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border border-black/8 dark:border-white/8"
                        >
                          <IconReset />
                          Réinitialiser ({childCount})
                        </button>
                      )}
                    </div>
                  </div>
                  {!effectiveChildField && (
                    <p className="mt-2 text-[11px] text-neutral-400 dark:text-neutral-500">
                      Sélectionne un champ pour créer automatiquement une sous-colonne par valeur.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Children */}
            {(node.children || []).length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Enfants ({childCount})
                </div>
                {(node.children || []).map((child: any) => renderNode(child, depth + 1, [...parentPath, nodeWithParent]))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const columnCount = (dashboard.columnTree || []).length;

  return (
    <div className="border dark:border-white/10 border-black/10 rounded-xl mt-4 bg-white/70 dark:bg-neutral-900/50 shadow-sm backdrop-blur overflow-hidden shrink-0">
      {/* ── Header (toujours visible, cliquable pour ouvrir/fermer) ── */}
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer select-none hover:bg-black/2 dark:hover:bg-white/3 transition-colors"
        onClick={() => setIsPanelOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span
            className="transition-transform duration-150"
            style={{ display: 'inline-block', transform: isPanelOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            <IconChevron open={isPanelOpen} />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              Structure des colonnes
              {columnCount > 0 && (
                <span className="ml-2 text-[11px] font-normal text-neutral-400">
                  {columnCount} groupe{columnCount > 1 ? 's' : ''}
                </span>
              )}
            </h3>
            {!isPanelOpen && (
              <p className="text-[11px] text-neutral-400">Cliquer pour configurer les colonnes du dashboard</p>
            )}
          </div>
        </div>
        {isPanelOpen && (
          <button
            onClick={(e) => { e.stopPropagation(); handleAddGroup(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold
              bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-sm"
          >
            <IconPlus />
            Ajouter un groupe
          </button>
        )}
      </div>

      {/* ── Tree (conditionnel) ── */}
      {isPanelOpen && (
        <div className="p-4 border-t border-black/8 dark:border-white/8">
          {columnCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-neutral-400">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <path d="M6.5 10v4M17.5 10v4M6.5 14h11M12 14v4M8 18h8" strokeLinecap="round"/>
              </svg>
              <p className="text-sm">Aucun groupe configuré</p>
              <p className="text-xs text-neutral-300 dark:text-neutral-600">Clique sur "Ajouter un groupe" pour commencer</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(dashboard.columnTree || []).map((node: any) => renderNode(node, 0, []))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardColumnConfig;
