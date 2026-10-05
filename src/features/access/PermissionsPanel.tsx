import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, FileUp, RefreshCw, RotateCcw, Trash2, Database, Zap, Plus, UserPlus } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AccessContext } from './panelTypes';
export type PermissionsPanelProps = { context: AccessContext };
export const PermissionsPanel = ({ context }: PermissionsPanelProps) => (
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white/5 rounded-xl border border-black/10 dark:border-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">Permissions</h4>
                  {context.loading && <span className="text-xs text-neutral-500">Chargement…</span>}
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-neutral-500">Rôles</div>
                  <button onClick={() => context.setCreatingRole(!context.creatingRole)} className="text-sm text-cyan-400 flex items-center gap-1">
                    <Plus size={14} /> Nouveau
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {context.roles.map((r: any) => (
                    <button
                      key={r.id}
                      className={`px-3 py-1.5 rounded-lg text-sm transition ${
                        context.selectedRoleId === r.id ? 'bg-cyan-500/20 text-black dark:text-white border border-cyan-500/40' : 'bg-white/5 text-neutral-500 dark:text-white'
                      }`}
                      onClick={() => context.setSelectedRoleId(r.id)}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
                <AnimatePresence>
                  {context.creatingRole && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2"
                    >
                      <input
                        className="bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
                        placeholder="Nom du rôle"
                        value={context.newRoleName}
                        onChange={(e) => context.setNewRoleName(e.target.value)}
                      />
                      <input
                        className="bg-white dark:bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm"
                        placeholder="Description (optionnel)"
                        value={context.newRoleDesc}
                        onChange={(e) => context.setNewRoleDesc(e.target.value)}
                      />
                      <ShinyButton onClick={context.createRole} className={context.busy ? 'opacity-60 pointer-events-none' : ''}>
                        <UserPlus size={14} /> Créer
                      </ShinyButton>
                    </motion.div>
                  )}
                </AnimatePresence>
                {context.selectedRoleId ? (
                  <Tabs value={context.permissionsTab} onValueChange={(v) => context.setPermissionsTab(v as any)} className="w-full">
                    <TabsList className="mb-3 w-full justify-start gap-2 bg-transparent p-0">
                      <TabsTrigger value="global" className="border border-black/10 dark:border-white/10">Global</TabsTrigger>
                      <TabsTrigger value="collections" className="border border-black/10 dark:border-white/10">Collections</TabsTrigger>
                      <TabsTrigger value="dashboards" className="border border-black/10 dark:border-white/10">Dashboards</TabsTrigger>
                    </TabsList>

                    <TabsContent value="global" className="mt-0 p-0 border-0">
                      <div className="space-y-4 max-h-[520px] overflow-auto pr-1">
                        {(() => {
                          const scope = { type: 'global', label: 'Global', collectionId: null, itemId: null, fieldId: null };
                          const perm = context.findPermission(context.selectedRoleId || '', scope) || {};
                          return (
                            <div key="global" className="bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 rounded-lg overflow-hidden">
                              <div className="px-4 py-3 bg-cyan-500/10 border-b border-cyan-500/20">
                                <div className="text-sm font-semibold">Global</div>
                                <div className="text-xs text-neutral-600 dark:text-white mt-0.5">Permissions appliquées à toutes les collections</div>
                              </div>
                              <div className="px-4 py-3">
                                <div className="text-xs font-medium text-neutral-600 dark:text-white mb-2">Paramètres global</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {context.flags.map((f: any) => {
                                    const isChecked = !!perm[f.key];
                                    return (
                                      <label
                                        key={f.key}
                                        className="flex items-center gap-2 text-xs text-neutral-500 dark:text-white hover:text-black cursor-pointer"
                                        title={f.hint}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => context.toggleFlag(context.selectedRoleId || '', scope, f.key, e.target.checked)}
                                          disabled={context.busy}
                                          className="cursor-pointer"
                                        />
                                        <span>{f.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </TabsContent>

                    <TabsContent value="collections" className="mt-0 p-0 border-0">
                      <div className="space-y-4 max-h-[520px] overflow-auto pr-1">
                        {context.collectionsWithProps.map((col: any) => {
                          const collectionScope = { type: 'collection', label: col.name, collectionId: col.id, itemId: null, fieldId: null };
                          const permCol = context.findPermission(context.selectedRoleId || '', collectionScope) || {};
                          const propertyFlags = context.flags.filter((f: any) => ['can_read', 'can_write', 'can_delete'].includes(f.key));

                          return (
                            <div key={col.id} className="bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 rounded-lg overflow-hidden">
                              <div className="px-4 py-3 bg-white/5 border-b border-black/10 dark:border-white/5">
                                <div className="text-sm font-semibold">{col.name}</div>
                                <div className="text-xs text-neutral-600 dark:text-white mt-0.5">Permissions de collection et propriétés</div>
                              </div>

                              <div className="px-4 py-3 border-b border-black/10 dark:border-white/5">
                                <div className="text-xs font-medium text-neutral-600 dark:text-white mb-2">Collection</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {context.flags.map((f: any) => {
                                    const isChecked = !!permCol[f.key];
                                    return (
                                      <label
                                        key={f.key}
                                        className="flex items-center gap-2 text-xs text-neutral-500 dark:text-white hover:text-black cursor-pointer"
                                        title={f.hint}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => context.toggleFlag(context.selectedRoleId || '', collectionScope, f.key, e.target.checked)}
                                          disabled={context.busy}
                                          className="cursor-pointer"
                                        />
                                        <span>{f.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="px-4 py-3">
                                <div className="text-xs font-medium text-neutral-600 dark:text-white mb-2">Propriétés (champs)</div>
                                {col.properties.length === 0 ? (
                                  <div className="text-xs text-neutral-500">Aucune propriété dans cette collection.</div>
                                ) : (
                                  <div className="space-y-2 max-h-56 overflow-auto pr-1">
                                    {col.properties.map((prop: any) => {
                                      const propScope = { type: 'property', label: prop.name, collectionId: col.id, itemId: null, fieldId: prop.id };
                                      const permProp = context.findPermission(context.selectedRoleId || '', propScope) || {};

                                      return (
                                        <div
                                          key={prop.id}
                                          className="flex items-center justify-between bg-white dark:bg-neutral-950/60 border border-black/10 dark:border-white/5 rounded-lg px-3 py-2"
                                        >
                                          <div>
                                            <div className="text-sm font-medium text-black dark:text-white">{prop.name}</div>
                                            <div className="text-xs text-neutral-500">{prop.type}</div>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            {propertyFlags.map((f: any) => {
                                              const isChecked = !!permProp[f.key];
                                              return (
                                                <label
                                                  key={f.key}
                                                  className="flex items-center gap-1 text-xs text-neutral-500 hover:text-black dark:text-white cursor-pointer"
                                                  title={`${f.label} ce champ`}
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => context.toggleFlag(context.selectedRoleId || '', propScope, f.key, e.target.checked)}
                                                    disabled={context.busy}
                                                    className="cursor-pointer"
                                                  />
                                                  <span>{f.label}</span>
                                                </label>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </TabsContent>

                    <TabsContent value="dashboards" className="mt-0 p-0 border-0">
                      <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                        {(context.dashboards || []).length === 0 && (
                          <p className="text-sm text-neutral-500">Aucun dashboard.</p>
                        )}
                        {(context.dashboards || []).map((db: any) => {
                          const checked = context.isDashboardVisibleForRole(db, context.selectedRoleId || '');
                          const restricted = (db?.visibleToRoles?.length || 0) > 0 || (db?.visibleToUsers?.length || 0) > 0;
                          return (
                            <div
                              key={db.id}
                              className="flex items-center justify-between bg-white dark:bg-neutral-900/70 border border-black/10 dark:border-white/5 rounded-lg px-3 py-2"
                            >
                              <div>
                                <div className="text-sm font-medium text-black dark:text-white">{db.name}</div>
                                <div className="text-xs text-neutral-500">
                                  {restricted ? 'Restreint par visibilité' : 'Visible pour tout le monde'}
                                </div>
                              </div>
                              <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-white cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => context.toggleDashboardVisibilityForRole(db.id, context.selectedRoleId || '', e.target.checked)}
                                  className="cursor-pointer"
                                />
                                <span>Visible pour ce rôle</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <p className="text-sm text-neutral-500">Sélectionnez un rôle pour éditer ses context.permissions.</p>
                )}
              </div>
            </div>
);
