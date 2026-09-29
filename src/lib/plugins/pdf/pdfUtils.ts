/**
 * Plugin PDF - Utilitaires client
 *
 * Chargement du modèle, détection des champs modifiables (AcroForm),
 * extraction de valeurs "texte" depuis les propriétés de collection
 * (y compris les relations résolues vers l'item lié), remplissage et
 * sauvegarde via pdf-lib côté navigateur.
 */

import { PDFDocument, PDFName, PDFArray, PDFDict, PDFHexString, PDFString } from 'pdf-lib';
import { normalizeRelationIds } from '@/lib/utils/relationUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface PdfFieldInfo {
  name: string;
  type: string; // text | checkbox | radio | dropdown | signature...
  pages: number[];
}

export interface PdfTemplateMeta {
  id: string;
  organizationId: string;
  name: string;
  size: number;
  uploadedAt: string;
  fields: PdfFieldInfo[];
}

// ---------------------------------------------------------------------------
// Récupération binaire (avec fallback base64 si la réponse n'est pas du PDF)
// ---------------------------------------------------------------------------

async function fetchBinary(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Fallback : certaines configurations renvoient du JSON { data: base64 }
  if (bytes.length > 5 && !(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44)) {
    try {
      const text = new TextDecoder().decode(bytes);
      const json = JSON.parse(text);
      if (json && typeof json.data === 'string') {
        return Uint8Array.from(atob(json.data), (c) => c.charCodeAt(0));
      }
    } catch {
      /* ce n'était pas du JSON, on garde les octets bruts */
    }
  }
  return bytes;
}

export async function loadPdfBytes(kind: 'template' | 'saved', id: string): Promise<Uint8Array> {
  if (kind === 'template') {
    return fetchBinary(`${API_URL}/plugins/pdf/templates/${id}/file`);
  }
  return fetchBinary(`${API_URL}/plugins/pdf/saved/${encodeURIComponent(id)}/file`);
}

// ---------------------------------------------------------------------------
// Détection des champs modifiables (AcroForm)
// ---------------------------------------------------------------------------

function decodePdfString(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    if (value instanceof PDFHexString || value?.constructor?.name === 'PDFHexString') {
      return value.decodeText();
    }
  } catch {
    /* ignore */
  }
  try {
    if (value instanceof PDFString || value?.constructor?.name === 'PDFString') {
      return value.decodeText();
    }
  } catch {
    /* ignore */
  }
  return String(value ?? '');
}

