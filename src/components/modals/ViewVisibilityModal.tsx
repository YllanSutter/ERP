import React, { useEffect, useState } from 'react';
import { Shield, Users } from 'lucide-react';
import ModalWrapper, { FormRadioGroup, FormCheckbox } from '@/components/ui/ModalWrapper';

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
    if (mode === 'all') onSave([], []);
    else onSave(selectedRoles, selectedUsers);
  };

  const canSubmit = mode === 'all' || selectedRoles.length + selectedUsers.length > 0;

  const header = (
    <div className="flex items-center gap-3 mb-4">
      <Shield size={18} className="text-cyan-400" />
      <div>
        <h3 className="text-lg font-semibold">Visibilité de la vue</h3>
        <p className="text-sm text-neutral-500">{view.name}</p>
      </div>
    </div>
  );

  return (
    <ModalWrapper
      title={header}
      onClose={onClose}
      onSave={handleSave}
      canSave={canSubmit}
      className="w-full max-w-lg bg-neutral-900/90 border-white/10 p-6 shadow-2xl min-w-0"
    >
      <div className="space-y-4 mb-4">
        <FormRadioGroup
          value={mode}
          onChange={(v) => setMode(v as 'all' | 'custom')}
          accentClass="accent-cyan-500"
          options={[
            {
              value: 'all',
              label: 'Visible par tout le monde',
              description: 'Par défaut, tous les rôles peuvent ouvrir la vue.',
            },
            {
              value: 'custom',
              label: 'Limiter à certains rôles ou utilisateurs',
              description: "La vue sera visible si le rôle OU l'utilisateur est autorisé.",
            },
          ]}
        />
      </div>

      {mode === 'custom' && (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 max-h-48 overflow-auto space-y-2">
            <div className="text-sm font-medium text-neutral-600 dark:text-neutral-200 mb-1">Rôles autorisés</div>
            {roles.length === 0 && <div className="text-sm text-neutral-500">Aucun rôle disponible.</div>}
            {roles.map((role) => (
              <div key={role.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5">
                <FormCheckbox
                  label={
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-neutral-400" />
                      <span className="text-sm text-neutral-600 dark:text-neutral-200">{role.name}</span>
                    </div>
                  }
                  checked={selectedRoles.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                />
              </div>
            ))}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3 max-h-48 overflow-auto space-y-2">
            <div className="text-sm font-medium text-neutral-600 dark:text-neutral-200 mb-1">Utilisateurs autorisés</div>
            {users.length === 0 && <div className="text-sm text-neutral-500">Aucun utilisateur chargé.</div>}
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5">
                <FormCheckbox
                  label={
                    <div className="flex flex-col">
                      <span className="text-sm text-neutral-600 dark:text-neutral-200">{u.email || u.name || u.id}</span>
                      {u.name && <span className="text-xs text-neutral-500">{u.name}</span>}
                    </div>
                  }
                  checked={selectedUsers.includes(u.id)}
                  onChange={() => toggleUser(u.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'custom' && selectedRoles.length + selectedUsers.length === 0 && (
        <p className="text-xs text-amber-400 mt-2">Sélectionnez au moins un rôle ou utilisateur pour ne pas masquer la vue à tout le monde.</p>
      )}
    </ModalWrapper>
  );
};

export default ViewVisibilityModal;
