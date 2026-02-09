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
      hiddenFields: Array.isArray(config?.hiddenFields) ? config.hiddenFields : [],
      // Si vide ou non défini -> tout le monde peut voir la vue
      visibleToRoles: [],
      visibleToUsers: []
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

  const updateFilter = (index: number, property: string, operator: string, value: any) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === activeView);
    if (viewIndex === -1) return;
    const filters = updatedViews[activeCollection][viewIndex].filters || [];
    if (!filters[index]) return;
    filters[index] = { property, operator, value };
    updatedViews[activeCollection][viewIndex].filters = filters;
    setViews(updatedViews);
  };

  const updateViewVisibility = (viewId: string, roleIds: string[], userIds: string[]) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === viewId);
    if (viewIndex === -1) return;
    updatedViews[activeCollection][viewIndex] = {
      ...updatedViews[activeCollection][viewIndex],
      visibleToRoles: roleIds,
      visibleToUsers: userIds
    };
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

  const updateView = (viewId: string, updates: Record<string, any>) => {
    if (!activeCollection) return;
    const updatedViews = { ...views } as Record<string, any[]>;
    const viewIndex = updatedViews[activeCollection].findIndex((v: any) => v.id === viewId);
    if (viewIndex === -1) return;
    updatedViews[activeCollection][viewIndex] = {
      ...updatedViews[activeCollection][viewIndex],
      ...updates,
    };
    setViews(updatedViews);
  };

  const duplicateView = (viewId: string) => {
    if (!activeCollection) return;
    const viewToCopy = currentViews.find((v: any) => v.id === viewId);
    if (!viewToCopy) return;
    const baseName = viewToCopy.name || 'Vue';
    const existing = currentViews
      .map((v: any) => v.name)
      .filter((name: string) => name && name.startsWith(baseName));
    const copyRegex = new RegExp(`^${baseName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')} \\(copie(?: (\\d+))?\\)$`);
    const maxIndex = existing.reduce((max: number, name: string) => {
      const match = name.match(copyRegex);
      if (!match) return max;
      const num = match[1] ? Number(match[1]) : 1;
      return Number.isFinite(num) ? Math.max(max, num) : max;
    }, 0);
    const copySuffix = maxIndex >= 1 ? ` (copie ${maxIndex + 1})` : ' (copie)';
    const duplicated = {
      ...viewToCopy,
      id: Date.now().toString(),
      name: `${baseName}${copySuffix}`
    };
    setViews({
      ...views,
      [activeCollection]: [...currentViews, duplicated]
    });
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
    updateFilter,
    removeFilter,
    addGroup,
    removeGroup,
    deleteView,
    updateView,
    duplicateView,
    toggleFieldVisibility,
    moveFieldInView,
    updateViewFieldOrder,
    updateViewVisibility
  };
};
