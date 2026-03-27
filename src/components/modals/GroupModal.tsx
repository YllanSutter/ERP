import React, { useMemo, useState } from 'react';
import ModalWrapper, { FormSelect, FormCheckbox } from '@/components/ui/ModalWrapper';
import {
  type TableGroupDisplayMode, type TableGroupColumnCount,
  normalizeGroupMode, normalizeColumnCount,
  GROUP_MODE_OPTIONS, GROUP_COLUMN_COUNT_OPTIONS,
} from '@/components/modals/modalLib';

type GroupTotalPosition = 'top' | 'bottom' | 'both';

interface GroupTotalConfig {
  enabled?: boolean;
  position?: GroupTotalPosition;
}

interface GroupRow {
  uid: string;
  propertyId: string;
}

interface GroupModalProps {
  properties: any[];
  collections: any[];
  currentGroups?: string[];
  initialGroupTotalsByGroupId?: Record<string, GroupTotalConfig>;
  initialGroupDisplayModes?: Record<string, TableGroupDisplayMode>;
  initialGroupDisplayColumnCounts?: Record<string, TableGroupColumnCount>;
  initialGroupTabStyleFieldIds?: Record<string, string>;
  initialDefaultGroupDisplayMode?: TableGroupDisplayMode;
  initialDefaultGroupDisplayColumnCount?: TableGroupColumnCount;
  onClose: () => void;
  onSave: (
    groups: string[],
    groupTotalsByGroupId: Record<string, GroupTotalConfig>,
    groupDisplayModes: Record<string, TableGroupDisplayMode>,
    groupDisplayColumnCounts: Record<string, TableGroupColumnCount>,
    groupTabStyleFieldIds: Record<string, string>
  ) => void;
}

