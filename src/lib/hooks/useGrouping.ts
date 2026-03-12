import { useMemo, useState, useEffect, useRef } from 'react';
import { buildGroupStructure } from '@/lib/groupingUtils';
import { Item, Property, Collection } from '@/lib/types';

/**
 * Hook personnalisé pour gérer la logique de groupage des items
 */
export function useGrouping(
  items: Item[],
  groups: string[],
  properties: Property[],
  collections: Collection[],
  initialExpandedGroupPaths?: string[],
  onExpandedGroupsChange?: (groupPaths: string[]) => void
) {
  const onExpandedGroupsChangeRef = useRef(onExpandedGroupsChange);
  const lastExpandedSerializedRef = useRef<string | null>(null);

  useEffect(() => {
    onExpandedGroupsChangeRef.current = onExpandedGroupsChange;
  }, [onExpandedGroupsChange]);

  // Indexer les items par ID pour accès O(1)
  const itemsMap = useMemo(() => {
    const map = new Map<string, Item>();
    items.forEach(item => map.set(item.id, item));
    return map;
  }, [items]);

  // Nouvelle logique de groupage : structure plate avec IDs uniquement
  const groupedStructure = useMemo(
    () => buildGroupStructure(items, groups, properties, collections),
    [items, groups, properties, collections]
  );

  const allGroupPaths = useMemo(
    () => (groupedStructure ? Object.keys(groupedStructure.structure) : []),
    [groupedStructure]
  );

  // Initialiser les groupes ouverts
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (!groupedStructure) return new Set();
    if (Array.isArray(initialExpandedGroupPaths) && initialExpandedGroupPaths.length > 0) {
      const allowed = new Set(allGroupPaths);
      return new Set(initialExpandedGroupPaths.filter((p) => allowed.has(p)));
    }
    return new Set(Object.keys(groupedStructure.structure));
  });

  // Synchroniser quand la vue change (ou quand l'état persisté est fourni)
  useEffect(() => {
    if (!groupedStructure) {
      setExpandedGroups(new Set());
      return;
    }
    if (!Array.isArray(initialExpandedGroupPaths)) return;
    const allowed = new Set(allGroupPaths);
    setExpandedGroups(new Set(initialExpandedGroupPaths.filter((p) => allowed.has(p))));
  }, [groupedStructure, initialExpandedGroupPaths, allGroupPaths]);

  // Mettre à jour les groupes ouverts pour les nouveaux groupes uniquement
  useEffect(() => {
    if (!groupedStructure) return;
    if (Array.isArray(initialExpandedGroupPaths)) return;
    setExpandedGroups(prev => {
      const newGroups = Object.keys(groupedStructure.structure).filter(
        path => !prev.has(path)
      );
      if (newGroups.length === 0) return prev;
      const next = new Set(prev);
      newGroups.forEach(path => next.add(path));
      return next;
    });
  }, [groupedStructure]);

  useEffect(() => {
    const cb = onExpandedGroupsChangeRef.current;
    if (!cb) return;
    const payload = Array.from(expandedGroups);
    const serialized = JSON.stringify(payload);
    if (serialized === lastExpandedSerializedRef.current) return;
    lastExpandedSerializedRef.current = serialized;
    cb(payload);
  }, [expandedGroups]);

  const toggleGroup = (groupPath: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupPath)) {
        next.delete(groupPath);
      } else {
        next.add(groupPath);
      }
      return next;
    });
  };

  return {
    itemsMap,
    groupedStructure,
    expandedGroups,
    toggleGroup,
  };
}
