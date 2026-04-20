import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, LogOut, Shield, Search, Command } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/auth/AuthProvider';
import { useCanManagePermissions } from '@/lib/hooks/useCanEdit';
import { io } from 'socket.io-client';

interface AppHeaderProps {
  impersonatedRoleId: string | null;
  availableRoles: any[];
  activeCollectionName?: string | null;
  theme: 'light' | 'dark';
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
  onImpersonate: (roleId: string | null) => void;
  onShowAccessManager: () => void;
  onOpenCommandMenu?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  impersonatedRoleId,
  availableRoles,
  activeCollectionName,
  onImpersonate,
  theme,
  setTheme,
  onShowAccessManager,
  onOpenCommandMenu,
}) => {
  const { user, logout, isAdminBase } = useAuth();
  // Hook de permissions
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
      className="border-b border-black/10 dark:border-white/5 backdrop-blur lg:px-4 px-2 py-2 flex items-center justify-between bg-white dark:bg-neutral-900/50"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm md:text-base font-semibold truncate max-w-[240px]">
            {activeCollectionName || 'Collections'}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onOpenCommandMenu && (() => {
          const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);
          return (
            <button
              type="button"
              onClick={onOpenCommandMenu}
              className="hidden md:inline-flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-md bg-muted/70 hover:bg-muted text-muted-foreground text-xs border border-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
              title={isMac ? 'Recherche globale (⌘K)' : 'Recherche globale (Ctrl+K)'}
              aria-label="Ouvrir la recherche globale"
            >
              <Search size={13} />
              <span className="mr-4">Rechercher…</span>
              <kbd className="ml-auto inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {isMac ? <Command size={10} /> : <span>Ctrl</span>}
                <span>K</span>
              </kbd>
            </button>
          );
        })()}
        {/* Affiche tous les utilisateurs connect\u00e9s avec couleur et uppercase */}
        <TooltipProvider>
          {connectedUsers.map((u: any) => (
            <Tooltip key={u.id}>
              <TooltipTrigger asChild>
                <div
                  className="text-sm text-neutral-400 grid items-center justify-center size-[22px] rounded-full"
                  style={{ background: getUserColor(u.id) }}
                >
                  <span className="text-white font-bold text-xs leading-none text-center">
                    {(u.name?.charAt(0) || 'U').toUpperCase()}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center">
                <span>{u.name || 'Utilisateur'}</span>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
        {(isAdminBase || canManagePermissions || Boolean(impersonatedRoleId)) && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground hidden md:inline">Rôle :</span>
            <Select
              value={impersonatedRoleId || '__self__'}
              onValueChange={(val) => {
                onImpersonate(val === '__self__' ? null : val);
              }}
            >
              <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs px-2 py-1 gap-1.5 focus:ring-brand-500">
                <SelectValue placeholder="Mon rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__self__">(Mon rôle réel)</SelectItem>
                {availableRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          className="h-8 w-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/5 text-neutral-700 dark:text-neutral-300 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 transition-all duration-300"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre'}
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
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
