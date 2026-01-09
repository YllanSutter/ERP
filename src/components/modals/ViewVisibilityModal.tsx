import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Users } from 'lucide-react';
import ShinyButton from '@/components/ShinyButton';

interface ViewVisibilityModalProps {
  view: any;
  roles: any[];
  users: any[];
  onSave: (roleIds: string[], userIds: string[]) => void;
  onClose: () => void;
}

const ViewVisibilityModal: React.FC<ViewVisibilityModalProps> = ({ view, roles, users, onSave, onClose }) => {
  const hasRestriction = (view?.visibleToRoles?.length || 0) > 0 || (view?.visibleToUsers?.length || 0) > 0;
  const [mode, setMode] = useState<'all' | 'custom'>(hasRestriction ? 'custom' : 'all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(view?.visibleToRoles || []);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(view?.visibleToUsers || []);

  useEffect(() => {
    const nextHasRestriction = (view?.visibleToRoles?.length || 0) > 0 || (view?.visibleToUsers?.length || 0) > 0;
    setMode(nextHasRestriction ? 'custom' : 'all');
    setSelectedRoles(view?.visibleToRoles || []);
    setSelectedUsers(view?.visibleToUsers || []);
  }, [view]);

  if (!view) return null;

  const toggleRole = (roleId: string) => {
    setMode('custom');
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const toggleUser = (userId: string) => {
    setMode('custom');
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = () => {
    if (mode === 'all') {
      onSave([], []);
    } else {
      onSave(selectedRoles, selectedUsers);
    }
  };

  const canSubmit = mode === 'all' || selectedRoles.length + selectedUsers.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur flex items-center justify-center z-[200] px-4">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg bg-neutral-900/90 border border-white/10 rounded-2xl shadow-2xl p-6 backdrop-blur"
      >
        <div className="flex items-center gap-3 mb-4">
          <Shield size={18} className="text-cyan-400" />
          <div>
            <h3 className="text-lg font-semibold">Visibilité de la vue</h3>
            <p className="text-sm text-neutral-500">{view.name}</p>
          </div>
        </div>

        <div className="space-y-4 mb-4">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:border-white/20 cursor-pointer">
            <input
              type="radio"
              className="accent-cyan-500"
              checked={mode === 'all'}
              onChange={() => setMode('all')}
            />
            <div>
              <div className="font-medium">Visible par tout le monde</div>
              <div className="text-sm text-neutral-500">Par défaut, tous les rôles peuvent ouvrir la vue.</div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-white/10 hover:border-white/20 cursor-pointer">
            <input
              type="radio"
              className="accent-cyan-500"
              checked={mode === 'custom'}
              onChange={() => setMode('custom')}
            />
            <div>
              <div className="font-medium">Limiter à certains rôles ou utilisateurs</div>
              <div className="text-sm text-neutral-500">La vue sera visible si le rôle OU l'utilisateur est autorisé.</div>
            </div>
          </label>
        </div>

        {mode === 'custom' && (
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 max-h-48 overflow-auto space-y-2">
              <div className="text-sm font-medium text-neutral-200 mb-1">Rôles autorisés</div>
              {roles.length === 0 && (
                <div className="text-sm text-neutral-500">Aucun rôle disponible.</div>
              )}
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="accent-cyan-500"
                    checked={selectedRoles.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-neutral-400" />
                    <span className="text-sm text-neutral-200">{role.name}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 max-h-48 overflow-auto space-y-2">
              <div className="text-sm font-medium text-neutral-200 mb-1">Utilisateurs autorisés</div>
              {users.length === 0 && (
                <div className="text-sm text-neutral-500">Aucun utilisateur chargé.</div>
              )}
              {users.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="accent-cyan-500"
                    checked={selectedUsers.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm text-neutral-200">{u.email || u.name || u.id}</span>
                    {u.name && <span className="text-xs text-neutral-500">{u.name}</span>}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {mode === 'custom' && selectedRoles.length + selectedUsers.length === 0 && (
          <p className="text-xs text-amber-400 mt-2">Sélectionnez au moins un rôle ou utilisateur pour ne pas masquer la vue à tout le monde.</p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition"
          >
            Annuler
          </button>
          <ShinyButton onClick={handleSave} className={!canSubmit ? 'opacity-60 pointer-events-none' : ''}>
            Enregistrer
          </ShinyButton>
        </div>
      </motion.div>
    </div>
  );
};

export default ViewVisibilityModal;
