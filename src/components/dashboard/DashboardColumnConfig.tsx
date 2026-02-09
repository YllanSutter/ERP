
import React, { useState } from 'react';
import ShinyButton from '@/components/ui/ShinyButton';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';
import { LightSelect } from '@/components/inputs/LightSelect';


const DashboardColumnConfig = ({
  dashboard,
  collections,
  properties,
  onUpdate,
}: any) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const collection = collections.find((c: any) => c.id === dashboard.sourceCollectionId);

  // Trouve la collection racine pour un noeud donné (en remontant l'arbre)
  const getRootGroup = (node: any, path: any[] = []): any => {
    if (!node._parentPath || node._parentPath.length === 0) return node;
    return node._parentPath[0];
  };

  // Récupère la collection à utiliser pour un noeud (colonne/feuille)
  const getNodeCollection = (node: any): any => {
    const rootGroup = getRootGroup(node);
    const groupCollectionId = rootGroup?.collectionId || dashboard.sourceCollectionId;
    return collections.find((c: any) => c.id === groupCollectionId) || collection;
  };

  // Récupère les propriétés pour un noeud
  const getNodeProperties = (node: any): any[] => {
    const nodeCollection = getNodeCollection(node);
    return nodeCollection?.properties || [];
  };

  // Récupère les options pour un champ d'une collection donnée
  const getOptions = (propId: string, node: any) => {
    const props = getNodeProperties(node);
    const prop = props.find((p: any) => p.id === propId);
    if (!prop) return [];
    // Cas relation : aller chercher les items de la collection liée
    if (prop.type === 'relation') {
      // 1. Si prop.options existe (tableau ou fonction), l'utiliser comme dans la vue tableau
      if (Array.isArray(prop.options)) {
        return prop.options.map((opt: any) =>
          typeof opt === 'string'
            ? { value: opt, label: opt }
            : { value: opt.value, label: opt.label || opt.value }
        );
      }
      if (typeof prop.options === 'function') {
        try {
          const opts = prop.options();
          if (Array.isArray(opts)) {
            return opts.map((opt: any) =>
              typeof opt === 'string'
                ? { value: opt, label: opt }
                : { value: opt.value, label: opt.label || opt.value }
            );
          }
        } catch (e) {
          // ignore
        }
      }
      // 2. Sinon, fallback sur tous les items de la collection liée, AVEC FILTRE relation.filter si présent
      const rel = prop.relation || prop.relationTo || prop.target || {};
      const relatedCollectionId = rel.collectionId || rel.targetCollectionId || rel.id;
      if (!relatedCollectionId) return [{ value: '', label: 'Aucune collection liée' }];
      const relatedCollection = collections.find((c: any) => c.id === relatedCollectionId);
      if (!relatedCollection) return [{ value: '', label: 'Collection liée introuvable' }];
      if (!Array.isArray(relatedCollection.items) || relatedCollection.items.length === 0) {
        return [{ value: '', label: 'Aucun item dans la collection liée' }];
      }
      let items = relatedCollection.items;
      // Applique le filtre relation.filter comme dans EditableProperty
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
    // Cas normal (options explicites)
    return prop.options?.map((opt: any) => (typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label || opt.value })) || [];
  };

  // Ajout d'un groupe
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


  // Ajout d'une sous-colonne dans n'importe quel noeud
  const handleAddChild = (parentId: string | null, type: 'leaf' | 'group') => {
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

  // Edition d'un groupe
  const handleUpdateGroup = (groupId: string, patch: any) => {
    const nextTree = (dashboard.columnTree || []).map((g: any) =>
      g.id === groupId ? { ...g, ...patch } : g
    );
    onUpdate({ columnTree: nextTree });
  };

  // Suppression d'un groupe
  const handleRemoveGroup = (groupId: string) => {
    const nextTree = (dashboard.columnTree || []).filter((g: any) => g.id !== groupId);
    onUpdate({ columnTree: nextTree });
  };


  // Edition d'un noeud (groupe ou feuille) récursive
  const handleUpdateNode = (nodeId: string, patch: any) => {
    const updateRecursive = (nodes: any[]): any[] => {
      return nodes.map((node) => {
        if (node.id === nodeId) {
          let next = { ...node, ...patch };
          // Si on modifie le filtre et qu'une valeur est sélectionnée, on met à jour le label
          if (
            ('filterField' in patch || 'typeValues' in patch) &&
            next.filterField &&
            Array.isArray(next.typeValues) && next.typeValues.length === 1 && next.typeValues[0]
          ) {
            // Chercher le label de l'option si possible
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


  // Suppression d'un noeud (groupe ou feuille) récursive
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


  // Repli/déploiement récursif
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
            filterField: field || null,
            childFilterValues: values,
            typeValues: [],
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


  // Rendu récursif des noeuds (groupes, feuilles...)
  const renderNode = (node: any, depth = 0, parentPath: any[] = []) => {
    // Ne jamais modifier node directement pour éviter les cycles !
    const nodeWithParent = { ...node, _parentPath: parentPath };
    const isGroup = !!node.groupField;
    const isLeaf = !isGroup;
    // Pour les groupes racine (depth === 0), on permet de choisir la collection et le champ date
    let groupCollection = null;
    let groupDateFields: any[] = [];
    if (depth === 0) {
      const groupCollectionId = node.collectionId || dashboard.sourceCollectionId;
      groupCollection = collections.find((c: any) => c.id === groupCollectionId) || collection;
      groupDateFields = (groupCollection?.properties || []).filter((p: any) => p.type === 'date' || p.type === 'date_range');
    }
    // Propriétés pour ce noeud (dépend de la collection racine parent)
    const nodeProperties = getNodeProperties(nodeWithParent);
    const primaryFilterField = node.filterField || '';
    const childValuesFromChildren = Array.isArray(node.children)
      ? node.children
          .filter((child: any) => child.filterField === primaryFilterField && Array.isArray(child.typeValues) && child.typeValues.length === 1)
          .map((child: any) => child.typeValues[0])
      : [];
    const childValues = Array.isArray(node.childFilterValues) && node.childFilterValues.length > 0
      ? node.childFilterValues
      : childValuesFromChildren;
    return (
      <div key={node.id} className={`border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 mb-2 ml-${depth * 4} bg-white/70 dark:bg-neutral-900/40 shadow-sm`}> 
        <div className="flex items-center gap-2">
          <button onClick={() => toggleNode(node.id)} className="text-xs px-2 py-1 rounded-full bg-neutral-200/80 dark:bg-white/10 hover:bg-neutral-200">
            {expandedGroups[node.id] ? '−' : '+'}
          </button>
          <input
            value={node.label}
            onChange={(e) => handleUpdateNode(node.id, { label: e.target.value })}
            className="flex-1 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white/80 dark:bg-neutral-950/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button onClick={() => handleRemoveNode(node.id)} className="text-red-600 dark:text-red-300 hover:text-black dark:hover:text-white hover:bg-red-500/20 rounded-full px-2 py-1 text-xs">
            Supprimer
          </button>
          <ShinyButton onClick={() => handleAddChild(node.id, 'leaf')} className="px-2 py-1 text-xs">+ Colonne</ShinyButton>
        </div>

        {expandedGroups[node.id] && (
          <div className="mt-3 space-y-3">
            {/* Racine: collection + champ date */}
            {depth === 0 && (
              <div className="flex gap-3">
                <div>
                  <div className="text-[11px] text-neutral-500 mb-1">Collection</div>
                  <select
                    value={node.collectionId || ''}
                    onChange={e => handleUpdateNode(node.id, { collectionId: e.target.value })}
                    className="w-full bg-white/80 dark:bg-neutral-950/40 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs"
                  >
                    <option value="">Collection</option>
                    {collections.map((col: any) => (
                      <option key={col.id} value={col.id}>{col.name}</option>
                    ))}
                  </select>
                </div>
                {groupDateFields.length > 0 && (
                  <div>
                    <div className="text-[11px] text-neutral-500 mb-1">Champ date</div>
                    <select
                      value={node.dateFieldId || ''}
                      onChange={e => handleUpdateNode(node.id, { dateFieldId: e.target.value })}
                      className="w-full bg-white/80 dark:bg-neutral-950/40 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs"
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

            {/* Groupe: champ + valeur */}
            {isGroup && (
              <div className="flex gap-3">
                <div>
                  <div className="text-[11px] text-neutral-500 mb-1">Champ à grouper</div>
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
                    <div className="text-[11px] text-neutral-500 mb-1">Valeur</div>
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

            {/* Colonne: filtre principal + sous-colonnes */}
            {isLeaf && (
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-[11px] text-neutral-500 mb-1">Filtre principal</div>
                  <LightSelect
                    options={nodeProperties.map((prop: any) => ({ value: prop.id, label: prop.name }))}
                    value={node.filterField || ''}
                    onChange={(val) => handleUpdateNode(node.id, { filterField: val || null, typeValues: [], childFilterValues: [] })}
                    placeholder="À définir"
                    sizeClass="text-xs h-7"
                  />
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500 mb-1">Filtres enfants (sous-colonnes)</div>
                  {node.filterField && (() => {
                    const options = getOptions(node.filterField, nodeWithParent);
                    const props = getNodeProperties(nodeWithParent);
                    const prop = props.find((p: any) => p.id === node.filterField);
                    if (!prop) return null;
                    if (prop.type === 'relation' || prop.type === 'multi_select' || prop.type === 'select') {
                      return (
                        <LightMultiSelect
                          options={options}
                          values={childValues}
                          onChange={(vals) => handleUpdateNode(node.id, { childFilterValues: vals })}
                          placeholder="Valeurs..."
                          sizeClass="text-xs h-7"
                        />
                      );
                    }
                    if (prop.type === 'text' || prop.type === 'url' || prop.type === 'email') {
                      return (
                        <input
                          type="text"
                          value={childValues?.[0] || ''}
                          onChange={e => handleUpdateNode(node.id, { childFilterValues: [e.target.value] })}
                          className="w-full border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                          placeholder="Valeur..."
                        />
                      );
                    }
                    if (prop.type === 'number') {
                      return (
                        <input
                          type="number"
                          value={childValues?.[0] || ''}
                          onChange={e => handleUpdateNode(node.id, { childFilterValues: [e.target.value] })}
                          className="w-full border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                          placeholder="Valeur..."
                        />
                      );
                    }
                    if (Array.isArray(options) && options.length > 0) {
                      return (
                        <LightMultiSelect
                          options={options}
                          values={childValues}
                          onChange={(vals) => handleUpdateNode(node.id, { childFilterValues: vals })}
                          placeholder="Valeurs..."
                          sizeClass="text-xs h-7"
                        />
                      );
                    }
                    return (
                      <input
                        type="text"
                        value={childValues?.[0] || ''}
                        onChange={e => handleUpdateNode(node.id, { childFilterValues: [e.target.value] })}
                        className="w-full border border-black/10 dark:border-white/10 rounded-lg px-2 py-1 text-xs focus:border-indigo-500 focus:outline-none"
                        placeholder="Valeur..."
                      />
                    );
                  })()}
                </div>
                <div className="md:col-span-2 grid items-center gap-2">
                  
                  <div className="text-[11px] text-neutral-500 mb-1">Filtres enfants (sous-colonnes)</div>
                <div className="flex items-center gap-2">
                  <ShinyButton
                    onClick={() => {
                      if (!node.filterField) return;
                      const options = getOptions(node.filterField, nodeWithParent);
                      applyAutoChildren(node.id, node.filterField, childValues || [], options);
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