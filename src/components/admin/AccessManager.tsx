import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Shield, UserPlus, Plus, Download, Trash2, Database, RotateCcw, Search, Palette, Clock3, BellRing, Save, CheckCircle2 } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/auth/AuthProvider';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type UserPreferenceDraft = {
  accentColor: string;
  workStart: string;
  workEnd: string;
  breakStart: string;
  breakEnd: string;
  timezone: string;
  weekStartsOn: string;
  density: string;
  notificationsEnabled: boolean;
};

const createDefaultUserPreferences = (): UserPreferenceDraft => ({
  accentColor: '#06b6d4',
  workStart: '09:00',
  workEnd: '18:00',
  breakStart: '12:30',
  breakEnd: '13:30',
  timezone: 'Europe/Paris',
  weekStartsOn: 'monday',
  density: 'comfortable',
  notificationsEnabled: true,
});

const normalizeUserPreferences = (value: any): UserPreferenceDraft => {
  const base = createDefaultUserPreferences();
  const src = typeof value === 'string'
    ? (() => {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    })()
    : value && typeof value === 'object'
      ? value
      : {};

  return {
    accentColor: typeof src.accentColor === 'string' ? src.accentColor : base.accentColor,
    workStart: typeof src.workStart === 'string' ? src.workStart : base.workStart,
    workEnd: typeof src.workEnd === 'string' ? src.workEnd : base.workEnd,
    breakStart: typeof src.breakStart === 'string' ? src.breakStart : base.breakStart,
    breakEnd: typeof src.breakEnd === 'string' ? src.breakEnd : base.breakEnd,
    timezone: typeof src.timezone === 'string' ? src.timezone : base.timezone,
    weekStartsOn: src.weekStartsOn === 'sunday' ? 'sunday' : 'monday',
    density: ['compact', 'comfortable', 'spacious'].includes(src.density) ? src.density : base.density,
    notificationsEnabled: Boolean(src.notificationsEnabled),
  };
};

const flags = [
  { key: 'can_read', label: 'Voir', hint: 'Consulter les collections et leurs items' },
  { key: 'can_write', label: 'Éditer', hint: 'Créer ou modifier des items dans la collection' },
  { key: 'can_delete', label: 'Supprimer', hint: 'Supprimer des items de la collection' },
  { key: 'can_manage_fields', label: 'Champs', hint: 'Ajouter, éditer ou supprimer les champs/colonnes de la collection' },
  { key: 'can_manage_views', label: 'Vues', hint: 'Créer, éditer ou supprimer les vues (Table, Kanban, Calendrier)' },
  { key: 'can_manage_permissions', label: 'Permissions', hint: 'Gérer les droits des rôles et utilisateurs' },
];

