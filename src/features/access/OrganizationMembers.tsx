import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import React, { useEffect, useState } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AccessContext } from './panelTypes';

type Person = { id: string; email: string; name?: string; role_ids?: string[]; role_names?: string[] };
type Role = { id: string; name: string };

const roleLabels: Record<string, string> = { admin: 'Administrateur', editor: 'Éditeur', viewer: 'Lecteur' };
const roleLabel = (role: Role) => roleLabels[role.name] || role.name;

export function OrganizationMembers({ context, organization }: { context: AccessContext; organization: { id: string; name: string } }) {
  const { API_URL, loadAll, activeOrganizationId } = context;
  const organizationId = organization.id;
  const [directory, setDirectory] = useState<{ members: Person[]; candidates: Person[]; roles: Role[] }>();
  const [candidateId, setCandidateId] = useState('');
  const [initialRoles, setInitialRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const request = async (path: string, method = 'GET', body?: object, signal?: AbortSignal) => {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: { 'Content-Type': 'application/json', 'X-Organization-Id': organizationId },
      body: body && JSON.stringify(body),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || 'Action impossible dans cette organisation.');
    return result;
  };

  const readDirectory = async (signal?: AbortSignal) => {
    const [members, candidates, roles] = await Promise.all([
      request('/organization/members', 'GET', undefined, signal),
      request('/organization/member-candidates', 'GET', undefined, signal),
      request('/roles', 'GET', undefined, signal),
    ]);
    return { members, candidates, roles };
  };

  useEffect(() => {
    const controller = new AbortController();
    void readDirectory(controller.signal).then((result) => {
      if (!controller.signal.aborted) setDirectory(result);
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [API_URL, organizationId]);

  const change = async (path: string, method: string, body?: object) => {
    setBusy(true);
    setError('');
    try {
      await request(path, method, body);
      if (path === '/organization/members') {
        setCandidateId('');
        setInitialRoles([]);
      }
      setDirectory(await readDirectory());
      if (organizationId === activeOrganizationId) await loadAll();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Action impossible dans cette organisation.');
    } finally {
      setBusy(false);
    }
  };

  const selectCandidate = (id: string) => {
    setCandidateId(id);
    const activeUser = context.selectableUsers.find((entry) => entry.id === id);
    const activeRoleIds = context.parseRoleIds(activeUser?.role_ids);
    const sourceNames = context.roles.filter((role) => activeRoleIds.includes(role.id)).map((role) => role.name);
    const candidate = directory?.candidates.find((entry) => entry.id === id);
    const names = sourceNames.length ? sourceNames : candidate?.role_names ?? [];
    const matching = directory?.roles.filter((role) => names.includes(role.name)) ?? [];
    setInitialRoles((matching.length ? matching : directory?.roles.filter((role) => role.name === 'viewer') ?? []).map((role) => role.id));
  };

  return (
    <section className="mt-2 space-y-2 border-t border-border pt-2">
      <h3 className="sr-only">Membres et rôles</h3>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!directory && !error && <p role="status" className="text-sm text-muted-foreground">Chargement des accès…</p>}
      {directory && (
        <>
          {directory.members.length === 0 && <p className="text-sm text-muted-foreground">Aucun membre.</p>}
          <ul className="divide-y divide-border rounded-lg border border-border">
            {directory.members.map((member) => (
              <li key={member.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 py-1">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="break-all text-sm font-medium">{member.email}{context.user?.id === member.id ? ' (vous)' : ''}</p>
                  <div role="group" aria-label={`Rôles de ${member.email}`} className="flex flex-wrap gap-1">
                    {directory.roles.map((role) => {
                      const assigned = Boolean(member.role_ids?.includes(role.id));
                      return (
                        <Button
                          key={role.id}
                          type="button"
                          size="sm"
                          variant={assigned ? 'secondary' : 'outline'}
                          aria-pressed={assigned}
                          disabled={busy}
                          onClick={() => void change('/user_roles', 'POST', { userId: member.id, roleId: role.id, action: assigned ? 'remove' : 'add' })}
                        >{roleLabel(role)}</Button>
                      );
                    })}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy || context.user?.id === member.id}
                  onClick={() => {
                    if (window.confirm(`Retirer ${member.email} de l’organisation ${organization.name} ?`)) {
                      void change(`/organization/members/${encodeURIComponent(member.id)}`, 'DELETE');
                    }
                  }}
                ><UserMinus /> Retirer</Button>
              </li>
            ))}
          </ul>

          {directory.candidates.length > 0 && (
            <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => {
              event.preventDefault();
              if (candidateId && initialRoles.length && !busy) {
                void change('/organization/members', 'POST', { userId: candidateId, roleIds: initialRoles });
              }
            }}>
              <label className="min-w-40 flex-1">
                <span className="sr-only">Ajouter un utilisateur</span>
                <Select value={candidateId} disabled={busy} onValueChange={(value) => selectCandidate(value)}>
                  <SelectTrigger aria-label="Ajouter un utilisateur" className="h-8 min-w-0 text-xs"><SelectValue placeholder="Sélectionner un utilisateur" /></SelectTrigger>
                  <SelectContent className="p-1">
                    {directory.candidates.map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              {candidateId && (
                <fieldset disabled={busy} className="flex flex-wrap gap-x-2 gap-y-1">
                  <legend className="sr-only">Rôles à attribuer</legend>
                  {directory.roles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 text-sm">
                      <Checkbox className="accent-brand-600" checked={initialRoles.includes(role.id)} onChange={(event) => {
                        const checked = event.target.checked;
                        setInitialRoles((previous) => checked ? [...previous, role.id] : previous.filter((id) => id !== role.id));
                      }} />
                      {roleLabel(role)}
                    </label>
                  ))}
                </fieldset>
              )}
              <Button type="submit" size="sm" disabled={busy || !candidateId || !initialRoles.length}><UserPlus /> Ajouter</Button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
