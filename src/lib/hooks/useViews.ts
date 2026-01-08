export const useViews = (
  views: Record<string, any[]>,
  setViews: (views: Record<string, any[]>) => void,
  activeCollection: string | null,
  activeView: string | null,
  setActiveView: (id: string) => void
) => {
  const currentViews = activeCollection ? views[activeCollection] || [] : [];
  const currentViewConfig = currentViews.find((v: any) => v.id === activeView) || currentViews[0];

  const addView = (name: string, type: string, config?: any) => {
    const newView: any = {
      id: Date.now().toString(),
      name,
      type,
      filters: [],
      groups: [],
      hiddenFields: []
    };
    if (config?.groupBy) newView.groupBy = config.groupBy;
    if (config?.dateProperty) newView.dateProperty = config.dateProperty;

    if (activeCollection) {
      setViews({
        ...views,
        [activeCollection]: [...currentViews, newView]
      });
    }
    setActiveView(newView.id);
  };

  const addFilter = (property: string, operator: string, value: any) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    updatedViews[activeCollection][viewIndex].filters.push({ property, operator, value });
    setViews(updatedViews);
  };

  const removeFilter = (index: number) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    updatedViews[activeCollection][viewIndex].filters.splice(index, 1);
    setViews(updatedViews);
  };

  const addGroup = (property: string) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    if (!updatedViews[activeCollection][viewIndex].groups.includes(property)) {
      updatedViews[activeCollection][viewIndex].groups.push(property);
      setViews(updatedViews);
    }
  };

  const removeGroup = (property: string) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    updatedViews[activeCollection][viewIndex].groups = updatedViews[activeCollection][
      viewIndex
    ].groups.filter((g: string) => g !== property);
    setViews(updatedViews);
  };

  const deleteView = (viewId: string) => {
    if (!activeCollection) return;
    if (currentViews.length <= 1) {
      alert('Impossible de supprimer la dernière vue');
      return;
    }
    if (confirm('Êtes-vous sûr de vouloir supprimer cette vue ?')) {
      const updatedViews = {
        ...views,
        [activeCollection]: currentViews.filter((v: any) => v.id !== viewId)
      };
      setViews(updatedViews);
      if (activeView === viewId) {
        setActiveView(updatedViews[activeCollection][0].id);
      }
    }
  };

  const toggleFieldVisibility = (fieldId: string) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    const hiddenFields = updatedViews[activeCollection][viewIndex].hiddenFields || [];
    if (hiddenFields.includes(fieldId)) {
      updatedViews[activeCollection][viewIndex].hiddenFields = hiddenFields.filter(
        (f: string) => f !== fieldId
      );
    } else {
      updatedViews[activeCollection][viewIndex].hiddenFields = [...hiddenFields, fieldId];
    }
    setViews(updatedViews);
  };

  const moveFieldInView = (fieldId: string, delta: number, currentCollection: any) => {
    if (!activeCollection) return;
    const props = currentCollection?.properties || [];
    const currentOrder =
      currentViewConfig?.fieldOrder && currentViewConfig.fieldOrder.length
        ? [...currentViewConfig.fieldOrder]
        : props.map((p: any) => p.id);
    const idx = currentOrder.indexOf(fieldId);
    const target = idx + delta;
    if (idx === -1 || target < 0 || target >= currentOrder.length) return;
    const nextOrder = [...currentOrder];
    const [item] = nextOrder.splice(idx, 1);
    nextOrder.splice(target, 0, item);
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    updatedViews[activeCollection][viewIndex] = {
      ...updatedViews[activeCollection][viewIndex],
      fieldOrder: nextOrder
    };
    setViews(updatedViews);
  };

  const updateViewFieldOrder = (nextOrder: string[]) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    updatedViews[activeCollection][viewIndex] = {
      ...updatedViews[activeCollection][viewIndex],
      fieldOrder: nextOrder
    };
    setViews(updatedViews);
  };

  return {
    currentViews,
    currentViewConfig,
    addView,
    addFilter,
    removeFilter,
    addGroup,
    removeGroup,
    deleteView,
    toggleFieldVisibility,
    moveFieldInView,
    updateViewFieldOrder
  };
};
