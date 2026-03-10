import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type AuthContextShape = {
  user: any | null;
  roles: any[];
  baseRoles: any[];
  permissions: any[];
  organizations: any[];
  activeOrganizationId: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
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

  const refresh = async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (impersonatedRoleId) {
        headers['X-Impersonate-Role-Id'] = impersonatedRoleId;
      }
      const res = await fetch(`${API_URL}/auth/me`, { 
        credentials: 'include',
        headers
      });
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
      setOrganizations(data.organizations || []);
      setActiveOrganizationId(data.activeOrganizationId || null);
      setImpersonatedRoleId(data.impersonatedRoleId || null);
    } catch (err) {
      console.error('Auth refresh failed', err);
      setUser(null);
      setRoles([]);
      setBaseRoles([]);
      setPermissions([]);
      setOrganizations([]);
      setActiveOrganizationId(null);
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
      setOrganizations([]);
      setActiveOrganizationId(null);
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
