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
    updateCollection,
    deleteCollection
  };
};
