import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Shield } from 'lucide-react';
import { useAccessManagerController } from './useAccessManagerController';
import { DataTransferPanel } from './DataTransferPanel';
import { OrganizationPanel } from './OrganizationPanel';
import { UsersPanel } from './UsersPanel';
import { ImportMappingPanel } from './ImportMappingPanel';

type AccessManagerWorkspaceProps = {
  collections: any[];
  dashboards: any[];
  onClose: () => void;
  onImportCollections?: (collections: any[]) => void;
  onUpdateDashboards?: (dashboards: any[]) => void;
};

const AccessManagerWorkspace = (props: AccessManagerWorkspaceProps) => {
  const { isAdmin, panelContext } = useAccessManagerController(props);
  if (!isAdmin) return null;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="w-full max-w-6xl bg-white dark:bg-neutral-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3"><Shield size={18} className="text-cyan-400" /><div><h3 className="text-lg font-semibold">Comptes & Permissions</h3><p className="text-sm text-neutral-500">Gérez les rôles, l’accès par collection / objet / champ.</p></div></div>
            <div className="flex items-center gap-2"><button onClick={panelContext.loadAll} className="p-2 rounded-lg hover:bg-white/10 text-neutral-600 dark:text-white" title="Rafraîchir"><RefreshCw size={16} /></button><button onClick={props.onClose} className="p-2 rounded-lg hover:bg-white/10 text-neutral-600 dark:text-white"><X size={16} /></button></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6 max-h-[80svh] overflow-y-scroll">
            <DataTransferPanel context={panelContext} />
            <OrganizationPanel context={panelContext} />
            <UsersPanel context={panelContext} />
            {panelContext.showImportMapper && <ImportMappingPanel context={panelContext} />}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AccessManagerWorkspace;
