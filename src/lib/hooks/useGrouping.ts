import { useMemo, useState, useEffect } from 'react';
import { buildGroupStructure } from '@/lib/groupingUtils';
import { Item, Property } from '@/lib/types';

/**
 * Hook personnalisé pour gérer la logique de groupage des items
 */
export function useGrouping(
  items: Item[],
  groups: string[],
  properties: Property[]
) {
  // Indexer les items par ID pour accès O(1)
  const itemsMap = useMemo(() => {
    const map = new Map<string, Item>();
    items.forEach(item => map.set(item.id, item));
    return map;
  }, [items]);

  // Nouvelle logique de groupage : structure plate avec IDs uniquement
  const groupedStructure = useMemo(
    () => buildGroupStructure(items, groups, properties),
    [items, groups, properties]
  );

  // Initialiser les groupes ouverts
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (!groupedStructure) return new Set();
    return new Set(Object.keys(groupedStructure.structure));
  });

  // Mettre à jour les groupes ouverts pour les nouveaux groupes uniquement
  useEffect(() => {
    if (!groupedStructure) return;
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
