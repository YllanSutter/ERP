
import React, { useState } from 'react';
import ShinyButton from '@/components/ui/ShinyButton';
import { LightMultiSelect } from '@/components/inputs/LightMultiSelect';


const DashboardColumnConfig = ({
  dashboard,
  collections,
  properties,
  onUpdate,
}: any) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const collection = collections.find((c: any) => c.id === dashboard.sourceCollectionId);
  const allProperties = collection?.properties || [];
  const allOptions = (propId: string) => {
    const prop = allProperties.find((p: any) => p.id === propId);
    return prop?.options?.map((opt: any) => (typeof opt === 'string' ? { value: opt, label: opt } : { value: opt.value, label: opt.label || opt.value })) || [];
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


  // Ajout d'une sous-colonne ou sous-groupe dans n'importe quel noeud
  const handleAddChild = (parentId: string | null, type: 'leaf' | 'group') => {
    const addRecursive = (nodes: any[]): any[] => {
      return nodes.map((node) => {
        if (node.id === parentId) {
          const newChild = type === 'leaf'
            ? {
                id: Date.now().toString(),
                label: 'Nouvelle sous-colonne',
                filterField: null,
                typeValues: [],
                dateFieldOverride: {},
                children: [],
              }
            : {
                id: Date.now().toString(),
                label: 'Nouveau sous-groupe',
                groupField: null,
                groupValue: '',
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
          return { ...node, ...patch };
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


  // Rendu récursif des noeuds (groupes, feuilles, sous-groupes...)
  const renderNode = (node: any, depth = 0) => {
    const isGroup = !!node.groupField;
    const isLeaf = !isGroup;
    return (
      <div key={node.id} className={`bg-neutral-900 border border-white/10 rounded px-3 py-2 mb-2 ml-${depth * 4}`}> 
        <div className="flex items-center gap-2 mb-2">
          <button onClick={() => toggleNode(node.id)} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20">
            {expandedGroups[node.id] ? '−' : '+'}
          </button>
          <input
            value={node.label}
            onChange={(e) => handleUpdateNode(node.id, { label: e.target.value })}
            className="flex-1 bg-neutral-900 border border-white/10 rounded px-3 py-2 text-sm"
          />
          {isGroup && <>
            <span className="text-neutral-400 text-xs">Champ à grouper :</span>
            <select
              value={node.groupField || ''}
              onChange={(e) => handleUpdateNode(node.id, { groupField: e.target.value || null })}
              className="bg-neutral-900 border border-white/10 rounded px-2 py-1 text-xs"
            >
              <option value="">À définir</option>
              {allProperties.map((prop: any) => (
                <option key={prop.id} value={prop.id}>{prop.name}</option>
              ))}
            </select>
            <span className="text-neutral-400 text-xs">Valeur :</span>
            {node.groupField && (
              <select
                value={node.groupValue || ''}
                onChange={(e) => handleUpdateNode(node.id, { groupValue: e.target.value })}
                className="bg-neutral-900 border border-white/10 rounded px-2 py-1 text-xs"
              >
                <option value="">À définir</option>
                {allOptions(node.groupField).map((opt: any) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}
          </>}
          {isLeaf && <>
            <span className="text-neutral-400 text-xs">Champ à filtrer :</span>
            <select
              value={node.filterField || ''}
              onChange={(e) => handleUpdateNode(node.id, { filterField: e.target.value || null, typeValues: [] })}
              className="bg-neutral-900 border border-white/10 rounded px-2 py-1 text-xs"
            >
              <option value="">À définir</option>
              {allProperties.map((prop: any) => (
                <option key={prop.id} value={prop.id}>{prop.name}</option>
              ))}
            </select>
            {node.filterField && (
              <LightMultiSelect
                options={allOptions(node.filterField)}
                values={node.typeValues || []}
                onChange={(vals) => handleUpdateNode(node.id, { typeValues: vals })}
                placeholder="Valeurs..."
                sizeClass="text-xs h-7"
              />
            )}
          </>}
          <button onClick={() => handleRemoveNode(node.id)} className="text-red-300 hover:text-white hover:bg-red-500/20 rounded px-2 py-1 text-xs ml-2">
            Supprimer
          </button>
          <ShinyButton onClick={() => handleAddChild(node.id, 'leaf')} className="px-2 py-1 ml-2 text-xs">+ Sous-colonne</ShinyButton>
          <ShinyButton onClick={() => handleAddChild(node.id, 'group')} className="px-2 py-1 ml-2 text-xs">+ Sous-groupe</ShinyButton>
        </div>
        {expandedGroups[node.id] && (
          <div className="space-y-3 pl-6">
            {(node.children || []).length === 0 && (
              <div className="text-xs text-neutral-500">Ajoute une sous-colonne ou un sous-groupe.</div>
            )}
            {(node.children || []).map((child: any) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border border-white/10 rounded-lg p-4 bg-neutral-900/60 mt-20">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Configuration avancée multi-niveaux</h3>
          <p className="text-sm text-neutral-500">Groupes, sous-colonnes et sous-groupes imbriqués.</p>
        </div>
        <ShinyButton onClick={handleAddGroup} className="px-4 py-2">
          Ajouter un groupe racine
        </ShinyButton>
      </div>
      <div className="space-y-6">
        {(dashboard.columnTree || []).length === 0 && (
          <div className="text-sm text-neutral-500">Ajoute un groupe pour commencer.</div>
        )}
        {(dashboard.columnTree || []).map((node: any) => renderNode(node, 0))}
      </div>
    </div>
  );
};

export default DashboardColumnConfig;