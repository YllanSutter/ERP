import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Shield, UserPlus, Plus, Download, Trash2, Database, RotateCcw } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import { useAuth } from '@/auth/AuthProvider';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const flags = [
  { key: 'can_read', label: 'Voir', hint: 'Consulter les collections et leurs items' },
  { key: 'can_write', label: 'Éditer', hint: 'Créer ou modifier des items dans la collection' },
  { key: 'can_delete', label: 'Supprimer', hint: 'Supprimer des items de la collection' },
  { key: 'can_manage_fields', label: 'Champs', hint: 'Ajouter, éditer ou supprimer les champs/colonnes de la collection' },
  { key: 'can_manage_views', label: 'Vues', hint: 'Créer, éditer ou supprimer les vues (Table, Kanban, Calendrier)' },
  { key: 'can_manage_permissions', label: 'Permissions', hint: 'Gérer les droits des rôles et utilisateurs' },
];

const AccessManager = ({ collections, onClose, onImportCollections }: { collections: any[]; onClose: () => void; onImportCollections?: (collections: any[]) => void }) => {
  const { isAdminBase: isAdmin, refresh: refreshAuth, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});
  const [backupLabel, setBackupLabel] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [selectedBackupDay, setSelectedBackupDay] = useState('');

  const loadAll = async () => {
    try {
      setLoading(true);
      const [rRes, uRes, pRes, aRes] = await Promise.all([
        fetch(`${API_URL}/roles`, { credentials: 'include' }),
        fetch(`${API_URL}/users`, { credentials: 'include' }),
        fetch(`${API_URL}/permissions`, { credentials: 'include' }),
        fetch(`${API_URL}/audit`, { credentials: 'include' }),
      ]);
      if (!rRes.ok || !uRes.ok || !pRes.ok || !aRes.ok) throw new Error('Erreur de chargement');
      const rolesData = await rRes.json();
      const usersData = await uRes.json();
      const permsData = await pRes.json();
      const auditData = await aRes.json();
      setRoles(rolesData);
      setUsers(usersData);
      setPermissions(permsData);
      setAudit(auditData);
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

  const toDayKey = (value: string | Date) => {
    const d = new Date(value);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dayLabel = (dayKey: string) => {
    const [y, m, d] = dayKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const reloadBackups = async () => {
    try {
      const res = await fetch(`${API_URL}/db/backups`, { credentials: 'include' });
      if (!res.ok) throw new Error('Load backups failed');
      const data = await res.json();
      setBackups(Array.isArray(data) ? data : []);
      if (!selectedBackupDay) {
        const todayKey = toDayKey(new Date());
        setSelectedBackupDay(todayKey);
      }
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
      if (!res.ok) throw new Error('Create backup failed');
      setBackupLabel('');
      await reloadBackups();
    } catch (err) {
      console.error(err);
      alert('Impossible de créer la sauvegarde.');
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
  const todayKey = toDayKey(new Date());
  const dayOptions = Array.from(new Set([todayKey, ...sortedBackups.map((b) => toDayKey(b.createdAt))]));
  const dayFiltered = sortedBackups.filter((b) => toDayKey(b.createdAt) === (selectedBackupDay || todayKey));
  const visibleBackups = dayFiltered.slice(0, 10);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const collectionsWithProps = useMemo(() => {
    return collections.map((col: any) => ({
      id: col.id,
      name: col.name,
      properties: col.properties || [],
    }));
  }, [collections]);

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

      // Refresh audit log (lightweight)
      const aRes = await fetch(`${API_URL}/audit`, { credentials: 'include' });
      if (aRes.ok) setAudit(await aRes.json());

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
      if (!res.ok) throw new Error('Assign failed');
      await loadAll();

      // Refresh current user's auth if their assignment was modified
      if (user && user.id === userId) {
        await refreshAuth();
      }
    } catch (err) {
      console.error(err);
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
      if (!res.ok) throw new Error('Delete user failed');
      await loadAll();
    } catch (err) {
      console.error(err);
      alert('Impossible de supprimer le compte.');
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
                  // Export JSON brut
                  try {
                    const res = await fetch(`${API_URL}/appstate`, { credentials: 'include' });
                    if (!res.ok) throw new Error('Erreur export appstate');
                    const data = await res.json();
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'erp_appstate_export.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    alert('Erreur lors de l\'export appstate.');
                  }
                }}
              >
                Export JSON
              </button>
              <button
                className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-700 text-white text-xs shadow "
                style={{ minWidth: 80 }}
                onClick={async () => {
                  // Export CSV par collection (dans un zip)
                  try {
                    const res = await fetch(`${API_URL}/appstate`, { credentials: 'include' });
                    if (!res.ok) throw new Error('Erreur export appstate');
                    const data = await res.json();
                    const appStateArr = Array.isArray(data.app_state) ? data.app_state : [];
                    // Prend la première entrée app_state trouvée (si aucune globale)
                    const row = appStateArr.find((row: { user_id: null; }) => row.user_id === null) || appStateArr[0];
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
                      const res = await fetch(`${API_URL}/appstate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(fullData),  // ← Envoi TOUT (users + appstate + ...)
                      });
                      if (!res.ok) throw new Error('Erreur import appstate');
                      alert('✅ Import COMPLET réussi ! BDD entièrement remplacée.');
                      // Optionnel : reload tout
                      loadAll();
                    } catch (err) {
                      alert(`❌ Erreur lors de l'import : ${err}`);
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
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-xs text-neutral-500">Jour</label>
                  <input
                    type="date"
                    className="flex-1 bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-sm"
                    value={selectedBackupDay || todayKey}
                    onChange={(e) => setSelectedBackupDay(e.target.value)}
                  />
                </div>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {visibleBackups.length === 0 && <p className="text-sm text-neutral-500">Aucune sauvegarde pour ce jour.</p>}
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
                  {dayFiltered.length > 10 && (
                    <div className="text-xs text-neutral-500">
                      Affichage limité aux 10 dernières de la journée.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white/5 rounded-xl border border-black/10 dark:border-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Rôles</h4>
                  <button onClick={() => setCreatingRole(!creatingRole)} className="text-sm text-cyan-400 flex items-center gap-1">
                    <Plus size={14} /> Nouveau
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-auto">
                  {roles.map((r) => (
                    <button
                      key={r.id}
                      className={`w-full text-left px-3 py-2 rounded-lg transition ${
                        selectedRoleId === r.id ? 'bg-cyan-500/20 text-black dark:text-white border border-cyan-500/40' : 'bg-white/5 text-neutral-500 dark:text-white'
                      }`}
                      onClick={() => setSelectedRoleId(r.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.name}</span>
                        {r.is_system && <span className="text-xs text-neutral-600 dark:text-white">système</span>}
                      </div>
                      {r.description && <p className="text-xs text-neutral-500 mt-1">{r.description}</p>}
                    </button>
                  ))}
                  {roles.length === 0 && <p className="text-sm text-neutral-500">Aucun rôle.</p>}
                </div>
                <AnimatePresence>
                  {creatingRole && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="mt-3 space-y-2"
                    >
                      <input
                        className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
                        placeholder="Nom du rôle"
                        value={newRoleName}
                        onChange={(e) => setNewRoleName(e.target.value)}
                      />
                      <input
                        className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
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
              </div>

              <div className="bg-white/5 rounded-xl border border-black/10 dark:border-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Utilisateurs</h4>
                </div>
                <div className="space-y-3 max-h-80 overflow-auto">
                  {users.map((u) => {
                    const roleIds = Array.isArray(u.role_ids) ? u.role_ids : (typeof u.role_ids === 'string' ? JSON.parse(u.role_ids) : []);
                    const userRoles = roles.filter((r) => roleIds.includes(r.id));
                    const isLocal = !u.provider || u.provider === 'local';
                    const isSelf = user?.id === u.id;
                    return (
                      <div key={u.id} className="rounded-lg bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{u.email}</div>
                            <div className="text-xs text-neutral-500">{u.provider || 'local'}</div>
                          </div>
                          <button
                            className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20"
                            onClick={() => deleteUser(u.id, u.email)}
                            disabled={busy || isSelf}
                            title={isSelf ? 'Impossible de supprimer votre propre compte.' : 'Supprimer le compte'}
                          >
                            Supprimer
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {userRoles.length === 0 && <span className="text-xs text-neutral-500">Aucun rôle</span>}
                          {userRoles.map((r) => (
                            <button
                              key={r.id}
                              className="px-2 py-1 text-xs rounded bg-cyan-500/20 text-black dark:text-white border border-cyan-500/40"
                              onClick={() => assignRole(u.id, r.id, 'remove')}
                            >
                              {r.name} ✕
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            className="flex-1 bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-sm"
                            onChange={(e) => assignRole(u.id, e.target.value, 'add')}
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Ajouter un rôle
                            </option>
                            {roles
                              .filter((r) => !userRoles.some((ur) => ur.id === r.id))
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <input
                            type="password"
                            className="flex-1 bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-sm"
                            placeholder={isLocal ? 'Nouveau mot de passe' : 'Mdp non disponible (SSO)'}
                            value={passwordInputs[u.id] || ''}
                            onChange={(e) =>
                              setPasswordInputs((prev) => ({ ...prev, [u.id]: e.target.value }))
                            }
                            disabled={!isLocal || busy}
                          />
                          <button
                            className="text-xs px-3 py-1 rounded bg-cyan-500/20 text-black dark:text-white border border-cyan-500/40"
                            onClick={() => updateUserPassword(u.id)}
                            disabled={!isLocal || busy || !(passwordInputs[u.id] || '').trim()}
                          >
                            Modifier mdp
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {users.length === 0 && <p className="text-sm text-neutral-500">Aucun utilisateur.</p>}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white/5 rounded-xl border border-black/10 dark:border-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Permissions</h4>
                  {loading && <span className="text-xs text-neutral-500">Chargement…</span>}
                </div>
                {selectedRoleId ? (
                  <div className="space-y-4 max-h-[520px] overflow-auto pr-1">
                    {/* Global */}
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

                    {/* Collections + Propriétés */}
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

                          {/* Collection-level */}
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

                          {/* Properties-level */}
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
                ) : (
                  <p className="text-sm text-neutral-500">Sélectionnez un rôle pour éditer ses permissions.</p>
                )}
              </div>

              <div className="bg-white/5 rounded-xl border border-black/10 dark:border-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Audit</h4>
                </div>
                <div className="space-y-2 max-h-64 overflow-auto pr-1 text-sm text-neutral-500 dark:text-white">
                  {audit.map((a) => (
                    <div key={a.id} className="flex items-center justify-between border-b border-black/10 dark:border-white/5 pb-1">
                      <div>
                        <div className="font-medium">{a.action}</div>
                        <div className="text-xs text-neutral-500">{a.target_type} / {a.target_id}</div>
                      </div>
                      <div className="text-xs text-neutral-500">{new Date(a.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                  {audit.length === 0 && <p className="text-sm text-neutral-500">Pas encore d’audit.</p>}
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
