import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, Plus, Sun, LogOut, Shield } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import { useAuth } from '@/auth/AuthProvider';
import { useCanEdit, useCanManagePermissions } from '@/lib/hooks/useCanEdit';
import { io } from 'socket.io-client';

interface AppHeaderProps {
  impersonatedRoleId: string | null;
  availableRoles: any[];
  activeCollectionName?: string | null;
  theme: 'light' | 'dark';
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
  onNewCollection: () => void;
  onImpersonate: (roleId: string | null) => void;
  onShowAccessManager: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  impersonatedRoleId,
  availableRoles,
  activeCollectionName,
  onNewCollection,
  onImpersonate,
  theme,
  setTheme,
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
      // console.log('[SOCKET][CLIENT] usersConnected reçu:', users);
      setConnectedUsers(users);
    });
    if (user && user.id && user.name) {
      // console.log('[SOCKET][CLIENT] emit identify', user.id, user.name);
      socket.emit('identify', { id: user.id, name: user.name });
    }
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Génère une couleur de fond pseudo-aléatoire à partir de l'id utilisateur
  function getUserColor(id: string) {
    // Palette pastel
    const colors = [
      '#f87171', // rouge
      '#fbbf24', // jaune
      '#34d399', // vert
      '#60a5fa', // bleu
      '#a78bfa', // violet
      '#f472b6', // rose
      '#38bdf8', // cyan
      '#facc15', // or
      '#fb7185', // rose foncé
      '#4ade80', // vert clair
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="border-b border-black/10 dark:border-white/5 backdrop-blur px-4 py-2 pl-16 flex items-center justify-between bg-white dark:bg-neutral-900/50"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <button
            className="h-8 w-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 transition-all duration-300"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-sm md:text-base font-semibold truncate max-w-[240px]">
            {activeCollectionName || 'Collections'}
          </h1>
        </div>
        <ShinyButton
          onClick={() => {
            if (!canEdit) return;
            onNewCollection();
          }}
          className={`!px-2 !py-1 text-xs ${!canEdit ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <Plus size={14} />
          Nouvelle
        </ShinyButton>
      </div>
      <div className="flex items-center gap-2">
        {/* Affiche tous les utilisateurs connectés avec couleur et uppercase */}
        {connectedUsers.map((u: any) => (
          <div
            key={u.id}
            className="text-sm text-neutral-400 grid items-center justify-center size-[22px] rounded-full"
            style={{ background: getUserColor(u.id) }}
          >
            <span className="text-white font-bold text-xs leading-none text-center" title={u.name}>
              {(u.name?.charAt(0) || 'U').toUpperCase()}
            </span>
          </div>
        ))}
        {(isAdminBase || canManagePermissions) && (
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="text-neutral-500 hidden md:inline">Rôle :</span>
            <select
              className="bg-background dark:bg-neutral-900 border border-black/10 dark:border-white/10 rounded px-2 py-1 text-xs text-neutral-700 dark:text-white"
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
            className="h-8 w-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 transition-all duration-300"
            title="Comptes & rôles"
          >
            <Shield size={16} />
          </button>
        )}
        <button
          onClick={logout}
          className="h-8 w-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 transition-all duration-300"
          title="Déconnexion"
        >
          <LogOut size={16} />
        </button>
      </div>
    </motion.div>
  );
};

export default AppHeader;
