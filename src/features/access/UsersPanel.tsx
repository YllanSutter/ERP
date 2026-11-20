import { Checkbox } from '@/components/ui/checkbox';
import React from 'react';
import { Clock3, KeyRound, Palette, Search, ShieldCheck, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SettingsSection } from '@/components/ui/settings-panel';
import type { AccessContext } from './panelTypes';

const selectClass = 'h-8 min-w-0 bg-background';
const fieldClass = 'settings-label grid min-w-0 gap-1';
const timeFields = [
  ['workStart', 'Début de journée'],
  ['workEnd', 'Fin de journée'],
  ['breakStart', 'Début de pause'],
  ['breakEnd', 'Fin de pause'],
] as const;

export const UsersPanel = ({ context }: { context: AccessContext }) => {
  const selected = context.selectedPreferencesUser;
  const preferences = context.selectedPreferencesDraft;
  const isMember = Boolean(selected && context.memberIds.has(selected.id));
  const roleNamesFor = (entry: any): string[] => context.parseRoleIds(entry.role_ids)
    .map((id: string) => context.roles.find(role => role.id === id)?.name)
    .filter((name: unknown): name is string => typeof name === 'string');
  const roleBadges = (entry: any) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {entry.is_site_admin && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200"><ShieldCheck size={12} aria-hidden="true" />Super administrateur</span>}
      {roleNamesFor(entry).map(name => <span key={name} className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-700 dark:text-brand-300">{name === 'admin' ? 'Administrateur' : name === 'viewer' ? 'Lecture seule' : name}</span>)}
      {context.memberIds.has(entry.id) && roleNamesFor(entry).length === 0 && <span className="text-xs text-muted-foreground">Aucun rôle attribué</span>}
      {!context.memberIds.has(entry.id) && <span className="text-xs text-muted-foreground">Hors organisation</span>}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="relative min-w-48 flex-1 sm:max-w-sm">
          <span className="sr-only">Rechercher un utilisateur</span>
          <Search size={15} className="pointer-events-none absolute left-2 top-2 text-muted-foreground" aria-hidden="true" />
          <Input className="h-8 pl-8" placeholder="Rechercher par e-mail ou rôle…" value={context.userQuery} onChange={(event) => context.setUserQuery(event.target.value)} />
        </label>
        <p className="text-xs text-muted-foreground">{context.members.length} membre(s) · {context.selectableUsers.length} compte(s)</p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
          <span>Utilisateur</span><span>Rôles dans l’organisation active</span>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-border">
          {context.filteredUsers.map(entry => (
            <button key={entry.id} type="button" aria-pressed={context.selectedPreferencesUserId === entry.id}
              onClick={() => context.setSelectedPreferencesUserId(entry.id)}
              className={`grid w-full gap-2 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-3 ${context.selectedPreferencesUserId === entry.id ? 'bg-brand-500/10' : 'hover:bg-muted/50'}`}>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-medium"><span className="truncate">{entry.name || entry.email}</span>{entry.id === context.user?.id && <span className="shrink-0 text-xs text-brand-600 dark:text-brand-300">Vous</span>}</span>
                {entry.name && <span className="block truncate text-xs text-muted-foreground">{entry.email}</span>}
              </span>
              {roleBadges(entry)}
            </button>
          ))}
          {context.filteredUsers.length === 0 && <p className="px-3 py-5 text-sm text-muted-foreground">Aucun utilisateur ne correspond à la recherche.</p>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Sélectionnez un compte pour afficher ses préférences. Le super administrateur est le compte principal du site.</p>
      {selected && (
        <div className="space-y-2">
          <section className="rounded-lg border border-brand-500/25 bg-brand-500/5 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <UserRound size={17} className="shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
              <h3 className="break-all font-semibold">{selected.email}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{isMember ? 'Membre' : 'Hors organisation'}</span>
              {context.isSelf && <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-700 dark:text-brand-300">Vous</span>}
            </div>
            <div className="mt-2">{roleBadges(selected)}</div>
            {selected.is_site_owner && <p className="mt-2 text-xs text-muted-foreground">Compte principal : ce statut ne peut pas être retiré.</p>}
            {selected.is_site_admin && <p className="mt-2 text-xs text-muted-foreground">Super administrateur : import/export global et sauvegardes de la base complète.</p>}
          </section>

          {context.canManageSiteAdmins && (
            <SettingsSection title="Droits globaux" icon={ShieldCheck}>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  className="size-4 accent-brand-600"
                  checked={Boolean(selected.is_site_admin)}
                  disabled={context.busy || Boolean(selected.is_site_owner)}
                  onChange={(event) => context.updateUserSiteAdmin(selected.id, event.target.checked)}
                />
                Super administrateur
              </label>
              <p className="mt-1 text-xs text-muted-foreground">Donne accès aux opérations globales du site. Seul un super administrateur peut modifier ce statut.</p>
            </SettingsSection>
          )}

          <SettingsSection title="Sécurité du compte" icon={KeyRound}>
            <div className="flex flex-wrap items-center gap-2">
              {context.isLocal && (
                <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:min-w-64 sm:flex-1">
                  <label className="min-w-36 flex-1 sm:max-w-sm">
                    <span className="sr-only">Nouveau mot de passe</span>
                    <Input className="h-8" type="password" placeholder="Nouveau mot de passe" autoComplete="new-password" value={context.passwordInputs[selected.id] || ''} onChange={(event) => context.setPasswordInputs((previous) => ({ ...previous, [selected.id]: event.target.value }))} disabled={context.busy} />
                  </label>
                  <Button type="button" size="sm" variant="outline" disabled={context.busy || !context.passwordInputs[selected.id]?.trim()} onClick={() => context.updateUserPassword(selected.id)}>Modifier le mot de passe</Button>
                </div>
              )}
              <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700 dark:text-red-400" disabled={context.busy || context.isSelf} onClick={() => context.deleteUser(selected.id, selected.email)}>Supprimer le compte</Button>
            </div>
          </SettingsSection>

          <div>
            {!isMember && <p className="mb-2 text-sm text-muted-foreground">Ajoutez cet utilisateur à l’organisation pour modifier ses préférences.</p>}
            <fieldset disabled={!isMember} className="grid min-w-0 gap-2 lg:grid-cols-2">
              <legend className="sr-only">Préférences et horaires</legend>
              <SettingsSection title="Préférences d’interface" icon={Palette}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className={fieldClass}>
                    Densité
                    <Select disabled={!isMember} value={preferences.density} onValueChange={(value) => context.updateUserPreferencesDraft(selected.id, { density: value })}>
                      <SelectTrigger className={selectClass} aria-label="Densité"><SelectValue /></SelectTrigger>
                      <SelectContent className="p-1">
                        <SelectItem value="compact">Compacte</SelectItem>
                        <SelectItem value="comfortable">Confort</SelectItem>
                        <SelectItem value="spacious">Aérée</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className={fieldClass}>
                    Début de semaine
                    <Select disabled={!isMember} value={preferences.weekStartsOn} onValueChange={(value) => context.updateUserPreferencesDraft(selected.id, { weekStartsOn: value })}>
                      <SelectTrigger className={selectClass} aria-label="Début de semaine"><SelectValue /></SelectTrigger>
                      <SelectContent className="p-1">
                        <SelectItem value="monday">Lundi</SelectItem>
                        <SelectItem value="sunday">Dimanche</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className={fieldClass}>Fuseau horaire
                    <Input className="h-8" placeholder="Europe/Paris" value={preferences.timezone} onChange={(event) => context.updateUserPreferencesDraft(selected.id, { timezone: event.target.value })} />
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:self-end sm:pb-1.5">
                    <Checkbox className="size-4 accent-brand-600" checked={preferences.notificationsEnabled} onChange={(event) => context.updateUserPreferencesDraft(selected.id, { notificationsEnabled: event.target.checked })} />
                    Notifications par défaut
                  </label>
                </div>
              </SettingsSection>
              <SettingsSection title="Horaires de travail" icon={Clock3}>
                <div className="grid grid-cols-2 gap-2">
                  {timeFields.map(([key, label]) => (
                    <label key={key} className={fieldClass}>{label}
                      <Input className="h-8 min-w-0" type="time" value={preferences[key]} onChange={(event) => context.updateUserPreferencesDraft(selected.id, { [key]: event.target.value })} />
                    </label>
                  ))}
                </div>
              </SettingsSection>
            </fieldset>
          </div>
        </div>
      )}
    </div>
  );
};
