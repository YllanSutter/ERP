import { useState, useEffect } from 'react';

export function useErpState(orgKey: string | null = null) {
  const keySuffix = orgKey ? `_${orgKey}` : '';
  const collectionKey = `erp_activeCollection${keySuffix}`;
  const viewKey = `erp_activeView${keySuffix}`;
  const dashboardKey = `erp_activeDashboard${keySuffix}`;

  // State ERP global
  const [activeCollection, setActiveCollection] = useState<string | null>(() => {
    return localStorage.getItem(collectionKey) || null;
  });
  const [activeView, setActiveView] = useState<string | null>(() => {
    return localStorage.getItem(viewKey) || null;
  });
  const [activeDashboard, setActiveDashboard] = useState<string | null>(() => {
    return localStorage.getItem(dashboardKey) || null;
  });

  useEffect(() => {
    setActiveCollection(localStorage.getItem(collectionKey) || null);
    setActiveView(localStorage.getItem(viewKey) || null);
    setActiveDashboard(localStorage.getItem(dashboardKey) || null);
  }, [collectionKey, viewKey, dashboardKey]);

  // Synchronisation localStorage
  useEffect(() => {
    if (activeCollection) {
      localStorage.setItem(collectionKey, activeCollection);
    } else {
      localStorage.removeItem(collectionKey);
    }
  }, [activeCollection, collectionKey]);

  useEffect(() => {
    if (activeView) {
      localStorage.setItem(viewKey, activeView);
    } else {
      localStorage.removeItem(viewKey);
    }
  }, [activeView, viewKey]);

  useEffect(() => {
    if (activeDashboard) {
      localStorage.setItem(dashboardKey, activeDashboard);
    } else {
      localStorage.removeItem(dashboardKey);
    }
  }, [activeDashboard, dashboardKey]);

  return {
    activeCollection,
    setActiveCollection,
    activeView,
    setActiveView,
    activeDashboard,
    setActiveDashboard,
  };
}
