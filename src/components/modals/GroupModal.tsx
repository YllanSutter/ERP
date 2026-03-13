import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ShinyButton from '@/components/ui/ShinyButton';
import { TableGroupDisplayMode, TableGroupColumnCount } from '@/lib/types';

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
  currentGroups?: string[];
  initialGroupTotalsByGroupId?: Record<string, GroupTotalConfig>;
  initialGroupDisplayModes?: Record<string, TableGroupDisplayMode>;
  initialGroupDisplayColumnCounts?: Record<string, TableGroupColumnCount>;
  initialDefaultGroupDisplayMode?: TableGroupDisplayMode;
  initialDefaultGroupDisplayColumnCount?: TableGroupColumnCount;
  onClose: () => void;
  onSave: (
    groups: string[],
    groupTotalsByGroupId: Record<string, GroupTotalConfig>,
    groupDisplayModes: Record<string, TableGroupDisplayMode>,
    groupDisplayColumnCounts: Record<string, TableGroupColumnCount>
  ) => void;
}

const makeUid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const GroupModal: React.FC<GroupModalProps> = ({
  properties,
  currentGroups = [],
  initialGroupTotalsByGroupId = {},
  initialGroupDisplayModes = {},
  initialGroupDisplayColumnCounts = {},
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
        position:
          prev[groupId]?.position === 'top'
            ? 'top'
            : prev[groupId]?.position === 'both'
              ? 'both'
              : 'bottom',
        ...patch,
      },
    }));
  };

  const normalizeMode = (mode?: string): TableGroupDisplayMode => {
    if (mode === 'columns' || mode === 'tabs' || mode === 'accordion') return mode;
    return 'accordion';
  };

  const normalizeColumnCount = (count?: number): TableGroupColumnCount => {
    if (count === 1 || count === 2 || count === 3) return count;
    return 3;
  };

  const getGroupMode = (groupId: string, idx: number): TableGroupDisplayMode => {
    const specific = groupDisplayModes[groupId];
    if (specific) return specific;
    if (idx === 0) return normalizeMode(initialDefaultGroupDisplayMode);
    return 'accordion';
  };

  const getGroupColumnCount = (groupId: string): TableGroupColumnCount => {
    return normalizeColumnCount(groupDisplayColumnCounts[groupId] ?? initialDefaultGroupDisplayColumnCount);
  };

  const updateGroupMode = (groupId: string, mode: TableGroupDisplayMode) => {
    setGroupDisplayModes((prev) => ({
      ...prev,
      [groupId]: normalizeMode(mode),
    }));
  };

  const updateGroupColumnCount = (groupId: string, count: TableGroupColumnCount) => {
    setGroupDisplayColumnCounts((prev) => ({
      ...prev,
      [groupId]: normalizeColumnCount(count),
    }));
  };

  const handleSave = () => {
    const normalizedGroups = rows
      .map((row) => row.propertyId)
      .filter((id) => Boolean(id));

    const seen = new Set<string>();
    const uniqueGroups = normalizedGroups.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    const nextTotalsByGroupId: Record<string, GroupTotalConfig> = {};
    const nextDisplayModes: Record<string, TableGroupDisplayMode> = {};
    const nextDisplayColumnCounts: Record<string, TableGroupColumnCount> = {};

    uniqueGroups.forEach((groupId) => {
      const cfg = groupTotalsByGroupId[groupId] || {};
      nextTotalsByGroupId[groupId] = {
        enabled: cfg.enabled !== false,
        position: cfg.position === 'top' ? 'top' : cfg.position === 'both' ? 'both' : 'bottom',
      };

      const index = uniqueGroups.indexOf(groupId);
      nextDisplayModes[groupId] = getGroupMode(groupId, index);
      nextDisplayColumnCounts[groupId] = getGroupColumnCount(groupId);
    });

    onSave(uniqueGroups, nextTotalsByGroupId, nextDisplayModes, nextDisplayColumnCounts);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-[200]" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gray-200 dark:bg-neutral-900/90 border border-black/10 dark:border-white/10 rounded-2xl p-6 min-w-[42rem] max-w-[90vw] max-h-[85vh] overflow-y-auto backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-2">Groupage</h3>
        <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-4">
          Configure les niveaux de groupage et les totaux par niveau.
        </p>

        <div className="space-y-3 mb-5">
          {rows.map((row, idx) => {
            const groupId = row.propertyId;
            const cfg = (groupId && groupTotalsByGroupId[groupId]) || { enabled: true, position: 'bottom' };
            const mode = groupId ? getGroupMode(groupId, idx) : 'accordion';
            const columnCount = groupId ? getGroupColumnCount(groupId) : 3;
            return (
              <div key={row.uid} className="rounded-lg border border-black/10 dark:border-white/10 p-3 bg-black/[0.03] dark:bg-white/[0.03]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Niveau {idx + 1}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => moveRow(row.uid, -1)}
                      disabled={idx === 0}
                      className="px-2 py-1 rounded text-xs bg-black/5 dark:bg-white/5 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveRow(row.uid, 1)}
                      disabled={idx === rows.length - 1}
                      className="px-2 py-1 rounded text-xs bg-black/5 dark:bg-white/5 disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeRow(row.uid)}
                      className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-600 dark:text-red-300"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                <select
                  value={row.propertyId}
                  onChange={(e) => updateRowProperty(row.uid, e.target.value)}
                  className="w-full px-3 py-2 bg-gray-300 dark:bg-neutral-800/50 border border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="">Sélectionner un champ...</option>
                  {groupableProperties.map((prop: any) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.name}
                      {prop.isRelationLinkedColumn ? ' (lié)' : ''}
                    </option>
                  ))}
                </select>

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={mode}
                    onChange={(e) => {
                      if (!groupId) return;
                      const nextMode = e.target.value as TableGroupDisplayMode;
                      updateGroupMode(groupId, normalizeMode(nextMode));
                    }}
                    disabled={!groupId}
                    className="w-full px-3 py-2 bg-gray-300 dark:bg-neutral-800/50 border border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="accordion">Type: Chevron (accordéon)</option>
                    <option value="columns">Type: Colonnes</option>
                    <option value="tabs">Type: Onglets</option>
                  </select>

                  <select
                    value={String(columnCount)}
                    onChange={(e) => {
                      if (!groupId) return;
                      const raw = Number(e.target.value);
                      const nextCount: TableGroupColumnCount = raw === 1 || raw === 2 || raw === 3 ? raw : 3;
                      updateGroupColumnCount(groupId, nextCount);
                    }}
                    disabled={!groupId || mode !== 'columns'}
                    className="w-full px-3 py-2 bg-gray-300 dark:bg-neutral-800/50 border border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="1">Colonnes: 1</option>
                    <option value="2">Colonnes: 2</option>
                    <option value="3">Colonnes: 3</option>
                  </select>

                  <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200">
                    <input
                      type="checkbox"
                      checked={cfg.enabled !== false}
                      onChange={(e) => {
                        if (!groupId) return;
                        updateGroupTotalConfig(groupId, { enabled: e.target.checked });
                      }}
                      disabled={!groupId}
                    />
                    Afficher le total
                  </label>

                  <select
                    value={cfg.position === 'top' ? 'top' : cfg.position === 'both' ? 'both' : 'bottom'}
                    onChange={(e) => {
                      if (!groupId) return;
                      updateGroupTotalConfig(groupId, {
                        position:
                          e.target.value === 'top'
                            ? 'top'
                            : e.target.value === 'both'
                              ? 'both'
                              : 'bottom',
                      });
                    }}
                    disabled={!groupId || cfg.enabled === false}
                    className="w-full px-3 py-2 bg-gray-300 dark:bg-neutral-800/50 border border-white/10 rounded-lg text-neutral-700 dark:text-white focus:border-violet-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="bottom">Total en bas</option>
                    <option value="top">Total en haut</option>
                    <option value="both">Total en haut et en bas</option>
                  </select>
                </div>

                <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                  {mode === 'columns'
                    ? `Affichage en colonnes (${columnCount} colonne${columnCount > 1 ? 's' : ''}).`
                    : mode === 'tabs'
                      ? 'Affichage par onglets.'
                      : 'Affichage en accordéon (chevrons).'}
                </p>
              </div>
            );
          })}
        </div>

        <button onClick={addRow} className="w-full mb-5 px-4 py-2 rounded-lg border border-dashed border-black/20 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/5">
          + Ajouter un niveau
        </button>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg">
            Annuler
          </button>
          <ShinyButton onClick={handleSave} className="flex-1">
            Enregistrer
          </ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default GroupModal;
