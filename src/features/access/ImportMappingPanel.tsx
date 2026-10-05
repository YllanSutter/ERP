import React from 'react';
import { Download, Trash2, Database, RotateCcw, RefreshCw, Save, Zap, FileUp, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PluginManagerUI } from '@/components/admin/PluginManager';
import type { AccessContext } from './panelTypes';
export type ImportMappingPanelProps = { context: AccessContext };
export const ImportMappingPanel = ({ context }: ImportMappingPanelProps) => (

            <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center px-4">
              <div className="w-full max-w-6xl max-h-[88vh] overflow-hidden rounded-xl border border-white/10 bg-white dark:bg-neutral-950 shadow-2xl flex flex-col">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
                  <div>
                    <h4 className="font-semibold">Prévisualisation & remapping import</h4>
                    <p className="text-xs text-neutral-500">Vous pouvez tout ajuster à la main avant création des organisations.</p>
                    <p className="text-[11px] mt-1 text-neutral-500">
                      {context.importMappingDiagnostics.errors.length} erreur(s) · {context.importMappingDiagnostics.warnings.length} avertissement(s)
                    </p>
                  </div>
                  <button
                    className="p-2 rounded hover:bg-white/10"
                    onClick={() => {
                      if (context.importCommitBusy) return;
                      context.setShowImportMapper(false);
                    }}
                    disabled={context.importCommitBusy}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-4">
                  <Tabs
                    value={context.importMapperTab}
                    onValueChange={(value) => context.setImportMapperTab(value as 'mapping' | 'diagnostics')}
                    className="space-y-4"
                  >
                    <TabsList className="grid w-full grid-cols-2 h-auto gap-2 bg-transparent p-0">
                      <TabsTrigger value="mapping" className="border border-cyan-500/30 data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                        Mapping manuel
                      </TabsTrigger>
                      <TabsTrigger value="diagnostics" className="border border-amber-500/30 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                        Diagnostics ({context.importMappingDiagnostics.errors.length} / {context.importMappingDiagnostics.warnings.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="diagnostics" className="mt-0 space-y-3">
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                        <div className="text-xs text-neutral-700 dark:text-neutral-300 mb-2">
                          Corrigez d’abord les erreurs bloquantes, puis utilisez l’import final.
                        </div>
                        {context.importMappingDiagnostics.errors.length > 0 && (
                          <div className="mb-2">
                            <div className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Erreurs bloquantes</div>
                            <ul className="list-disc pl-5 space-y-1 text-xs text-red-800 dark:text-red-200">
                              {context.importMappingDiagnostics.errors.map((msg, idx) => (
                                <li key={`import-error-${idx}`}>{msg}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {context.importMappingDiagnostics.warnings.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Avertissements</div>
                            <ul className="list-disc pl-5 space-y-1 text-xs text-amber-900 dark:text-amber-200">
                              {context.importMappingDiagnostics.warnings.map((msg, idx) => (
                                <li key={`import-warning-${idx}`}>{msg}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {context.importMappingDiagnostics.errors.length === 0 && context.importMappingDiagnostics.warnings.length === 0 && (
                          <div className="text-xs text-emerald-700 dark:text-emerald-300">Aucun problème détecté. Import prêt.</div>
                        )}
                      </div>

                      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                        <div className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 mb-2">
                          Relations détectées ({context.importRelationSummary.length})
                        </div>
                        {context.importRelationSummary.length === 0 ? (
                          <div className="text-xs text-neutral-600 dark:text-neutral-300">Aucune relation détectée pour le moment.</div>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-auto pr-1">
                            {context.importRelationSummary.map((rel, idx) => (
                              <div key={`rel-summary-${idx}`} className="flex flex-wrap items-center gap-2 justify-between bg-white/40 dark:bg-white/5 rounded px-2 py-1.5">
                                <div className="text-xs text-neutral-700 dark:text-neutral-200">
                                  <span className="font-medium">{rel.collectionName}</span>
                                  <span className="mx-1">·</span>
                                  <span>{rel.fieldName}</span>
                                  <span className="mx-1">→</span>
                                  <span className="font-medium">{rel.targetName}</span>
                                  <span className="mx-1">({rel.relationType})</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <select
                                    className="px-2 py-1 rounded text-[11px] bg-white dark:bg-neutral-900 border border-white/20"
                                    value={context.relationChoiceFieldByKey[`${rel.orgIdx}:${rel.colIdx}:${rel.propIdx}`] || rel.targetFields[0]?.id || ''}
                                    onChange={(e) => {
                                      const key = `${rel.orgIdx}:${rel.colIdx}:${rel.propIdx}`;
                                      context.setRelationChoiceFieldByKey((prev) => ({ ...prev, [key]: e.target.value }));
                                    }}
                                    disabled={context.importCommitBusy || rel.targetFields.length === 0}
                                    title="Champ utilisé pour générer les options du select"
                                  >
                                    {rel.targetFields.map((f) => (
                                      <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded text-[11px] bg-white/70 dark:bg-white/10 border border-white/20 hover:bg-white"
                                    onClick={() => {
                                      const key = `${rel.orgIdx}:${rel.colIdx}:${rel.propIdx}`;
                                      const selectedFieldId = context.relationChoiceFieldByKey[key] || rel.targetFields[0]?.id;
                                      context.convertRelationToChoiceField(rel.orgIdx, rel.colIdx, rel.propIdx, 'select', selectedFieldId, false);
                                    }}
                                    disabled={context.importCommitBusy}
                                    title="Convertir en select (liste simple)"
                                  >
                                    → select
                                  </button>
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded text-[11px] bg-white/70 dark:bg-white/10 border border-white/20 hover:bg-white"
                                    onClick={() => {
                                      const key = `${rel.orgIdx}:${rel.colIdx}:${rel.propIdx}`;
                                      const selectedFieldId = context.relationChoiceFieldByKey[key] || rel.targetFields[0]?.id;
                                      context.convertRelationToChoiceField(rel.orgIdx, rel.colIdx, rel.propIdx, 'multi_select', selectedFieldId, false);
                                    }}
                                    disabled={context.importCommitBusy}
                                    title="Convertir en multi_select (liste multiple)"
                                  >
                                    → multi
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {context.deletedImportProperties.length > 0 && (
                        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                          <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">Champs supprimés ({context.deletedImportProperties.length})</div>
                          <div className="space-y-2">
                            {context.deletedImportProperties.map((deleted: any, idx: number) => (
                              <div key={`deleted-${idx}`} className="flex items-center justify-between gap-2 p-2 bg-white/30 dark:bg-white/5 rounded text-xs">
                                <div>
                                  <span className="font-medium">{deleted.property?.name || 'Sans nom'}</span>
                                  <span className="text-neutral-500 ml-2">({deleted.property?.type})</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    context.patchImportPreviewOrganizations((draft) => {
                                      const collection = draft?.[deleted.orgIndex]?.state?.collections?.[deleted.collectionIndex];
                                      if (collection && Array.isArray(collection.properties)) {
                                        collection.properties.splice(deleted.propertyIndex, 0, deleted.property);
                                      }
                                    });
                                    context.setDeletedImportProperties((prev) => prev.filter((_, i) => i !== idx));
                                  }}
                                  className="px-2 py-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                                >
                                  Restaurer
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="mapping" className="mt-0 space-y-4">
                      {context.importPreviewOrganizations.map((org: any, orgIdx: number) => {
                        const orgCollections = Array.isArray(org?.state?.collections) ? org.state.collections : [];
                        return (
                          <div key={`org-${orgIdx}`} className="rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900/70 p-3 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              <div className="md:col-span-2">
                                <label className="block text-xs text-neutral-500 mb-1">Nom de l’organisation</label>
                                <input
                                  className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-2 text-sm"
                                  value={org?.name || ''}
                                  onChange={(e) => context.updateImportOrganizationName(orgIdx, e.target.value)}
                                  disabled={context.importCommitBusy}
                                />
                              </div>
                              <div className="flex items-end md:justify-end">
                                <button
                                  type="button"
                                  className="px-2 py-1.5 rounded bg-red-600/90 hover:bg-red-700 text-white text-xs disabled:opacity-60"
                                  onClick={() => context.removeImportOrganization(orgIdx)}
                                  disabled={context.importCommitBusy || context.importPreviewOrganizations.length <= 1}
                                  title={context.importPreviewOrganizations.length <= 1 ? 'Au moins une organisation est requise' : 'Supprimer cette organisation de l’import'}
                                >
                                  Supprimer organisation
                                </button>
                              </div>
                            </div>

                            <div className="space-y-3">
                              {orgCollections.length === 0 ? (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                                  Aucune collection détectée pour cette organisation.
                                </div>
                              ) : (
                                <Tabs defaultValue={`col-${orgIdx}-0`} className="space-y-3">
                                  <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-transparent p-0 gap-2">
                                    {orgCollections.map((col: any, colIdx: number) => (
                                      <TabsTrigger
                                        key={`org-${orgIdx}-tab-${colIdx}`}
                                        value={`col-${orgIdx}-${colIdx}`}
                                        className="border border-cyan-500/30 data-[state=active]:bg-cyan-600 data-[state=active]:text-white whitespace-nowrap"
                                      >
                                        {col?.name || `Collection ${colIdx + 1}`}
                                      </TabsTrigger>
                                    ))}
                                  </TabsList>

                                  {orgCollections.map((col: any, colIdx: number) => {
                                    const properties = Array.isArray(col?.properties) ? col.properties : [];
                                    const targetCollections = orgCollections.map((c: any) => ({ id: c.id, name: c.name || c.id }));
                                    return (
                                      <TabsContent key={`org-${orgIdx}-content-${colIdx}`} value={`col-${orgIdx}-${colIdx}`} className="mt-0">
                                        <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 space-y-3">
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-1">
                                            <div>
                                              <label className="block text-xs text-neutral-500 mb-1">Nom collection</label>
                                              <input
                                                className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-2 text-sm"
                                                value={col?.name || ''}
                                                onChange={(e) => context.updateImportCollectionName(orgIdx, colIdx, e.target.value)}
                                                disabled={context.importCommitBusy}
                                              />
                                            </div>
                                            <div className="text-xs text-neutral-500 flex items-end pb-2">
                                              {Array.isArray(col?.items) ? col.items.length : 0} item(s) · {properties.length} champ(s)
                                            </div>
                                            <div className="flex items-end md:justify-end">
                                              <button
                                                type="button"
                                                className="px-2 py-1.5 rounded bg-red-600/90 hover:bg-red-700 text-white text-xs disabled:opacity-60"
                                                onClick={() => context.removeImportCollection(orgIdx, colIdx)}
                                                disabled={context.importCommitBusy || orgCollections.length <= 1}
                                                title={orgCollections.length <= 1 ? 'Au moins une collection est requise' : 'Supprimer cette collection de l’import'}
                                              >
                                                Supprimer collection
                                              </button>
                                            </div>
                                          </div>

                                          <div className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden">
                                            <div className="grid grid-cols-12 gap-2 bg-black/5 dark:bg-white/5 px-2 py-2 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 sticky top-0 z-10">
                                              <div className="col-span-4">Champ</div>
                                              <div className="col-span-3">Type</div>
                                              <div className="col-span-3">Cible relation</div>
                                              <div className="col-span-1">Cardinalité</div>
                                              <div className="col-span-1 text-center">Action</div>
                                            </div>

                                            <div className="max-h-[550px] overflow-auto">
                                              {properties.map((prop: any, propIdx: number) => {
                                                const relationType = prop?.relation?.type || 'many_to_many';
                                                const relationTarget = prop?.relation?.targetCollectionId || '';
                                                const isRelation = prop?.type === 'relation';
                                                const isChoiceType = prop?.type === 'select' || prop?.type === 'multi_select';
                                                const choiceSourceCollectionId = String(prop?.importChoiceSource?.collectionId || '');
                                                const choiceTargetCollection = isChoiceType
                                                  ? orgCollections.find((c: any) => c?.id === choiceSourceCollectionId)
                                                  : null;
                                                const choiceTargetFields = Array.isArray(choiceTargetCollection?.properties)
                                                  ? choiceTargetCollection.properties
                                                    .map((p: any) => ({ id: String(p?.id || ''), name: String(p?.name || p?.id || 'champ') }))
                                                    .filter((p: any) => p.id)
                                                  : [];
                                                const choiceSourceFieldId = String(prop?.importChoiceSource?.fieldId || choiceTargetFields[0]?.id || '');
                                                const relationTargetCollection = isRelation
                                                  ? orgCollections.find((c: any) => c?.id === relationTarget)
                                                  : null;
                                                const relationTargetFields = Array.isArray(relationTargetCollection?.properties)
                                                  ? relationTargetCollection.properties
                                                    .map((p: any) => ({ id: String(p?.id || ''), name: String(p?.name || p?.id || 'champ') }))
                                                    .filter((p: any) => p.id)
                                                  : [];
                                                const relationChoiceKey = `${orgIdx}:${colIdx}:${propIdx}`;
                                                const selectedRelationChoiceFieldId = context.relationChoiceFieldByKey[relationChoiceKey]
                                                  || relationTargetFields[0]?.id
                                                  || '';
                                                return (
                                                  <div
                                                    key={`org-${orgIdx}-col-${colIdx}-prop-${propIdx}`}
                                                    className="grid grid-cols-12 gap-2 px-2 py-2 border-t border-black/10 dark:border-white/10 items-center"
                                                  >
                                                    <div className="col-span-4">
                                                      <input
                                                        className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs"
                                                        value={prop?.name || ''}
                                                        onChange={(e) => context.updateImportProperty(orgIdx, colIdx, propIdx, { name: e.target.value })}
                                                        disabled={context.importCommitBusy}
                                                      />
                                                    </div>

                                                    <div className="col-span-3">
                                                      <select
                                                        className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs"
                                                        value={prop?.type || 'text'}
                                                        onChange={(e) => {
                                                          const nextType = e.target.value;
                                                          const fromRelationTarget = String(prop?.relation?.targetCollectionId || '').trim();
                                                          if (nextType === 'select' || nextType === 'multi_select') {
                                                            const sourceCollectionId = fromRelationTarget || choiceSourceCollectionId || '';
                                                            const sourceCollection = sourceCollectionId
                                                              ? orgCollections.find((c: any) => c?.id === sourceCollectionId)
                                                              : null;
                                                            const defaultFieldId = context.pickDefaultChoiceFieldId(sourceCollection, prop);
                                                            context.updateImportProperty(orgIdx, colIdx, propIdx, {
                                                              type: nextType,
                                                              importChoiceSource: {
                                                                collectionId: sourceCollectionId,
                                                                fieldId: defaultFieldId,
                                                              },
                                                            });
                                                            if (sourceCollectionId) {
                                                              context.hydrateChoiceFieldOptions(
                                                                orgIdx,
                                                                colIdx,
                                                                propIdx,
                                                                sourceCollectionId,
                                                                defaultFieldId || undefined,
                                                              );
                                                            }
                                                            return;
                                                          }
                                                          context.updateImportProperty(orgIdx, colIdx, propIdx, { type: nextType });
                                                        }}
                                                        disabled={context.importCommitBusy}
                                                      >
                                                        {context.IMPORT_PROPERTY_TYPE_OPTIONS.map((typeOpt) => (
                                                          <option key={typeOpt} value={typeOpt}>{typeOpt}</option>
                                                        ))}
                                                      </select>
                                                    </div>

                                                    <div className="col-span-3">
                                                      {isRelation ? (
                                                        <select
                                                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs"
                                                          value={relationTarget}
                                                          onChange={(e) => context.updateImportProperty(orgIdx, colIdx, propIdx, {
                                                            relation: {
                                                              ...(prop?.relation || {}),
                                                              targetCollectionId: e.target.value,
                                                              type: relationType,
                                                            },
                                                          })}
                                                          disabled={context.importCommitBusy}
                                                        >
                                                          <option value="">Sélectionner une cible…</option>
                                                          {targetCollections.map((target: any) => (
                                                            <option key={target.id} value={target.id}>{target.name}</option>
                                                          ))}
                                                        </select>
                                                      ) : isChoiceType ? (
                                                        <div className="grid grid-cols-1 gap-1">
                                                          <select
                                                            className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1 text-[11px]"
                                                            value={choiceSourceCollectionId}
                                                            onChange={(e) => {
                                                              const collectionId = e.target.value;
                                                              context.updateImportProperty(orgIdx, colIdx, propIdx, {
                                                                importChoiceSource: {
                                                                  collectionId,
                                                                  fieldId: '',
                                                                },
                                                              });
                                                              if (collectionId) {
                                                                context.hydrateChoiceFieldOptions(orgIdx, colIdx, propIdx, collectionId);
                                                              }
                                                            }}
                                                            disabled={context.importCommitBusy}
                                                          >
                                                            <option value="">Source options…</option>
                                                            {targetCollections.map((target: any) => (
                                                              <option key={target.id} value={target.id}>{target.name}</option>
                                                            ))}
                                                          </select>
                                                          <select
                                                            className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1 text-[11px]"
                                                            value={choiceSourceFieldId}
                                                            onChange={(e) => {
                                                              const fieldId = e.target.value;
                                                              context.updateImportProperty(orgIdx, colIdx, propIdx, {
                                                                importChoiceSource: {
                                                                  collectionId: choiceSourceCollectionId,
                                                                  fieldId,
                                                                },
                                                              });
                                                              if (choiceSourceCollectionId) {
                                                                context.hydrateChoiceFieldOptions(orgIdx, colIdx, propIdx, choiceSourceCollectionId, fieldId || undefined);
                                                              }
                                                            }}
                                                            disabled={context.importCommitBusy || !choiceSourceCollectionId}
                                                          >
                                                            {choiceTargetFields.length === 0 && <option value="">Champ…</option>}
                                                            {choiceTargetFields.map((f: any) => (
                                                              <option key={f.id} value={f.id}>{f.name}</option>
                                                            ))}
                                                          </select>
                                                        </div>
                                                      ) : (
                                                        <div className="text-[11px] text-neutral-500 py-1.5">—</div>
                                                      )}
                                                    </div>

                                                    <div className="col-span-1">
                                                      {isRelation ? (
                                                        <select
                                                          className="w-full bg-white dark:bg-neutral-900 border border-white/10 rounded px-2 py-1.5 text-xs"
                                                          value={relationType}
                                                          onChange={(e) => context.updateImportProperty(orgIdx, colIdx, propIdx, {
                                                            relation: {
                                                              ...(prop?.relation || {}),
                                                              targetCollectionId: relationTarget || targetCollections[0]?.id || null,
                                                              type: e.target.value,
                                                            },
                                                          })}
                                                          disabled={context.importCommitBusy}
                                                        >
                                                          <option value="one_to_one">one_to_one</option>
                                                          <option value="one_to_many">one_to_many</option>
                                                          <option value="many_to_many">many_to_many</option>
                                                        </select>
                                                      ) : (
                                                        <div className="text-[11px] text-neutral-500 py-1.5">—</div>
                                                      )}
                                                    </div>

                                                    <div className="col-span-1 flex justify-center">
                                                      <div className="flex items-center gap-1">
                                                        {isRelation && (
                                                          <>
                                                            <button
                                                              type="button"
                                                              className="px-1.5 py-1 rounded text-[10px] bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                                                              onClick={() => context.convertRelationToChoiceField(orgIdx, colIdx, propIdx, 'select', selectedRelationChoiceFieldId || undefined)}
                                                              disabled={context.importCommitBusy}
                                                              title="Convertir cette relation en select"
                                                            >
                                                              S
                                                            </button>
                                                            <button
                                                              type="button"
                                                              className="px-1.5 py-1 rounded text-[10px] bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-50"
                                                              onClick={() => context.convertRelationToChoiceField(orgIdx, colIdx, propIdx, 'multi_select', selectedRelationChoiceFieldId || undefined)}
                                                              disabled={context.importCommitBusy}
                                                              title="Convertir cette relation en multi_select"
                                                            >
                                                              M
                                                            </button>
                                                          </>
                                                        )}
                                                        <button
                                                          type="button"
                                                          className="p-1 rounded hover:bg-red-500/20 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-50"
                                                          onClick={() => context.removeImportProperty(orgIdx, colIdx, propIdx)}
                                                          disabled={context.importCommitBusy}
                                                          title="Supprimer cette propriété"
                                                        >
                                                          <X size={16} />
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      </TabsContent>
                                    );
                                  })}
                                </Tabs>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="px-4 py-3 border-t border-white/10 flex items-center justify-end gap-2">
                  <button
                    className="px-3 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm disabled:opacity-60"
                    onClick={context.autoFixImportMapping}
                    disabled={context.importCommitBusy || !context.importPreviewOrganizations.length}
                  >
                    Auto-fix mapping
                  </button>
                  <button
                    className="px-3 py-2 rounded border border-white/20 text-sm"
                    onClick={() => context.setShowImportMapper(false)}
                    disabled={context.importCommitBusy}
                  >
                    Annuler
                  </button>
                  <button
                    className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60"
                    onClick={context.importOrganizationsWithManualMapping}
                    disabled={context.importCommitBusy || !context.importPreviewOrganizations.length || context.importMappingDiagnostics.errors.length > 0}
                  >
                    {context.importCommitBusy ? 'Import en cours…' : 'Créer les organisations'}
                  </button>
                </div>
              </div>
            </div>

);
