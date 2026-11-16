import { archiveItems, restoreArchivedItem, purgeArchivedItem } from '@/lib/itemArchive';
import { generateId } from '@/lib/utils/id';
import { stripCalculatedNumberFieldsFromItem } from '@/lib/calculatedFields';

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
  setCollections: (collections: any[] | ((prevCollections: any[]) => any[])) => void,
  activeCollection: string | null,
  prepareItem?: (collection: any, item: any) => any
) => {
  const generateItemId = generateId;

  // Ajout d'un paramètre optionnel collectionId pour cibler la bonne collection
  const saveItem = (item: any, editingItem: any, collectionId?: string, steamExchangeDrafts: any[] = []) => {
    let newItem = { ...item };

    // Détermination de la collection cible
    const targetCollectionId = collectionId || item.__collectionId || activeCollection;
    const targetCollection = collections.find((col) => col.id === targetCollectionId);
    if (prepareItem && targetCollection) newItem = prepareItem(targetCollection, newItem);
    const targetItems = targetCollection?.items || [];
    const isEdition = Boolean(editingItem && editingItem.id);
    console.log('[saveItem] targetCollectionId:', targetCollectionId, '| found:', !!targetCollection, '| isEdition:', isEdition, '| collections available:', collections.map(c => c.id));

    // Générer un id robuste si absent
    if (!newItem.id) {
      newItem.id = generateItemId();
    }

    // En création, éviter absolument d'écraser un item existant en cas de collision d'id
    if (!isEdition && targetItems.some((i: any) => i.id === newItem.id)) {
      do {
        newItem.id = generateItemId();
      } while (targetItems.some((i: any) => i.id === newItem.id));
    }

    // En édition : merge avec l'item courant dans collections (multi-utilisateur)
    // Seuls les champs que l'utilisateur a réellement modifiés (vs editingItem baseline) remplacent
    // les valeurs actuelles — les champs non touchés gardent la valeur live (modifiée par un autre user)
    if (isEdition) {
      const liveItem = targetItems.find((i: any) => i.id === newItem.id);
      if (liveItem) {
        const baseline = editingItem || {};
        const merged: any = { ...liveItem };
        for (const key of Object.keys(newItem)) {
          const userModified =
            JSON.stringify(newItem[key]) !== JSON.stringify(baseline[key]);
          if (userModified) {
            merged[key] = newItem[key];
          }
        }
        newItem = merged;
      }
    }

    newItem = stripCalculatedNumberFieldsFromItem(newItem, targetCollection);

    let updatedCollections = collections.map((col) => {
      if (col.id === targetCollectionId) {
        const colItems = col.items || [];
        const exists = colItems.some((i: any) => i.id === newItem.id);
        if (isEdition || exists) {
          return {
            ...col,
            items: [
              ...colItems.map((i: any) => (i.id === newItem.id ? newItem : i)),
              ...(col.plugins?.steam?.role === 'games' ? steamExchangeDrafts.map(({ _steamExchangeDraft, ...draft }) =>
                prepareItem ? prepareItem(col, draft) : draft
              ) : []),
            ]
          };
        }
        return { ...col, items: [...colItems, newItem] };
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

  const updateItem = (item: any, collectionId?: string) => {
    const targetCollectionId = collectionId || item.__collectionId || activeCollection;
    if (!targetCollectionId) return;

    setCollections((prevCollections: any[]) => {
      const sourceCollection = prevCollections.find((c: any) => c.id === targetCollectionId);
      if (!sourceCollection) return prevCollections;
      const sanitizedItem = stripCalculatedNumberFieldsFromItem(prepareItem ? prepareItem(sourceCollection, item) : item, sourceCollection);
      const prevItem = sourceCollection.items.find((i: any) => i.id === sanitizedItem.id) || {};

      let updatedCollections = prevCollections.map((col: any) => {
        if (col.id === targetCollectionId) {
          return { ...col, items: col.items.map((i: any) => (i.id === sanitizedItem.id ? sanitizedItem : i)) };
        }
        return col;
      });

      const relationProps = (sourceCollection.properties || []).filter(
        (p: any) => p.type === 'relation'
      );
      relationProps.forEach((prop: any) => {
        const beforeVal = prevItem[prop.id];
        const afterVal = sanitizedItem[prop.id];
        if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
          updatedCollections = applyRelationChangeInternal(
            updatedCollections,
            sourceCollection,
            sanitizedItem,
            prop,
            afterVal,
            beforeVal
          );
        }
      });

      return updatedCollections;
    });
  };

  // All normal deletion entry points archive; only the Archives panel can purge.
  const bulkDeleteItems = (itemIds: string[], collectionId?: string) => {
    const targetId = collectionId || activeCollection;
    if (!targetId || !itemIds.length) return;
    setCollections((previous) => archiveItems(previous, targetId, itemIds));
  };

  const deleteItem = (itemId: string, collectionId?: string) => {
    bulkDeleteItems([itemId], collectionId);
  };

  const restoreItem = (itemId: string, collectionId: string) => {
    setCollections((previous) => restoreArchivedItem(previous, collectionId, itemId));
  };

  const permanentlyDeleteItem = (itemId: string, collectionId: string) => {
    setCollections((previous) => purgeArchivedItem(previous, collectionId, itemId));
  };

  /**
   * Met à jour plusieurs items en UNE SEULE action d'état (évite les race conditions)
   * @param itemUpdates Tableau de { itemId, updates } ou directement d'items avec __collectionId
   * @param collectionId ID de la collection (optionnel si __collectionId dans chaque item)
   */
  const bulkUpdateItems = (
    itemUpdates: Array<{ id: string; [key: string]: any }>,
    collectionId?: string
  ) => {
    if (!itemUpdates.length) return;
    
    const targetCollectionId = collectionId || activeCollection;
    if (!targetCollectionId) return;

    setCollections((prevCollections: any[]) => {
      const sourceCollection = prevCollections.find((c: any) => c.id === targetCollectionId);
      if (!sourceCollection) return prevCollections;

      // Grouper les changements de relations pour les traiter une fois
      const itemIdToUpdates = new Map(itemUpdates.map((update) => [update.id, update]));
      let updatedCollections = prevCollections.map((col: any) => {
        if (col.id !== targetCollectionId) return col;

        return {
          ...col,
          items: col.items.map((i: any) => {
            const itemUpdate = itemIdToUpdates.get(i.id);
            if (!itemUpdate) return i;
            const sanitized = stripCalculatedNumberFieldsFromItem(itemUpdate, sourceCollection);
            return sanitized;
          })
        };
      });

      // Traiter les relations pour tous les items modifiés
      const relationProps = (sourceCollection.properties || []).filter(
        (p: any) => p.type === 'relation'
      );
      
      for (const itemUpdate of itemUpdates) {
        const prevItem = sourceCollection.items.find((i: any) => i.id === itemUpdate.id) || {};
        
        relationProps.forEach((prop: any) => {
          const beforeVal = prevItem[prop.id];
          const afterVal = itemUpdate[prop.id];
          if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
            updatedCollections = applyRelationChangeInternal(
              updatedCollections,
              sourceCollection,
              itemUpdate,
              prop,
              afterVal,
              beforeVal
            );
          }
        });
      }

      console.log('bulkUpdateItems - updating', itemUpdates.length, 'items in one state update');
      return updatedCollections;
    });
  };

  return {
    saveItem,
    updateItem,
    deleteItem,
    bulkDeleteItems,
    restoreItem,
    permanentlyDeleteItem,
    bulkUpdateItems
  };
};
