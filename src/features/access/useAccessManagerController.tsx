import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { initializePluginRegistry } from '@/lib/plugins';
import { pluginManager } from '@/lib/plugins/PluginManager';

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

export const useAccessManagerController = ({
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

  // Load plugin configs from database and initialize
  const loadPluginConfigs = async () => {
    if (!activeOrganizationId) return;
    
    try {
      const response = await fetch(`${API_URL}/plugins/config/${activeOrganizationId}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.warn('[AccessManager] Failed to load plugin configs');
        return;
      }
      
      const configs = await response.json() as Record<string, any>;
      console.log('[AccessManager] Loaded plugin configs from DB:', configs);

      const enabledPlugins = Object.entries(configs)
        .filter(([, value]) => Boolean((value as any)?.enabled))
        .map(([pluginId]) => pluginId);
      const pluginConfigs = Object.fromEntries(
        Object.entries(configs).map(([pluginId, value]) => [pluginId, (value as any)?.config || {}])
      );

      await pluginManager.initializeOrganizationPlugins(
        activeOrganizationId,
        {
          organizationId: activeOrganizationId,
          plugins: pluginManager.getAllPlugins(),
          enabledPlugins,
          pluginConfigs,
        },
        {
          organizationId: activeOrganizationId,
          userId: user?.id || '',
          api: {
            getOrganizationData: () => ({}),
            updateOrganizationConfig: async () => {},
            registerHook: (hookName, callback) => pluginManager.registerHook(hookName, callback),
            unregisterHook: (hookName, callback) => pluginManager.unregisterHook(hookName, callback),
            emit: (eventName, data) => {
              window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
            },
          },
        }
      );

      enabledPlugins.forEach((pluginId) => {
        console.log(`[AccessManager] Re-enabled plugin: ${pluginId}`);
      });
    } catch (error) {
      console.error('[AccessManager] Error loading plugin configs:', error);
    }
  };

  useEffect(() => {
    loadAll();
    console.log('[AccessManager] Initializing plugin registry...');
    initializePluginRegistry();
    console.log('[AccessManager] Plugin registry initialized');
    loadPluginConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganizationId]);

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
        // Si l'utilisateur est en cours de sauvegarde, conserver le brouillon actuel
        if (preferencesBusyByUser[u.id]) {
          next[u.id] = prev[u.id] || merged;
          return;
        }
        next[u.id] = merged;
        if (JSON.stringify(prev[u.id]) !== JSON.stringify(merged)) {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [users, memberCandidates, preferencesBusyByUser]);

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

  const isLocal = user?.provider === 'local';
  const isSelf = selectedPreferencesUser?.id === user?.id;

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


  const panelContext = { API_URL, collections, dashboards, dataTransferTab, setDataTransferTab, importOrganizationName, setImportOrganizationName, importBusy, importOrganizationsFromFiles, loadAll, activeOrganizationId, organizations, organizationNameEdits, setOrganizationNameEdits, busy, renameOrganization, deleteOrganization, backups, backupLabel, setBackupLabel, reloadBackups, createBackup, backupBusy, visibleBackups, formatBytes, restoreBackup, downloadBackup, deleteBackup, sortedBackups, loading, roles, creatingRole, setCreatingRole, selectedRoleId, setSelectedRoleId, newRoleName, setNewRoleName, newRoleDesc, setNewRoleDesc, createRole, permissionsTab, setPermissionsTab, findPermission, toggleFlag, permissions, collectionsWithProps, flags, toggleDashboardVisibilityForRole, isDashboardVisibleForRole, importRelationSummary, patchImportPreviewOrganizations, IMPORT_PROPERTY_TYPE_OPTIONS, selectableUsers, filteredUsers, userQuery, setUserQuery, selectedPreferencesUserId, setSelectedPreferencesUserId, members, user, parseRoleIds, assignRole, selectedPreferencesDraft, selectedPreferencesUser, memberIds, preferencesBusyByUser, preferencesSavedAtByUser, updateUserPreferencesDraft, saveUserPreferences, passwordInputs, setPasswordInputs, updateUserPassword, deleteUser, isLocal, isSelf, addMember, removeMember, membersBusy, relationChoiceFieldByKey, setRelationChoiceFieldByKey, updateImportOrganizationName, removeImportOrganization, updateImportCollectionName, removeImportCollection, updateImportProperty, removeImportProperty, convertRelationToChoiceField, pickDefaultChoiceFieldId, hydrateChoiceFieldOptions, deletedImportProperties, setDeletedImportProperties, importMapperTab, setImportMapperTab, importMappingDiagnostics, importPreviewOrganizations, importCommitBusy, autoFixImportMapping, importOrganizationsWithManualMapping, showImportMapper, setShowImportMapper };


  return { isAdmin, panelContext };
};
