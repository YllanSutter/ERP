import { useState, useEffect } from 'react';

export function useErpState() {
  // State ERP global
  const [activeCollection, setActiveCollection] = useState<string | null>(() => {
    return localStorage.getItem('erp_activeCollection') || null;
  });
  const [activeView, setActiveView] = useState<string | null>(() => {
    return localStorage.getItem('erp_activeView') || null;
  });
  const [activeDashboard, setActiveDashboard] = useState<string | null>(() => {
    return localStorage.getItem('erp_activeDashboard') || null;
  });

  // Synchronisation localStorage
  useEffect(() => {
    if (activeCollection) {
      localStorage.setItem('erp_activeCollection', activeCollection);
    } else {
      localStorage.removeItem('erp_activeCollection');
    }
  }, [activeCollection]);

  useEffect(() => {
    if (activeView) {
      localStorage.setItem('erp_activeView', activeView);
    } else {
      localStorage.removeItem('erp_activeView');
    }
  }, [activeView]);

  useEffect(() => {
    if (activeDashboard) {
      localStorage.setItem('erp_activeDashboard', activeDashboard);
    } else {
      localStorage.removeItem('erp_activeDashboard');
    }
  }, [activeDashboard]);

  return {
    activeCollection,
    setActiveCollection,
    activeView,
    setActiveView,
    activeDashboard,
    setActiveDashboard,
  };
}
