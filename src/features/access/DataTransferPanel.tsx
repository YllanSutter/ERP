import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, FileUp, RefreshCw, RotateCcw, Trash2, Database, Zap, Plus, UserPlus } from 'lucide-react';
import ShinyButton from '@/components/ui/ShinyButton';
import { SettingsTabs, SettingsTabContent, SettingsSectionTitle } from '@/components/ui/settings-panel';
import type { AccessContext } from './panelTypes';
export type DataTransferPanelProps = { context: AccessContext };
export const DataTransferPanel = ({ context }: DataTransferPanelProps) => (
  <div className="min-w-0">
              <SettingsTabs
                value={context.dataTransferTab}
                onValueChange={(value) => context.setDataTransferTab(value as 'import-new' | 'import-replace' | 'export')}
               inline label="Import et export" items={[{id:'import-new',label:'Nouvelle organisation'},{id:'import-replace',label:'Remplacer des données'},{id:'export',label:'Exporter'}]}>

                <SettingsTabContent value="import-new">
                  <div className="space-y-2">
                    <SettingsSectionTitle>Créer des organisations depuis un fichier</SettingsSectionTitle>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-2">
                      Ajoute une ou plusieurs organisations à partir de fichiers JSON/CSV, avec prévisualisation et remapping avant validation.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="px-2 py-1 rounded border border-white/10 bg-white dark:bg-neutral-900 text-xs"
                        placeholder="Nom orga (optionnel)"
                        value={context.importOrganizationName}
                        onChange={(e) => context.setImportOrganizationName(e.target.value)}
                        disabled={context.importBusy}
                      />
                      <label
                        className={`px-3 py-1 rounded text-white text-xs shadow cursor-pointer flex items-center gap-1 ${context.importBusy ? 'bg-emerald-400' : 'bg-brand-600 hover:bg-brand-700'}`}
                        title="Importe des .json ou .csv et crée de nouvelles organisations automatiquement"
                      >
                        <FileUp size={13} />
                        {context.importBusy ? 'Import…' : 'Importer JSON/CSV'}
                        <input
                          type="file"
                          accept=".json,.csv,application/json,text/csv"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const input = e.currentTarget;
                            await context.importOrganizationsFromFiles(input.files);
                            input.value = '';
                          }}
                          disabled={context.importBusy}
                        />
                      </label>
                    </div>
                  </div>
                </SettingsTabContent>

                <SettingsTabContent value="import-replace">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
                    <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">Remplacer les données existantes</div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-2">
                      Remplace les données existantes via un export appstate JSON (scope auto: organisation ou global).
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1 rounded bg-brand-600 hover:bg-brand-700 text-white text-xs shadow cursor-pointer" title="Import historique appstate (peut remplacer des données selon le scope)">
                        Importer Appstate JSON
                        <input
                          type="file"
                          accept="application/json"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const text = await file.text();
                              const fullData = JSON.parse(text);
                              const appStateRows = Array.isArray(fullData?.app_state) ? fullData.app_state : [];
                              const organizationIdsFromState = new Set(
                                appStateRows
                                  .map((row: any) => row?.organization_id)
                                  .filter((value: any) => typeof value === 'string' && value.length > 0)
                              );
                              const organizationsInPayload = Array.isArray(fullData?.organizations)
                                ? fullData.organizations.length
                                : 0;

                              const inferredScope: 'global' | 'organization' =
                                fullData?.scope === 'organization' ? 'organization' :
                                  fullData?.scope === 'global' ||
                                  /global/i.test(file.name) ||
                                  organizationsInPayload > 1 ||
                                  organizationIdsFromState.size > 1
                                    ? 'global'
                                    : 'organization';

                              const res = await fetch(`${context.API_URL}/appstate?scope=${inferredScope}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify(fullData),
                              });
                              const result = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(result?.error || 'Erreur import appstate');

                              const appliedScope: 'global' | 'organization' =
                                result?.scope === 'global' ? 'global' : inferredScope;

                              if (appliedScope === 'global') {
                                const orgCount = organizationsInPayload || organizationIdsFromState.size || 1;
                                alert(`✅ Import global réussi ! ${orgCount} organisation(s) remplacée(s).`);
                              } else {
                                alert('✅ Import organisation réussi ! Seule l’organisation active a été remplacée.');
                              }
                              window.location.reload();
                            } catch (err) {
                              alert(`❌ Erreur lors de l'import : ${err instanceof Error ? err.message : String(err)}`);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </SettingsTabContent>

                <SettingsTabContent value="export">
                  <div className="rounded-lg border border-brand-500/30 bg-brand-500/10 p-2">
                    <div className="text-[11px] font-semibold text-brand-800 dark:text-brand-200 mb-2">EXPORT</div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 mb-2">
                      Exporte l’organisation active (JSON/CSV) ou tout l’ERP (global JSON).
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="px-3 py-1 rounded bg-brand-600 hover:bg-brand-700 text-white text-xs shadow"
                        onClick={async () => {
                          try {
                            const res = await fetch(`${context.API_URL}/appstate?scope=organization`, { credentials: 'include' });
                            if (!res.ok) throw new Error('Erreur export appstate');
                            const data = await res.json();
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'erp_organization_export.json';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          } catch {
                            alert('Erreur lors de l\'export appstate.');
                          }
                        }}
                        title="Exporter uniquement l'organisation active en JSON"
                      >
                        Orga JSON
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-brand-600 hover:bg-brand-700 text-white text-xs shadow"
                        onClick={async () => {
                          try {
                            const res = await fetch(`${context.API_URL}/appstate?scope=global`, { credentials: 'include' });
                            if (!res.ok) throw new Error('Erreur export global appstate');
                            const data = await res.json();
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'erp_global_export.json';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          } catch {
                            alert('Erreur lors de l\'export global appstate.');
                          }
                        }}
                        title="Exporter toutes les organisations (global) en JSON"
                      >
                        Global JSON
                      </button>
                      <button
                        className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-700 text-white text-xs shadow"
                        onClick={async () => {
                          try {
                            const res = await fetch(`${context.API_URL}/appstate?scope=organization`, { credentials: 'include' });
                            if (!res.ok) throw new Error('Erreur export appstate');
                            const data = await res.json();
                            const appStateArr = Array.isArray(data.app_state) ? data.app_state : [];
                            const row = appStateArr[0];
                            if (!row) return;
                            let state;
                            try {
                              state = JSON.parse(row.data);
                            } catch {
                              alert('Impossible de parser le state pour CSV');
                              return;
                            }
                            const exportCollections = Array.isArray(state.collections) ? state.collections : [];
                            if (exportCollections.length === 0) return;
                            let JSZip;
                            try {
                              JSZip = (await import('jszip')).default;
                            } catch {
                              alert('JSZip est requis pour l\'export CSV.');
                              return;
                            }
                            const zip = new JSZip();
                            for (const col of exportCollections) {
                              const items = Array.isArray(col.items) ? col.items : [];
                              if (items.length === 0) continue;
                              const allKeys = Array.from(new Set(items.flatMap((item: {}) => Object.keys(item))));
                              const header = allKeys.join(',');
                              const csvRows = [header];
                              for (const item of items) {
                                const row = allKeys.map((k) => {
                                  let v = (item as Record<string, any>)[k as string];
                                  if (typeof v === 'object' && v !== null) v = JSON.stringify(v);
                                  if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
                                    v = '"' + v.replace(/"/g, '""') + '"';
                                  }
                                  return v ?? '';
                                }).join(',');
                                csvRows.push(row);
                              }
                              zip.file(`${col.name || col.id || 'collection'}.csv`, csvRows.join('\n'));
                            }
                            const zipBlob = await zip.generateAsync({ type: 'blob' });
                            const zipUrl = URL.createObjectURL(zipBlob);
                            const azip = document.createElement('a');
                            azip.href = zipUrl;
                            azip.download = 'erp_collections_csv.zip';
                            document.body.appendChild(azip);
                            azip.click();
                            document.body.removeChild(azip);
                            URL.revokeObjectURL(zipUrl);
                          } catch {
                            alert('Erreur lors de l\'export CSV.');
                          }
                        }}
                        title="Exporter les collections de l'organisation active en CSV (ZIP)"
                      >
                        CSV (ZIP)
                      </button>
                    </div>
                  </div>
                </SettingsTabContent>

                <div className="text-[11px] text-neutral-600 dark:text-neutral-300 text-center max-w-2xl mx-auto mt-3">
                  <span className="font-semibold">Aide rapide :</span> <strong>Importer JSON/CSV</strong> crée de nouvelles organisations (avec remapping),
                  <strong> Import Appstate</strong> remplace des données, <strong>Exports</strong> sert à sauvegarder l'orga active ou tout le global.
                </div>
              </SettingsTabs>
            </div>
);
