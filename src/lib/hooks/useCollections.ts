import { PROPERTY_TYPES } from '../constants';

export const useCollections = (
  collections: any[],
  setCollections: (collections: any[]) => void,
  views: Record<string, any[]>,
  setViews: (views: Record<string, any[]>) => void,
  setActiveCollection: (id: string) => void,
  setActiveView: (id: string) => void,
  setRelationFilter: (filter: { collectionId: string | null; ids: string[] }) => void,
  activeCollection: string | null
) => {
  const addCollection = (name: string, icon: string, color: string) => {
    const id = name.toLowerCase().replace(/\s+/g, '_');
    const newCollections = [
      ...collections,
      {
        id,
        name,
        icon,
        color,
        isPrimary: false,
        properties: [{ id: 'name', name: 'Nom', type: 'text', required: true }],
        items: [],
        defaultVisibleFieldIds: ['name']
      }
    ];
    setCollections(newCollections);
    setViews({
      ...views,
      [id]: [
        {
          id: 'default',
          name: 'Toutes les données',
          type: 'table',
          filters: [],
          groups: [],
          hiddenFields: []
        }
      ]
    });
    setActiveCollection(id);
    setActiveView('default');
    setRelationFilter({ collectionId: null, ids: [] });
  };

  const deleteProperty = (propId: string) => {
    if (propId === 'name') {
      alert('La propriété "Nom" ne peut pas être supprimée.');
      return;
    }
    if (confirm('Êtes-vous sûr ?')) {
      const updatedCollections = collections.map((col) => {
        if (col.id === activeCollection) {
          return {
            ...col,
            properties: col.properties.filter((p: any) => p.id !== propId),
            items: col.items.map((item: any) => {
              const newItem = { ...item } as Record<string, any>;
              delete newItem[propId];
              return newItem;
            })
          };
        }
        return col;
      });
      setCollections(updatedCollections);
    }
  };

  const addProperty = (property: any) => {
    if (property.type !== PROPERTY_TYPES.RELATION) {
      const updatedCollections = collections.map((col) => {
        if (col.id === activeCollection) {
          return {
            ...col,
            properties: [
              ...col.properties,
              { ...property, id: property.name.toLowerCase().replace(/\s+/g, '_') }
            ]
          };
        }
        return col;
      });
      setCollections(updatedCollections);
      return;
    }

    const sourceCollection = collections.find((c) => c.id === activeCollection);
    const targetCollection = collections.find(
      (c) => c.id === property.relation?.targetCollectionId
    );
    if (!sourceCollection || !targetCollection) {
      alert('Collection cible introuvable pour la relation');
      return;
    }
    const sourcePropId = property.name.toLowerCase().replace(/\s+/g, '_');
    const reciprocalName = `${sourceCollection.name}`;
    const targetPropId = `${reciprocalName.toLowerCase().replace(/\s+/g, '_')}_lié`;

    const relationType = property.relation?.type || 'many_to_many';
    const reciprocalType =
      relationType === 'one_to_many'
        ? 'many_to_one'
        : relationType === 'many_to_one'
        ? 'one_to_many'
        : relationType;

    const sourceProp = {
      ...property,
      id: sourcePropId,
      relation: {
        targetCollectionId: targetCollection.id,
        type: relationType,
        targetFieldId: targetPropId
      }
    };

    const targetProp = {
      name: sourceCollection.name,
      type: 'relation',
      icon: property.icon || 'Link',
      color: property.color || '#8b5cf6',
      id: targetPropId,
      relation: {
        targetCollectionId: sourceCollection.id,
        type: reciprocalType,
        targetFieldId: sourcePropId
      }
    };

    const updatedCollections = collections.map((col) => {
      if (col.id === sourceCollection.id) {
        return { ...col, properties: [...col.properties, sourceProp] };
      }
      if (col.id === targetCollection.id) {
        const exists = col.properties.some((p: any) => p.id === targetPropId);
        return exists ? col : { ...col, properties: [...col.properties, targetProp] };
      }
      return col;
    });
    setCollections(updatedCollections);
  };

  const updateProperty = (property: any) => {
    const updatedCollections = collections.map((col) => {
      if (col.id === activeCollection) {
        return {
          ...col,
          properties: col.properties.map((p: any) => (p.id === property.id ? property : p))
        };
      }
      return col;
    });
    setCollections(updatedCollections);
  };

  const duplicateProperty = (propId: string, options?: { copyValues?: boolean }) => {
    if (!activeCollection) return;

    const sourceCollection = collections.find((c) => c.id === activeCollection);
    if (!sourceCollection) return;

    const sourceProp = (sourceCollection.properties || []).find((p: any) => p.id === propId);
    if (!sourceProp) return;

    if (sourceProp.type === PROPERTY_TYPES.RELATION) {
      alert('La duplication directe d\'une colonne relation n\'est pas supportée.');
      return;
    }

    const shouldCopyValues = options?.copyValues !== false;

    const baseId = `${sourceProp.id}_copy`;
    let nextId = baseId;
    let idx = 2;
    const existingIds = new Set((sourceCollection.properties || []).map((p: any) => p.id));
    while (existingIds.has(nextId)) {
      nextId = `${baseId}_${idx}`;
      idx += 1;
    }

    const baseName = `${sourceProp.name} (copie)`;
    let nextName = baseName;
    let nameIdx = 2;
    const existingNames = new Set((sourceCollection.properties || []).map((p: any) => p.name));
    while (existingNames.has(nextName)) {
      nextName = `${baseName} ${nameIdx}`;
      nameIdx += 1;
    }

    const duplicatedProp = {
      ...sourceProp,
      id: nextId,
      name: nextName,
      showContextMenu: false,
    };

    const cloneValue = (value: any) => {
      if (value === null || typeof value !== 'object') return value;
      try {
        return structuredClone(value);
      } catch {
        return JSON.parse(JSON.stringify(value));
      }
    };

    const getEmptyValueForProperty = (prop: any) => {
      if (!prop) return '';
      if (prop.type === 'checkbox') return false;
      if (prop.type === 'multi_select' || prop.type === 'multiselect') return [];
      if (prop.type === 'number') return null;
      if (prop.type === 'date' || prop.type === 'date_range') return null;
      return '';
    };

    const updatedCollections = collections.map((col) => {
      if (col.id !== activeCollection) return col;

      const sourceIndex = col.properties.findIndex((p: any) => p.id === propId);
      const nextProperties = [...col.properties];
      nextProperties.splice(sourceIndex + 1, 0, duplicatedProp);

      const nextItems = (col.items || []).map((item: any) => ({
        ...item,
        [nextId]: shouldCopyValues ? cloneValue(item?.[propId]) : getEmptyValueForProperty(sourceProp),
      }));

      const visible = Array.isArray(col.defaultVisibleFieldIds) ? [...col.defaultVisibleFieldIds] : [];
      if (visible.length > 0 && visible.includes(propId) && !visible.includes(nextId)) {
        const originVisibleIndex = visible.indexOf(propId);
        visible.splice(originVisibleIndex + 1, 0, nextId);
      }

      return {
        ...col,
        properties: nextProperties,
        items: nextItems,
        defaultVisibleFieldIds: visible,
      };
    });

    setCollections(updatedCollections);

    const collectionViews = views[activeCollection] || [];
    if (collectionViews.length > 0) {
      const updatedCollectionViews = collectionViews.map((view: any) => {
        let nextView = { ...view };

        if (Array.isArray(view.fieldOrder)) {
          const idx = view.fieldOrder.indexOf(propId);
          if (idx >= 0) {
            const nextFieldOrder = [...view.fieldOrder];
            nextFieldOrder.splice(idx + 1, 0, nextId);
            nextView = { ...nextView, fieldOrder: nextFieldOrder };
          }
        }

        if (view.totalFields && view.totalFields[propId]) {
          nextView = {
            ...nextView,
            totalFields: {
              ...view.totalFields,
              [nextId]: view.totalFields[propId],
            },
          };
        }

        return nextView;
      });

      setViews({
        ...views,
        [activeCollection]: updatedCollectionViews,
      });
    }
  };

  const updateCollection = (updatedCollection: any) => {
    const updatedCollections = collections.map((col) => {
      if (col.id === updatedCollection.id) return updatedCollection;
      if (updatedCollection.isPrimary) return { ...col, isPrimary: false };
      return col;
    });
    setCollections(updatedCollections);
  };

  const deleteCollection = (collectionId: string) => {
    if (collections.length <= 1) {
      alert('Impossible de supprimer la seule collection');
      return;
    }
    const updatedCollections = collections.filter((col) => col.id !== collectionId);
    setCollections(updatedCollections);

    // Update views - remove the collection's views
    const updatedViews = { ...views };
    delete updatedViews[collectionId];
    setViews(updatedViews);

    // Switch to another collection if we deleted the active one
    if (activeCollection === collectionId) {
      setActiveCollection(updatedCollections[0].id);
      // setActiveView('default');
    }
  };

  return {
    addCollection,
    deleteProperty,
    addProperty,
    updateProperty,
    duplicateProperty,
    updateCollection,
    deleteCollection
  };
};
