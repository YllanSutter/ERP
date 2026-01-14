const applyRelationChangeInternal = (
  stateCollections: any[],
  sourceCollection: any,
  sourceItem: any,
  prop: any,
  newVal: any,
  oldVal: any
) => {
  const relation = prop.relation || {};
  const targetCollectionId = relation.targetCollectionId;
  let targetFieldId = relation.targetFieldId;
  const relationType = relation.type || 'many_to_many';

  const targetCollection = stateCollections.find((c: any) => c.id === targetCollectionId);
  if (!targetFieldId && targetCollection) {
    const fallback = (targetCollection.properties || []).find(
      (p: any) =>
        p.type === 'relation' && p.relation?.targetCollectionId === sourceCollection.id
    );
    if (fallback) targetFieldId = fallback.id;
  }
  if (!targetCollection) return stateCollections;
  if (!targetFieldId) return stateCollections;

  const isSourceMany = relationType === 'one_to_many' || relationType === 'many_to_many';
  const isTargetMany =
    relationType === 'many_to_many'
      ? true
      : relationType === 'one_to_many'
      ? false
      : true;

  const oldIds = isSourceMany
    ? Array.isArray(oldVal)
      ? oldVal
      : []
    : oldVal
    ? [oldVal]
    : [];
  const newIds = isSourceMany
    ? Array.isArray(newVal)
      ? newVal
      : []
    : newVal
    ? [newVal]
    : [];

  const removed = oldIds.filter((id: string) => !newIds.includes(id));
  const added = newIds.filter((id: string) => !oldIds.includes(id));

  let updatedTargetItems = (targetCollection.items || []).map((ti: any) => {
    if (added.includes(ti.id)) {
      if (isTargetMany) {
        const arr = Array.isArray(ti[targetFieldId]) ? ti[targetFieldId] : [];
        if (!arr.includes(sourceItem.id)) ti[targetFieldId] = [...arr, sourceItem.id];
      } else {
        ti[targetFieldId] = sourceItem.id;
      }
    }
    return ti;
  });

  updatedTargetItems = updatedTargetItems.map((ti: any) => {
    if (removed.includes(ti.id)) {
      if (isTargetMany) {
        const arr = Array.isArray(ti[targetFieldId]) ? ti[targetFieldId] : [];
        ti[targetFieldId] = arr.filter((sid: string) => sid !== sourceItem.id);
      } else {
        if (ti[targetFieldId] === sourceItem.id) ti[targetFieldId] = null;
      }
    }
    return ti;
  });

  if (relationType === 'one_to_one') {
    const keepId = newIds[0] || null;
    if (keepId) {
      updatedTargetItems = updatedTargetItems.map((ti: any) => {
        if (ti.id !== keepId && ti[targetFieldId] === sourceItem.id) {
          ti[targetFieldId] = null;
        }
        return ti;
      });
    }
  }

  const updatedCollections2 = stateCollections.map((c: any) => {
    if (c.id === targetCollectionId) {
      return { ...c, items: updatedTargetItems };
    }
    return c;
  });

  return updatedCollections2;
};


export const useItems = (
  collections: any[],
  setCollections: (collections: any[]) => void,
  activeCollection: string | null
) => {
  // Ajout d'un paramètre optionnel collectionId pour cibler la bonne collection
  const saveItem = (item: any, editingItem: any, collectionId?: string) => {
    let newItem = { ...item };
    if (!editingItem && !item.id) {
      newItem.id = Date.now().toString();
    }

    // Détermination de la collection cible
    const targetCollectionId = collectionId || item.__collectionId || activeCollection;
    let updatedCollections = collections.map((col) => {
      if (col.id === targetCollectionId) {
        if (editingItem || item.id) {
          return {
            ...col,
            items: col.items.map((i: any) => (i.id === newItem.id ? newItem : i))
          };
        }
        return { ...col, items: [...col.items, newItem] };
      }
      return col;
    });

    const sourceCollection = collections.find((c) => c.id === targetCollectionId)!;
    const relationProps = (sourceCollection.properties || []).filter(
      (p: any) => p.type === 'relation'
    );
    relationProps.forEach((prop: any) => {
      const afterVal = newItem[prop.id];
      if (afterVal && (Array.isArray(afterVal) ? afterVal.length > 0 : true)) {
        updatedCollections = applyRelationChangeInternal(
          updatedCollections,
          sourceCollection,
          newItem,
          prop,
          afterVal,
          null
        );
      }
    });

    setCollections(updatedCollections);
  };

  const updateItem = (item: any) => {
    const sourceCollection = collections.find((c) => c.id === activeCollection)!;
    const prevItem = sourceCollection.items.find((i: any) => i.id === item.id) || {};

    let updatedCollections = collections.map((col) => {
      if (col.id === activeCollection) {
        return { ...col, items: col.items.map((i: any) => (i.id === item.id ? item : i)) };
      }
      return col;
    });

    const relationProps = (sourceCollection.properties || []).filter(
      (p: any) => p.type === 'relation'
    );
    relationProps.forEach((prop: any) => {
      const beforeVal = prevItem[prop.id];
      const afterVal = item[prop.id];
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        updatedCollections = applyRelationChangeInternal(
          updatedCollections,
          sourceCollection,
          item,
          prop,
          afterVal,
          beforeVal
        );
      }
    });

    setCollections(updatedCollections);
  };

  const deleteItem = (itemId: string) => {
    // 1) Remove the item from its source collection
    let updatedCollections = collections.map((col) => {
      if (col.id === activeCollection) {
        return { ...col, items: col.items.filter((i: any) => i.id !== itemId) };
      }
      return col;
    });

    // 2) Cleanup relations in other collections that point to the deleted item's collection
    updatedCollections = updatedCollections.map((col) => {
      const newItems = (col.items || []).map((it: any) => {
        let next = { ...it };
        (col.properties || []).forEach((prop: any) => {
          if (prop.type !== 'relation') return;
          const relation = prop.relation || {};
          const targetCollectionId = relation.targetCollectionId;
          const relationType = relation.type || 'many_to_many';
          const isSourceMany = relationType === 'one_to_many' || relationType === 'many_to_many';

          // Only relations that target the active (deleted item) collection
          if (targetCollectionId === activeCollection) {
            const val = next[prop.id];
            if (isSourceMany) {
              const arr = Array.isArray(val) ? val : [];
              const filtered = arr.filter((id: string) => id !== itemId);
              if (filtered.length !== arr.length) next[prop.id] = filtered;
            } else {
              if (val === itemId) next[prop.id] = null;
            }
          }
        });
        return next;
      });
      return { ...col, items: newItems };
    });

    setCollections(updatedCollections);
  };

  return {
    saveItem,
    updateItem,
    deleteItem
  };
};
