import React from 'react';
import { Download, Trash2, Database, RotateCcw, RefreshCw, Save, Zap, FileUp, X, Search, Palette, CheckCircle2, BellRing, Clock3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PluginManagerUI } from '@/components/admin/PluginManager';
import type { AccessContext } from './panelTypes';
export type UsersPanelProps = { context: AccessContext };
export const UsersPanel = ({ context }: UsersPanelProps) => (
<>
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
                    {context.selectableUsers.length} utilisateur(s)
                  </span>
                  <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    {context.members.length} membre(s) orga
                  </span>
                  <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    {Math.max(context.selectableUsers.length - context.members.length, 0)} hors orga
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
                        value={context.selectedPreferencesUserId}
                        onChange={(e) => context.setSelectedPreferencesUserId(e.target.value)}
                      >
                        {context.filteredUsers.map((u) => (
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
                          value={context.userQuery}
                          onChange={(e) => context.setUserQuery(e.target.value)}
                        />
                      </div>
                    </div>

                  
                  </div>

                  {context.selectableUsers.length > 0 && context.filteredUsers.length === 0 && (
                    <p className="text-xs text-neutral-500 mt-2">Aucun résultat pour cette recherche.</p>
                  )}
                </div>

                {context.selectableUsers.length === 0 && <p className="text-sm text-neutral-500">Aucun utilisateur.</p>}

                {context.selectedPreferencesUser && (() => {
                  const roleIds = context.parseRoleIds(context.selectedPreferencesUser.role_ids);
                  const userRoles = context.roles.filter((r) => roleIds.includes(r.id));
                  const availableRoles = context.roles.filter((r) => !userRoles.some((ur) => ur.id === r.id));
                  const isLocal = !context.selectedPreferencesUser.provider || context.selectedPreferencesUser.provider === 'local';
                  const isSelf = context.user?.id === context.selectedPreferencesUser.id;
                  const isMember = context.memberIds.has(context.selectedPreferencesUser.id);

                  return (
                    <div className="grid grid-cols-1 xl:grid-cols-1 gap-3">
                      <div className="rounded-lg bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div>
                            <div className="font-medium break-all">{context.selectedPreferencesUser.email}</div>
                            <div className="text-xs text-neutral-500 mt-0.5">{context.selectedPreferencesUser.provider || 'local'}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-0.5 text-xs rounded-full border ${isMember ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' : 'bg-neutral-500/10 text-neutral-700 dark:text-neutral-300 border-neutral-500/30'}`}>
                              {isMember ? 'Membre orga' : 'Hors orga'}
                            </span>
                            {context.isSelf && (
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
                                onClick={() => context.assignRole(context.selectedPreferencesUser.id, r.id, 'remove')}
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
                                onClick={() => context.assignRole(context.selectedPreferencesUser.id, r.id, 'add')}
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
                              onClick={() => context.removeMember(context.selectedPreferencesUser.id, context.selectedPreferencesUser.email)}
                              disabled={context.membersBusy || context.isSelf}
                              title={context.isSelf ? 'Vous ne pouvez pas vous retirer vous-même.' : 'Retirer de l’organisation'}
                            >
                              Retirer de l’organisation
                            </button>
                          ) : (
                            <button
                              className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-50"
                              onClick={() => context.addMember(context.selectedPreferencesUser.id, context.selectedPreferencesUser.email)}
                              disabled={context.membersBusy}
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
                            placeholder={context.isLocal ? 'Nouveau mot de passe' : 'Mdp non disponible (SSO)'}
                            value={context.passwordInputs[context.selectedPreferencesUser.id] || ''}
                            onChange={(e) =>
                              context.setPasswordInputs((prev) => ({ ...prev, [context.selectedPreferencesUser.id]: e.target.value }))
                            }
                            disabled={!context.isLocal || context.busy}
                          />
                          <button
                            className="text-xs px-3 py-2 rounded-lg bg-cyan-500/20 text-black dark:text-white border border-cyan-500/40 whitespace-nowrap"
                            onClick={() => context.updateUserPassword(context.selectedPreferencesUser.id)}
                            disabled={!context.isLocal || context.busy || !(context.passwordInputs[context.selectedPreferencesUser.id] || '').trim()}
                          >
                            Modifier
                          </button>
                        </div>

                        <button
                          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-white border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
                          onClick={() => context.deleteUser(context.selectedPreferencesUser.id, context.selectedPreferencesUser.email)}
                          disabled={context.busy || context.isSelf}
                          title={context.isSelf ? 'Impossible de supprimer votre propre compte.' : 'Supprimer le compte'}
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

                    {context.selectedPreferencesUser && (
                      <div className="text-xs text-neutral-500 mb-3">
                        Configuration de <span className="font-medium text-black dark:text-white">{context.selectedPreferencesUser.email}</span>
                      </div>
                    )}

                    {context.selectedPreferencesUser && !context.memberIds.has(context.selectedPreferencesUser.id) && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                        Ajoutez cet utilisateur à l’organisation pour modifier ses options.
                      </p>
                    )}

                    <button
                      className="w-full mb-3 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs disabled:opacity-60 flex items-center justify-center gap-2"
                      onClick={() => context.saveUserPreferences(context.selectedPreferencesUserId)}
                      disabled={!context.selectedPreferencesUserId || !!context.preferencesBusyByUser[context.selectedPreferencesUserId] || !context.selectedPreferencesUser || !context.memberIds.has(context.selectedPreferencesUser.id)}
                    >
                      {context.preferencesBusyByUser[context.selectedPreferencesUserId] ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" /> Sauvegarde…
                        </>
                      ) : (
                        <>
                          <Save size={14} /> Sauvegarder les options UI
                        </>
                      )}
                    </button>

                    {context.selectedPreferencesUserId && !!context.preferencesSavedAtByUser[context.selectedPreferencesUserId] && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-300 mb-3 flex items-center gap-1">
                        <CheckCircle2 size={13} />
                        Dernière sauvegarde à {new Date(context.preferencesSavedAtByUser[context.selectedPreferencesUserId]).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}

                    <label className="block text-xs text-neutral-500 mb-1">Couleur d’accent</label>
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="color"
                        value={context.selectedPreferencesDraft.accentColor}
                        onChange={(e) => context.updateUserPreferencesDraft(context.selectedPreferencesUserId, { accentColor: e.target.value })}
                        className="h-9 w-12 rounded border border-white/10 bg-transparent"
                        disabled={!context.selectedPreferencesUserId || !context.selectedPreferencesUser || !context.memberIds.has(context.selectedPreferencesUser.id)}
                      />
                      <input
                        value={context.selectedPreferencesDraft.accentColor}
                        onChange={(e) => context.updateUserPreferencesDraft(context.selectedPreferencesUserId, { accentColor: e.target.value })}
                        className="flex-1 bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                        disabled={!context.selectedPreferencesUserId || !context.selectedPreferencesUser || !context.memberIds.has(context.selectedPreferencesUser.id)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Densité</label>
                        <select
                          value={context.selectedPreferencesDraft.density}
                          onChange={(e) => context.updateUserPreferencesDraft(context.selectedPreferencesUserId, { density: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                          disabled={!context.selectedPreferencesUserId || !context.selectedPreferencesUser || !context.memberIds.has(context.selectedPreferencesUser.id)}
                        >
                          <option value="compact">Compacte</option>
                          <option value="comfortable">Confort</option>
                          <option value="spacious">Aérée</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Début de semaine</label>
                        <select
                          value={context.selectedPreferencesDraft.weekStartsOn}
                          onChange={(e) => context.updateUserPreferencesDraft(context.selectedPreferencesUserId, { weekStartsOn: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                          disabled={!context.selectedPreferencesUserId || !context.selectedPreferencesUser || !context.memberIds.has(context.selectedPreferencesUser.id)}
                        >
                          <option value="monday">Lundi</option>
                          <option value="sunday">Dimanche</option>
                        </select>
                      </div>
                    </div>

                    <label className="block text-xs text-neutral-500 mb-1">Fuseau horaire</label>
                    <input
                      value={context.selectedPreferencesDraft.timezone}
                      onChange={(e) => context.updateUserPreferencesDraft(context.selectedPreferencesUserId, { timezone: e.target.value })}
                      className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs mb-3"
                      placeholder="Europe/Paris"
                      disabled={!context.selectedPreferencesUserId || !context.selectedPreferencesUser || !context.memberIds.has(context.selectedPreferencesUser.id)}
                    />

                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={context.selectedPreferencesDraft.notificationsEnabled}
                        onChange={(e) => context.updateUserPreferencesDraft(context.selectedPreferencesUserId, { notificationsEnabled: e.target.checked })}
                        disabled={!context.selectedPreferencesUserId || !context.selectedPreferencesUser || !context.memberIds.has(context.selectedPreferencesUser.id)}
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

                    {context.selectedPreferencesUser && !context.memberIds.has(context.selectedPreferencesUser.id) && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                        Ajoutez cet utilisateur à l’organisation pour modifier ses horaires.
                      </p>
                    )}

                    <button
                      className="w-full mb-3 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs disabled:opacity-60 flex items-center justify-center gap-2"
                      onClick={() => context.saveUserPreferences(context.selectedPreferencesUserId)}
                      disabled={!context.selectedPreferencesUserId || !!context.preferencesBusyByUser[context.selectedPreferencesUserId] || !context.selectedPreferencesUser || !context.memberIds.has(context.selectedPreferencesUser.id)}
                    >
                      {context.preferencesBusyByUser[context.selectedPreferencesUserId] ? (
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
                          value={context.selectedPreferencesDraft.workStart}
                          onChange={(e) => context.updateUserPreferencesDraft(context.selectedPreferencesUserId, { workStart: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                          disabled={!context.selectedPreferencesUserId || !context.selectedPreferencesUser || !context.memberIds.has(context.selectedPreferencesUser.id)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Fin</label>
                        <input
                          type="time"
                          value={context.selectedPreferencesDraft.workEnd}
                          onChange={(e) => context.updateUserPreferencesDraft(context.selectedPreferencesUserId, { workEnd: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                          disabled={!context.selectedPreferencesUserId || !context.selectedPreferencesUser || !context.memberIds.has(context.selectedPreferencesUser.id)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Pause début</label>
                        <input
                          type="time"
                          value={context.selectedPreferencesDraft.breakStart}
                          onChange={(e) => context.updateUserPreferencesDraft(context.selectedPreferencesUserId, { breakStart: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                          disabled={!context.selectedPreferencesUserId || !context.selectedPreferencesUser || !context.memberIds.has(context.selectedPreferencesUser.id)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500 mb-1">Pause fin</label>
                        <input
                          type="time"
                          value={context.selectedPreferencesDraft.breakEnd}
                          onChange={(e) => context.updateUserPreferencesDraft(context.selectedPreferencesUserId, { breakEnd: e.target.value })}
                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-2 py-2 text-xs"
                          disabled={!context.selectedPreferencesUserId || !context.selectedPreferencesUser || !context.memberIds.has(context.selectedPreferencesUser.id)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

</>
);
