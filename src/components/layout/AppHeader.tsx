import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import { useAuth } from '@/auth/AuthProvider';
import { useCanEdit, useCanManagePermissions } from '@/lib/hooks/useCanEdit';
import { io } from 'socket.io-client';

interface AppHeaderProps {
  impersonatedRoleId: string | null;
  availableRoles: any[];
  onNewCollection: () => void;
  onImpersonate: (roleId: string | null) => void;
  onShowAccessManager: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  impersonatedRoleId,
  availableRoles,
  onNewCollection,
  onImpersonate,
  onShowAccessManager
}) => {
  const { user, logout, isAdminBase } = useAuth();
  // Hooks de permissions
  const canEdit = useCanEdit();
  const canManagePermissions = useCanManagePermissions();

  // Ajout de la liste des utilisateurs connectés
  const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
  useEffect(() => {
    const socket = io({ transports: ['polling'] });
    socket.on('usersConnected', (users: any[]) => {
      console.log('[SOCKET][CLIENT] usersConnected reçu:', users);
      setConnectedUsers(users);
    });
    console.log('[SOCKET][CLIENT] emit whoIsConnected');
    socket.emit('whoIsConnected');
    return () => {
      socket.disconnect();
    };
  }, []);

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
        {/* Affiche tous les utilisateurs connectés */}
        {connectedUsers.map((u: any) => (
          <div key={u.id} className="text-sm text-neutral-400 grid items-center justify-center bg-neutral-700 size-[22px] rounded-full">
            <span className="text-white font-bold text-xs leading-none text-center">{u.name?.charAt(0) || 'U'}</span>
          </div>
        ))}
        <div className="text-sm text-neutral-400 grid items-center justify-center bg-neutral-700 size-[22px] rounded-full">
          <span className="text-white font-bold text-xs leading-none text-center">{user?.name.charAt(0) || 'Utilisateur'}</span>
        </div>
        {isAdminBase && (
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="text-neutral-500">Rôle effectif :</span>
            <select
              className="bg-neutral-900 border border-white/10 rounded px-4 py-2 text-sm text-white"
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
