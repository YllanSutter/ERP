import React, { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from 'react';

import LoginPage from '@/components/pages/LoginPage';
import { monitorSession } from './sessionMonitor';

import { getWorkspaceTheme } from '@/lib/workspaceTheme';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type AuthContextShape = {
  user: any | null;
  roles: any[];
  baseRoles: any[];
  permissions: any[];
  organizations: any[];
  activeOrganizationId: string | null;
  loading: boolean;
  refresh: (options?: { silent?: boolean }) => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<void>;
  createOrganization: (name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  impersonate: (roleId: string | null) => Promise<void>;
  isAdmin: boolean;
  isAdminBase: boolean;
  isEditor: boolean;
  isViewer: boolean;
  impersonatedRoleId: string | null;
};

const AuthContext = createContext<AuthContextShape | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [baseRoles, setBaseRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [impersonatedRoleId, setImpersonatedRoleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [sessionExpired, setSessionExpired] = useState(false);
  const expiredRef = useRef(false);
  const authGeneration = useRef(0);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);
  const sessionDialog = useRef<HTMLDialogElement>(null);
  const expireSession = useCallback(() => {
    if (!userRef.current) return;
    expiredRef.current = true;
    setSessionExpired(true);
  }, []);
  const clearSession = () => {
    authGeneration.current += 1;
    userRef.current = null;
    expiredRef.current = false;
    setSessionExpired(false);
    setUser(null);
    setRoles([]);
    setBaseRoles([]);
    setPermissions([]);
    setOrganizations([]);
    setActiveOrganizationId(null);
    setImpersonatedRoleId(null);
  };
  useEffect(() => monitorSession(window, API_URL, expireSession), [expireSession]);
  useEffect(() => {
    if (sessionExpired) sessionDialog.current?.showModal();
    else sessionDialog.current?.close();
  }, [sessionExpired]);

  const workspaceColor = user && organizations.find((org) => org.id === activeOrganizationId)?.accent_color;
  useEffect(() => {
    const root = document.documentElement;
    const palette = getWorkspaceTheme(workspaceColor);
    for (const [name, value] of Object.entries(palette)) root.style.setProperty(name, value);
    return () => {
      for (const name of Object.keys(palette)) root.style.removeProperty(name);
    };
  }, [workspaceColor]);

  const refresh = async ({ silent = false, recover = false } = {}) => {
    const generation = authGeneration.current;
    try {
      if (!silent) setLoading(true);
      const headers: Record<string, string> = {};
      if (impersonatedRoleId) {
        headers['X-Impersonate-Role-Id'] = impersonatedRoleId;
      }
      const res = await fetch(`${API_URL}/auth/me`, { 
        credentials: 'include',
        headers
      });
      if (generation !== authGeneration.current) return;
      if (!res.ok) {
        if (res.status === 401) {
          if (userRef.current) expireSession();
          else clearSession();
        }
        if (recover) throw new Error('Impossible de vérifier la session. Réessayez de vous connecter.');
        return;
      }
      const data = await res.json();
      if (generation !== authGeneration.current || (expiredRef.current && !recover)) return;
      // A reconnect must not replace the workspace or unsaved local edits.
      if (expiredRef.current && userRef.current && data.user?.id !== userRef.current.id) {
        throw new Error('Reconnectez-vous avec le même compte pour reprendre vos modifications.');
      }
      setUser(data.user);
      expiredRef.current = false;
      setSessionExpired(false);
      setRoles(data.roles || []);
      setBaseRoles(data.baseRoles || data.roles || []);
      setPermissions(data.permissions || []);
      setOrganizations(data.organizations || []);
      setActiveOrganizationId(data.activeOrganizationId || null);
      setImpersonatedRoleId(data.impersonatedRoleId || null);
    } catch (err) {
      console.error('Auth refresh failed', err);
      if (recover) throw err;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    clearSession();
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const check = () => { if (document.visibilityState === 'visible' && !expiredRef.current) void refresh({ silent: true }); };
    const timer = window.setInterval(check, 30000);
    window.addEventListener('focus', check);
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', check);
    };
    // refresh reads the current impersonation; checking must not reset editor state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, impersonatedRoleId]);

  const isAdmin = useMemo(() => roles.some((r) => r.name === 'admin'), [roles]);
  const isAdminBase = useMemo(() => baseRoles.some((r) => r.name === 'admin'), [baseRoles]);
  const isEditor = useMemo(() => roles.some((r) => r.name === 'editor'), [roles]);
  const isViewer = useMemo(() => roles.some((r) => r.name === 'viewer'), [roles]);

  const value: AuthContextShape = {
    user,
    roles,
    baseRoles,
    permissions,
    organizations,
    activeOrganizationId,
    loading,
    refresh,
    switchOrganization: async (organizationId: string) => {
      const res = await fetch(`${API_URL}/organizations/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ organizationId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Impossible de changer d’organisation');
      }
      setActiveOrganizationId(organizationId);
      await refresh();
    },
    createOrganization: async (name: string) => {
      const res = await fetch(`${API_URL}/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Impossible de créer l’organisation');
      }
      await refresh();
    },
    login: async (email: string, password: string) => {
      if (expiredRef.current && email.trim().toLowerCase() !== userRef.current?.email?.toLowerCase()) {
        throw new Error('Reconnectez-vous avec le même compte pour reprendre vos modifications.');
      }
      if (!expiredRef.current) setLoading(true);
      try {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Identifiants invalides');
        }
        if (expiredRef.current && activeOrganizationId) {
          const restored = await fetch(`${API_URL}/organizations/switch`, {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ organizationId: activeOrganizationId }),
          });
          if (!restored.ok) throw new Error('Impossible de retrouver l’organisation de vos modifications.');
        }
        await refresh({ silent: expiredRef.current, recover: true });
      } finally {
        setLoading(false);
      }
    },
    register: async (email: string, password: string, name?: string) => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password, name }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Impossible de créer le compte');
        }
        await refresh({ silent: expiredRef.current });
      } finally {
        setLoading(false);
      }
    },
    logout,
    impersonate: async (roleId: string | null) => {
      try {
        // Mettre à jour immédiatement le state pour les prochaines requêtes
        setImpersonatedRoleId(roleId);
        const res = await fetch(`${API_URL}/auth/impersonate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ roleId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setImpersonatedRoleId(null);
          throw new Error(data.error || 'Impersonation failed');
        }
        await refresh();
      } catch (err) {
        setImpersonatedRoleId(null);
        throw err;
      }
    },
    isAdmin,
    isAdminBase,
    isEditor,
    isViewer,
    impersonatedRoleId,
  };

  return <AuthContext.Provider value={value}>
    {children}
    <dialog ref={sessionDialog} aria-label="Session expirée" onCancel={event => event.preventDefault()}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-background p-0 text-foreground backdrop:bg-black/60">
      {sessionExpired && <>
        <div role="alert" className="bg-amber-100 p-4 text-center text-amber-950">
          Votre session a expiré. Reconnectez-vous avec le même compte pour reprendre.
          Vos modifications en cours sont conservées dans cet onglet. Ne le fermez pas et ne rechargez pas la page.
        </div>
        <LoginPage onLogin={value.login} onRegister={value.register} loading={loading} reconnect />
      </>}
    </dialog>
  </AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
