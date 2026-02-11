
import React, { useMemo, useState } from 'react';
import ShinyButton from '@/components/ui/ShinyButton';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';
import { LightSelect } from '@/components/inputs/LightSelect';


const DashboardColumnConfig = ({ dashboard, collections, onUpdate }: any) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const collection = collections.find((c: any) => c.id === dashboard.sourceCollectionId);

  const classNames = useMemo(
    () => ({
      panel:
        'border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 mb-2 bg-white/70 dark:bg-neutral-900/40 shadow-sm',
      label: 'text-[11px] text-neutral-500 mb-1',
      input:
        'w-full border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none',
      inputWide:
        'flex-1 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white/80 dark:bg-neutral-950/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20',
      select:
        'w-full bg-white/80 dark:bg-neutral-950/40 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs',
      toggle:
        'text-xs px-2 py-1 rounded-full bg-neutral-200/80 dark:bg-white/10 hover:bg-neutral-200',
      delete:
        'text-red-600 dark:text-red-300 hover:text-black dark:hover:text-white hover:bg-red-500/20 rounded-full px-2 py-1 text-xs',
    }),
    []
  );

  const normalizeOption = (opt: any) =>
    typeof opt === 'string'
      ? { value: opt, label: opt }
      : { value: opt.value, label: opt.label || opt.value };

  const getRootGroup = (node: any): any => {
    if (!node._parentPath || node._parentPath.length === 0) return node;
    return node._parentPath[0];
  };

  const getNodeCollection = (node: any): any => {
    const rootGroup = getRootGroup(node);
    const groupCollectionId = rootGroup?.collectionId || dashboard.sourceCollectionId;
    return collections.find((c: any) => c.id === groupCollectionId) || collection;
  };

  const getNodeProperties = (node: any): any[] => {
    const nodeCollection = getNodeCollection(node);
    return nodeCollection?.properties || [];
  };

  const getOptions = (propId: string, node: any) => {
    const props = getNodeProperties(node);
    const prop = props.find((p: any) => p.id === propId);
    if (!prop) return [];
    if (prop.type === 'relation') {
      if (Array.isArray(prop.options)) {
        return prop.options.map(normalizeOption);
      }
      if (typeof prop.options === 'function') {
        try {
          const opts = prop.options();
          if (Array.isArray(opts)) {
            return opts.map(normalizeOption);
          }
        } catch (e) {
        }
      }
      const rel = prop.relation || prop.relationTo || prop.target || {};
      const relatedCollectionId = rel.collectionId || rel.targetCollectionId || rel.id;
      if (!relatedCollectionId) return [{ value: '', label: 'Aucune collection liée' }];
      const relatedCollection = collections.find((c: any) => c.id === relatedCollectionId);
      if (!relatedCollection) return [{ value: '', label: 'Collection liée introuvable' }];
      if (!Array.isArray(relatedCollection.items) || relatedCollection.items.length === 0) {
        return [{ value: '', label: 'Aucun item dans la collection liée' }];
      }
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
            if (key !== 'id' && typeof item[key] === 'string' && item[key].length > 0) {
              label = item[key];
              break;
            }
          }
        }
        if (!label) label = item.id || 'Sans nom';
        return {
          value: item.id,
          label
        };
      });
    }
    return prop.options?.map(normalizeOption) || [];
  };

  const handleAddGroup = () => {
    const newGroup = {
      id: Date.now().toString(),
      label: 'Nouveau groupe',
      groupField: null,
      groupValue: '',
      children: [],
    };
    onUpdate({ columnTree: [...(dashboard.columnTree || []), newGroup] });
    setExpandedGroups((prev) => ({ ...prev, [newGroup.id]: true }));
  };

  const handleAddChild = (parentId: string | null) => {
    const addRecursive = (nodes: any[]): any[] => {
      return nodes.map((node) => {
        if (node.id === parentId) {
          const newChild = {
            id: Date.now().toString(),
            label: 'Nouvelle colonne',
            filterField: null,
            typeValues: [],
            dateFieldOverride: {},
            children: [],
          };
          return {
            ...node,
            children: [...(node.children || []), newChild],
          };
        }
        if (node.children && node.children.length) {
          return { ...node, children: addRecursive(node.children) };
        }
        return node;
      });
    };
    onUpdate({ columnTree: addRecursive(dashboard.columnTree || []) });
    setExpandedGroups((prev) => ({ ...prev, [parentId as string]: true }));
  };

  const handleUpdateNode = (nodeId: string, patch: any) => {
    const updateRecursive = (nodes: any[]): any[] => {
      return nodes.map((node) => {
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
        if (node.children && node.children.length) {
          return { ...node, children: updateRecursive(node.children) };
        }
        return node;
      });
    };
    onUpdate({ columnTree: updateRecursive(dashboard.columnTree || []) });
  };

  const handleRemoveNode = (nodeId: string) => {
    const removeRecursive = (nodes: any[]): any[] => {
      return nodes
        .filter((node) => node.id !== nodeId)
        .map((node) => ({
          ...node,
          children: node.children ? removeRecursive(node.children) : [],
        }));
    };
    onUpdate({ columnTree: removeRecursive(dashboard.columnTree || []) });
  };

  const toggleNode = (nodeId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const applyAutoChildren = (nodeId: string, field: string, values: string[], options: any[]) => {
    const labels = new Map(options.map((opt: any) => [opt.value, opt.label ?? opt.value]));
    const updateRecursive = (nodes: any[]): any[] => {
      return nodes.map((node) => {
        if (node.id === nodeId) {
          const nextChildren = values.map((val, idx) => ({
            id: `${nodeId}-${val}-${idx}-${Date.now()}`,
            label: labels.get(val) || val,
            filterField: field,
            typeValues: [val],
            dateFieldOverride: {},
            children: [],
          }));
          return {
            ...node,
            childFilterField: field || null,
            childFilterValues: values,
            children: nextChildren,
          };
        }
        if (node.children && node.children.length) {
          return { ...node, children: updateRecursive(node.children) };
        }
        return node;
      });
    };
    onUpdate({ columnTree: updateRecursive(dashboard.columnTree || []) });
  };

  const renderValueInput = (
    fieldId: string,
    values: string[],
    nodeContext: any,
    onChange: (next: string[]) => void
  ) => {
    if (!fieldId) return null;
    const options = getOptions(fieldId, nodeContext);
    const props = getNodeProperties(nodeContext);
    const prop = props.find((p: any) => p.id === fieldId);
    if (!prop) return null;
    if (prop.type === 'relation' || prop.type === 'multi_select' || prop.type === 'select') {
      return (
        <LightMultiSelect
          options={options}
          values={values || []}
          onChange={(vals) => onChange(vals)}
          placeholder="Valeurs..."
          sizeClass="text-xs h-7"
        />
      );
    }
    if (prop.type === 'text' || prop.type === 'url' || prop.type === 'email') {
      return (
        <input
          type="text"
          value={values?.[0] || ''}
          onChange={(e) => onChange([e.target.value])}
          className={classNames.input}
          placeholder="Valeur..."
        />
      );
    }
    if (prop.type === 'number') {
      return (
        <input
          type="number"
          value={values?.[0] || ''}
          onChange={(e) => onChange([e.target.value])}
          className={classNames.input}
          placeholder="Valeur..."
        />
      );
    }
    if (Array.isArray(options) && options.length > 0) {
      return (
        <LightMultiSelect
          options={options}
          values={values || []}
          onChange={(vals) => onChange(vals)}
          placeholder="Valeurs..."
          sizeClass="text-xs h-7"
        />
      );
    }
    return (
      <input
        type="text"
        value={values?.[0] || ''}
        onChange={(e) => onChange([e.target.value])}
        className={classNames.input}
        placeholder="Valeur..."
      />
    );
  };

  const renderNode = (node: any, depth = 0, parentPath: any[] = []) => {
    const nodeWithParent = { ...node, _parentPath: parentPath };
    const isGroup = !!node.groupField;
    const isLeaf = !isGroup;
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
      ? node.children
        .filter((child: any) => child.filterField === effectiveChildField && Array.isArray(child.typeValues) && child.typeValues.length === 1)
          .map((child: any) => child.typeValues[0])
      : [];
    const childValues = Array.isArray(node.childFilterValues) && node.childFilterValues.length > 0
      ? node.childFilterValues
      : childValuesFromChildren;
    return (
      <div key={node.id} className={`${classNames.panel} ml-${depth * 4}`}> 

        <div className="flex items-center gap-2">
          <button onClick={() => toggleNode(node.id)} className={classNames.toggle}>
            {expandedGroups[node.id] ? '−' : '+'}
          </button>
          <input
            value={node.label}
            onChange={(e) => handleUpdateNode(node.id, { label: e.target.value })}
            className={classNames.inputWide}
          />
          <button onClick={() => handleRemoveNode(node.id)} className={classNames.delete}>
            Supprimer
          </button>
          <ShinyButton onClick={() => handleAddChild(node.id)} className="px-2 py-1 text-xs">+ Colonne</ShinyButton>
        </div>

        {expandedGroups[node.id] && (
          <div className="mt-3 space-y-3">
            {depth === 0 && (
              <div className="flex gap-3">
                <div>
                  <div className={classNames.label}>Collection</div>
                  <select
                    value={node.collectionId || ''}
                    onChange={e => handleUpdateNode(node.id, { collectionId: e.target.value })}
                    className={classNames.select}
                  >
                    <option value="">Collection</option>
                    {collections.map((col: any) => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                </div>
                {groupDateFields.length > 0 && (
                  <div>
                    <div className={classNames.label}>Champ date</div>
                    <select
                      value={node.dateFieldId || ''}
                      onChange={e => handleUpdateNode(node.id, { dateFieldId: e.target.value })}
                      className={classNames.select}
                    >
                      <option value="">Champ date</option>
                      {groupDateFields.map((f: any) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {isGroup && (
              <div className="flex gap-3">
                <div>
                  <div className={classNames.label}>Champ à grouper</div>
                  <LightSelect
                    options={nodeProperties.map((prop: any) => ({ value: prop.id, label: prop.name }))}
                    value={node.groupField || ''}
                    onChange={(val) => handleUpdateNode(node.id, { groupField: val || null })}
                    placeholder="À définir"
                    sizeClass="text-xs h-7"
                  />
                </div>
                {node.groupField && (
                  <div>
                    <div className={classNames.label}>Valeur</div>
                    <LightSelect
                      options={getOptions(node.groupField, node).map((opt: any) => ({ value: opt.value, label: opt.label }))}
                      value={node.groupValue || ''}
                      onChange={(val) => handleUpdateNode(node.id, { groupValue: val })}
                      placeholder="À définir"
                      sizeClass="text-xs h-7"
                    />
                  </div>
                )}
              </div>
            )}

            {isLeaf && (
              <div className="flex gap-5">
                <div>
                  <div className={classNames.label}>Filtre principal</div>
                  <LightSelect
                    options={nodeProperties.map((prop: any) => ({ value: prop.id, label: prop.name }))}
                    value={node.filterField || ''}
                    onChange={(val) => handleUpdateNode(node.id, { filterField: val || null, typeValues: [], childFilterValues: [], childFilterField: '' })}
                    placeholder="À définir"
                    sizeClass="text-xs h-7"
                  />
                </div>
                <div>
                  <div className={classNames.label}>Valeur(s) du filtre principal</div>
                  {renderValueInput(node.filterField, node.typeValues || [], nodeWithParent, (vals) =>
                    handleUpdateNode(node.id, { typeValues: vals })
                  )}
                </div>
                <div>
                  <div className={classNames.label}>Filtre enfant (sous-colonnes)</div>
                  <LightSelect
                    options={nodeProperties.map((prop: any) => ({ value: prop.id, label: prop.name }))}
                    value={node.childFilterField || ''}
                    onChange={(val) => handleUpdateNode(node.id, { childFilterField: val || null, childFilterValues: [] })}
                    placeholder="À définir"
                    sizeClass="text-xs h-7"
                  />
                </div>
                <div>
                  <div className={classNames.label}>Valeur(s) du filtre enfant</div>
                  {renderValueInput(effectiveChildField, childValues || [], nodeWithParent, (vals) =>
                    handleUpdateNode(node.id, { childFilterValues: vals })
                  )}
                </div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <ShinyButton
                    onClick={() => {
                      if (!effectiveChildField) return;
                      const options = getOptions(effectiveChildField, nodeWithParent);
                      applyAutoChildren(node.id, effectiveChildField, childValues || [], options);
                    }}
                    className="px-3 py-1 text-xs"
                  >
                    Générer les sous-colonnes
                  </ShinyButton>
                  <button
                    type="button"
                    onClick={() => handleUpdateNode(node.id, { childFilterValues: [], children: [] })}
                    className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  >
                    Réinitialiser
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 pl-6">
              {(node.children || []).length === 0 && (
                <div className="text-xs text-neutral-500">Ajoute une colonne ou un groupe.</div>
              )}
              {(node.children || []).map((child: any) => renderNode(child, depth + 1, [...parentPath, nodeWithParent]))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border dark:border-white/10 border-black/10 rounded-xl p-5 mt-10 bg-white/70 dark:bg-neutral-900/50 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Configuration avancée multi-niveaux</h3>
          <p className="text-sm text-neutral-500">Groupes et colonnes imbriqués.</p>
        </div>
        <ShinyButton onClick={handleAddGroup} className="px-4 py-2">
          Ajouter un groupe racine
        </ShinyButton>
      </div>
      <div className="space-y-6">
        {(dashboard.columnTree || []).length === 0 && (
          <div className="text-sm text-neutral-500">Ajoute un groupe pour commencer.</div>
        )}
        {(dashboard.columnTree || []).map((node: any) => renderNode(node, 0, []))}
      </div>
    </div>
  );
};

export default DashboardColumnConfig;