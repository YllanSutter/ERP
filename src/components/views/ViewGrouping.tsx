import React, { useCallback, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ViewGroupTabs from './ViewGroupTabs';
import { useGrouping } from '@/lib/hooks/useGrouping';
import type { Collection, Item, Property, TableGroupDisplayMode } from '@/lib/types';
import { countItemsInGroup, getGroupLabel } from '@/lib/groupingUtils';

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
}) => {
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({});
  const [activeSelects, setActiveSelects] = useState<Record<number, string>>({});
  const { groupedStructure, itemsMap, expandedGroups, toggleGroup, getItemsForGroup } = useViewGrouping(
    items,
    groups,
    properties,
    collections,
    initialExpandedGroups,
    onExpandedGroupsChange,
  );

  const rootMode = groupDisplayModes[groups[0]] || groupDisplayMode;
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
      const activeTab = activeTabs[path] && children.includes(activeTabs[path]) ? activeTabs[path] : children[0];
      const activeSelect = activeSelects[depth + 1] && children.includes(activeSelects[depth + 1])
        ? activeSelects[depth + 1]
        : children[0];
      const childMode = groups[depth + 1]
        ? groupDisplayModes[groups[depth + 1]] || 'accordion'
        : 'accordion';
      const renderChildren = children.length === 0 ? renderItems(paginateItems ? paginateItems(groupItems) : groupItems) : childMode === 'tabs' ? (
        <Tabs
          value={activeTab}
          onValueChange={(next) => setActiveTabs((previous) => ({ ...previous, [path]: next }))}
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
            <TabsContent key={child} value={child}>{renderRecursive(child)}</TabsContent>
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
        <section key={path} className="space-y-2">
          <button
            type="button"
            onClick={() => collapsible && toggleGroup(path)}
            aria-expanded={collapsible ? expanded : true}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left ${
              collapsible ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : 'cursor-default'
            }`}
          >
            {collapsible && <ChevronRight size={18} className={expanded ? 'rotate-90' : ''} />}
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">
              {property?.name ? `${property.name}: ` : ''}{property
                ? getGroupLabel(property, value === '(vide)' ? undefined : value, collections)
                : value}
            </h3>
            <span className="text-xs text-neutral-500">{groupItems.length}</span>
          </button>
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
      <div className={`p-3 ${className || ''}`}>
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
      <div className={`p-3 ${className || ''}`}>
        <Tabs value={activeRoot} onValueChange={(next) => setActiveTabs((previous) => ({ ...previous, root: next }))}>
          <ViewGroupTabs items={rootTabs} activeId={activeRoot} />
          {roots.map((root) => <TabsContent key={root} value={root}>{renderGroup(root)}</TabsContent>)}
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
    let currentOptions = roots;
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
      currentOptions = groupedStructure.structure[selectedId]?.subGroups || [];
    }

    return (
      <div className={`space-y-3 p-3 ${className || ''}`}>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(selectLevels.length, 1)}, minmax(180px, 1fr))` }}
        >
          {selectLevels.map((level) => (
            <div key={`group-select-${level.depth}`} className="min-w-0">
              <label className="mb-1 block truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                {level.property.name}
              </label>
              <Select
                value={level.selectedId}
                onValueChange={(next) => setActiveSelects((previous) => {
                  const nextState = { ...previous, [level.depth]: next };
                  Object.keys(nextState).forEach((key) => {
                    if (Number(key) > level.depth) delete nextState[Number(key)];
                  });
                  return nextState;
                })}
              >
                <SelectTrigger className="w-full text-xs"><SelectValue /></SelectTrigger>
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
        {renderGroup(selectedPath)}
      </div>
    );
  }

  if (rootMode === 'columns') {
    return (
      <div className={`grid gap-4 p-3 ${getColumnsClassName(groups[0])} ${className || ''}`}>
        {roots.map((root) => <div key={root} className="min-w-0">{renderGroup(root)}</div>)}
      </div>
    );
  }

  return (
    <div className={`space-y-3 p-3 ${className || ''}`}>
      {roots.map((root) => (
        <div key={root}>{renderGroup(root)}</div>
      ))}
    </div>
  );
};

export default ViewGrouping;
