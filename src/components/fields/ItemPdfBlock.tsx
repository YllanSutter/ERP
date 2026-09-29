/**
 * Plugin PDF - Bloc affiché dans NewItemModal
 *
 * Pour un objet d'une collection activée dans les paramètres du plugin :
 *  - prévisualise le modèle PDF lié (ou le PDF déjà sauvegardé pour l'objet)
 *  - liste les champs modifiables détectés (AcroForm)
 *  - pré-remplit automatiquement les champs via le mapping "champ PDF <-> propriété"
 *  - permet de modifier manuellement n'importe quel champ (les modifications
 *    manuelles PRENNENT LE DESSUS sur les valeurs mappées)
 *  - enregistre le PDF rempli côté serveur (par objet) et permet de le télécharger
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PdfPluginConfig } from '@/lib/plugins/pdf/usePdfPlugin';
import {
  detectPdfFields,
  fillPdfBytes,
  loadPdfBytes,
  resolvePdfValues,
  saveItemPdf,
  getSavedItemPdf,
  downloadBlob,
  type PdfFieldInfo,
} from '@/lib/plugins/pdf/pdfUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface ItemPdfBlockProps {
  organizationId: string;
  config: PdfPluginConfig;
  collection: any;
  item: any | null; // editingItem (peut être null pour une création)
  formData: Record<string, any>;
  collections: any[];
  className?: string;
}

type PreviewSource = 'template' | 'live' | 'saved';

export const ItemPdfBlock: React.FC<ItemPdfBlockProps> = ({
  organizationId,
  config,
  collection,
  item,
  formData,
  collections,
  className,
}) => {
  const collectionId = collection?.id || null;
  const itemId = item?.id || null;

  const [fields, setFields] = useState<PdfFieldInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Éditions manuelles utilisateur : ne contient QUE ce qui a été touché
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const manualBaselineRef = useRef<Record<string, string>>({});

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<PreviewSource>('template');
  const [showPreview, setShowPreview] = useState(true);

  const [savedMeta, setSavedMeta] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const properties = useMemo(
    () => (Array.isArray(collection?.properties) ? collection.properties : []),
    [collection]
  );

  const mapping = useMemo(
    () => (collectionId && config.mappings?.[collectionId]) || {},
    [config.mappings, collectionId]
  );

  // ------------------------------------------------------------------
  // Chargement des champs + PDF sauvegardé existant
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setFields([]);
      setManualValues({});
      manualBaselineRef.current = {};
      setSavedMeta(null);

      if (!config.templateId) {
        setError("Aucun modèle PDF n'est lié. Liez un PDF dans les paramètres du plugin 📄.");
        setLoading(false);
        return;
      }

      try {
        const bytes = await loadPdfBytes('template', config.templateId);
        const detected = await detectPdfFields(bytes);
        if (cancelled) return;
        setFields(detected);

        if (itemId && collectionId) {
          const saved = await getSavedItemPdf(organizationId, collectionId, itemId);
          if (cancelled) return;
          if (saved) {
            setSavedMeta(saved);
            // Les valeurs enregistrées deviennent la référence "manuel" :
            // elles priment sur le mapping tant que l'utilisateur ne re-mapping pas.
            const baseline: Record<string, string> = {};
            for (const f of detected) {
              baseline[f.name] = saved.values?.[f.name] ?? '';
            }
            manualBaselineRef.current = baseline;
            setManualValues(baseline);
          }
        }
      } catch (err: any) {
        console.error('[PDF Plugin] Chargement impossible:', err);
        if (!cancelled) setError(err?.message || 'Impossible de charger le modèle PDF.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, config.templateId, collectionId, itemId]);

  // ------------------------------------------------------------------
  // Valeurs résolues (mapping + priorité au manuel)
  // ------------------------------------------------------------------
  const resolved = useMemo(
    () =>
      resolvePdfValues({
        fields,
        mapping,
        properties,
        formData,
        collections,
        manualValues,
        manualOverride: config.manualOverride !== false,
      }),
    [fields, mapping, properties, formData, collections, manualValues, config.manualOverride]
  );

  const handleFieldChange = (fieldName: string, value: string) => {
    setManualValues((prev) => ({ ...prev, [fieldName]: value }));
    setSaveMessage(null);
  };

  const resetManualField = (fieldName: string) => {
    setManualValues((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      delete manualBaselineRef.current[fieldName];
      return next;
    });
  };

  // ------------------------------------------------------------------
  // Prévisualisation : on génère le PDF rempli à la demande (blob URL)
  // ------------------------------------------------------------------
  const generatePreview = useCallback(async () => {
    if (!config.templateId) return;
    try {
      setError(null);
      const bytes = await loadPdfBytes('template', config.templateId);
      const filled = await fillPdfBytes(bytes, resolved.values);
      const blob = new Blob([filled as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      setPreviewSource('live');
    } catch (err: any) {
      console.error('[PDF Plugin] Preview error:', err);
      setError(err?.message || 'Prévisualisation impossible.');
    }
  }, [config.templateId, resolved.values]);

  // Aperçu du PDF déjà sauvegardé (le cas échéant)
  const showSavedPreview = useCallback(async () => {
    if (!savedMeta?.id) return;
    try {
      const bytes = await loadPdfBytes('saved', savedMeta.id);
      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      setPreviewSource('saved');
    } catch (err: any) {
      setError(err?.message || 'Chargement du PDF sauvegardé impossible.');
    }
  }, [savedMeta]);

  // ------------------------------------------------------------------
  // Enregistrement / téléchargement
  // ------------------------------------------------------------------
  const buildFilename = () => {
    const nameProp = properties.find((p: any) => p.isNameField) || properties[0];
    const rawName = nameProp
      ? String(formData?.[nameProp.id] ?? '').slice(0, 60)
      : String(item?.name ?? '').slice(0, 60);
    const safe = (rawName.trim() || `item-${itemId || 'nouveau'}`).replace(/[\\/:*?"<>|]+/g, '_');
    return `${safe}.pdf`;
  };

  const handleSave = async () => {
    if (!config.templateId || !collectionId || !itemId) {
      setSaveMessage("Enregistrez d'abord l'objet avant de sauvegarder son PDF.");
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const templateBytes = await loadPdfBytes('template', config.templateId);
      const filled = await fillPdfBytes(templateBytes, resolved.values);
      const meta = await saveItemPdf({
        organizationId,
        collectionId,
        itemId,
        templateId: config.templateId,
        bytes: filled,
        values: resolved.values,
      });
      setSavedMeta(meta);
      // Les valeurs enregistrées deviennent la nouvelle référence manuelle
      const baseline: Record<string, string> = {};
      for (const f of fields) baseline[f.name] = resolved.values[f.name] ?? '';
      manualBaselineRef.current = baseline;
      setManualValues(baseline);
      setSaveMessage('PDF enregistré ✔');
    } catch (err: any) {
      console.error('[PDF Plugin] Save error:', err);
      setSaveMessage(err?.message || "Échec de l'enregistrement du PDF.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!config.templateId) return;
    try {
      setError(null);
      const templateBytes = await loadPdfBytes('template', config.templateId);
      const filled = await fillPdfBytes(templateBytes, resolved.values);
      downloadBlob(filled, buildFilename());
    } catch (err: any) {
      setError(err?.message || 'Téléchargement impossible.');
    }
  };

  const mappedCount = fields.filter((f) => mapping[f.name]).length;
  const manualCount = Object.keys(manualValues).filter(
    (k) => manualValues[k] !== (manualBaselineRef.current[k] ?? '') || k in manualBaselineRef.current
  ).length;

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-neutral-500 py-3', className)}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Chargement du modèle PDF…
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-3">
        <span className="text-[10px] tracking-widest uppercase font-medium text-neutral-600 shrink-0 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> PDF
        </span>
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-[10px] text-neutral-500 whitespace-nowrap">
          {config.templateName || 'modèle'} · {fields.length} champ{fields.length > 1 ? 's' : ''} modifiable
          {fields.length > 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {fields.length === 0 && !error && (
        <div className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-xs text-neutral-500">
          Aucun champ de formulaire détecté dans ce PDF. Ouvrez le modèle dans un éditeur PDF et ajoutez
          des champs de formulaire (AcroForm), puis rechargez la configuration du plugin.
        </div>
      )}

      {fields.length > 0 && (
        <>
          {/* Champs modifiables */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.05] overflow-hidden">
            {fields.map((field) => {
              const propId = mapping[field.name];
              const propName = propId ? properties.find((p: any) => p.id === propId)?.name : null;
              const isManual = Object.prototype.hasOwnProperty.call(manualValues, field.name);
              const finalValue = resolved.values[field.name] ?? '';
              const overridden = isManual && config.manualOverride !== false && finalValue !== resolved.mappedValues[field.name];

              return (
                <div key={field.name} className="flex items-center gap-3 px-3 py-2">
                  <div className="w-[180px] shrink-0 min-w-0">
                    <div className="text-xs text-neutral-300 truncate" title={field.name}>
                      {field.name}
                    </div>
                    <div className="text-[10px] text-neutral-600 flex items-center gap-1 flex-wrap">
                      <span className="uppercase">{field.type}</span>
                      {propName ? (
                        <span className="text-cyan-500/80 truncate max-w-[90px]" title={`Mappé sur : ${propName}`}>
                          ← {propName}
                        </span>
                      ) : (
                        <span className="text-neutral-700">(non mappé)</span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    {field.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={/^(true|1|oui|yes|on|x)$/i.test(finalValue)}
                        onChange={(e) => handleFieldChange(field.name, e.target.checked ? 'true' : 'false')}
                        className="accent-violet-500 w-4 h-4"
                      />
                    ) : (
                      <input
                        type="text"
                        value={finalValue}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        placeholder={propName ? '(vide — valeur du champ lié)' : '(aucune source)'}
                        className={cn(
                          'w-full px-2 py-1.5 rounded-md bg-black/20 border text-sm text-neutral-100 outline-none transition-colors',
                          isManual
                            ? 'border-violet-500/50 focus:border-violet-400'
                            : 'border-white/10 focus:border-white/25'
                        )}
                      />
                    )}
                  </div>

                  <div className="w-[120px] shrink-0 text-right space-y-0.5">
                    {isManual && (
                      <div className="text-[10px] text-violet-400">
                        {overridden ? 'manuel (prioritaire)' : 'manuel'}
                      </div>
                    )}
                    {isManual && (
                      <button
                        type="button"
                        onClick={() => resetManualField(field.name)}
                        className="text-[10px] text-neutral-500 hover:text-neutral-300 underline underline-offset-2"
                        title="Revenir à la valeur calculée depuis le champ de la collection"
                      >
                        re-mapper
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barre d'actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generatePreview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-neutral-200 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Générer l'aperçu
            </button>
            {savedMeta?.id && (
              <button
                type="button"
                onClick={showSavedPreview}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-neutral-200 transition"
                title="Voir la dernière version enregistrée"
              >
                <Eye className="w-3.5 h-3.5" />
                Version enregistrée
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !itemId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-xs font-medium text-white transition"
              title={!itemId ? "Enregistrez d'abord l'objet" : "Enregistrer ce PDF pour cet objet"}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Enregistrer
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-medium text-white transition"
            >
              <Download className="w-3.5 h-3.5" />
              Télécharger
            </button>
            {saveMessage && <span className="text-[11px] text-neutral-400">{saveMessage}</span>}
            {!itemId && (
              <span className="text-[10px] text-neutral-600">
                Sauvegarde PDF disponible après création de l'objet
              </span>
            )}
          </div>

          <div className="text-[10px] text-neutral-600">
            {mappedCount} champ{mappedCount > 1 ? 's' : ''} mappé{mappedCount > 1 ? 's' : ''} sur des propriétés
            {manualCount > 0 &&
              ` · ${manualCount} modification${manualCount > 1 ? 's' : ''} manuelle${manualCount > 1 ? 's' : ''} (prioritaire${manualCount > 1 ? 's' : ''})`}
            {config.manualOverride !== false
              ? ' · vos modifications manuelles écrasent le mapping'
              : ' · le mapping prime (override désactivé dans les paramètres)'}
          </div>

          {/* Prévisualisation */}
          {previewUrl && (
            <div className="rounded-xl border border-white/[0.08] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.04]">
                <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                  Prévisualisation ({previewSource === 'saved' ? 'enregistrée' : 'en cours'})
                </span>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-200"
                >
                  {showPreview ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showPreview ? 'Masquer' : 'Afficher'}
                </button>
              </div>
              {showPreview && (
                <object data={previewUrl} type="application/pdf" className="w-full h-[480px] bg-black/20">
                  <div className="p-3 text-xs text-neutral-400">
                    Prévisualisation indisponible dans ce navigateur —{' '}
                    <a
                      href={`${API_URL}/plugins/pdf/templates/${config.templateId}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 underline"
                    >
                      ouvrir le modèle
                    </a>
                  </div>
                </object>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ItemPdfBlock;
