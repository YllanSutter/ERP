import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import ShinyButton from './ShinyButton';
import { useAuth } from '@/auth/AuthProvider';

interface AppHeaderProps {
  canEdit: boolean;
  canManagePermissions: boolean;
  impersonatedRoleId: string | null;
  availableRoles: any[];
  onNewCollection: () => void;
  onImpersonate: (roleId: string | null) => void;
  onShowAccessManager: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  canEdit,
  canManagePermissions,
  impersonatedRoleId,
  availableRoles,
  onNewCollection,
  onImpersonate,
  onShowAccessManager
}) => {
  const { user, logout, isAdminBase } = useAuth();

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="border-b border-white/5 bg-neutral-900/50 backdrop-blur px-8 py-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded-full bg-gradient-to-tr from-violet-500 to-cyan-400 animate-pulse" />
          <h1 className="text-2xl font-serif font-bold">Gestionnaire de Projet</h1>
        </div>
        <ShinyButton
          onClick={() => {
            if (!canEdit) return;
            onNewCollection();
          }}
          className={!canEdit ? 'opacity-60 pointer-events-none' : ''}
        >
          <Plus size={16} />
          Nouvelle collection
        </ShinyButton>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-neutral-400">
          <span className="text-neutral-500">Connecté en tant que</span>{' '}
          <span className="text-white font-medium">{user?.email || 'Utilisateur'}</span>
        </div>
        {isAdminBase && (
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="text-neutral-500">Rôle effectif :</span>
            <select
              className="bg-neutral-900 border border-white/10 rounded px-2 py-1 text-sm text-white"
              value={impersonatedRoleId || ''}
              onChange={(e) => {
                const val = e.target.value || null;
                onImpersonate(val);
              }}
            >
              <option value="">(Mon rôle réel)</option>
              {availableRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {canManagePermissions && (
          <button
            onClick={onShowAccessManager}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-neutral-300 hover:bg-white/10 border border-white/10"
          >
            Comptes & rôles
          </button>
        )}
        <button
          onClick={logout}
          className="px-3 py-2 rounded-lg text-sm font-medium bg-white/5 text-neutral-400 hover:bg-white/10"
        >
          Déconnexion
        </button>
      </div>
    </motion.div>
  );
};

export default AppHeader;
