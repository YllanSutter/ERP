import { Checkbox } from '@/components/ui/checkbox';
import React from 'react';
import { Clock3, KeyRound, Palette, Search, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AccessContext } from './panelTypes';

const selectClass = 'h-8 min-w-0 bg-background';
const fieldClass = 'grid min-w-0 gap-1 text-sm font-medium text-foreground';
const panelClass = 'min-w-0 overflow-hidden rounded-lg border border-border bg-card';
const headingClass = 'flex items-center gap-2 border-b border-border bg-muted/60 px-3 py-1.5 text-sm font-semibold [&_svg]:text-brand-700 dark:[&_svg]:text-brand-300';
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

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className="sr-only">Rechercher un utilisateur</span>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-2 top-2 text-muted-foreground" aria-hidden="true" />
            <Input className="h-8 pl-8" placeholder="E-mail, type de connexion ou rôle" value={context.userQuery} onChange={(event) => context.setUserQuery(event.target.value)} />
          </div>
        </label>
        <Select value={context.selectedPreferencesUserId} onValueChange={context.setSelectedPreferencesUserId} disabled={!context.filteredUsers.length}>
          <SelectTrigger aria-label="Utilisateur" className={selectClass}>
            <SelectValue placeholder="Sélectionner un utilisateur">{selected?.email}</SelectValue>
          </SelectTrigger>
          <SelectContent className="p-1">
            {context.filteredUsers.map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">{context.members.length} membre(s) de l’organisation · {context.selectableUsers.length} utilisateur(s) au total</p>
      {context.filteredUsers.length === 0 && <p className="text-sm text-muted-foreground">Aucun utilisateur ne correspond à la recherche.</p>}
      {selected && (
        <div className="space-y-2">
          <section className="rounded-lg border border-brand-500/25 bg-brand-500/5 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <UserRound size={17} className="shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
              <h3 className="break-all font-semibold">{selected.email}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{isMember ? 'Membre' : 'Hors organisation'}</span>
              {context.isSelf && <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs text-brand-700 dark:text-brand-300">Vous</span>}
            </div>
          </section>

          <section className={panelClass}>
            <h3 className={headingClass} title={`Connexion : ${selected.provider || 'locale'}`}><KeyRound size={15} aria-hidden="true" /> Sécurité du compte</h3>
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
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
          </section>

          <div>
            {!isMember && <p className="mb-2 text-sm text-muted-foreground">Ajoutez cet utilisateur à l’organisation pour modifier ses préférences.</p>}
            <fieldset disabled={!isMember} className="grid min-w-0 gap-2 lg:grid-cols-2">
              <legend className="sr-only">Préférences et horaires</legend>
              <section className={panelClass}>
                <h3 className={headingClass}><Palette size={15} aria-hidden="true" /> Préférences d’interface</h3>
                <div className="grid gap-2 px-3 py-2 sm:grid-cols-2">
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
              </section>
              <section className={panelClass}>
                <h3 className={headingClass}><Clock3 size={15} aria-hidden="true" /> Horaires de travail</h3>
                <div className="grid grid-cols-2 gap-2 px-3 py-2">
                  {timeFields.map(([key, label]) => (
                    <label key={key} className={fieldClass}>{label}
                      <Input className="h-8 min-w-0" type="time" value={preferences[key]} onChange={(event) => context.updateUserPreferencesDraft(selected.id, { [key]: event.target.value })} />
                    </label>
                  ))}
                </div>
              </section>
            </fieldset>
          </div>
        </div>
      )}
    </div>
  );
};
