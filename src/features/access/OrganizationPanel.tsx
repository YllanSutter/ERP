import React from 'react';
import { Download, Trash2, Database, RotateCcw, RefreshCw, Save, Zap, FileUp, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PluginManagerUI } from '@/components/admin/PluginManager';
import type { AccessContext } from './panelTypes';
export type OrganizationPanelProps = { context: AccessContext };
export const OrganizationPanel = ({ context }: OrganizationPanelProps) => (
<>
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl border border-black/10 dark:border-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Organisations</h4>
                  <span className="text-xs text-neutral-500">{(context.organizations || []).length} total</span>
                </div>

                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {(context.organizations || []).length === 0 && (
                    <p className="text-sm text-neutral-500">Aucune organisation.</p>
                  )}
                  {(context.organizations || []).map((org: any) => {
                    const orgId = String(org?.id || '');
                    const isActive = context.activeOrganizationId === orgId;
                    return (
                      <div key={orgId} className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900/70 p-2">
                        <div className="flex items-center gap-2">
                          <input
                            className="flex-1 bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs"
                            value={context.organizationNameEdits[orgId] ?? String(org?.name || '')}
                            onChange={(e) => context.setOrganizationNameEdits((prev) => ({ ...prev, [orgId]: e.target.value }))}
                            disabled={context.busy}
                          />
                          <button
                            type="button"
                            className="px-2 py-1.5 rounded bg-cyan-600 hover:bg-cyan-700 text-white text-xs disabled:opacity-60"
                            onClick={() => context.renameOrganization(orgId)}
                            disabled={context.busy || !orgId}
                            title="Renommer"
                          >
                            <Save size={12} />
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs disabled:opacity-60"
                            onClick={() => context.deleteOrganization(orgId, String(org?.name || orgId))}
                            disabled={context.busy || !orgId}
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
                  <button onClick={context.reloadBackups} className="p-2 rounded-lg hover:bg-white/10 text-neutral-600 dark:text-white" title="Rafraîchir">
                    <RefreshCw size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    className="flex-1 bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
                    placeholder="Label (optionnel)"
                    value={context.backupLabel}
                    onChange={(e) => context.setBackupLabel(e.target.value)}
                  />
                  <button
                    onClick={context.createBackup}
                    className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs shadow disabled:opacity-60"
                    disabled={context.backupBusy}
                  >
                    Créer
                  </button>
                  <button
                    onClick={context.reloadBackups}
                    className="px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-xs"
                  >
                    Reload
                  </button>
                </div>
                <div className="space-y-2 max-h-60 overflow-auto">
                  {context.visibleBackups.length === 0 && <p className="text-sm text-neutral-500">Aucune sauvegarde.</p>}
                  {context.visibleBackups.map((b) => (
                    <div key={b.name} className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 p-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{b.name}</div>
                        <div className="text-xs text-neutral-500">
                          {context.formatBytes(b.size)} · {new Date(b.createdAt).toLocaleString('fr-FR')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-600"
                          onClick={() => context.restoreBackup(b.name)}
                          title="Restaurer"
                          disabled={context.backupBusy}
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          className="p-2 rounded-lg hover:bg-white/10 text-neutral-600 dark:text-white"
                          onClick={() => context.downloadBackup(b.name)}
                          title="Télécharger"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="p-2 rounded-lg hover:bg-red-500/10 text-red-600"
                          onClick={() => context.deleteBackup(b.name)}
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {context.sortedBackups.length > 10 && (
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
                  const orgId = context.activeOrganizationId || 'default';
                  const props = context.collections[0]?.properties || [];
                  return <PluginManagerUI organizationId={orgId} collectionProperties={props} collections={context.collections} />;
                })()}
              </div>

            </div>



</>
);