const AccessManager = ({
  collections,
  dashboards,
  onClose,
  onImportCollections,
  onUpdateDashboards,
}: {
  collections: any[];
  dashboards: any[];
  onClose: () => void;
  onImportCollections?: (collections: any[]) => void;
  onUpdateDashboards?: (dashboards: any[]) => void;
}) => {
  const { isAdminBase: isAdmin, refresh: refreshAuth, user, organizations, activeOrganizationId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [memberCandidates, setMemberCandidates] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [membersBusy, setMembersBusy] = useState(false);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});
  const [backupLabel, setBackupLabel] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [permissionsTab, setPermissionsTab] = useState<'global' | 'collections' | 'dashboards'>('global');
  const [userQuery, setUserQuery] = useState('');
  const [selectedPreferencesUserId, setSelectedPreferencesUserId] = useState<string>('');
  const [userPreferenceDrafts, setUserPreferenceDrafts] = useState<Record<string, UserPreferenceDraft>>({});
  const [preferencesBusyByUser, setPreferencesBusyByUser] = useState<Record<string, boolean>>({});
  const [preferencesSavedAtByUser, setPreferencesSavedAtByUser] = useState<Record<string, number>>({});

  const loadAll = async () => {
    try {
      setLoading(true);
      const [rRes, uRes, mRes, pRes, cRes] = await Promise.all([
        fetch(`${API_URL}/roles`, { credentials: 'include' }),
        fetch(`${API_URL}/users`, { credentials: 'include' }),
        fetch(`${API_URL}/organization/members`, { credentials: 'include' }),
        fetch(`${API_URL}/permissions`, { credentials: 'include' }),
        fetch(`${API_URL}/organization/member-candidates`, { credentials: 'include' }),
      ]);
      if (!rRes.ok || !uRes.ok || !mRes.ok || !pRes.ok || !cRes.ok) throw new Error('Erreur de chargement');
      const rolesData = await rRes.json();
      const usersData = await uRes.json();
      const membersData = await mRes.json();
      const permsData = await pRes.json();
      const candidatesData = await cRes.json();
      setRoles(rolesData);
      setUsers(usersData);
      setMembers(Array.isArray(membersData) ? membersData : []);
      setPermissions(permsData);
      setMemberCandidates(Array.isArray(candidatesData) ? candidatesData : []);
      try {
        const bRes = await fetch(`${API_URL}/db/backups`, { credentials: 'include' });
        if (bRes.ok) {
          const backupsData = await bRes.json();
          setBackups(Array.isArray(backupsData) ? backupsData : []);
        }
      } catch (err) {
        console.error(err);
      }
      if (!selectedRoleId && rolesData.length) setSelectedRoleId(rolesData[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addMember = async (userId: string, email: string) => {
    if (!userId) return;
    setMembersBusy(true);
    try {
      const res = await fetch(`${API_URL}/organization/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('Add member failed');
      await loadAll();
    } catch (err) {
      console.error(err);
      alert(`Impossible d’ajouter ${email} à l’organisation.`);
    } finally {
      setMembersBusy(false);
    }
  };

  const removeMember = async (userId: string, email: string) => {
    const ok = confirm(`Retirer ${email} de l'organisation active ?`);
    if (!ok) return;
    setMembersBusy(true);
    try {
      const res = await fetch(`${API_URL}/organization/members/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Remove member failed');
      }
      await loadAll();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Impossible de retirer ce membre.');
    } finally {
      setMembersBusy(false);
    }
  };

  const formatBytes = (value: number) => {
    if (!Number.isFinite(value)) return '-';
    if (value < 1024) return `${value} o`;
    const units = ['Ko', 'Mo', 'Go'];
    let size = value / 1024;
    let unit = units.shift() as string;
    while (size >= 1024 && units.length) {
      size /= 1024;
      unit = units.shift() as string;
    }
    return `${size.toFixed(1)} ${unit}`;
  };

  const reloadBackups = async () => {
    try {
      const res = await fetch(`${API_URL}/db/backups`, { credentials: 'include' });
      if (!res.ok) throw new Error('Load backups failed');
      const data = await res.json();
      setBackups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const createBackup = async () => {
    setBackupBusy(true);
    try {
      const res = await fetch(`${API_URL}/db/backups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: backupLabel.trim() || undefined }),
      });
      if (!res.ok) {
        let message = 'Impossible de créer la sauvegarde.';
        try {
          const errData = await res.json();
          if (errData?.detail) message = `${message}\n${errData.detail}`;
          else if (errData?.error) message = `${message}\n${errData.error}`;
        } catch {
          // ignore parse error
        }
        throw new Error(message);
      }
      setBackupLabel('');
      await reloadBackups();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Impossible de créer la sauvegarde.');
    } finally {
      setBackupBusy(false);
    }
  };

  const downloadBackup = async (name: string) => {
    try {
      const res = await fetch(`${API_URL}/db/backups/${encodeURIComponent(name)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Download backup failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Impossible de télécharger la sauvegarde.');
    }
  };

  const deleteBackup = async (name: string) => {
    const ok = confirm(`Supprimer la sauvegarde ${name} ?`);
    if (!ok) return;
    try {
      const res = await fetch(`${API_URL}/db/backups/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Delete backup failed');
      await reloadBackups();
    } catch (err) {
      console.error(err);
      alert('Impossible de supprimer la sauvegarde.');
    }
  };

  const restoreBackup = async (name: string) => {
    const ok = confirm(`Restaurer la base depuis ${name} ? Cette action écrase la base actuelle.`);
    if (!ok) return;
    setBackupBusy(true);
    try {
      const res = await fetch(`${API_URL}/db/backups/${encodeURIComponent(name)}/restore`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Restore backup failed');
      alert('Restauration terminée.');
    } catch (err) {
      console.error(err);
      alert('Impossible de restaurer la sauvegarde.');
    } finally {
      setBackupBusy(false);
    }
  };

  const sortedBackups = [...backups].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const visibleBackups = sortedBackups.slice(0, 10);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mergedUsers = [...users, ...memberCandidates.filter((c) => !users.some((u) => u.id === c.id))];
    if (!mergedUsers.length) {
      setSelectedPreferencesUserId('');
      return;
    }

    setSelectedPreferencesUserId((prev) => {
      if (prev && mergedUsers.some((u) => u.id === prev)) return prev;
      return mergedUsers[0].id;
    });

    setUserPreferenceDrafts((prev) => {
      let changed = false;
      const next: Record<string, UserPreferenceDraft> = {};
      mergedUsers.forEach((u) => {
        const merged = normalizeUserPreferences(u.user_preferences);
        next[u.id] = merged;
        if (JSON.stringify(prev[u.id]) !== JSON.stringify(merged)) {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [users, memberCandidates]);

  const collectionsWithProps = useMemo(() => {
    return collections.map((col: any) => ({
      id: col.id,
      name: col.name,
      properties: col.properties || [],
    }));
  }, [collections]);

  const parseRoleIds = (value: any) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const roleById = useMemo(() => {
    return new Map(roles.map((r) => [r.id, r]));
  }, [roles]);

  const memberIds = useMemo(() => {
    return new Set((members || []).map((m) => m.id));
  }, [members]);

  const selectableUsers = useMemo(() => {
    const byId = new Map<string, any>();
    users.forEach((u) => byId.set(u.id, u));
    memberCandidates.forEach((u) => {
      if (!byId.has(u.id)) {
        byId.set(u.id, {
          ...u,
          role_ids: [],
          user_preferences: createDefaultUserPreferences(),
        });
      }
    });
    return Array.from(byId.values());
  }, [users, memberCandidates]);

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    if (!query) return selectableUsers;

    return selectableUsers.filter((u) => {
      const roleIds = parseRoleIds(u.role_ids);
      const roleNames = roleIds
        .map((id: string) => roleById.get(id)?.name || '')
        .join(' ')
        .toLowerCase();
      const provider = String(u.provider || 'local').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      return email.includes(query) || provider.includes(query) || roleNames.includes(query);
    });
  }, [selectableUsers, userQuery, roleById]);

  const updateUserPreferencesDraft = (userId: string, patch: Partial<UserPreferenceDraft>) => {
    if (!userId) return;
    setUserPreferenceDrafts((prev) => {
      const current = prev[userId] || createDefaultUserPreferences();
      return {
        ...prev,
        [userId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const saveUserPreferences = async (userId: string) => {
    if (!userId) return;
    const payload = userPreferenceDrafts[userId] || createDefaultUserPreferences();

    setPreferencesBusyByUser((prev) => ({ ...prev, [userId]: true }));
    try {
      const res = await fetch(`${API_URL}/users/${encodeURIComponent(userId)}/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences: payload }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Sauvegarde impossible');
      }

      const data = await res.json().catch(() => ({}));
      const saved = normalizeUserPreferences(data?.user?.user_preferences || payload);

      setUserPreferenceDrafts((prev) => ({ ...prev, [userId]: saved }));
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, user_preferences: saved } : u)));
      setPreferencesSavedAtByUser((prev) => ({ ...prev, [userId]: Date.now() }));
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Impossible de sauvegarder les préférences utilisateur.');
    } finally {
      setPreferencesBusyByUser((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const selectedPreferencesUser = selectableUsers.find((u) => u.id === selectedPreferencesUserId) || null;
  const selectedPreferencesDraft = selectedPreferencesUserId
    ? userPreferenceDrafts[selectedPreferencesUserId] || createDefaultUserPreferences()
    : createDefaultUserPreferences();

  const findPermission = (roleId: string, scope: any) => {
    const collId = scope.collectionId || null;
    const itmId = scope.itemId || null;
    const fldId = scope.fieldId || null;
    
    return permissions.find(
      (p) =>
        p.role_id === roleId &&
        (p.collection_id || null) === collId &&
        (p.item_id || null) === itmId &&
        (p.field_id || null) === fldId
    );
  };

  const isDashboardVisibleForRole = (dashboard: any, roleId: string) => {
    const allowedRoles = Array.isArray(dashboard?.visibleToRoles) ? dashboard.visibleToRoles : [];
    const allowedUsers = Array.isArray(dashboard?.visibleToUsers) ? dashboard.visibleToUsers : [];
    const hasRestriction = allowedRoles.length > 0 || allowedUsers.length > 0;
    if (!hasRestriction) return true;
    return allowedRoles.includes(roleId);
  };

  const toggleDashboardVisibilityForRole = (dashboardId: string, roleId: string, visible: boolean) => {
    if (!onUpdateDashboards) return;

    const allRoleIds = roles.map((r) => r.id);
    const nextDashboards = (dashboards || []).map((db: any) => {
      if (db.id !== dashboardId) return db;

      const currentRoles = Array.isArray(db.visibleToRoles) ? [...db.visibleToRoles] : [];
      const currentUsers = Array.isArray(db.visibleToUsers) ? [...db.visibleToUsers] : [];
      const hasRestriction = currentRoles.length > 0 || currentUsers.length > 0;

      if (visible) {
        // Si non restreint, déjà visible pour tout le monde
        if (!hasRestriction) return db;
        const merged = Array.from(new Set([...currentRoles, roleId]));
        return { ...db, visibleToRoles: merged };
      }

      // Si non restreint et on retire un rôle, on crée une allow-list pour tous les autres rôles
      if (!hasRestriction) {
        return {
          ...db,
          visibleToRoles: allRoleIds.filter((id) => id !== roleId),
          visibleToUsers: currentUsers,
        };
      }

      return {
        ...db,
        visibleToRoles: currentRoles.filter((id: string) => id !== roleId),
        visibleToUsers: currentUsers,
      };
    });

    onUpdateDashboards(nextDashboards);
  };

  const savePermission = async (roleId: string, scope: any, flag: string, value: boolean) => {
    const body: Record<string, any> = {
      role_id: roleId,
      collection_id: scope.collectionId || null,
      item_id: scope.itemId || null,
      field_id: scope.fieldId || null,
    };

    const existing = findPermission(roleId, scope);
    if (existing) {
      flags.forEach((f) => {
        body[f.key] = !!existing[f.key];
      });
    } else {
      flags.forEach((f) => {
        body[f.key] = false;
      });
    }

    body[flag] = value;

    const res = await fetch(`${API_URL}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('Update failed:', errText);
      throw new Error('Update failed');
    }
    const updatedPerm = await res.json();
    return updatedPerm || { ...body };
  };

  const applyLocalUpdates = (roleId: string, updates: { scope: any; flag: string; value: boolean; perm: any }[]) => {
    setPermissions((prev) => {
      const next = [...prev];
      updates.forEach(({ scope, flag, value, perm }) => {
        const collId = scope.collectionId || null;
        const itmId = scope.itemId || null;
        const fldId = scope.fieldId || null;
        const idx = next.findIndex(
          (p) =>
            p.role_id === roleId &&
            (p.collection_id || null) === collId &&
            (p.item_id || null) === itmId &&
            (p.field_id || null) === fldId
        );
        if (idx >= 0) {
          next[idx] = { ...next[idx], [flag]: value };
        } else {
          next.push({ id: perm.id, role_id: roleId, collection_id: collId, item_id: itmId, field_id: fldId, [flag]: value });
        }
      });
      return next;
    });
  };

  const toggleFlag = async (roleId: string, scope: any, flag: string, value: boolean) => {
    setBusy(true);
    try {
      const updates: { scope: any; flag: string; value: boolean; perm?: any }[] = [];

      if (scope.type === 'global') {
        // Apply to global, all collections, and all properties
        updates.push({ scope, flag, value });
        collectionsWithProps.forEach((col) => {
          const colScope = { type: 'collection', label: col.name, collectionId: col.id, itemId: null, fieldId: null };
          updates.push({ scope: colScope, flag, value });
          (col.properties || []).forEach((prop: any) => {
            const propScope = { type: 'property', label: prop.name, collectionId: col.id, itemId: null, fieldId: prop.id };
            updates.push({ scope: propScope, flag, value });
          });
        });
      } else if (scope.type === 'collection') {
        // Apply to collection and its properties
        updates.push({ scope, flag, value });
        const col = collectionsWithProps.find((c) => c.id === scope.collectionId);
        (col?.properties || []).forEach((prop: any) => {
          const propScope = { type: 'property', label: prop.name, collectionId: col?.id, itemId: null, fieldId: prop.id };
          updates.push({ scope: propScope, flag, value });
        });
      } else if (scope.type === 'property') {
        // Only this property; no automatic cascade to parent collection
        updates.push({ scope, flag, value });
      } else {
        updates.push({ scope, flag, value });
      }

      // Persist sequentially to keep order predictable
      for (const u of updates) {
        const perm = await savePermission(roleId, u.scope, u.flag, u.value);
        u.perm = perm;
      }

      applyLocalUpdates(roleId, updates as any);

      // Refresh current user's auth if their role was modified
      if (user && user.role_ids && user.role_ids.includes(roleId)) {
        await refreshAuth();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const assignRole = async (userId: string, roleId: string, action: 'add' | 'remove') => {
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/user_roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, roleId, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Assign failed');
      }
      await loadAll();

      // Refresh current user's auth if their assignment was modified
      if (user && user.id === userId) {
        await refreshAuth();
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Impossible de modifier ce rôle.');
    } finally {
      setBusy(false);
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newRoleName.trim(), description: newRoleDesc.trim() || undefined }),
      });
      if (!res.ok) throw new Error('Create role failed');
      setNewRoleName('');
      setNewRoleDesc('');
      setCreatingRole(false);
      await loadAll();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const updateUserPassword = async (userId: string) => {
    const nextPassword = (passwordInputs[userId] || '').trim();
    if (!nextPassword) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/users/${userId}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: nextPassword }),
      });
      if (!res.ok) throw new Error('Update password failed');
      setPasswordInputs((prev) => ({ ...prev, [userId]: '' }));
      await loadAll();
    } catch (err) {
      console.error(err);
      alert('Impossible de modifier le mot de passe.');
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    const ok = confirm(`Supprimer le compte ${email} ? Cette action est irréversible.`);
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Delete user failed');
      }
      await loadAll();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Impossible de supprimer le compte.');
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="w-full max-w-6xl bg-white dark:bg-neutral-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-cyan-400" />
              <div>
                <h3 className="text-lg font-semibold">Comptes & Permissions</h3>
                <p className="text-sm text-neutral-500">Gérez les rôles, l’accès par collection / objet / champ.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs shadow "
                style={{ minWidth: 80 }}
                onClick={async () => {
                  // Export JSON de l'organisation active
                  try {
                    const res = await fetch(`${API_URL}/appstate?scope=organization`, { credentials: 'include' });
                    if (!res.ok) throw new Error('Erreur export appstate');
                    const data = await res.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'erp_organization_export.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    alert('Erreur lors de l\'export appstate.');
                  }
                }}
              >
                Export Orga JSON
              </button>
              <button
                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs shadow "
                style={{ minWidth: 80 }}
                onClick={async () => {
                  // Export JSON global (toutes organisations)
                  try {
                    const res = await fetch(`${API_URL}/appstate?scope=global`, { credentials: 'include' });
                    if (!res.ok) throw new Error('Erreur export global appstate');
                    const data = await res.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'erp_global_export.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    alert('Erreur lors de l\'export global appstate.');
                  }
                }}
              >
                Export Complet
              </button>
              <button
                className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-700 text-white text-xs shadow "
                style={{ minWidth: 80 }}
                onClick={async () => {
                  // Export CSV des collections de l'organisation active (dans un zip)
                  try {
                    const res = await fetch(`${API_URL}/appstate?scope=organization`, { credentials: 'include' });
                    if (!res.ok) throw new Error('Erreur export appstate');
                    const data = await res.json();
                    const appStateArr = Array.isArray(data.app_state) ? data.app_state : [];
                    const row = appStateArr[0];
                    if (!row) return;
                    let state;
                    try {
                      state = JSON.parse(row.data);
                    } catch (e) {
                      alert('Impossible de parser le state pour CSV');
                      return;
                    }
                    const collections = Array.isArray(state.collections) ? state.collections : [];
                    if (collections.length === 0) return;
                    let JSZip;
                    try {
                      JSZip = (await import('jszip')).default;
                    } catch (e) {
                      alert('JSZip est requis pour l\'export CSV.');
                      return;
                    }
                    const zip = new JSZip();
                    for (const col of collections) {
                      const items = Array.isArray(col.items) ? col.items : [];
                      if (items.length === 0) continue;
                      const allKeys = Array.from(new Set(items.flatMap((item: {}) => Object.keys(item))));
                      const header = allKeys.join(',');
                      const csvRows = [header];
                      for (const item of items) {
                        const row = allKeys.map(k => {
                          let v = (item as Record<string, any>)[k as string];
                          if (typeof v === 'object' && v !== null) v = JSON.stringify(v);
                          if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
                            v = '"' + v.replace(/"/g, '""') + '"';
                          }
                          return v ?? '';
                        }).join(',');
                        csvRows.push(row);
                      }
                      const csvContent = csvRows.join('\n');
                      zip.file(`${col.name || col.id || 'collection'}.csv`, csvContent);
                    }
                    const zipBlob = await zip.generateAsync({ type: 'blob' });
                    const zipUrl = URL.createObjectURL(zipBlob);
                    const azip = document.createElement('a');
                    azip.href = zipUrl;
                    azip.download = 'erp_collections_csv.zip';
                    document.body.appendChild(azip);
                    azip.click();
                    document.body.removeChild(azip);
                    URL.revokeObjectURL(zipUrl);
                  } catch (err) {
                    alert('Erreur lors de l\'export CSV.');
                  }
                }}
              >
                Export CSV
              </button>
              <label className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-xs shadow cursor-pointer" style={{ minWidth: 80, textAlign: 'center' }}>
                Importer
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const fullData = JSON.parse(text);  // Garde TOUT le JSON
                      const appStateRows = Array.isArray(fullData?.app_state) ? fullData.app_state : [];
                      const organizationIdsFromState = new Set(
                        appStateRows
                          .map((row: any) => row?.organization_id)
                          .filter((value: any) => typeof value === 'string' && value.length > 0)
                      );
                      const organizationsInPayload = Array.isArray(fullData?.organizations)
                        ? fullData.organizations.length
                        : 0;

                      const inferredScope: 'global' | 'organization' =
                        fullData?.scope === 'global' ||
                        /global/i.test(file.name) ||
                        organizationsInPayload > 1 ||
                        organizationIdsFromState.size > 1
                          ? 'global'
                          : 'organization';

                      const res = await fetch(`${API_URL}/appstate?scope=${inferredScope}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(fullData),  // ← Envoi TOUT (users + appstate + ...)
                      });
                      const result = await res.json().catch(() => ({}));
                      if (!res.ok) {
                        throw new Error(result?.error || 'Erreur import appstate');
                      }

                      const appliedScope: 'global' | 'organization' =
                        result?.scope === 'global' ? 'global' : inferredScope;

                      if (appliedScope === 'global') {
                        const orgCount =
                          organizationsInPayload ||
                          organizationIdsFromState.size ||
                          1;
                        alert(`✅ Import global réussi ! ${orgCount} organisation(s) remplacée(s).`);
                      } else {
                        alert('✅ Import organisation réussi ! Seule l’organisation active a été remplacée.');
                      }
                      // Optionnel : reload tout
                      loadAll();
                    } catch (err) {
                      alert(`❌ Erreur lors de l'import : ${err instanceof Error ? err.message : String(err)}`);
                    }
                  }}

                />
              </label>
              <button onClick={loadAll} className="p-2 rounded-lg hover:bg-white/10 text-neutral-600 dark:text-white" title="Rafraîchir">
                <RefreshCw size={16} />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-neutral-600 dark:text-white">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6 max-h-[80svh] overflow-y-scroll">
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl border border-black/10 dark:border-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Database size={16} className="text-cyan-400" />
                    <h4 className="font-semibold">Sauvegardes BDD</h4>
                  </div>
                  <button onClick={reloadBackups} className="p-2 rounded-lg hover:bg-white/10 text-neutral-600 dark:text-white" title="Rafraîchir">
                    <RefreshCw size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    className="flex-1 bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
                    placeholder="Label (optionnel)"
                    value={backupLabel}
                    onChange={(e) => setBackupLabel(e.target.value)}
                  />
                  <button
                    onClick={createBackup}
                    className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs shadow disabled:opacity-60"
                    disabled={backupBusy}
                  >
                    Créer
                  </button>
                  <button
                    onClick={reloadBackups}
                    className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs"
                  >
                    Reload
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {visibleBackups.length === 0 && <p className="text-sm text-neutral-500">Aucune sauvegarde.</p>}
                  {visibleBackups.map((b) => (
                    <div key={b.name} className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 p-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{b.name}</div>
                        <div className="text-xs text-neutral-500">
                          {formatBytes(b.size)} · {new Date(b.createdAt).toLocaleString('fr-FR')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-600"
                          onClick={() => restoreBackup(b.name)}
                          title="Restaurer"
                          disabled={backupBusy}
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          className="p-2 rounded-lg hover:bg-white/10 text-neutral-600 dark:text-white"
                          onClick={() => downloadBackup(b.name)}
                          title="Télécharger"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="p-2 rounded-lg hover:bg-red-500/10 text-red-600"
                          onClick={() => deleteBackup(b.name)}
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {sortedBackups.length > 10 && (
                    <div className="text-xs text-neutral-500">
                      Affichage limité aux 10 dernières sauvegardes.
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white/5 rounded-xl border border-black/10 dark:border-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Permissions</h4>
                  {loading && <span className="text-xs text-neutral-500">Chargement…</span>}
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-neutral-500">Rôles</div>
                  <button onClick={() => setCreatingRole(!creatingRole)} className="text-sm text-cyan-400 flex items-center gap-1">
                    <Plus size={14} /> Nouveau
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        selectedRoleId === r.id ? 'bg-cyan-500/20 text-black dark:text-white border border-cyan-500/40' : 'bg-white/5 text-neutral-500 dark:text-white'
                      }`}
                      onClick={() => setSelectedRoleId(r.id)}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
                <AnimatePresence>
                  {creatingRole && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2"
                    >
                      <input
                        className="bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
                        placeholder="Nom du rôle"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                      />
                      <input
                        className="bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
                        placeholder="Description (optionnel)"
                        value={newRoleDesc}
                        onChange={(e) => setNewRoleDesc(e.target.value)}
                      />
                      <ShinyButton onClick={createRole} className={busy ? 'opacity-60 pointer-events-none' : ''}>
                        <UserPlus size={14} /> Créer
                      </ShinyButton>
                    </motion.div>
                  )}
                </AnimatePresence>
                {selectedRoleId ? (
                  <Tabs value={permissionsTab} onValueChange={(v) => setPermissionsTab(v as any)} className="w-full">
                    <TabsList className="mb-3 w-full justify-start gap-2 bg-transparent p-0">
                      <TabsTrigger value="global" className="border border-black/10 dark:border-white/10">Global</TabsTrigger>
                      <TabsTrigger value="collections" className="border border-black/10 dark:border-white/10">Collections</TabsTrigger>
                      <TabsTrigger value="dashboards" className="border border-black/10 dark:border-white/10">Dashboards</TabsTrigger>
                    </TabsList>

                    <TabsContent value="global" className="mt-0 p-0 border-0">
                      <div className="space-y-4 max-h-[520px] overflow-auto pr-1">
                        {(() => {
                          const scope = { type: 'global', label: 'Global', collectionId: null, itemId: null, fieldId: null };
                          const perm = findPermission(selectedRoleId, scope) || {};
                          return (
                            <div key="global" className="bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 rounded-lg overflow-hidden">
                              <div className="px-4 py-3 bg-cyan-500/10 border-b border-cyan-500/20">
                                <div className="text-sm font-semibold">Global</div>
                                <div className="text-xs text-neutral-600 dark:text-white mt-0.5">Permissions appliquées à toutes les collections</div>
                              </div>
                              <div className="px-4 py-3">
                                <div className="text-xs font-medium text-neutral-600 dark:text-white mb-2">Paramètres global</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {flags.map((f) => {
                                    const isChecked = !!perm[f.key];
                                    return (
                                      <label
                                        key={f.key}
                                        className="flex items-center gap-2 text-xs text-neutral-500 dark:text-white hover:text-black cursor-pointer"
                                        title={f.hint}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => toggleFlag(selectedRoleId, scope, f.key, e.target.checked)}
                                          disabled={busy}
                                          className="cursor-pointer"
                                        />
                                        <span>{f.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </TabsContent>

                    <TabsContent value="collections" className="mt-0 p-0 border-0">
                      <div className="space-y-4 max-h-[520px] overflow-auto pr-1">
                        {collectionsWithProps.map((col) => {
                          const collectionScope = { type: 'collection', label: col.name, collectionId: col.id, itemId: null, fieldId: null };
                          const permCol = findPermission(selectedRoleId, collectionScope) || {};
                          const propertyFlags = flags.filter((f) => ['can_read', 'can_write', 'can_delete'].includes(f.key));

                          return (
                            <div key={col.id} className="bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 rounded-lg overflow-hidden">
                              <div className="px-4 py-3 bg-white/5 border-b border-black/10 dark:border-white/5">
                                <div className="text-sm font-semibold">{col.name}</div>
                                <div className="text-xs text-neutral-600 dark:text-white mt-0.5">Permissions de collection et propriétés</div>
                              </div>

                              <div className="px-4 py-3 border-b border-black/10 dark:border-white/5">
                                <div className="text-xs font-medium text-neutral-600 dark:text-white mb-2">Collection</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {flags.map((f) => {
                                    const isChecked = !!permCol[f.key];
                                    return (
                                      <label
                                        key={f.key}
                                        className="flex items-center gap-2 text-xs text-neutral-500 dark:text-white hover:text-black cursor-pointer"
                                        title={f.hint}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => toggleFlag(selectedRoleId, collectionScope, f.key, e.target.checked)}
                                          disabled={busy}
                                          className="cursor-pointer"
                                        />
                                        <span>{f.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="px-4 py-3">
                                <div className="text-xs font-medium text-neutral-600 dark:text-white mb-2">Propriétés (champs)</div>
                                {col.properties.length === 0 ? (
                                  <div className="text-xs text-neutral-500">Aucune propriété dans cette collection.</div>
                                ) : (
                                  <div className="space-y-2 max-h-56 overflow-auto pr-1">
                                    {col.properties.map((prop: any) => {
                                      const propScope = { type: 'property', label: prop.name, collectionId: col.id, itemId: null, fieldId: prop.id };
                                      const permProp = findPermission(selectedRoleId, propScope) || {};

                                      return (
                                        <div
                                          key={prop.id}
                                          className="flex items-center justify-between bg-white dark:bg-neutral-950/60 border border-black/10 dark:border-white/5 rounded-lg px-3 py-2"
                                        >
                                          <div>
                                            <div className="text-sm font-medium text-black dark:text-white">{prop.name}</div>
                                            <div className="text-xs text-neutral-500">{prop.type}</div>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            {propertyFlags.map((f) => {
                                              const isChecked = !!permProp[f.key];
                                              return (
                                                <label
                                                  key={f.key}
                                                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-black dark:text-white cursor-pointer"
                                                  title={`${f.label} ce champ`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => toggleFlag(selectedRoleId, propScope, f.key, e.target.checked)}
                                                    disabled={busy}
                                                    className="cursor-pointer"
                                                  />
                                                  <span>{f.label}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </TabsContent>

                    <TabsContent value="dashboards" className="mt-0 p-0 border-0">
                      <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                        {(dashboards || []).length === 0 && (
                          <p className="text-sm text-neutral-500">Aucun dashboard.</p>
                        )}
                        {(dashboards || []).map((db: any) => {
                          const checked = isDashboardVisibleForRole(db, selectedRoleId);
                          const restricted = (db?.visibleToRoles?.length || 0) > 0 || (db?.visibleToUsers?.length || 0) > 0;
                          return (
                            <div
                              key={db.id}
                              className="flex items-center justify-between bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 rounded-lg px-3 py-2"
                            >
                              <div>
                                <div className="text-sm font-medium text-black dark:text-white">{db.name}</div>
                                <div className="text-xs text-neutral-500">
                                  {restricted ? 'Restreint par visibilité' : 'Visible pour tout le monde'}
                                </div>
                              </div>
                              <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-white cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => toggleDashboardVisibilityForRole(db.id, selectedRoleId, e.target.checked)}
                                  className="cursor-pointer"
                                />
                                <span>Visible pour ce rôle</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <p className="text-sm text-neutral-500">Sélectionnez un rôle pour éditer ses permissions.</p>
                )}
              </div>
            </div>

            <div className="lg:col-span-3 bg-white/5 rounded-xl border border-black/10 dark:border-white/5 p-4">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-4">
                <div>
                  <h4 className="font-semibold">Utilisateurs</h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Tout est ici : membres de l’organisation, rôles, mot de passe et préférences.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                    {selectableUsers.length} utilisateur(s)
                  </span>
                  <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    {members.length} membre(s) orga
                  </span>
                  <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    {Math.max(selectableUsers.length - members.length, 0)} hors orga
                  </span>
                </div>
              </div>

              <div className="grid xl:grid-cols-2 gap-2 mt-3">
                <div className="rounded-lg xl:col-span-2 bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 p-3">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Utilisateur ciblé</label>
                      <select
                        className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                        value={selectedPreferencesUserId}
                        onChange={(e) => setSelectedPreferencesUserId(e.target.value)}
                      >
                        {filteredUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">Recherche utilisateur</label>
                      <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm"
                          placeholder="Rechercher par email, provider ou rôle…"
                          value={userQuery}
                          onChange={(e) => setUserQuery(e.target.value)}
                        />
                      </div>
                    </div>

                  
                  </div>

                  {selectableUsers.length > 0 && filteredUsers.length === 0 && (
                    <p className="text-xs text-neutral-500 mt-2">Aucun résultat pour cette recherche.</p>
                  )}
                </div>

                {selectableUsers.length === 0 && <p className="text-sm text-neutral-500">Aucun utilisateur.</p>}

                {selectedPreferencesUser && (() => {
                  const roleIds = parseRoleIds(selectedPreferencesUser.role_ids);
                  const userRoles = roles.filter((r) => roleIds.includes(r.id));
                  const availableRoles = roles.filter((r) => !userRoles.some((ur) => ur.id === r.id));
                  const isLocal = !selectedPreferencesUser.provider || selectedPreferencesUser.provider === 'local';
                  const isSelf = user?.id === selectedPreferencesUser.id;
                  const isMember = memberIds.has(selectedPreferencesUser.id);

                  return (
                    <div className="grid grid-cols-1 xl:grid-cols-1 gap-3">
                      <div className="rounded-lg bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div>
                            <div className="font-medium break-all">{selectedPreferencesUser.email}</div>
                            <div className="text-xs text-neutral-500 mt-0.5">{selectedPreferencesUser.provider || 'local'}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${isMember ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' : 'bg-neutral-500/10 text-neutral-700 dark:text-neutral-300 border-neutral-500/30'}`}>
                              {isMember ? 'Membre orga' : 'Hors orga'}
                            </span>
                            {isSelf && (
                              <span className="px-2 py-0.5 text-xs rounded-full border bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30">
                                Vous
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-black/10 dark:border-white/10 bg-white/50 dark:bg-neutral-900 p-3 mb-3">
                          <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-2">Rôles actuels</div>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {!isMember && <span className="text-xs text-neutral-500">Ajoutez d’abord à l’organisation</span>}
                            {isMember && userRoles.length === 0 && <span className="text-xs text-neutral-500">Aucun rôle</span>}
                            {userRoles.map((r) => (
                              <button
                                key={r.id}
                                className="px-2 py-1 text-xs rounded-full bg-cyan-500/20 text-black dark:text-white border border-cyan-500/40 hover:bg-cyan-500/30 disabled:opacity-50"
                                onClick={() => assignRole(selectedPreferencesUser.id, r.id, 'remove')}
                                disabled={!isMember}
                              >
                                {r.name} ✕
                              </button>
                            ))}
                          </div>

                          <div className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-2">Ajouter un rôle</div>
                          <div className="flex flex-wrap gap-2">
                            {isMember && availableRoles.length === 0 && <span className="text-xs text-neutral-500">Tous les rôles sont déjà attribués</span>}
                            {availableRoles.map((r) => (
                              <button
                                key={r.id}
                                className="px-2 py-1 text-xs rounded-full bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 hover:bg-cyan-500/10 disabled:opacity-50"
                                onClick={() => assignRole(selectedPreferencesUser.id, r.id, 'add')}
                                disabled={!isMember}
                              >
                                + {r.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {isMember ? (
                            <button
                              className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-white border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
                              onClick={() => removeMember(selectedPreferencesUser.id, selectedPreferencesUser.email)}
                              disabled={membersBusy || isSelf}
                              title={isSelf ? 'Vous ne pouvez pas vous retirer vous-même.' : 'Retirer de l’organisation'}
                            >
                              Retirer de l’organisation
                            </button>
                          ) : (
                            <button
                              className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
                              onClick={() => addMember(selectedPreferencesUser.id, selectedPreferencesUser.email)}
                              disabled={membersBusy}
                            >
                              Ajouter à l’organisation
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 p-3">
                        <div className="text-sm font-semibold mb-2">Sécurité du compte</div>
                        <div className="text-xs text-neutral-500 mb-2">Mot de passe et suppression du compte.</div>
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="password"
                            className="flex-1 bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-sm"
                            placeholder={isLocal ? 'Nouveau mot de passe' : 'Mdp non disponible (SSO)'}
                            value={passwordInputs[selectedPreferencesUser.id] || ''}
                            onChange={(e) =>
                              setPasswordInputs((prev) => ({ ...prev, [selectedPreferencesUser.id]: e.target.value }))
                            }
                            disabled={!isLocal || busy}
                          />
                          <button
                            className="text-xs px-3 py-2 rounded-lg bg-cyan-500/20 text-black dark:text-white border border-cyan-500/40 whitespace-nowrap"
                            onClick={() => updateUserPassword(selectedPreferencesUser.id)}
                            disabled={!isLocal || busy || !(passwordInputs[selectedPreferencesUser.id] || '').trim()}
                          >
                            Modifier
                          </button>
                        </div>

                        <button
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-white border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
                          onClick={() => deleteUser(selectedPreferencesUser.id, selectedPreferencesUser.email)}
                          disabled={busy || isSelf}
                          title={isSelf ? 'Impossible de supprimer votre propre compte.' : 'Supprimer le compte'}
                        >
                          Supprimer le compte
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  <div className="rounded-lg bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Palette size={15} className="text-fuchsia-500" />
                      <h5 className="text-sm font-semibold">Options UI utilisateur</h5>
                    </div>
                    <p className="text-xs text-neutral-500 mb-3">Chaque utilisateur a ses propres options, persistées côté serveur.</p>

                    {selectedPreferencesUser && (
                      <div className="text-xs text-neutral-500 mb-3">
                        Configuration de <span className="font-medium text-black dark:text-white">{selectedPreferencesUser.email}</span>
                      </div>
                    )}

                    {selectedPreferencesUser && !memberIds.has(selectedPreferencesUser.id) && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                        Ajoutez cet utilisateur à l’organisation pour modifier ses options.
                      </p>
                    )}

                    <button
                      className="w-full mb-3 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs disabled:opacity-60 flex items-center justify-center gap-2"
                      onClick={() => saveUserPreferences(selectedPreferencesUserId)}
                      disabled={!selectedPreferencesUserId || !!preferencesBusyByUser[selectedPreferencesUserId] || !selectedPreferencesUser || !memberIds.has(selectedPreferencesUser.id)}
                    >
                      {preferencesBusyByUser[selectedPreferencesUserId] ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" /> Sauvegarde…
                        </>
                      ) : (
                        <>
                          <Save size={14} /> Sauvegarder les options UI
                        </>
                      )}
                    </button>

                    {selectedPreferencesUserId && !!preferencesSavedAtByUser[selectedPreferencesUserId] && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-300 mb-3 flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        Dernière sauvegarde à {new Date(preferencesSavedAtByUser[selectedPreferencesUserId]).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}

                    <label className="block text-xs text-neutral-500 mb-1">Couleur d’accent</label>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="color"
                        value={selectedPreferencesDraft.accentColor}
                        onChange={(e) => updateUserPreferencesDraft(selectedPreferencesUserId, { accentColor: e.target.value })}
                        className="h-9 w-12 rounded border border-white/10 bg-transparent"
                        disabled={!selectedPreferencesUserId || !selectedPreferencesUser || !memberIds.has(selectedPreferencesUser.id)}
                      />
                      <input
                        value={selectedPreferencesDraft.accentColor}
                        onChange={(e) => updateUserPreferencesDraft(selectedPreferencesUserId, { accentColor: e.target.value })}
                        className="flex-1 bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                        disabled={!selectedPreferencesUserId || !selectedPreferencesUser || !memberIds.has(selectedPreferencesUser.id)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Densité</label>
                        <select
                          value={selectedPreferencesDraft.density}
                          onChange={(e) => updateUserPreferencesDraft(selectedPreferencesUserId, { density: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                          disabled={!selectedPreferencesUserId || !selectedPreferencesUser || !memberIds.has(selectedPreferencesUser.id)}
                        >
                          <option value="compact">Compacte</option>
                          <option value="comfortable">Confort</option>
                          <option value="spacious">Aérée</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Début de semaine</label>
                        <select
                          value={selectedPreferencesDraft.weekStartsOn}
                          onChange={(e) => updateUserPreferencesDraft(selectedPreferencesUserId, { weekStartsOn: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                          disabled={!selectedPreferencesUserId || !selectedPreferencesUser || !memberIds.has(selectedPreferencesUser.id)}
                        >
                          <option value="monday">Lundi</option>
                          <option value="sunday">Dimanche</option>
                        </select>
                      </div>
                    </div>

                    <label className="block text-xs text-neutral-500 mb-1">Fuseau horaire</label>
                    <input
                      value={selectedPreferencesDraft.timezone}
                      onChange={(e) => updateUserPreferencesDraft(selectedPreferencesUserId, { timezone: e.target.value })}
                      className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs mb-3"
                      placeholder="Europe/Paris"
                      disabled={!selectedPreferencesUserId || !selectedPreferencesUser || !memberIds.has(selectedPreferencesUser.id)}
                    />

                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedPreferencesDraft.notificationsEnabled}
                        onChange={(e) => updateUserPreferencesDraft(selectedPreferencesUserId, { notificationsEnabled: e.target.checked })}
                        disabled={!selectedPreferencesUserId || !selectedPreferencesUser || !memberIds.has(selectedPreferencesUser.id)}
                      />
                      <BellRing size={14} className="text-cyan-500" /> Notifications par défaut
                    </label>
                  </div>

                  <div className="rounded-lg bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock3 size={15} className="text-amber-500" />
                      <h5 className="text-sm font-semibold">Horaires de travail utilisateur</h5>
                    </div>
                    <p className="text-xs text-neutral-500 mb-3">Préconfiguration utile pour le calendrier, les rappels et la charge.</p>

                    {selectedPreferencesUser && !memberIds.has(selectedPreferencesUser.id) && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                        Ajoutez cet utilisateur à l’organisation pour modifier ses horaires.
                      </p>
                    )}

                    <button
                      className="w-full mb-3 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs disabled:opacity-60 flex items-center justify-center gap-2"
                      onClick={() => saveUserPreferences(selectedPreferencesUserId)}
                      disabled={!selectedPreferencesUserId || !!preferencesBusyByUser[selectedPreferencesUserId] || !selectedPreferencesUser || !memberIds.has(selectedPreferencesUser.id)}
                    >
                      {preferencesBusyByUser[selectedPreferencesUserId] ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" /> Sauvegarde…
                        </>
                      ) : (
                        <>
                          <Save size={14} /> Sauvegarder les horaires
                        </>
                      )}
                    </button>

                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Début</label>
                        <input
                          type="time"
                          value={selectedPreferencesDraft.workStart}
                          onChange={(e) => updateUserPreferencesDraft(selectedPreferencesUserId, { workStart: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                          disabled={!selectedPreferencesUserId || !selectedPreferencesUser || !memberIds.has(selectedPreferencesUser.id)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Fin</label>
                        <input
                          type="time"
                          value={selectedPreferencesDraft.workEnd}
                          onChange={(e) => updateUserPreferencesDraft(selectedPreferencesUserId, { workEnd: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                          disabled={!selectedPreferencesUserId || !selectedPreferencesUser || !memberIds.has(selectedPreferencesUser.id)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Pause début</label>
                        <input
                          type="time"
                          value={selectedPreferencesDraft.breakStart}
                          onChange={(e) => updateUserPreferencesDraft(selectedPreferencesUserId, { breakStart: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                          disabled={!selectedPreferencesUserId || !selectedPreferencesUser || !memberIds.has(selectedPreferencesUser.id)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Pause fin</label>
                        <input
                          type="time"
                          value={selectedPreferencesDraft.breakEnd}
                          onChange={(e) => updateUserPreferencesDraft(selectedPreferencesUserId, { breakEnd: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                          disabled={!selectedPreferencesUserId || !selectedPreferencesUser || !memberIds.has(selectedPreferencesUser.id)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AccessManager;