export async function detectPdfFields(bytes: Uint8Array): Promise<PdfFieldInfo[]> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  const seen = new Set<string>();
  const fields: PdfFieldInfo[] = [];

  for (const field of form.getFields()) {
    let name = '';
    try {
      name = field.getName();
    } catch {
      continue;
    }
    if (!name || seen.has(name)) continue;
    seen.add(name);
    let type = 'text';
    try {
      type = field.constructor.name.replace(/Field$/, '').toLowerCase();
    } catch {
      /* ignore */
    }
    fields.push({ name, type, pages: [] });
  }

  // Localise chaque champ terminal sur une page (pour affichage ordonné / infos)
  try {
    const acroForm = doc.catalog.getIfExists(doc.context.lookup(doc.catalog.AcroForm()));
    const fieldsRef =
      acroForm instanceof PDFDict ? (acroForm as PDFDict).get(PDFName.of('Fields')) : undefined;
    const topFields = fieldsRef instanceof PDFArray ? (fieldsRef as PDFArray) : null;
    if (topFields) {
      const pageRefs: any[] = [];
      for (let p = 0; p < doc.getPageCount(); p++) {
        pageRefs.push(doc.getPage(p).node.ref());
      }
      const walk = (ref: any, pageIndexes: Set<number>) => {
        const obj: any = doc.context.lookup(ref);
        if (!(obj instanceof PDFDict)) return;
        const dict = obj as PDFDict;
        const kids = dict.get(PDFName.of('Kids'));
        if (kids instanceof PDFArray) {
          for (let i = 0; i < (kids as PDFArray).size(); i++) {
            walk((kids as PDFArray).get(i), pageIndexes);
          }
        } else {
          const parentRef = dict.get(PDFName.of('Parent'));
          let current = parentRef;
          while (current) {
            const parentObj: any = doc.context.lookup(current);
            if (!(parentObj instanceof PDFDict)) break;
            const typeVal = decodePdfString((parentObj as PDFDict).get(PDFName.of('Type')));
            if (typeVal === '/Page') {
              const idx = pageRefs.findIndex((pr: any) => pr === current || pr?.toString?.() === current?.toString?.());
              if (idx >= 0) pageIndexes.add(idx + 1);
              break;
            }
            current = (parentObj as PDFDict).get(PDFName.of('Parent'));
          }
        }
      };
      for (let i = 0; i < topFields.size(); i++) {
        const ref = topFields.get(i);
        const info = { pages: new Set<number>() };
        walk(ref, info.pages);
        const name = decodePdfString(
          (() => {
            const obj: any = doc.context.lookup(ref);
            return obj instanceof PDFDict ? (obj as PDFDict).get(PDFName.of('T')) : undefined;
          })()
        );
        const found = fields.find((f) => f.name === name);
        if (found) found.pages = Array.from(info.pages).sort((a, b) => a - b);
      }
    }
  } catch {
    /* le mapping des pages est optionnel */
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Extraction de valeur "texte" depuis une propriété de collection
// ---------------------------------------------------------------------------

export function extractPropertyValue(prop: any, rawValue: any, collections: any[] = []): string {
  if (rawValue === null || rawValue === undefined) return '';

  // Relation : on résout l'item lié pour prendre son champ "titre" (ou premier champ texte)
  if (prop?.type === 'relation') {
    const ids = normalizeRelationIds(rawValue);
    if (ids.length === 0) return '';
    const targetCollectionId = prop.targetCollectionId || prop.collectionId;
    const target = collections.find((c: any) => c.id === targetCollectionId);
    const labels = ids.map((itemId: string) => resolveItemLabel(target, itemId)).filter(Boolean);
    return labels.join(', ');
  }

  if (typeof rawValue === 'boolean') return rawValue ? 'true' : 'false';
  if (typeof rawValue === 'number') return String(rawValue);
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    // Rich text Tiptap sérialisé ou JSON
    if (trimmed.startsWith('{') && trimmed.includes('"type":"doc"')) {
      try {
        const doc = JSON.parse(trimmed);
        return collectTiptapText(doc).join('\n');
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (Array.isArray(rawValue)) {
    return rawValue
      .map((v) => (typeof v === 'object' ? String(v?.name ?? v?.label ?? '') : String(v)))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof rawValue === 'object') {
    return String(rawValue.name ?? rawValue.label ?? rawValue.value ?? '');
  }
  return String(rawValue);
}

function resolveItemLabel(collection: any, itemId: string): string {
  if (!collection) return '';
  const items = Array.isArray(collection.items) ? collection.items : [];
  const item = items.find((i: any) => String(i.id) === String(itemId));
  if (!item) return '';
  const props = Array.isArray(collection.properties) ? collection.properties : [];
  const nameProp = props.find((p: any) => p.isNameField) || props.find((p: any) => p.type === 'text') || props[0];
  if (nameProp) {
    const direct = item[nameProp.id] ?? item.data?.[nameProp.id];
    const text = extractPropertyValue(nameProp, direct, []);
    if (text) return text;
  }
  return String(item.name || item.title || '');
}

function collectTiptapText(node: any, out: string[] = []) {
  if (!node || typeof node !== 'object') return out;
  if (typeof node.text === 'string') out.push(node.text);
  if (Array.isArray(node.content)) node.content.forEach((c: any) => collectTiptapText(c, out));
  return out;
}

// ---------------------------------------------------------------------------
// Calcul des valeurs à injecter dans le PDF (mapping + override manuel)
// ---------------------------------------------------------------------------

export interface ResolvedPdfValues {
  /** valeurs finales (override manuel prioritaire si enabled) */
  values: Record<string, string>;
  /** valeurs calculées depuis le mapping (avant override) */
  mappedValues: Record<string, string>;
  /** vrais si l'utilisateur a édité manuellement le champ */
  manualFields: Record<string, boolean>;
}

export function resolvePdfValues(params: {
  fields: PdfFieldInfo[];
  mapping: Record<string, string>; // champPdf -> propertyId
  properties: any[]; // propriétés de la collection
  formData: Record<string, any>; // données de l'item en cours d'édition
  collections: any[];
  manualValues?: Record<string, string>; // éditions manuelles utilisateur
  manualOverride?: boolean; // défaut true : le manuel prend le dessus
}): ResolvedPdfValues {
  const {
    fields,
    mapping,
    properties,
    formData,
    collections,
    manualValues = {},
    manualOverride = true,
  } = params;

  const mappedValues: Record<string, string> = {};
  const manualFields: Record<string, boolean> = {};
  const values: Record<string, string> = {};

  for (const field of fields) {
    const propId = mapping?.[field.name];
    let mapped = '';
    if (propId) {
      const prop = properties.find((p: any) => p.id === propId);
      if (prop) mapped = extractPropertyValue(prop, formData?.[propId], collections);
    }
    mappedValues[field.name] = mapped;

    const hasManual = Object.prototype.hasOwnProperty.call(manualValues, field.name);
    manualFields[field.name] = hasManual;

    // Règle clé : si l'utilisateur a modifié le champ lui-même, cela prend le dessus
    if (manualOverride && hasManual) {
      values[field.name] = manualValues[field.name] ?? '';
    } else {
      values[field.name] = mapped;
    }
  }

  return { values, mappedValues, manualFields };
}

// ---------------------------------------------------------------------------
// Remplissage + sauvegarde
// ---------------------------------------------------------------------------

export async function fillPdfBytes(
  templateBytes: Uint8Array,
  values: Record<string, string>,
  options: { flatten?: boolean } = {}
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const form = doc.getForm();

  for (const [name, value] of Object.entries(values)) {
    try {
      const field = form.getFieldMaybe(name);
      if (!field) continue;
      const ctor = field.constructor.name;
      if (ctor === 'PDFTextField') {
        field.setText(value ?? '');
      } else if (ctor === 'PDFCheckBox') {
        const truthy = /^(true|1|oui|yes|on|x)$/i.test(String(value ?? '').trim());
        if (truthy) (field as any).check();
        else (field as any).uncheck();
      } else if (ctor === 'PDFDropdown') {
        if (value) (field as any).select(value);
      } else if (ctor === 'PDFOptionList') {
        if (value) (field as any).select([value]);
      }
      // radio : value attend l'état ("On"/nom d'option) — best effort
      if (ctor === 'PDFRadioGroup') {
        try {
          const states = (field as any).getOptions?.() || [];
          const target = states.find((s: string) => s === value) || states[0];
          if (target) (field as any).select(target);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      console.warn(`[PDF Plugin] Impossible de remplir le champ "${name}":`, err);
    }
  }

  if (options.flatten) {
    try {
      form.flatten();
    } catch (err) {
      console.warn('[PDF Plugin] Aplatissement impossible:', err);
    }
  }

  return doc.save();
}

export function downloadBlob(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function uploadPdfTemplate(organizationId: string, file: File): Promise<PdfTemplateMeta> {
  const buffer = await file.arrayBuffer();
  const fields = await detectPdfFields(new Uint8Array(buffer)).catch(() => [] as PdfFieldInfo[]);
  const res = await fetch(`${API_URL}/plugins/pdf/templates/${encodeURIComponent(organizationId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      name: file.name,
      data: bytesToBase64(buffer),
      fields,
    }),
  });
  if (!res.ok) throw new Error(`Upload du template impossible: ${await res.text()}`);
  return res.json();
}

export async function saveItemPdf(params: {
  organizationId: string;
  collectionId: string;
  itemId: string;
  templateId: string;
  bytes: Uint8Array;
  values: Record<string, string>;
}): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/plugins/pdf/saved`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      organizationId: params.organizationId,
      collectionId: params.collectionId,
      itemId: params.itemId,
      templateId: params.templateId,
      data: bytesToBase64(params.bytes),
      values: params.values,
    }),
  });
  if (!res.ok) throw new Error(`Sauvegarde du PDF impossible: ${await res.text()}`);
  return res.json();
}

export async function getSavedItemPdf(
  organizationId: string,
  collectionId: string,
  itemId: string
): Promise<{ id: string; templateId: string; values: Record<string, string>; updatedAt: string } | null> {
  try {
    const res = await fetch(
      `${API_URL}/plugins/pdf/saved/${encodeURIComponent(organizationId)}/${encodeURIComponent(
        collectionId
      )}/${encodeURIComponent(itemId)}`,
      { credentials: 'include' }
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json && json.id ? json : null;
  } catch {
    return null;
  }
}
