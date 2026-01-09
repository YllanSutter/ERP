import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type AuthContextShape = {
  user: any | null;
  roles: any[];
  baseRoles: any[];
  permissions: any[];
  loading: boolean;
  refresh: () => Promise<void>;
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
  const [impersonatedRoleId, setImpersonatedRoleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
      if (!res.ok) {
        setUser(null);
        setRoles([]);
        return;
      }
      const data = await res.json();
      setUser(data.user);
      setRoles(data.roles || []);
      setBaseRoles(data.baseRoles || data.roles || []);
      setPermissions(data.permissions || []);
      setImpersonatedRoleId(data.impersonatedRoleId || null);
    } catch (err) {
      console.error('Auth refresh failed', err);
      setUser(null);
      setRoles([]);
      setBaseRoles([]);
      setPermissions([]);
      setImpersonatedRoleId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      setUser(null);
      setRoles([]);
      setBaseRoles([]);
      setPermissions([]);
      setImpersonatedRoleId(null);
    }
  };

  const isAdmin = useMemo(() => roles.some((r) => r.name === 'admin'), [roles]);
  const isAdminBase = useMemo(() => baseRoles.some((r) => r.name === 'admin'), [baseRoles]);
  const isEditor = useMemo(() => roles.some((r) => r.name === 'editor'), [roles]);
  const isViewer = useMemo(() => roles.some((r) => r.name === 'viewer'), [roles]);

  const value: AuthContextShape = {
    user,
    roles,
    baseRoles,
    permissions,
    loading,
    refresh,
    login: async (email: string, password: string) => {
      setLoading(true);
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
        await refresh();
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
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    logout,
    impersonate: async (roleId: string | null) => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/auth/impersonate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ roleId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Impersonation failed');
        }
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    isAdmin,
    isAdminBase,
    isEditor,
    isViewer,
    impersonatedRoleId,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