const makeUid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const GroupModal: React.FC<GroupModalProps> = ({
  properties,
  collections,
  currentGroups = [],
  initialGroupTotalsByGroupId = {},
  initialGroupDisplayModes = {},
  initialGroupDisplayColumnCounts = {},
  initialGroupTabStyleFieldIds = {},
  initialDefaultGroupDisplayMode = 'accordion',
  initialDefaultGroupDisplayColumnCount = 3,
  onClose,
  onSave,
}) => {
  const groupableProperties = useMemo(
    () => properties.filter((p: any) => (
      ['select', 'multi_select', 'relation', 'checkbox', 'text', 'number', 'date', 'date_range'].includes(p.type)
    )),
    [properties]
  );

  const [rows, setRows] = useState<GroupRow[]>(
    currentGroups.length
      ? currentGroups.map((propertyId) => ({ uid: makeUid(), propertyId }))
      : [{ uid: makeUid(), propertyId: '' }]
  );
  const [groupTotalsByGroupId, setGroupTotalsByGroupId] = useState<Record<string, GroupTotalConfig>>(
    initialGroupTotalsByGroupId || {}
  );
  const [groupDisplayModes, setGroupDisplayModes] = useState<Record<string, TableGroupDisplayMode>>(
    initialGroupDisplayModes || {}
  );
  const [groupDisplayColumnCounts, setGroupDisplayColumnCounts] = useState<Record<string, TableGroupColumnCount>>(
    initialGroupDisplayColumnCounts || {}
  );
  const [groupTabStyleFieldIds, setGroupTabStyleFieldIds] = useState<Record<string, string>>(
    initialGroupTabStyleFieldIds || {}
  );

  const updateRowProperty = (uid: string, propertyId: string) => {
    setRows((prev) => prev.map((row) => (row.uid === uid ? { ...row, propertyId } : row)));
  };

  const moveRow = (uid: string, delta: number) => {
    setRows((prev) => {
      const idx = prev.findIndex((row) => row.uid === uid);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const removeRow = (uid: string) => {
    setRows((prev) => {
      const next = prev.filter((row) => row.uid !== uid);
      return next.length ? next : [{ uid: makeUid(), propertyId: '' }];
    });
  };

  const addRow = () => {
    setRows((prev) => [...prev, { uid: makeUid(), propertyId: '' }]);
  };

  const updateGroupTotalConfig = (groupId: string, patch: Partial<GroupTotalConfig>) => {
    setGroupTotalsByGroupId((prev) => ({
      ...prev,
      [groupId]: {
        enabled: prev[groupId]?.enabled ?? true,
        position: prev[groupId]?.position === 'top' ? 'top' : prev[groupId]?.position === 'both' ? 'both' : 'bottom',
        ...patch,
      },
    }));
  };

  const getGroupMode = (groupId: string, idx: number): TableGroupDisplayMode => {
    const specific = groupDisplayModes[groupId];
    if (specific) return specific;
    if (idx === 0) return normalizeGroupMode(initialDefaultGroupDisplayMode);
    return 'accordion';
  };

  const getGroupColumnCount = (groupId: string): TableGroupColumnCount => {
    return normalizeColumnCount(groupDisplayColumnCounts[groupId] ?? initialDefaultGroupDisplayColumnCount);
  };

  const updateGroupMode = (groupId: string, mode: TableGroupDisplayMode) => {
    setGroupDisplayModes((prev) => ({ ...prev, [groupId]: normalizeGroupMode(mode) }));
  };

  const updateGroupColumnCount = (groupId: string, count: TableGroupColumnCount) => {
    setGroupDisplayColumnCounts((prev) => ({ ...prev, [groupId]: normalizeColumnCount(count) }));
  };

  const handleSave = () => {
    const normalizedGroups = rows.map((row) => row.propertyId).filter(Boolean);
    const seen = new Set<string>();
    const uniqueGroups = normalizedGroups.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const nextTotalsByGroupId: Record<string, GroupTotalConfig> = {};
    const nextDisplayModes: Record<string, TableGroupDisplayMode> = {};
    const nextDisplayColumnCounts: Record<string, TableGroupColumnCount> = {};
    const nextTabStyleFieldIds: Record<string, string> = {};

    uniqueGroups.forEach((groupId) => {
      const cfg = groupTotalsByGroupId[groupId] || {};
      nextTotalsByGroupId[groupId] = {
        enabled: cfg.enabled !== false,
        position: cfg.position === 'top' ? 'top' : cfg.position === 'both' ? 'both' : 'bottom',
      };
      const index = uniqueGroups.indexOf(groupId);
      nextDisplayModes[groupId] = getGroupMode(groupId, index);
      nextDisplayColumnCounts[groupId] = getGroupColumnCount(groupId);
      const configuredStyleField = groupTabStyleFieldIds[groupId];
      if (configuredStyleField) nextTabStyleFieldIds[groupId] = configuredStyleField;
    });

    onSave(uniqueGroups, nextTotalsByGroupId, nextDisplayModes, nextDisplayColumnCounts, nextTabStyleFieldIds);
  };

  return (
    <ModalWrapper
      title={
        <>
          <h3 className="text-xl font-bold mb-2">Groupage</h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">
            Configure les niveaux de groupage et les totaux par niveau.
          </p>
        </>
      }
      onClose={onClose}
      onSave={handleSave}
      className="p-6 min-w-[42rem] max-w-[90vw] max-h-[85vh]"
    >
      <div className="space-y-3 mb-5">
        {rows.map((row, idx) => {
          const groupId = row.propertyId;
          const cfg = (groupId && groupTotalsByGroupId[groupId]) || { enabled: true, position: 'bottom' };
          const mode = groupId ? getGroupMode(groupId, idx) : 'accordion';
          const columnCount = groupId ? getGroupColumnCount(groupId) : 3;
          const groupProp = groupableProperties.find((p: any) => p.id === groupId);
          const sourceRelationProp = groupProp?.isRelationLinkedColumn && groupProp?.sourceRelationPropertyId
            ? properties.find((p: any) => p.id === groupProp.sourceRelationPropertyId)
            : null;
          const relationTargetCollectionId =
            groupProp?.type === 'relation'
              ? groupProp?.relation?.targetCollectionId
              : groupProp?.isRelationLinkedColumn
                ? (groupProp?.sourceTargetCollectionId || sourceRelationProp?.relation?.targetCollectionId || '')
                : '';
          const relationTargetCollection = relationTargetCollectionId
            ? (collections || []).find((c: any) => c.id === relationTargetCollectionId)
            : null;
          const relationStyleFieldOptions = (relationTargetCollection?.properties || [])
            .filter((p: any) => p.type === 'select' || p.type === 'multi_select');

          return (
            <div key={row.uid} className="rounded-lg border border-black/10 dark:border-white/10 p-3 bg-black/[0.03] dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Niveau {idx + 1}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => moveRow(row.uid, -1)}
                    disabled={idx === 0}
                    className="px-2 py-1 rounded text-xs bg-black/5 dark:bg-white/5 disabled:opacity-40"
                  >↑</button>
                  <button
                    onClick={() => moveRow(row.uid, 1)}
                    disabled={idx === rows.length - 1}
                    className="px-2 py-1 rounded text-xs bg-black/5 dark:bg-white/5 disabled:opacity-40"
                  >↓</button>
                  <button
                    onClick={() => removeRow(row.uid)}
                    className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-600 dark:text-red-300"
                  >Supprimer</button>
                </div>
              </div>

              <FormSelect
                value={row.propertyId}
                onChange={(v) => updateRowProperty(row.uid, v)}
                options={[
                  { value: '', label: 'Sélectionner un champ...' },
                  ...groupableProperties.map((prop: any) => ({
                    value: prop.id,
                    label: prop.name + (prop.isRelationLinkedColumn ? ' (lié)' : ''),
                  })),
                ]}
              />

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormSelect
                  value={mode}
                  onChange={(v) => { if (groupId) updateGroupMode(groupId, normalizeGroupMode(v)); }}
                  disabled={!groupId}
                  options={GROUP_MODE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                />

                <FormSelect
                  value={String(columnCount)}
                  onChange={(v) => {
                    if (!groupId) return;
                    const raw = Number(v);
                    updateGroupColumnCount(groupId, (raw === 1 || raw === 2 || raw === 3 ? raw : 3) as TableGroupColumnCount);
                  }}
                  disabled={!groupId || mode !== 'columns'}
                  options={GROUP_COLUMN_COUNT_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                />

                <FormCheckbox
                  label="Afficher le total"
                  checked={cfg.enabled !== false}
                  disabled={!groupId}
                  onChange={(checked) => { if (groupId) updateGroupTotalConfig(groupId, { enabled: checked }); }}
                />

                <FormSelect
                  value={cfg.position === 'top' ? 'top' : cfg.position === 'both' ? 'both' : 'bottom'}
                  onChange={(v) => {
                    if (!groupId) return;
                    updateGroupTotalConfig(groupId, { position: v === 'top' ? 'top' : v === 'both' ? 'both' : 'bottom' });
                  }}
                  disabled={!groupId || cfg.enabled === false}
                  options={[
                    { value: 'bottom', label: 'Total en bas' },
                    { value: 'top',    label: 'Total en haut' },
                    { value: 'both',   label: 'Total en haut et en bas' },
                  ]}
                />
              </div>

              <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                {mode === 'columns'
                  ? `Affichage en colonnes (${columnCount} colonne${columnCount > 1 ? 's' : ''}).`
                  : mode === 'tabs'   ? 'Affichage par onglets.'
                  : mode === 'select' ? 'Affichage via menu déroulant (select).'
                  : 'Affichage en accordéon (chevrons).'}
              </p>

              {groupId && mode === 'tabs' && (groupProp?.type === 'relation' || groupProp?.isRelationLinkedColumn) && (
                <div className="mt-3">
                  <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">
                    Modèle visuel des onglets
                  </label>
                  <FormSelect
                    value={groupTabStyleFieldIds[groupId] || ''}
                    onChange={(v) => {
                      setGroupTabStyleFieldIds((prev) => {
                        const next = { ...prev };
                        if (!v) delete next[groupId]; else next[groupId] = v;
                        return next;
                      });
                    }}
                    disabled={relationStyleFieldOptions.length === 0}
                    options={[
                      { value: '', label: 'Aucun style spécial' },
                      ...relationStyleFieldOptions.map((p: any) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                  <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                    Choisis un champ select/multi-select de la collection liée pour reprendre icône + couleur dans les onglets de ce niveau.
                  </p>
                  {relationStyleFieldOptions.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                      Aucun champ select/multi-select trouvé dans la collection liée.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={addRow} className="w-full mb-5 px-4 py-2 rounded-lg border border-dashed border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5">
        + Ajouter un niveau
      </button>
    </ModalWrapper>
  );
};

export default GroupModal;
