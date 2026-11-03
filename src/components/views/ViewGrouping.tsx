import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GroupHeader } from '@/components/ui/group-header';
import ViewGroupTabs from './ViewGroupTabs';
import { useGrouping } from '@/lib/hooks/useGrouping';
import type { Collection, Item, Property, TableGroupDisplayMode } from '@/lib/types';
import { countItemsInGroup, getGroupLabel } from '@/lib/groupingUtils';
import { getGroupSelectionStorageKey, GROUPING_SELECTION_CHANGE_EVENT, readGroupFieldSelections, saveGroupFieldSelection, saveGroupingSelection } from '@/lib/groupingSelectionStorage';

// TabsContent is a general-purpose panel with a border and generous padding.
// In a view grouping, the renderer already owns its surface (table, cards, etc.).
const groupedTabsContentClass = 'mt-2 rounded-none border-0 p-0';

const getStoredGroupChoice = (key: string, choices: string[]) => {
  if (typeof window === 'undefined') return undefined;
  try {
    const stored = window.localStorage.getItem(key);
    return stored && choices.includes(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
};

interface ViewGroupingProps {
  items: Item[];
  groups: string[];
  properties: Property[];
  collections: Collection[];
  initialExpandedGroups?: string[];
  onExpandedGroupsChange?: (groups: string[]) => void;
  groupDisplayMode?: TableGroupDisplayMode;
  groupDisplayModes?: Record<string, TableGroupDisplayMode>;
  groupDisplayColumnCount?: 1 | 2 | 3;
  groupDisplayColumnCounts?: Record<string, 1 | 2 | 3>;
  paginateItems?: (items: Item[]) => Item[];
  renderItems: (items: Item[]) => React.ReactNode;
  className?: string;
  onActiveGroupPathChange?: (path: string | undefined) => void;
  /** Reuse the table's grouping selection so renderers stay interchangeable. */
  collectionId?: string;
  /** Opening selection supplied by a containing dialog; overrides its older stored choices. */
  initialGroupPath?: string;
}

export function useViewGrouping(
  items: Item[],
  groups: string[],
  properties: Property[],
  collections: Collection[],
  initialExpandedGroups?: string[],
  onExpandedGroupsChange?: (groups: string[]) => void,
) {
  const { groupedStructure, itemsMap, expandedGroups, toggleGroup } = useGrouping(
    items,
    groups,
    properties,
    collections,
    initialExpandedGroups,
    onExpandedGroupsChange,
  );
  const getItemsForGroup = useCallback((path: string) => {
    if (!groupedStructure) return [];
    const ids = new Set<string>();
    const collect = (currentPath: string) => {
      const group = groupedStructure.structure[currentPath];
      if (!group) return;
      group.itemIds.forEach((id) => ids.add(id));
      group.subGroups.forEach(collect);
    };
    collect(path);
    return Array.from(ids)
      .map((id) => itemsMap.get(id))
      .filter((item): item is Item => Boolean(item));
  }, [groupedStructure, itemsMap]);

  return { groupedStructure, itemsMap, expandedGroups, toggleGroup, getItemsForGroup };
}

const ViewGrouping: React.FC<ViewGroupingProps> = ({
  items,
  groups,
  properties,
  collections,
  initialExpandedGroups,
  onExpandedGroupsChange,
  groupDisplayMode = 'accordion',
  groupDisplayModes = {},
  groupDisplayColumnCount = 3,
  groupDisplayColumnCounts = {},
  paginateItems,
  renderItems,
  className,
  onActiveGroupPathChange,
  collectionId,
  initialGroupPath,
}) => {
  const [activeSelects, setActiveSelects] = useState<Record<number, string>>(() => Object.fromEntries(
    (initialGroupPath ? initialGroupPath.split('/') : []).map((_, depth, parts) => [depth, parts.slice(0, depth + 1).join('/')])
  ));
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>(() => {
    const paths = initialGroupPath ? initialGroupPath.split('/').map((_, depth, parts) => parts.slice(0, depth + 1).join('/')) : [];
    return Object.fromEntries(paths.map((path, depth) => [depth ? paths[depth - 1] : 'root', path]));
  });
  const [hasHydratedSelections, setHasHydratedSelections] = useState(initialGroupPath !== undefined);
  const { groupedStructure, itemsMap, expandedGroups, toggleGroup, getItemsForGroup } = useViewGrouping(
    items,
    groups,
    properties,
    collections,
    initialExpandedGroups,
    onExpandedGroupsChange,
  );

  const rootMode = groupDisplayModes[groups[0]] || groupDisplayMode;
  const rootTabsStorageKey = useMemo(
    () => `erp:table:root-tabs:${collectionId || 'unknown'}:${groups.join('|')}`,
    [collectionId, groups],
  );
  const rootSelectStorageKey = useMemo(
    () => `erp:table:root-select:${collectionId || 'unknown'}:${groups.join('|')}`,
    [collectionId, groups],
  );
  const groupFieldSelectionStorageKey = useMemo(() => getGroupSelectionStorageKey(collectionId || 'unknown'), [collectionId]);

  useEffect(() => {
    if (initialGroupPath !== undefined || typeof window === 'undefined') return;
    try {
      const sharedSelections = readGroupFieldSelections(collectionId || 'unknown');
      const sharedSelects = Object.fromEntries(groups.flatMap((fieldId, depth) => typeof sharedSelections[fieldId] === 'string' ? [[depth, sharedSelections[fieldId]]] : []));
      const rawSelects = window.localStorage.getItem(rootSelectStorageKey);
      if (Object.keys(sharedSelects).length > 0) setActiveSelects(sharedSelects);
      else if (rawSelects) {
        const storedSelects = JSON.parse(rawSelects);
        if (storedSelects && typeof storedSelects === 'object') setActiveSelects(storedSelects);
      }
      const storedTab = window.localStorage.getItem(rootTabsStorageKey);
      if (storedTab) setActiveTabs((previous) => ({ ...previous, root: storedTab }));
    } catch {
      // Fall back to the first available group.
    } finally {
      setHasHydratedSelections(true);
    }
  }, [rootSelectStorageKey, rootTabsStorageKey, initialGroupPath]);

  useEffect(() => {
    if (!hasHydratedSelections || typeof window === 'undefined') return;
    const syncGroupingSelection = (event: Event) => {
      const { key, value } = (event as CustomEvent<{ key?: string; value?: string }>).detail || {};
      if (key === rootSelectStorageKey && typeof value === 'string') {
        try {
          const next = JSON.parse(value);
          if (next && typeof next === 'object') setActiveSelects(next);
        } catch {
          // Ignore invalid external state.
        }
      } else if (key === rootTabsStorageKey && typeof value === 'string') {
        setActiveTabs((previous) => ({ ...previous, root: value }));
      } else if (key === groupFieldSelectionStorageKey && typeof value === 'string') {
        try {
          const shared = JSON.parse(value);
          const next = Object.fromEntries(groups.flatMap((fieldId, depth) => typeof shared?.[fieldId] === 'string' ? [[depth, shared[fieldId]]] : []));
          setActiveSelects(next);
        } catch {
          // Ignore invalid external state.
        }
      } else if (typeof key === 'string' && typeof value === 'string') {
        const prefix = `erp:table:sub-tabs:${collectionId || 'unknown'}:`;
        if (key.startsWith(prefix)) {
          const suffix = key.slice(prefix.length);
          const separator = suffix.lastIndexOf(':');
          if (separator > 0) setActiveTabs((previous) => ({ ...previous, [suffix.slice(0, separator)]: value }));
        }
      }
    };
    window.addEventListener(GROUPING_SELECTION_CHANGE_EVENT, syncGroupingSelection);
    return () => window.removeEventListener(GROUPING_SELECTION_CHANGE_EVENT, syncGroupingSelection);
  }, [collectionId, groupFieldSelectionStorageKey, groups, hasHydratedSelections, rootSelectStorageKey, rootTabsStorageKey]);
  const activeGroupPath = useMemo(() => {
    if (!groupedStructure || groups.length === 0) return undefined;
    const roots = groupedStructure.rootGroups;
    if (rootMode === 'select') {
      let path = activeSelects[0] && roots.includes(activeSelects[0]) ? activeSelects[0] : roots[0];
      for (let depth = 1; depth < groups.length; depth += 1) {
        const children = groupedStructure.structure[path]?.subGroups || [];
        if (!children.length) break;
        const mode = groupDisplayModes[groups[depth]] || 'accordion';
        if (mode !== 'select') {
          if (mode === 'tabs') return activeTabs[path] && children.includes(activeTabs[path]) ? activeTabs[path] : children[0];
          break;
        }
        path = activeSelects[depth] && children.includes(activeSelects[depth]) ? activeSelects[depth] : children[0];
      }
      return path;
    }
    const selectedPaths = Object.values(activeTabs).filter((path) => typeof path === 'string');
    return selectedPaths.sort((left, right) => right.length - left.length)[0] || roots[0];
  }, [activeSelects, activeTabs, groupedStructure, groups.length, rootMode]);
  React.useEffect(() => { onActiveGroupPathChange?.(activeGroupPath); }, [activeGroupPath, onActiveGroupPathChange]);
  const getMode = useCallback((path: string) => {
    const depth = path.split('/').length - 1;
    return groupDisplayModes[groups[depth]] || (depth === 0 ? rootMode : 'accordion');
  }, [groupDisplayModes, groups, rootMode]);
  const getColumnsClassName = useCallback((groupId?: string) => {
    const count = groupId ? groupDisplayColumnCounts[groupId] || groupDisplayColumnCount : groupDisplayColumnCount;
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 lg:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 2xl:grid-cols-3';
  }, [groupDisplayColumnCount, groupDisplayColumnCounts]);

  const renderGroup = useMemo(() => {
    const renderRecursive = (path: string): React.ReactNode => {
      if (!groupedStructure) return null;
      const depth = path.split('/').length - 1;
      const value = path.split('/').pop() || path;
      const property = properties.find((candidate) => candidate.id === groups[depth]);
      const children = groupedStructure.structure[path]?.subGroups || [];
      const mode = getMode(path);
      const expanded = expandedGroups.has(path);
      const collapsible = mode === 'accordion';
      const groupItems = getItemsForGroup(path);
      const childProperty = properties.find((candidate) => candidate.id === groups[depth + 1]);
      const activeTab = activeTabs[path] && children.includes(activeTabs[path])
        ? activeTabs[path]
        : getStoredGroupChoice(`erp:table:sub-tabs:${collectionId || 'unknown'}:${path}:${groups[depth + 1] || 'none'}`, children) || children[0];
      const activeSelect = activeSelects[depth + 1] && children.includes(activeSelects[depth + 1])
        ? activeSelects[depth + 1]
        : children[0];
      const childMode = groups[depth + 1]
        ? groupDisplayModes[groups[depth + 1]] || 'accordion'
        : 'accordion';
      const renderChildren = children.length === 0 ? renderItems(paginateItems ? paginateItems(groupItems) : groupItems) : childMode === 'tabs' ? (
        <Tabs
          value={activeTab}
          onValueChange={(next) => {
            setActiveTabs((previous) => ({ ...previous, [path]: next }));
            saveGroupingSelection(`erp:table:sub-tabs:${collectionId || 'unknown'}:${path}:${groups[depth + 1] || 'none'}`, next);
            saveGroupFieldSelection(collectionId || 'unknown', groups[depth + 1] || '', next);
          }}
        >
          <ViewGroupTabs
            items={children.map((child) => ({
              id: child,
              label: childProperty
                ? getGroupLabel(childProperty, child.split('/').pop() === '(vide)' ? undefined : child.split('/').pop(), collections)
                : child.split('/').pop() || child,
              itemCount: countItemsInGroup(child, groupedStructure.structure),
            }))}
            activeId={activeTab}
          />
          {children.map((child) => (
            <TabsContent key={child} value={child} className={groupedTabsContentClass}>{renderRecursive(child)}</TabsContent>
          ))}
        </Tabs>
      ) : childMode === 'select' ? (
        <div className="space-y-2">
          <Select
            value={activeSelect}
            onValueChange={(next) => setActiveSelects((previous) => {
              const nextState = { ...previous, [depth + 1]: next };
              Object.keys(nextState).forEach((key) => {
                if (Number(key) > depth + 1) delete nextState[Number(key)];
              });
              saveGroupingSelection(`erp:table:sub-select:${collectionId || 'unknown'}:${path}:${groups[depth + 1] || 'none'}`, next);
              saveGroupFieldSelection(collectionId || 'unknown', groups[depth + 1] || '', next);
              return nextState;
            })}
          >
            <SelectTrigger className="mx-3 w-[calc(100%-1.5rem)] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child} value={child}>
                  {child.split('/').pop() || child} ({countItemsInGroup(child, groupedStructure.structure)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {renderRecursive(activeSelect)}
        </div>
      ) : childMode === 'columns' ? (
        <div className={`grid gap-4 ${getColumnsClassName(groups[depth + 1])}`}>
          {children.map((child) => <div key={child} className="min-w-0">{renderRecursive(child)}</div>)}
        </div>
      ) : children.map((child) => renderRecursive(child));

      return (
        <section key={path} className="space-y-2 px-3 py-2">
          <GroupHeader
            onClick={() => collapsible && toggleGroup(path)}
            collapsible={collapsible}
            expanded={expanded}
            count={groupItems.length}
            label={`${property?.name ? `${property.name}: ` : ''}${property
              ? getGroupLabel(property, value === '(vide)' ? undefined : value, collections)
              : value}`}
          />
          {(!collapsible || expanded) && renderChildren}
        </section>
      );
    };
    return renderRecursive;
  }, [
    activeSelects,
    activeTabs,
    collections,
    expandedGroups,
    getItemsForGroup,
    getMode,
    getColumnsClassName,
    groupDisplayModes,
    groups,
    groupedStructure,
    properties,
    renderItems,
    paginateItems,
    toggleGroup,
  ]);

  if (!groupedStructure || groups.length === 0) {
    return (
      <div className={className || ''}>
        {renderItems(paginateItems ? paginateItems(items) : items)}
      </div>
    );
  }

  const roots = groupedStructure.rootGroups;
  const rootProperty = properties.find((property) => property.id === groups[0]);
  const rootTabs = roots.map((path) => {
    const value = path.split('/').pop() || path;
    return {
      id: path,
      label: rootProperty ? getGroupLabel(rootProperty, value === '(vide)' ? undefined : value, collections) : value,
      itemCount: countItemsInGroup(path, groupedStructure.structure),
    };
  });
  const activeRoot = activeTabs.root && roots.includes(activeTabs.root) ? activeTabs.root : roots[0];

  if (rootMode === 'tabs') {
    return (
      <div className={className || ''}>
        <Tabs value={activeRoot} onValueChange={(next) => {
          setActiveTabs((previous) => ({ ...previous, root: next }));
          saveGroupingSelection(rootTabsStorageKey, next);
          saveGroupFieldSelection(collectionId || 'unknown', groups[0] || '', next);
        }}>
          <ViewGroupTabs items={rootTabs} activeId={activeRoot} />
          {roots.map((root) => <TabsContent key={root} value={root} className={groupedTabsContentClass}>{renderGroup(root)}</TabsContent>)}
        </Tabs>
      </div>
    );
  }

  if (rootMode === 'select') {
    const selectLevels: Array<{
      depth: number;
      property: Property;
      options: Array<{ id: string; label: string; itemCount: number }>;
      selectedId: string;
    }> = [];
    let currentOptions = [...roots];
    if (initialGroupPath !== undefined && activeSelects[0] && !currentOptions.includes(activeSelects[0])) {
      currentOptions.push(activeSelects[0]);
    }
    let selectedPath = roots[0];

    for (let depth = 0; depth < groups.length && currentOptions.length > 0; depth += 1) {
      const groupId = groups[depth];
      const mode = groupDisplayModes[groupId] || (depth === 0 ? rootMode : 'accordion');
      if (mode !== 'select') break;
      const property = properties.find((candidate) => candidate.id === groupId);
      if (!property) break;

      const options = currentOptions.map((path) => {
        const value = path.split('/').pop() || path;
        return {
          id: path,
          label: getGroupLabel(property, value === '(vide)' ? undefined : value, collections),
          itemCount: countItemsInGroup(path, groupedStructure.structure),
        };
      });
      const persisted = activeSelects[depth];
      const selectedId = options.some((option) => option.id === persisted)
        ? persisted
        : options[0].id;
      selectLevels.push({ depth, property, options, selectedId });
      selectedPath = selectedId;
      currentOptions = [...(groupedStructure.structure[selectedId]?.subGroups || [])];
      const requestedChild = activeSelects[depth + 1];
      if (initialGroupPath !== undefined && requestedChild?.startsWith(`${selectedId}/`) && !currentOptions.includes(requestedChild)) {
        currentOptions.push(requestedChild);
      }
    }

    const children = groupedStructure.structure[selectedPath]?.subGroups || [];
    const nextGroupId = groups[selectLevels.length];
    const nextMode = nextGroupId ? groupDisplayModes[nextGroupId] || 'accordion' : 'accordion';
    const renderDirectItems = (path: string) => {
      const directItems = (groupedStructure.structure[path]?.itemIds || [])
        .map((id) => itemsMap.get(id))
        .filter((item): item is Item => Boolean(item));
      return renderItems(paginateItems ? paginateItems(directItems) : directItems);
    };
    const tabbedChildren = children.length > 0 && nextMode === 'tabs';
    const activeTab = tabbedChildren
      ? (activeTabs[selectedPath] && children.includes(activeTabs[selectedPath])
        ? activeTabs[selectedPath]
        : getStoredGroupChoice(`erp:table:sub-tabs:${collectionId || 'unknown'}:${selectedPath}:${nextGroupId || 'none'}`, children) || children[0])
      : undefined;
    const childProperty = properties.find((property) => property.id === nextGroupId);
    const groupSelectors = (
      <div className="flex shrink-0 flex-nowrap items-end gap-2">
        {selectLevels.map((level) => (
          <div key={`group-select-${level.depth}`} className="w-40 shrink-0">
            <Select
              value={level.selectedId}
              onValueChange={(next) => setActiveSelects((previous) => {
                const nextState = { ...previous, [level.depth]: next };
                Object.keys(nextState).forEach((key) => {
                  if (Number(key) > level.depth) delete nextState[Number(key)];
                });
                saveGroupingSelection(rootSelectStorageKey, JSON.stringify(nextState));
                saveGroupFieldSelection(collectionId || 'unknown', groups[level.depth] || '', next);
                return nextState;
              })}
            >
              <SelectTrigger aria-label={level.property.name} className="h-9 w-full bg-transparent text-sm shadow-none"><SelectValue /></SelectTrigger>
              <SelectContent>
                {level.options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label} ({option.itemCount})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    );

    if (tabbedChildren && activeTab) {
      return (
        <Tabs
          value={activeTab}
          onValueChange={(next) => {
            setActiveTabs((previous) => ({ ...previous, [selectedPath]: next }));
            saveGroupingSelection(`erp:table:sub-tabs:${collectionId || 'unknown'}:${selectedPath}:${nextGroupId || 'none'}`, next);
            saveGroupFieldSelection(collectionId || 'unknown', nextGroupId || '', next);
          }}
          className={className || ''}
        >
          <div className="flex min-w-0 items-end justify-between gap-3 overflow-x-auto px-3 py-2">
            {groupSelectors}
            <ViewGroupTabs
              className="ml-auto shrink-0"
              items={children.map((path) => ({
                id: path,
                label: childProperty ? getGroupLabel(childProperty, path.split('/').pop() === '(vide)' ? undefined : path.split('/').pop(), collections) : path.split('/').pop() || path,
                itemCount: countItemsInGroup(path, groupedStructure.structure),
              }))}
              activeId={activeTab}
            />
          </div>
          {children.map((path) => <TabsContent key={path} value={path} className={groupedTabsContentClass}>{renderDirectItems(path)}</TabsContent>)}
        </Tabs>
      );
    }

    return (
      <div className={className || ''}>
        {groupSelectors}
        {renderDirectItems(selectedPath)}
      </div>
    );
  }

  if (rootMode === 'columns') {
    return (
      <div className={`grid gap-4 ${getColumnsClassName(groups[0])} ${className || ''}`}>
        {roots.map((root) => <div key={root} className="min-w-0">{renderGroup(root)}</div>)}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className || ''}`}>
      {roots.map((root) => (
        <div key={root}>{renderGroup(root)}</div>
      ))}
    </div>
  );
};

export default ViewGrouping;
