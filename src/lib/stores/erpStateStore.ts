import { create } from 'zustand';
import { storage } from '@/lib/storage';

type ErpState = {
  activeCollection: string | null;
  activeView: string | null;
  activeDashboard: string | null;
  showViewSettings: boolean;
  setActiveCollection: (value: string | null) => void;
  setActiveView: (value: string | null) => void;
  setActiveDashboard: (value: string | null) => void;
  setShowViewSettings: (value: boolean) => void;
};

const readBoolean = (key: string) => storage.get(key) === 'true';

export const createErpStateStore = (orgKey: string | null) => {
  const suffix = orgKey ? `_${orgKey}` : '';
  const keys = {
    collection: `erp_activeCollection${suffix}`,
    view: `erp_activeView${suffix}`,
    dashboard: `erp_activeDashboard${suffix}`,
    viewSettings: `erp_showViewSettings${suffix}`,
  };

  return create<ErpState>((set) => ({
    activeCollection: storage.get(keys.collection),
    activeView: storage.get(keys.view),
    activeDashboard: storage.get(keys.dashboard),
    showViewSettings: readBoolean(keys.viewSettings),
    setActiveCollection: (value) => {
      value ? storage.set(keys.collection, value) : storage.remove(keys.collection);
      set({ activeCollection: value });
    },
    setActiveView: (value) => {
      value ? storage.set(keys.view, value) : storage.remove(keys.view);
      set({ activeView: value });
    },
    setActiveDashboard: (value) => {
      value ? storage.set(keys.dashboard, value) : storage.remove(keys.dashboard);
      set({ activeDashboard: value });
    },
    setShowViewSettings: (value) => {
      storage.set(keys.viewSettings, String(value));
      set({ showViewSettings: value });
    },
  }));
};
