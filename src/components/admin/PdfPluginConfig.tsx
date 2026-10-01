/**
 * Plugin PDF - Écran de configuration (Paramètres → Plugins)
 *
 * Permet de :
 *  - lier un modèle PDF au plugin (upload + détection automatique des champs modifiables)
 *  - choisir les collections concernées
 *  - mapper chaque champ du PDF avec une propriété de la collection
 *  - activer/désactiver la priorité des modifications manuelles
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Save, Upload, FileText, RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { pluginManager } from '@/lib/plugins';
import {
  getPdfMappingPropertyId,
  normalizePdfConfig,
  type PdfFieldMapping,
  type PdfPluginConfig,
} from '@/lib/plugins/pdf/usePdfPlugin';
import { detectPdfFields, loadPdfBytes, uploadPdfTemplate, type PdfFieldInfo } from '@/lib/plugins/pdf/pdfUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface PdfPluginConfigProps {
  organizationId: string;
  collections?: any[];
  onClose: () => void;
  onSave?: (config: Record<string, any>) => void;
}

export const PdfPluginConfigUI: React.FC<PdfPluginConfigProps> = ({
  organizationId,
  collections = [],
  onClose,
  onSave,
}) => {
  const [config, setConfig] = useState<PdfPluginConfig>({
    templateId: null,
    templateName: null,
    enabledCollectionIds: [],
    mappings: {},
    manualOverride: true,
  });
  const [fields, setFields] = useState<PdfFieldInfo[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chargement de la config persistée (DB en source de vérité)
  useEffect(() => {
    const load = async () => {
      try {
        const local = pluginManager.getPluginConfig(organizationId, 'pdf');
        if (local && Object.keys(local).length > 0) setConfig(normalizePdfConfig(local));
      } catch {
        /* ignore */
      }
      try {
        const res = await fetch(`${API_URL}/plugins/config/${organizationId}`, { credentials: 'include' });
        if (!res.ok) return;
        const all = await res.json();
        const persisted = all?.pdf?.config;
        if (persisted && typeof persisted === 'object') {
          const normalized = normalizePdfConfig(persisted);
          setConfig(normalized);
          pluginManager.updatePluginConfig(organizationId, 'pdf', persisted);
        }
      } catch (err) {
        console.warn('[PDF Config] Chargement de la config impossible:', err);
      }
    };
    load();
  }, [organizationId]);

  // Détection des champs du modèle lié
  useEffect(() => {
    let cancelled = false;
    const detect = async () => {
      if (!config.templateId) {
        setFields([]);
        return;
      }
      setDetecting(true);
      try {
        const bytes = await loadPdfBytes('template', config.templateId);
        const detected = await detectPdfFields(bytes);
        if (!cancelled) setFields(detected);
      } catch (err: any) {
        if (!cancelled) {
          setFields([]);
          setError(err?.message || 'Détection des champs impossible.');
        }
      } finally {
        if (!cancelled) setDetecting(false);
      }
    };
    detect();
    return () => {
      cancelled = true;
    };
  }, [config.templateId]);

  useEffect(() => {
    if (!activeCollectionId && config.enabledCollectionIds.length > 0) {
      setActiveCollectionId(config.enabledCollectionIds[0]);
    }
  }, [config.enabledCollectionIds, activeCollectionId]);

  const collectionProperties = useMemo(() => {
    const col = collections.find((c: any) => c.id === activeCollectionId);
    return Array.isArray(col?.properties) ? col.properties : [];
  }, [collections, activeCollectionId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const meta = await uploadPdfTemplate(organizationId, file);
      setConfig((prev) => ({ ...prev, templateId: meta.id, templateName: meta.name }));
      setFields(Array.isArray(meta.fields) ? meta.fields : []);
    } catch (err: any) {
      console.error('[PDF Config] Upload impossible:', err);
      setError(err?.message || "Impossible d'uploader le modèle PDF.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleCollection = (colId: string) => {
    setConfig((prev) => {
      const enabled = prev.enabledCollectionIds.includes(colId)
        ? prev.enabledCollectionIds.filter((id) => id !== colId)
        : [...prev.enabledCollectionIds, colId];
      const mappings = { ...prev.mappings };
      if (!mappings[colId]) mappings[colId] = {};
      return { ...prev, enabledCollectionIds: enabled, mappings };
    });
  };

  const updateMapping = (fieldName: string, changes: Partial<PdfFieldMapping>) => {
    setConfig((prev) => ({
      ...prev,
      mappings: {
        ...prev.mappings,
        [activeCollectionId]: {
          ...(prev.mappings?.[activeCollectionId] || {}),
          [fieldName]: {
            ...(typeof prev.mappings?.[activeCollectionId]?.[fieldName] === 'object'
              ? prev.mappings[activeCollectionId][fieldName]
              : { propertyId: getPdfMappingPropertyId(prev.mappings?.[activeCollectionId]?.[fieldName]) }),
            ...changes,
          },
        },
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      pluginManager.updatePluginConfig(organizationId, 'pdf', config);
      const response = await fetch(`${API_URL}/plugins/config/${organizationId}/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          enabled: pluginManager.isPluginActive(organizationId, 'pdf'),
          config,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      onSave?.(config as any);
      onClose();
    } catch (err: any) {
      console.error('[PDF Config] Sauvegarde impossible:', err);
      setError(err?.message || 'Impossible de sauvegarder la configuration du plugin PDF.');
    } finally {
      setSaving(false);
    }
  };

  const currentMapping = config.mappings?.[activeCollectionId] || {};

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-950 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText size={18} className="text-violet-400" />
            Configuration du plugin PDF
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Modèle PDF */}
          <div>
            <label className="text-sm font-medium mb-2 block">Modèle PDF lié</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium transition"
              >
                {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                {config.templateId ? 'Remplacer le modèle' : 'Choisir un fichier PDF'}
              </button>
              {config.templateId && (
                <>
                  <span className="text-sm text-neutral-300 truncate max-w-[240px]" title={config.templateName || ''}>
                    {config.templateName}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      setDetecting(true);
                      try {
                        const bytes = await loadPdfBytes('template', config.templateId!);
                        setFields(await detectPdfFields(bytes));
                      } finally {
                        setDetecting(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200"
                  >
                    <RefreshCw size={13} className={detecting ? 'animate-spin' : ''} />
                    Redétecter les champs
                  </button>
                </>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-1.5">
              Le PDF doit contenir des champs de formulaire (AcroForm). Les champs modifiables sont détectés
              automatiquement à l'upload.
            </p>
            {config.templateId && !detecting && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 size={14} />
                {fields.length} champ{fields.length > 1 ? 's' : ''} modifiable{fields.length > 1 ? 's' : ''} détecté
                {fields.length > 1 ? 's' : ''}
              </div>
            )}
            {fields.length === 0 && config.templateId && !detecting && (
              <div className="mt-2 inline-flex items-start gap-1.5 text-xs text-amber-400">
                <AlertTriangle size={14} className="mt-0.5" />
                Aucun champ de formulaire détecté dans ce PDF. Ajoutez des champs avec un éditeur PDF avant de
                l'utiliser.
              </div>
            )}
          </div>

          {/* Collections activées */}
          <div className="border-t border-white/10 pt-4">
            <label className="text-sm font-medium mb-2 block">Collections concernées</label>
            <div className="flex flex-wrap gap-2">
              {collections.map((col: any) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => toggleCollection(col.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    config.enabledCollectionIds.includes(col.id)
                      ? 'bg-violet-600/20 border-violet-500/50 text-violet-200'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10'
                  }`}
                >
                  {col.name || col.id}
                </button>
              ))}
              {collections.length === 0 && (
                <span className="text-xs text-neutral-500">Aucune collection disponible.</span>
              )}
            </div>
          </div>

          {/* Mapping par collection */}
          {config.enabledCollectionIds.length > 0 && fields.length > 0 && (
            <div className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
                <label className="text-sm font-medium">Correspondances champs PDF ↔ propriétés</label>
                <select
                  value={activeCollectionId}
                  onChange={(e) => setActiveCollectionId(e.target.value)}
                  className="px-3 py-1.5 rounded border border-white/10 bg-white dark:bg-neutral-900 text-sm"
                >
                  {config.enabledCollectionIds.map((colId) => {
                    const col = collections.find((c: any) => c.id === colId);
                    return (
                      <option key={colId} value={colId}>
                        {col?.name || colId}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="rounded-lg border border-white/10 divide-y divide-white/5 overflow-hidden">
                {fields.map((field) => (
                  <div key={field.name} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate" title={field.name}>
                        {field.name}
                      </div>
                      <div className="text-[10px] uppercase text-neutral-500">{field.type}</div>
                    </div>
                    <select
                      value={getPdfMappingPropertyId(currentMapping[field.name])}
                      onChange={(e) => updateMapping(field.name, { propertyId: e.target.value })}
                      className="w-[220px] px-2 py-1.5 rounded border border-white/10 bg-white dark:bg-neutral-900 text-sm"
                    >
                      <option value="">— aucun —</option>
                      {collectionProperties.map((prop: any) => (
                        <option key={prop.id} value={prop.id}>
                          {prop.name} ({prop.type})
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={
                        currentMapping[field.name] && typeof currentMapping[field.name] === 'object'
                          ? (currentMapping[field.name] as PdfFieldMapping).customText || ''
                          : ''
                      }
                      onChange={(e) => updateMapping(field.name, { customText: e.target.value })}
                      placeholder="Texte personnalisé ({{valeur}})"
                      title="Utilisez {{valeur}} pour placer la valeur mappée. Sans marqueur, le texte est ajouté après la valeur."
                      className="w-[220px] px-2 py-1.5 rounded border border-white/10 bg-white dark:bg-neutral-900 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Priorité manuelle */}
          <div className="border-t border-white/10 pt-4 flex items-center gap-3">
            <input
              id="pdf-manual-override"
              type="checkbox"
              checked={config.manualOverride}
              onChange={(e) => setConfig((prev) => ({ ...prev, manualOverride: e.target.checked }))}
              className="accent-violet-500 w-4 h-4"
            />
            <label htmlFor="pdf-manual-override" className="text-sm">
              Les modifications manuelles dans le modal{' '}
              <strong className="text-violet-300">prennent le dessus</strong> sur les valeurs mappées
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-white/10 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-medium transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfPluginConfigUI;
