import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, Shield, UserPlus, Plus, Download, Trash2, Database, RotateCcw, Search, Palette, Clock3, BellRing, Save, CheckCircle2, FileUp, Zap } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/auth/AuthProvider';
import { PluginManagerUI } from './PluginManager';
import { initializePluginRegistry } from '@/lib/plugins';

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

const IMPORT_PROPERTY_TYPE_OPTIONS = [
  'text',
  'number',
  'select',
  'multi_select',
  'date',
  'date_range',
  'checkbox',
  'url',
  'email',
  'phone',
  'relation',
];

const toSafeImportId = (value: any, fallback: string) => {
  const source = String(value || '').trim();
  const normalized = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
};

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
  const [importBusy, setImportBusy] = useState(false);
  const [importCommitBusy, setImportCommitBusy] = useState(false);
  const [importOrganizationName, setImportOrganizationName] = useState('');
  const [showImportMapper, setShowImportMapper] = useState(false);
  const [importPreviewOrganizations, setImportPreviewOrganizations] = useState<any[]>([]);
  const [importMapperTab, setImportMapperTab] = useState<'mapping' | 'diagnostics'>('mapping');
  const [dataTransferTab, setDataTransferTab] = useState<'import-new' | 'import-replace' | 'export'>('import-new');
  const [permissionsTab, setPermissionsTab] = useState<'global' | 'collections' | 'dashboards'>('global');
  const [userQuery, setUserQuery] = useState('');
  const [selectedPreferencesUserId, setSelectedPreferencesUserId] = useState<string>('');
  const [userPreferenceDrafts, setUserPreferenceDrafts] = useState<Record<string, UserPreferenceDraft>>({});
  const [preferencesBusyByUser, setPreferencesBusyByUser] = useState<Record<string, boolean>>({});
  const [preferencesSavedAtByUser, setPreferencesSavedAtByUser] = useState<Record<string, number>>({});
  const [organizationNameEdits, setOrganizationNameEdits] = useState<Record<string, string>>({});
  const [deletedImportProperties, setDeletedImportProperties] = useState<any[]>([]);
  const [relationChoiceFieldByKey, setRelationChoiceFieldByKey] = useState<Record<string, string>>({});

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

  const renameOrganization = async (organizationId: string) => {
    const nextName = String(organizationNameEdits[organizationId] || '').trim();
    if (!nextName) {
      alert('Le nom de l’organisation ne peut pas être vide.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/organizations/${encodeURIComponent(organizationId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: nextName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Rename organization failed');
      await refreshAuth();
      await loadAll();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Impossible de renommer l’organisation.');
    } finally {
      setBusy(false);
    }
  };

  const deleteOrganization = async (organizationId: string, name: string) => {
    const ok = confirm(`Supprimer l'organisation "${name}" ? Cette action est irréversible.`);
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/organizations/${encodeURIComponent(organizationId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Delete organization failed');
      await refreshAuth();
      await loadAll();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Impossible de supprimer l’organisation.');
    } finally {
      setBusy(false);
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

  const importOrganizationsFromFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const jsonFiles = files.filter((f) => f.name.toLowerCase().endsWith('.json'));
    const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith('.csv'));

    if (jsonFiles.length > 0 && csvFiles.length > 0) {
      alert('Merci de sélectionner soit des JSON, soit des CSV (pas les deux en même temps).');
      return;
    }

    setImportBusy(true);
    try {
      const previews: any[] = [];

      if (csvFiles.length > 0) {
        const csvPayload = await Promise.all(
          csvFiles.map(async (file) => ({
            name: file.name,
            text: await file.text(),
          }))
        );

        const res = await fetch(`${API_URL}/import/organizations/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            format: 'csv',
            organizationName: importOrganizationName.trim() || undefined,
            files: csvPayload,
          }),
        });

        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result?.error || 'Import CSV impossible');
        previews.push(...(Array.isArray(result?.organizations) ? result.organizations : []));
      } else if (jsonFiles.length > 0) {
        for (const file of jsonFiles) {
          const text = await file.text();
          const payload = JSON.parse(text);
          const res = await fetch(`${API_URL}/import/organizations/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              format: 'json',
              organizationName: importOrganizationName.trim() || undefined,
              payload,
            }),
          });
          const result = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(result?.error || `Import JSON impossible (${file.name})`);
          previews.push(...(Array.isArray(result?.organizations) ? result.organizations : []));
        }
      }

      if (!previews.length) {
        throw new Error('Aucune organisation exploitable trouvée pour prévisualisation.');
      }

      setImportPreviewOrganizations(previews);
      setShowImportMapper(true);

    } catch (err) {
      console.error(err);
      alert(`❌ Erreur import JSON/CSV : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImportBusy(false);
    }
  };

  const patchImportPreviewOrganizations = (mutator: (draft: any[]) => void) => {
    setImportPreviewOrganizations((prev) => {
      const draft = JSON.parse(JSON.stringify(prev || []));
      mutator(draft);
      return draft;
    });
  };

  const updateImportOrganizationName = (orgIndex: number, name: string) => {
    patchImportPreviewOrganizations((draft) => {
      if (!draft[orgIndex]) return;
      draft[orgIndex].name = name;
    });
  };

  const removeImportOrganization = (orgIndex: number) => {
    patchImportPreviewOrganizations((draft) => {
      if (!Array.isArray(draft) || !draft[orgIndex]) return;
      draft.splice(orgIndex, 1);
    });
  };

  const updateImportCollectionName = (orgIndex: number, collectionIndex: number, name: string) => {
    patchImportPreviewOrganizations((draft) => {
      const collection = draft?.[orgIndex]?.state?.collections?.[collectionIndex];
      if (!collection) return;
      collection.name = name;
    });
  };

  const removeImportCollection = (orgIndex: number, collectionIndex: number) => {
    patchImportPreviewOrganizations((draft) => {
      const org = draft?.[orgIndex];
      if (!org?.state?.collections || !Array.isArray(org.state.collections)) return;
      const removed = org.state.collections[collectionIndex];
      if (!removed) return;
      org.state.collections.splice(collectionIndex, 1);

      // Nettoyage des relations pointant vers la collection supprimée
      org.state.collections.forEach((collection: any) => {
        (collection?.properties || []).forEach((prop: any) => {
          if (prop?.type === 'relation' && prop?.relation?.targetCollectionId === removed.id) {
            prop.type = 'text';
            delete prop.relation;
          }
        });
      });
    });
  };

  const updateImportProperty = (
    orgIndex: number,
    collectionIndex: number,
    propertyIndex: number,
    patch: Record<string, any>
  ) => {
    patchImportPreviewOrganizations((draft) => {
      const property = draft?.[orgIndex]?.state?.collections?.[collectionIndex]?.properties?.[propertyIndex];
      if (!property) return;
      Object.assign(property, patch);
      const nextType = patch.type ?? property.type;
      if (nextType !== 'relation') {
        delete property.relation;
      } else if (!property.relation) {
        const targetCollectionId = draft?.[orgIndex]?.state?.collections?.[0]?.id || null;
        property.relation = {
          targetCollectionId,
          type: 'many_to_many',
        };
      }
      
      // Si on change en relation, créer aussi une relation inverse
      if (patch.type === 'relation' && property.relation?.targetCollectionId) {
        const targetCollId = property.relation.targetCollectionId;
        const targetCollection = draft?.[orgIndex]?.state?.collections?.find((c: any) => c.id === targetCollId);
        if (targetCollection) {
          const sourceCollId = draft?.[orgIndex]?.state?.collections?.[collectionIndex]?.id;
          const inverseRelPropName = property.name || `Relation_${collectionIndex}`;
          
          // Chercher si une relation inverse existe déjà
          const existingInverse = targetCollection.properties?.find((p: any) => 
            p.type === 'relation' && p.relation?.targetCollectionId === sourceCollId
          );
          
          if (!existingInverse && targetCollection.properties) {
            targetCollection.properties.push({
              id: `inverse_${propertyIndex}_${Date.now()}`,
              name: `Inverse: ${inverseRelPropName}`,
              type: 'relation',
              relation: {
                targetCollectionId: sourceCollId,
                type: property.relation.type === 'one_to_many' ? 'one_to_many' : property.relation.type,
              },
            });
          }
        }
      }
    });
  };

  const removeImportProperty = (
    orgIndex: number,
    collectionIndex: number,
    propertyIndex: number
  ) => {
    patchImportPreviewOrganizations((draft) => {
      const collection = draft?.[orgIndex]?.state?.collections?.[collectionIndex];
      if (!collection || !Array.isArray(collection.properties)) return;
      const removed = collection.properties[propertyIndex];
      collection.properties.splice(propertyIndex, 1);
      
      // Tracker le champ supprimé
      if (removed) {
        setDeletedImportProperties((prev) => [...prev, {
          orgIndex,
          collectionIndex,
          propertyIndex,
          property: removed,
          removedAt: Date.now(),
        }]);
      }
    });
  };

  const convertRelationToChoiceField = (
    orgIndex: number,
    collectionIndex: number,
    propertyIndex: number,
    mode: 'select' | 'multi_select',
    optionLabelFieldId?: string,
    removeTargetCollection = false,
  ) => {
    patchImportPreviewOrganizations((draft) => {
      const org = draft?.[orgIndex];
      const sourceCollection = org?.state?.collections?.[collectionIndex];
      const property = sourceCollection?.properties?.[propertyIndex];
      if (!org || !sourceCollection || !property || property?.type !== 'relation') return;

      const targetCollectionId = String(property?.relation?.targetCollectionId || '').trim();
      if (!targetCollectionId) return;

      const targetCollection = (org.state.collections || []).find((c: any) => c?.id === targetCollectionId);
      if (!targetCollection) return;

      const targetProps = Array.isArray(targetCollection.properties) ? targetCollection.properties : [];
      const preferredLabelProp = optionLabelFieldId
        ? targetProps.find((p: any) => p?.id === optionLabelFieldId)
        : null;
      const labelProp = preferredLabelProp || targetProps.find((p: any) => {
        const key = String(p?.name || p?.id || '').trim().toLowerCase();
        return ['name', 'nom', 'label', 'title', 'code', 'slug'].includes(key);
      }) || targetProps[0];

      const targetItems = Array.isArray(targetCollection.items) ? targetCollection.items : [];
      const labelById = new Map<string, string>();
      targetItems.forEach((it: any) => {
        const id = String(it?.id || '').trim();
        if (!id) return;
        const rawLabel = labelProp ? it?.[labelProp.id] : id;
        const label = String(rawLabel ?? id).trim() || id;
        labelById.set(id, label);
      });

      const options = Array.from(labelById.entries()).map(([value, label]) => ({ value: label, label }));

      property.type = mode;
      delete property.relation;
      property.importChoiceSource = {
        collectionId: targetCollectionId,
        fieldId: labelProp?.id || null,
      };
      property.options = options;

      sourceCollection.items = (sourceCollection.items || []).map((item: any) => {
        const current = item?.[property.id];
        const asArray = Array.isArray(current)
          ? current
          : (current === null || current === undefined || String(current).trim() === '')
            ? []
            : [current];
        const mapped = asArray
          .map((v: any) => String(v || '').trim())
          .filter(Boolean)
          .map((id: string) => labelById.get(id) || id)
          .filter(Boolean);

        if (mode === 'multi_select') {
          return { ...item, [property.id]: Array.from(new Set(mapped)) };
        }
        return { ...item, [property.id]: mapped[0] || null };
      });

      if (removeTargetCollection) {
        const stillReferenced = (org.state.collections || []).some((col: any) =>
          (col?.properties || []).some((p: any) => p?.type === 'relation' && p?.relation?.targetCollectionId === targetCollectionId)
        );
        if (!stillReferenced) {
          org.state.collections = (org.state.collections || []).filter((c: any) => c?.id !== targetCollectionId);
        }
      }
    });
  };

  const pickDefaultChoiceFieldId = (targetCollection: any, prop?: any): string => {
    const targetProps = Array.isArray(targetCollection?.properties) ? targetCollection.properties : [];
    if (!targetProps.length) return '';

    const relationDisplayFieldId = String(prop?.relation?.displayFieldIds?.[0] || '').trim();
    if (relationDisplayFieldId && targetProps.some((p: any) => String(p?.id || '') === relationDisplayFieldId)) {
      return relationDisplayFieldId;
    }

    const preferred = targetProps.find((p: any) => {
      const key = String(p?.name || p?.id || '').trim().toLowerCase();
      return ['name', 'nom', 'label', 'title', 'code', 'slug'].includes(key);
    });
    if (preferred?.id) return String(preferred.id);

    return String(targetProps[0]?.id || '');
  };

  const hydrateChoiceFieldOptions = (
    orgIndex: number,
    collectionIndex: number,
    propertyIndex: number,
    sourceCollectionId: string,
    sourceFieldId?: string,
  ) => {
    patchImportPreviewOrganizations((draft) => {
      const org = draft?.[orgIndex];
      const sourceCollection = org?.state?.collections?.[collectionIndex];
      const property = sourceCollection?.properties?.[propertyIndex];
      if (!org || !sourceCollection || !property) return;
      if (property.type !== 'select' && property.type !== 'multi_select') return;

      const targetCollection = (org.state.collections || []).find((c: any) => c?.id === sourceCollectionId);
      if (!targetCollection) return;

      const targetProps = Array.isArray(targetCollection.properties) ? targetCollection.properties : [];
      const resolvedField = sourceFieldId
        ? targetProps.find((p: any) => p?.id === sourceFieldId)
        : targetProps.find((p: any) => {
          const key = String(p?.name || p?.id || '').trim().toLowerCase();
          return ['name', 'nom', 'label', 'title', 'code', 'slug'].includes(key);
        }) || targetProps[0];
      if (!resolvedField) return;

      const targetItems = Array.isArray(targetCollection.items) ? targetCollection.items : [];
      const labelById = new Map<string, string>();
      const labelByNormalized = new Map<string, string>();
      targetItems.forEach((it: any) => {
        const id = String(it?.id || '').trim();
        if (!id) return;
        const label = String(it?.[resolvedField.id] ?? id).trim() || id;
        labelById.set(id, label);
        labelByNormalized.set(label.toLowerCase(), label);
      });

      property.importChoiceSource = {
        collectionId: sourceCollectionId,
        fieldId: resolvedField.id,
      };
      property.options = Array.from(new Set(Array.from(labelById.values()))).map((label) => ({ value: label, label }));

      sourceCollection.items = (sourceCollection.items || []).map((item: any) => {
        const current = item?.[property.id];
        const asArray = Array.isArray(current)
          ? current
          : (current === null || current === undefined || String(current).trim() === '')
            ? []
            : [current];

        const mapped = asArray
          .map((v: any) => String(v || '').trim())
          .filter(Boolean)
          .map((rawVal: string) => {
            if (labelById.has(rawVal)) return labelById.get(rawVal) as string;
            const lower = rawVal.toLowerCase();
            if (labelByNormalized.has(lower)) return labelByNormalized.get(lower) as string;
            return rawVal;
          });

        if (property.type === 'multi_select') {
          return { ...item, [property.id]: Array.from(new Set(mapped)) };
        }
        return { ...item, [property.id]: mapped[0] || null };
      });
    });
  };

  const importOrganizationsWithManualMapping = async () => {
    if (!importPreviewOrganizations.length) return;
    setImportCommitBusy(true);
    try {
      const res = await fetch(`${API_URL}/import/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mappedOrganizations: importPreviewOrganizations }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result?.error || 'Import manuel impossible');

      const createdCount = Number(result?.createdCount || 0);
      alert(`✅ Import terminé : ${createdCount} organisation(s) créée(s).`);
      setShowImportMapper(false);
      setImportPreviewOrganizations([]);
      await refreshAuth();
      await loadAll();
    } catch (err) {
      console.error(err);
      alert(`❌ Erreur import final : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImportCommitBusy(false);
    }
  };

  const autoFixImportMapping = () => {
    patchImportPreviewOrganizations((draft) => {
      draft.forEach((org: any, orgIdx: number) => {
        org.name = String(org?.name || '').trim() || `Organisation importée ${orgIdx + 1}`;

        const collections = Array.isArray(org?.state?.collections) ? org.state.collections : [];
        const collectionIdSet = new Set<string>();
        const oldToNewCollectionId = new Map<string, string>();

        collections.forEach((col: any, colIdx: number) => {
          const oldId = String(col?.id || '').trim();
          const baseId = toSafeImportId(oldId || col?.name, `collection_${colIdx + 1}`);
          let nextId = baseId;
          let i = 2;
          while (collectionIdSet.has(nextId)) {
            nextId = `${baseId}_${i}`;
            i += 1;
          }
          collectionIdSet.add(nextId);
          if (oldId) oldToNewCollectionId.set(oldId, nextId);
          col.id = nextId;
          col.name = String(col?.name || '').trim() || `Collection ${colIdx + 1}`;

          if (!Array.isArray(col.items)) col.items = [];
          if (!Array.isArray(col.properties)) col.properties = [];
        });

        collections.forEach((col: any) => {
          const propertyIdSet = new Set<string>();
          col.properties.forEach((prop: any, propIdx: number) => {
            prop.name = String(prop?.name || '').trim() || `Champ ${propIdx + 1}`;
            const basePropId = toSafeImportId(prop?.id || prop?.name, `champ_${propIdx + 1}`);
            let nextPropId = basePropId;
            let i = 2;
            while (propertyIdSet.has(nextPropId)) {
              nextPropId = `${basePropId}_${i}`;
              i += 1;
            }
            propertyIdSet.add(nextPropId);
            prop.id = nextPropId;
            if (!IMPORT_PROPERTY_TYPE_OPTIONS.includes(String(prop?.type || ''))) {
              prop.type = 'text';
            }
          });
        });

        const targetItemIdsByCollectionId = new Map<string, Set<string>>();
        collections.forEach((col: any) => {
          const itemIdSet = new Set<string>();
          col.items.forEach((item: any, itemIdx: number) => {
            const baseItemId = String(item?.id || '').trim() || `${col.id}_item_${itemIdx + 1}`;
            let nextItemId = toSafeImportId(baseItemId, `${col.id}_item_${itemIdx + 1}`);
            let i = 2;
            while (itemIdSet.has(nextItemId)) {
              nextItemId = `${toSafeImportId(baseItemId, `${col.id}_item_${itemIdx + 1}`)}_${i}`;
              i += 1;
            }
            item.id = nextItemId;
            itemIdSet.add(nextItemId);
          });
          targetItemIdsByCollectionId.set(col.id, itemIdSet);
        });

        collections.forEach((col: any) => {
          const firstTarget = collections[0]?.id || null;

          col.properties.forEach((prop: any) => {
            if (prop.type !== 'relation') {
              delete prop.relation;
              return;
            }

            if (!prop.relation || typeof prop.relation !== 'object') prop.relation = {};
            const rawTarget = String(prop.relation.targetCollectionId || '').trim();
            const mappedTarget = oldToNewCollectionId.get(rawTarget) || rawTarget;
            const validTarget = collections.some((c: any) => c.id === mappedTarget)
              ? mappedTarget
              : firstTarget;
            prop.relation.targetCollectionId = validTarget;

            const relationType = String(prop.relation.type || '');
            prop.relation.type = ['one_to_one', 'one_to_many', 'many_to_many'].includes(relationType)
              ? relationType
              : 'many_to_many';
          });

          col.items.forEach((item: any) => {
            col.properties.forEach((prop: any) => {
              const raw = item?.[prop.id];

              if (prop.type === 'number') {
                const num = Number(String(raw ?? '').replace(',', '.'));
                item[prop.id] = Number.isFinite(num) ? num : null;
                return;
              }

              if (prop.type === 'checkbox') {
                const val = String(raw ?? '').trim().toLowerCase();
                item[prop.id] = ['true', '1', 'yes', 'oui'].includes(val);
                return;
              }

              if (prop.type === 'relation') {
                const targetId = prop?.relation?.targetCollectionId;
                const targetItemIds = targetItemIdsByCollectionId.get(targetId) || new Set<string>();
                const relationType = prop?.relation?.type || 'many_to_many';

                const rawValues = Array.isArray(raw)
                  ? raw
                  : String(raw ?? '').includes(',')
                    ? String(raw).split(',')
                    : String(raw ?? '').includes(';')
                      ? String(raw).split(';')
                      : raw === null || raw === undefined || raw === ''
                        ? []
                        : [raw];

                const cleaned = Array.from(new Set(rawValues.map((v: any) => String(v).trim()).filter(Boolean)))
                  .filter((v) => targetItemIds.size === 0 || targetItemIds.has(v));

                item[prop.id] = relationType === 'many_to_many' ? cleaned : (cleaned[0] || null);
                return;
              }

              if (raw === undefined) item[prop.id] = null;
            });
          });
        });
      });
    });
  };

  const importMappingDiagnostics = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    (importPreviewOrganizations || []).forEach((org: any, orgIdx: number) => {
      const orgLabel = `Organisation ${orgIdx + 1}`;
      const orgName = String(org?.name || '').trim();
      if (!orgName) {
        errors.push(`${orgLabel}: nom d'organisation vide.`);
      }

      const collections = Array.isArray(org?.state?.collections) ? org.state.collections : [];
      if (collections.length === 0) {
        errors.push(`${orgLabel}: aucune collection.`);
        return;
      }

      const collectionIds = new Set<string>();
      const collectionNames = new Set<string>();
      collections.forEach((col: any, colIdx: number) => {
        const colLabel = `${orgLabel} > Collection ${colIdx + 1}`;
        const colName = String(col?.name || '').trim();
        const colId = String(col?.id || '').trim();

        if (!colName) errors.push(`${colLabel}: nom de collection vide.`);
        if (!colId) errors.push(`${colLabel}: id de collection vide.`);
        if (colId && collectionIds.has(colId)) errors.push(`${colLabel}: id de collection dupliqué (${colId}).`);
        if (colName && collectionNames.has(colName.toLowerCase())) warnings.push(`${colLabel}: nom de collection dupliqué (${colName}).`);
        if (colId) collectionIds.add(colId);
        if (colName) collectionNames.add(colName.toLowerCase());

        const properties = Array.isArray(col?.properties) ? col.properties : [];
        if (properties.length === 0) warnings.push(`${colLabel}: aucune propriété détectée.`);

        const propertyIds = new Set<string>();
        const propertyNames = new Set<string>();
        properties.forEach((prop: any, propIdx: number) => {
          const propLabel = `${colLabel} > Champ ${propIdx + 1}`;
          const propId = String(prop?.id || '').trim();
          const propName = String(prop?.name || '').trim();
          const propType = String(prop?.type || '').trim();

          if (!propId) errors.push(`${propLabel}: id de champ vide.`);
          if (!propName) errors.push(`${propLabel}: nom de champ vide.`);
          if (propId && propertyIds.has(propId)) errors.push(`${propLabel}: id de champ dupliqué (${propId}).`);
          if (propName && propertyNames.has(propName.toLowerCase())) warnings.push(`${propLabel}: nom de champ dupliqué (${propName}).`);
          if (!IMPORT_PROPERTY_TYPE_OPTIONS.includes(propType)) errors.push(`${propLabel}: type invalide (${propType || 'vide'}).`);
          if (propId) propertyIds.add(propId);
          if (propName) propertyNames.add(propName.toLowerCase());

          if (propType === 'relation') {
            const relation = prop?.relation || {};
            const targetCollectionId = String(relation?.targetCollectionId || '').trim();
            const relationType = String(relation?.type || '').trim();

            if (!targetCollectionId) {
              errors.push(`${propLabel}: relation sans collection cible.`);
            } else if (!collections.some((c: any) => c?.id === targetCollectionId)) {
              errors.push(`${propLabel}: collection cible introuvable (${targetCollectionId}).`);
            }

            if (!['one_to_one', 'one_to_many', 'many_to_many'].includes(relationType)) {
              errors.push(`${propLabel}: type de relation invalide (${relationType || 'vide'}).`);
            }
          }
        });
      });
    });

    return { errors, warnings };
  }, [importPreviewOrganizations]);

  const importRelationSummary = useMemo(() => {
    const rows: Array<{
      orgIdx: number;
      colIdx: number;
      propIdx: number;
      orgName: string;
      collectionName: string;
      fieldName: string;
      targetName: string;
      targetCollectionId: string;
      relationType: string;
      targetFields: Array<{ id: string; name: string }>;
    }> = [];

    (importPreviewOrganizations || []).forEach((org: any, orgIdx: number) => {
      const orgName = String(org?.name || `Organisation ${orgIdx + 1}`);
      const cols = Array.isArray(org?.state?.collections) ? org.state.collections : [];
      cols.forEach((col: any, colIdx: number) => {
        const collectionName = String(col?.name || `Collection ${colIdx + 1}`);
        const props = Array.isArray(col?.properties) ? col.properties : [];
        props.forEach((prop: any, propIdx: number) => {
          if (prop?.type !== 'relation') return;
          const targetId = String(prop?.relation?.targetCollectionId || '').trim();
          const targetCollection = cols.find((c: any) => c?.id === targetId);
          const targetFields = Array.isArray(targetCollection?.properties)
            ? targetCollection.properties.map((p: any) => ({
              id: String(p?.id || ''),
              name: String(p?.name || p?.id || 'champ'),
            })).filter((p: any) => p.id)
            : [];
          rows.push({
            orgIdx,
            colIdx,
            propIdx,
            orgName,
            collectionName,
            fieldName: String(prop?.name || prop?.id || `Champ ${propIdx + 1}`),
            targetName: String(targetCollection?.name || targetId || '—'),
            targetCollectionId: targetId,
            relationType: String(prop?.relation?.type || 'many_to_many'),
            targetFields,
          });
        });
      });
    });

    return rows;
  }, [importPreviewOrganizations]);

  const sortedBackups = [...backups].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const visibleBackups = sortedBackups.slice(0, 10);

  useEffect(() => {
    loadAll();
    initializePluginRegistry();
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

  useEffect(() => {
    setOrganizationNameEdits((prev) => {
      const next: Record<string, string> = {};
      (organizations || []).forEach((org: any) => {
        const id = String(org?.id || '');
        if (!id) return;
        next[id] = prev[id] ?? String(org?.name || '');
      });
      return next;
    });
  }, [organizations]);

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
              <button onClick={loadAll} className="p-2 rounded-lg hover:bg-white/10 text-neutral-600 dark:text-white" title="Rafraîchir">
                <RefreshCw size={16} />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-neutral-600 dark:text-white">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6 max-h-[80svh] overflow-y-scroll">
            <div className="lg:col-span-3 bg-white/5 rounded-xl border border-black/10 dark:border-white/5 p-4">
              <div className="w-full text-left">
                <div>
                  <h4 className="font-semibold">Imports / Exports</h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Zone de transfert de données (exports, import nouvelles orga, import remplacement).
                  </p>
                </div>
              </div>

              <Tabs
                value={dataTransferTab}
                onValueChange={(value) => setDataTransferTab(value as 'import-new' | 'import-replace' | 'export')}
                className="mt-4"
              >
                <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto gap-2 bg-transparent p-0">
                  <TabsTrigger value="import-new" className="border border-emerald-500/30 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                    Import nouvelles orgas
                  </TabsTrigger>
                  <TabsTrigger value="import-replace" className="border border-amber-500/30 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                    Import remplacement
                  </TabsTrigger>
                  <TabsTrigger value="export" className="border border-blue-500/30 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                    Exports
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="import-new" className="mt-3">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200 mb-2">IMPORT NOUVELLES ORGAS</div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-3">
                      Ajoute une ou plusieurs organisations à partir de fichiers JSON/CSV, avec prévisualisation et remapping avant validation.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="px-2 py-1 rounded border border-white/10 bg-white dark:bg-neutral-900 text-xs"
                        placeholder="Nom orga (optionnel)"
                        value={importOrganizationName}
                        onChange={(e) => setImportOrganizationName(e.target.value)}
                        disabled={importBusy}
                      />
                      <label
                        className={`px-3 py-1 rounded text-white text-xs shadow cursor-pointer flex items-center gap-1 ${importBusy ? 'bg-emerald-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                        title="Importe des .json ou .csv et crée de nouvelles organisations automatiquement"
                      >
                        <FileUp size={13} />
                        {importBusy ? 'Import…' : 'Importer JSON/CSV'}
                        <input
                          type="file"
                          accept=".json,.csv,application/json,text/csv"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = e.target.files;
                            await importOrganizationsFromFiles(files);
                            e.currentTarget.value = '';
                          }}
                          disabled={importBusy}
                        />
                      </label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="import-replace" className="mt-3">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-200 mb-2">IMPORT REMPLACEMENT</div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-3">
                      Remplace les données existantes via un export appstate JSON (scope auto: organisation ou global).
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-xs shadow cursor-pointer" title="Import historique appstate (peut remplacer des données selon le scope)">
                        Importer Appstate JSON
                        <input
                          type="file"
                          accept="application/json"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const text = await file.text();
                              const fullData = JSON.parse(text);
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
                                body: JSON.stringify(fullData),
                              });
                              const result = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(result?.error || 'Erreur import appstate');

                              const appliedScope: 'global' | 'organization' =
                                result?.scope === 'global' ? 'global' : inferredScope;

                              if (appliedScope === 'global') {
                                const orgCount = organizationsInPayload || organizationIdsFromState.size || 1;
                                alert(`✅ Import global réussi ! ${orgCount} organisation(s) remplacée(s).`);
                              } else {
                                alert('✅ Import organisation réussi ! Seule l’organisation active a été remplacée.');
                              }
                              loadAll();
                            } catch (err) {
                              alert(`❌ Erreur lors de l'import : ${err instanceof Error ? err.message : String(err)}`);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="export" className="mt-3">
                  <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                    <div className="text-[11px] font-semibold text-blue-800 dark:text-blue-200 mb-2">EXPORT</div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-3">
                      Exporte l’organisation active (JSON/CSV) ou tout l’ERP (global JSON).
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs shadow"
                        onClick={async () => {
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
                          } catch {
                            alert('Erreur lors de l\'export appstate.');
                          }
                        }}
                        title="Exporter uniquement l'organisation active en JSON"
                      >
                        Orga JSON
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs shadow"
                        onClick={async () => {
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
                          } catch {
                            alert('Erreur lors de l\'export global appstate.');
                          }
                        }}
                        title="Exporter toutes les organisations (global) en JSON"
                      >
                        Global JSON
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-700 text-white text-xs shadow"
                        onClick={async () => {
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
                            } catch {
                              alert('Impossible de parser le state pour CSV');
                              return;
                            }
                            const collections = Array.isArray(state.collections) ? state.collections : [];
                            if (collections.length === 0) return;
                            let JSZip;
                            try {
                              JSZip = (await import('jszip')).default;
                            } catch {
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
                                const row = allKeys.map((k) => {
                                  let v = (item as Record<string, any>)[k as string];
                                  if (typeof v === 'object' && v !== null) v = JSON.stringify(v);
                                  if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
                                    v = '"' + v.replace(/"/g, '""') + '"';
                                  }
                                  return v ?? '';
                                }).join(',');
                                csvRows.push(row);
                              }
                              zip.file(`${col.name || col.id || 'collection'}.csv`, csvRows.join('\n'));
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
                          } catch {
                            alert('Erreur lors de l\'export CSV.');
                          }
                        }}
                        title="Exporter les collections de l'organisation active en CSV (ZIP)"
                      >
                        CSV (ZIP)
                      </button>
                    </div>
                  </div>
                </TabsContent>

                <div className="text-[11px] text-neutral-600 dark:text-neutral-300 text-center max-w-2xl mx-auto mt-3">
                  <span className="font-semibold">Aide rapide :</span> <strong>Importer JSON/CSV</strong> crée de nouvelles organisations (avec remapping),
                  <strong> Import Appstate</strong> remplace des données, <strong>Exports</strong> sert à sauvegarder l'orga active ou tout le global.
                </div>
              </Tabs>
            </div>

            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl border border-black/10 dark:border-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Organisations</h4>
                  <span className="text-xs text-neutral-500">{(organizations || []).length} total</span>
                </div>

                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {(organizations || []).length === 0 && (
                    <p className="text-sm text-neutral-500">Aucune organisation.</p>
                  )}
                  {(organizations || []).map((org: any) => {
                    const orgId = String(org?.id || '');
                    const isActive = activeOrganizationId === orgId;
                    return (
                      <div key={orgId} className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900/70 p-2">
                        <div className="flex items-center gap-2">
                          <input
                            className="flex-1 bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs"
                            value={organizationNameEdits[orgId] ?? String(org?.name || '')}
                            onChange={(e) => setOrganizationNameEdits((prev) => ({ ...prev, [orgId]: e.target.value }))}
                            disabled={busy}
                          />
                          <button
                            type="button"
                            className="px-2 py-1.5 rounded bg-cyan-600 hover:bg-cyan-700 text-white text-xs disabled:opacity-60"
                            onClick={() => renameOrganization(orgId)}
                            disabled={busy || !orgId}
                            title="Renommer"
                          >
                            <Save size={12} />
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs disabled:opacity-60"
                            onClick={() => deleteOrganization(orgId, String(org?.name || orgId))}
                            disabled={busy || !orgId}
                            title="Supprimer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="mt-1 text-[11px] text-neutral-500 flex items-center justify-between">
                          <span className="truncate">{orgId}</span>
                          {isActive && <span className="text-emerald-600 dark:text-emerald-300">Active</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

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

              <div className="bg-white/5 rounded-xl border border-black/10 dark:border-white/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={16} className="text-blue-500" />
                  <h4 className="font-semibold">Plugins</h4>
                </div>
                {(() => {
                  const orgId = activeOrganizationId || 'default';
                  return <PluginManagerUI organizationId={orgId} />;
                })()}
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

          {showImportMapper && (
            <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-4">
              <div className="w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-xl border border-white/10 bg-white dark:bg-neutral-950 shadow-2xl flex flex-col">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
                  <div>
                    <h4 className="font-semibold">Prévisualisation & remapping import</h4>
                    <p className="text-xs text-neutral-500">Vous pouvez tout ajuster à la main avant création des organisations.</p>
                    <p className="text-[11px] mt-1 text-neutral-500">
                      {importMappingDiagnostics.errors.length} erreur(s) · {importMappingDiagnostics.warnings.length} avertissement(s)
                    </p>
                  </div>
                  <button
                    className="p-2 rounded hover:bg-white/10"
                    onClick={() => {
                      if (importCommitBusy) return;
                      setShowImportMapper(false);
                    }}
                    disabled={importCommitBusy}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-4">
                  <Tabs
                    value={importMapperTab}
                    onValueChange={(value) => setImportMapperTab(value as 'mapping' | 'diagnostics')}
                    className="space-y-4"
                  >
                    <TabsList className="grid w-full grid-cols-2 h-auto gap-2 bg-transparent p-0">
                      <TabsTrigger value="mapping" className="border border-cyan-500/30 data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                        Mapping manuel
                      </TabsTrigger>
                      <TabsTrigger value="diagnostics" className="border border-amber-500/30 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                        Diagnostics ({importMappingDiagnostics.errors.length} / {importMappingDiagnostics.warnings.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="diagnostics" className="mt-0 space-y-3">
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                        <div className="text-xs text-neutral-700 dark:text-neutral-300 mb-2">
                          Corrigez d’abord les erreurs bloquantes, puis utilisez l’import final.
                        </div>
                        {importMappingDiagnostics.errors.length > 0 && (
                          <div className="mb-2">
                            <div className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Erreurs bloquantes</div>
                            <ul className="list-disc pl-5 space-y-1 text-xs text-red-800 dark:text-red-200">
                              {importMappingDiagnostics.errors.map((msg, idx) => (
                                <li key={`import-error-${idx}`}>{msg}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {importMappingDiagnostics.warnings.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Avertissements</div>
                            <ul className="list-disc pl-5 space-y-1 text-xs text-amber-900 dark:text-amber-200">
                              {importMappingDiagnostics.warnings.map((msg, idx) => (
                                <li key={`import-warning-${idx}`}>{msg}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {importMappingDiagnostics.errors.length === 0 && importMappingDiagnostics.warnings.length === 0 && (
                          <div className="text-xs text-emerald-700 dark:text-emerald-300">Aucun problème détecté. Import prêt.</div>
                        )}
                      </div>

                      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                        <div className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 mb-2">
                          Relations détectées ({importRelationSummary.length})
                        </div>
                        {importRelationSummary.length === 0 ? (
                          <div className="text-xs text-neutral-600 dark:text-neutral-300">Aucune relation détectée pour le moment.</div>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-auto pr-1">
                            {importRelationSummary.map((rel, idx) => (
                              <div key={`rel-summary-${idx}`} className="flex flex-wrap items-center gap-2 justify-between bg-white/40 dark:bg-white/5 rounded px-2 py-1.5">
                                <div className="text-xs text-neutral-700 dark:text-neutral-200">
                                  <span className="font-medium">{rel.collectionName}</span>
                                  <span className="mx-1">·</span>
                                  <span>{rel.fieldName}</span>
                                  <span className="mx-1">→</span>
                                  <span className="font-medium">{rel.targetName}</span>
                                  <span className="mx-1">({rel.relationType})</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <select
                                    className="px-2 py-1 rounded text-[11px] bg-white dark:bg-neutral-900 border border-white/20"
                                    value={relationChoiceFieldByKey[`${rel.orgIdx}:${rel.colIdx}:${rel.propIdx}`] || rel.targetFields[0]?.id || ''}
                                    onChange={(e) => {
                                      const key = `${rel.orgIdx}:${rel.colIdx}:${rel.propIdx}`;
                                      setRelationChoiceFieldByKey((prev) => ({ ...prev, [key]: e.target.value }));
                                    }}
                                    disabled={importCommitBusy || rel.targetFields.length === 0}
                                    title="Champ utilisé pour générer les options du select"
                                  >
                                    {rel.targetFields.map((f) => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded text-[11px] bg-white/70 dark:bg-white/10 border border-white/20 hover:bg-white"
                                    onClick={() => {
                                      const key = `${rel.orgIdx}:${rel.colIdx}:${rel.propIdx}`;
                                      const selectedFieldId = relationChoiceFieldByKey[key] || rel.targetFields[0]?.id;
                                      convertRelationToChoiceField(rel.orgIdx, rel.colIdx, rel.propIdx, 'select', selectedFieldId, false);
                                    }}
                                    disabled={importCommitBusy}
                                    title="Convertir en select (liste simple)"
                                  >
                                    → select
                                  </button>
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded text-[11px] bg-white/70 dark:bg-white/10 border border-white/20 hover:bg-white"
                                    onClick={() => {
                                      const key = `${rel.orgIdx}:${rel.colIdx}:${rel.propIdx}`;
                                      const selectedFieldId = relationChoiceFieldByKey[key] || rel.targetFields[0]?.id;
                                      convertRelationToChoiceField(rel.orgIdx, rel.colIdx, rel.propIdx, 'multi_select', selectedFieldId, false);
                                    }}
                                    disabled={importCommitBusy}
                                    title="Convertir en multi_select (liste multiple)"
                                  >
                                    → multi
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {deletedImportProperties.length > 0 && (
                        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                          <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Champs supprimés ({deletedImportProperties.length})</div>
                          <div className="space-y-2">
                            {deletedImportProperties.map((deleted: any, idx: number) => (
                              <div key={`deleted-${idx}`} className="flex items-center justify-between gap-2 p-2 bg-white/30 dark:bg-white/5 rounded text-xs">
                                <div>
                                  <span className="font-medium">{deleted.property?.name || 'Sans nom'}</span>
                                  <span className="text-neutral-500 ml-2">({deleted.property?.type})</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    patchImportPreviewOrganizations((draft) => {
                                      const collection = draft?.[deleted.orgIndex]?.state?.collections?.[deleted.collectionIndex];
                                      if (collection && Array.isArray(collection.properties)) {
                                        collection.properties.splice(deleted.propertyIndex, 0, deleted.property);
                                      }
                                    });
                                    setDeletedImportProperties((prev) => prev.filter((_, i) => i !== idx));
                                  }}
                                  className="px-2 py-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                                >
                                  Restaurer
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="mapping" className="mt-0 space-y-4">
                      {importPreviewOrganizations.map((org: any, orgIdx: number) => {
                        const orgCollections = Array.isArray(org?.state?.collections) ? org.state.collections : [];
                        return (
                          <div key={`org-${orgIdx}`} className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900/70 p-3 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div className="md:col-span-2">
                                <label className="block text-xs text-neutral-500 mb-1">Nom de l’organisation</label>
                                <input
                                  className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-2 text-sm"
                                  value={org?.name || ''}
                                  onChange={(e) => updateImportOrganizationName(orgIdx, e.target.value)}
                                  disabled={importCommitBusy}
                                />
                              </div>
                              <div className="flex items-end md:justify-end">
                                <button
                                  type="button"
                                  className="px-2 py-1.5 rounded bg-red-600/90 hover:bg-red-700 text-white text-xs disabled:opacity-60"
                                  onClick={() => removeImportOrganization(orgIdx)}
                                  disabled={importCommitBusy || importPreviewOrganizations.length <= 1}
                                  title={importPreviewOrganizations.length <= 1 ? 'Au moins une organisation est requise' : 'Supprimer cette organisation de l’import'}
                                >
                                  Supprimer organisation
                                </button>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {orgCollections.length === 0 ? (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                                  Aucune collection détectée pour cette organisation.
                                </div>
                              ) : (
                                <Tabs defaultValue={`col-${orgIdx}-0`} className="space-y-3">
                                  <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-transparent p-0 gap-2">
                                    {orgCollections.map((col: any, colIdx: number) => (
                                      <TabsTrigger
                                        key={`org-${orgIdx}-tab-${colIdx}`}
                                        value={`col-${orgIdx}-${colIdx}`}
                                        className="border border-cyan-500/30 data-[state=active]:bg-cyan-600 data-[state=active]:text-white whitespace-nowrap"
                                      >
                                        {col?.name || `Collection ${colIdx + 1}`}
                                      </TabsTrigger>
                                    ))}
                                  </TabsList>

                                  {orgCollections.map((col: any, colIdx: number) => {
                                    const properties = Array.isArray(col?.properties) ? col.properties : [];
                                    const targetCollections = orgCollections.map((c: any) => ({ id: c.id, name: c.name || c.id }));
                                    return (
                                      <TabsContent key={`org-${orgIdx}-content-${colIdx}`} value={`col-${orgIdx}-${colIdx}`} className="mt-0">
                                        <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 space-y-3">
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-1">
                                            <div>
                                              <label className="block text-xs text-neutral-500 mb-1">Nom collection</label>
                                              <input
                                                className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-2 text-sm"
                                                value={col?.name || ''}
                                                onChange={(e) => updateImportCollectionName(orgIdx, colIdx, e.target.value)}
                                                disabled={importCommitBusy}
                                              />
                                            </div>
                                            <div className="text-xs text-neutral-500 flex items-end pb-2">
                                              {Array.isArray(col?.items) ? col.items.length : 0} item(s) · {properties.length} champ(s)
                                            </div>
                                            <div className="flex items-end md:justify-end">
                                              <button
                                                type="button"
                                                className="px-2 py-1.5 rounded bg-red-600/90 hover:bg-red-700 text-white text-xs disabled:opacity-60"
                                                onClick={() => removeImportCollection(orgIdx, colIdx)}
                                                disabled={importCommitBusy || orgCollections.length <= 1}
                                                title={orgCollections.length <= 1 ? 'Au moins une collection est requise' : 'Supprimer cette collection de l’import'}
                                              >
                                                Supprimer collection
                                              </button>
                                            </div>
                                          </div>

                                          <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
                                            <div className="grid grid-cols-12 gap-2 bg-black/5 dark:bg-white/5 px-2 py-2 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 sticky top-0 z-10">
                                              <div className="col-span-4">Champ</div>
                                              <div className="col-span-3">Type</div>
                                              <div className="col-span-3">Cible relation</div>
                                              <div className="col-span-1">Cardinalité</div>
                                              <div className="col-span-1 text-center">Action</div>
                                            </div>

                                            <div className="max-h-[550px] overflow-auto">
                                              {properties.map((prop: any, propIdx: number) => {
                                                const relationType = prop?.relation?.type || 'many_to_many';
                                                const relationTarget = prop?.relation?.targetCollectionId || '';
                                                const isRelation = prop?.type === 'relation';
                                                const isChoiceType = prop?.type === 'select' || prop?.type === 'multi_select';
                                                const choiceSourceCollectionId = String(prop?.importChoiceSource?.collectionId || '');
                                                const choiceTargetCollection = isChoiceType
                                                  ? orgCollections.find((c: any) => c?.id === choiceSourceCollectionId)
                                                  : null;
                                                const choiceTargetFields = Array.isArray(choiceTargetCollection?.properties)
                                                  ? choiceTargetCollection.properties
                                                    .map((p: any) => ({ id: String(p?.id || ''), name: String(p?.name || p?.id || 'champ') }))
                                                    .filter((p: any) => p.id)
                                                  : [];
                                                const choiceSourceFieldId = String(prop?.importChoiceSource?.fieldId || choiceTargetFields[0]?.id || '');
                                                const relationTargetCollection = isRelation
                                                  ? orgCollections.find((c: any) => c?.id === relationTarget)
                                                  : null;
                                                const relationTargetFields = Array.isArray(relationTargetCollection?.properties)
                                                  ? relationTargetCollection.properties
                                                    .map((p: any) => ({ id: String(p?.id || ''), name: String(p?.name || p?.id || 'champ') }))
                                                    .filter((p: any) => p.id)
                                                  : [];
                                                const relationChoiceKey = `${orgIdx}:${colIdx}:${propIdx}`;
                                                const selectedRelationChoiceFieldId = relationChoiceFieldByKey[relationChoiceKey]
                                                  || relationTargetFields[0]?.id
                                                  || '';
                                                return (
                                                  <div
                                                    key={`org-${orgIdx}-col-${colIdx}-prop-${propIdx}`}
                                                    className="grid grid-cols-12 gap-2 px-2 py-2 border-t border-black/10 dark:border-white/10 items-center"
                                                  >
                                                    <div className="col-span-4">
                                                      <input
                                                        className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs"
                                                        value={prop?.name || ''}
                                                        onChange={(e) => updateImportProperty(orgIdx, colIdx, propIdx, { name: e.target.value })}
                                                        disabled={importCommitBusy}
                                                      />
                                                    </div>

                                                    <div className="col-span-3">
                                                      <select
                                                        className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs"
                                                        value={prop?.type || 'text'}
                                                        onChange={(e) => {
                                                          const nextType = e.target.value;
                                                          const fromRelationTarget = String(prop?.relation?.targetCollectionId || '').trim();
                                                          if (nextType === 'select' || nextType === 'multi_select') {
                                                            const sourceCollectionId = fromRelationTarget || choiceSourceCollectionId || '';
                                                            const sourceCollection = sourceCollectionId
                                                              ? orgCollections.find((c: any) => c?.id === sourceCollectionId)
                                                              : null;
                                                            const defaultFieldId = pickDefaultChoiceFieldId(sourceCollection, prop);
                                                            updateImportProperty(orgIdx, colIdx, propIdx, {
                                                              type: nextType,
                                                              importChoiceSource: {
                                                                collectionId: sourceCollectionId,
                                                                fieldId: defaultFieldId,
                                                              },
                                                            });
                                                            if (sourceCollectionId) {
                                                              hydrateChoiceFieldOptions(
                                                                orgIdx,
                                                                colIdx,
                                                                propIdx,
                                                                sourceCollectionId,
                                                                defaultFieldId || undefined,
                                                              );
                                                            }
                                                            return;
                                                          }
                                                          updateImportProperty(orgIdx, colIdx, propIdx, { type: nextType });
                                                        }}
                                                        disabled={importCommitBusy}
                                                      >
                                                        {IMPORT_PROPERTY_TYPE_OPTIONS.map((typeOpt) => (
                                                          <option key={typeOpt} value={typeOpt}>{typeOpt}</option>
                                                        ))}
                                                      </select>
                                                    </div>

                                                    <div className="col-span-3">
                                                      {isRelation ? (
                                                        <select
                                                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs"
                                                          value={relationTarget}
                                                          onChange={(e) => updateImportProperty(orgIdx, colIdx, propIdx, {
                                                            relation: {
                                                              ...(prop?.relation || {}),
                                                              targetCollectionId: e.target.value,
                                                              type: relationType,
                                                            },
                                                          })}
                                                          disabled={importCommitBusy}
                                                        >
                                                          <option value="">Sélectionner une cible…</option>
                                                          {targetCollections.map((target: any) => (
                                                            <option key={target.id} value={target.id}>{target.name}</option>
                                                          ))}
                                                        </select>
                                                      ) : isChoiceType ? (
                                                        <div className="grid grid-cols-1 gap-1">
                                                          <select
                                                            className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1 text-[11px]"
                                                            value={choiceSourceCollectionId}
                                                            onChange={(e) => {
                                                              const collectionId = e.target.value;
                                                              updateImportProperty(orgIdx, colIdx, propIdx, {
                                                                importChoiceSource: {
                                                                  collectionId,
                                                                  fieldId: '',
                                                                },
                                                              });
                                                              if (collectionId) {
                                                                hydrateChoiceFieldOptions(orgIdx, colIdx, propIdx, collectionId);
                                                              }
                                                            }}
                                                            disabled={importCommitBusy}
                                                          >
                                                            <option value="">Source options…</option>
                                                            {targetCollections.map((target: any) => (
                                                              <option key={target.id} value={target.id}>{target.name}</option>
                                                            ))}
                                                          </select>
                                                          <select
                                                            className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1 text-[11px]"
                                                            value={choiceSourceFieldId}
                                                            onChange={(e) => {
                                                              const fieldId = e.target.value;
                                                              updateImportProperty(orgIdx, colIdx, propIdx, {
                                                                importChoiceSource: {
                                                                  collectionId: choiceSourceCollectionId,
                                                                  fieldId,
                                                                },
                                                              });
                                                              if (choiceSourceCollectionId) {
                                                                hydrateChoiceFieldOptions(orgIdx, colIdx, propIdx, choiceSourceCollectionId, fieldId || undefined);
                                                              }
                                                            }}
                                                            disabled={importCommitBusy || !choiceSourceCollectionId}
                                                          >
                                                            {choiceTargetFields.length === 0 && <option value="">Champ…</option>}
                                                            {choiceTargetFields.map((f: any) => (
                                                              <option key={f.id} value={f.id}>{f.name}</option>
                                                            ))}
                                                          </select>
                                                        </div>
                                                      ) : (
                                                        <div className="text-[11px] text-neutral-500 py-1.5">—</div>
                                                      )}
                                                    </div>

                                                    <div className="col-span-1">
                                                      {isRelation ? (
                                                        <select
                                                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs"
                                                          value={relationType}
                                                          onChange={(e) => updateImportProperty(orgIdx, colIdx, propIdx, {
                                                            relation: {
                                                              ...(prop?.relation || {}),
                                                              targetCollectionId: relationTarget || targetCollections[0]?.id || null,
                                                              type: e.target.value,
                                                            },
                                                          })}
                                                          disabled={importCommitBusy}
                                                        >
                                                          <option value="one_to_one">one_to_one</option>
                                                          <option value="one_to_many">one_to_many</option>
                                                          <option value="many_to_many">many_to_many</option>
                                                        </select>
                                                      ) : (
                                                        <div className="text-[11px] text-neutral-500 py-1.5">—</div>
                                                      )}
                                                    </div>

                                                    <div className="col-span-1 flex justify-center">
                                                      <div className="flex items-center gap-1">
                                                        {isRelation && (
                                                          <>
                                                            <button
                                                              type="button"
                                                              className="px-1.5 py-1 rounded text-[10px] bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                                                              onClick={() => convertRelationToChoiceField(orgIdx, colIdx, propIdx, 'select', selectedRelationChoiceFieldId || undefined)}
                                                              disabled={importCommitBusy}
                                                              title="Convertir cette relation en select"
                                                            >
                                                              S
                                                            </button>
                                                            <button
                                                              type="button"
                                                              className="px-1.5 py-1 rounded text-[10px] bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                                                              onClick={() => convertRelationToChoiceField(orgIdx, colIdx, propIdx, 'multi_select', selectedRelationChoiceFieldId || undefined)}
                                                              disabled={importCommitBusy}
                                                              title="Convertir cette relation en multi_select"
                                                            >
                                                              M
                                                            </button>
                                                          </>
                                                        )}
                                                        <button
                                                          type="button"
                                                          className="p-1 rounded hover:bg-red-500/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                                                          onClick={() => removeImportProperty(orgIdx, colIdx, propIdx)}
                                                          disabled={importCommitBusy}
                                                          title="Supprimer cette propriété"
                                                        >
                                                          <X size={16} />
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      </TabsContent>
                                    );
                                  })}
                                </Tabs>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="px-4 py-3 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    className="px-3 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm disabled:opacity-60"
                    onClick={autoFixImportMapping}
                    disabled={importCommitBusy || !importPreviewOrganizations.length}
                  >
                    Auto-fix mapping
                  </button>
                  <button
                    className="px-3 py-2 rounded border border-white/20 text-sm"
                    onClick={() => setShowImportMapper(false)}
                    disabled={importCommitBusy}
                  >
                    Annuler
                  </button>
                  <button
                    className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60"
                    onClick={importOrganizationsWithManualMapping}
                    disabled={importCommitBusy || !importPreviewOrganizations.length || importMappingDiagnostics.errors.length > 0}
                  >
                    {importCommitBusy ? 'Import en cours…' : 'Créer les organisations'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AccessManager;
