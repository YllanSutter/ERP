import { logger } from '../../services/logger.js';
/**
 * Plugin PDF - Serveur
 *
 * Routes :
 *  POST /api/plugins/pdf/templates/:organizationId      -> upload d'un modèle (base64) + détection des champs
 *  GET  /api/plugins/pdf/templates/:id/file             -> sert le binaire du modèle
 *  GET  /api/plugins/pdf/templates                      -> liste les modèles de l'organisation active
 *  POST /api/plugins/pdf/saved                          -> sauvegarde un PDF rempli pour un item
 *  GET  /api/plugins/pdf/saved/:org/:col/:item          -> métadonnées du PDF sauvegardé pour un item
 *  GET  /api/plugins/pdf/saved/:id/file                 -> binaire du PDF sauvegardé
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const STORAGE_DIR = path.join(PROJECT_ROOT, 'data', 'pdf-plugin');
const TEMPLATES_DIR = path.join(STORAGE_DIR, 'templates');
const SAVED_DIR = path.join(STORAGE_DIR, 'saved');

const ensureDir = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    logger.error('[PDF Plugin] Impossible de créer le dossier', dir, err);
  }
};

const safeId = (value) => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');

const readMetaFile = (file) => {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

export const pdfServerPlugin = {
  id: 'pdf',
  register: ({ app, deps }) => {
    const { requireAuth, pool } = deps;

    ensureDir(TEMPLATES_DIR);
    ensureDir(SAVED_DIR);

    // ------------------------------------------------------------------
    // Templates (modèles liés dans les paramètres du plugin)
    // ------------------------------------------------------------------
    app.post('/api/plugins/pdf/templates/:organizationId', requireAuth, async (req, res) => {
      try {
        const organizationId = safeId(req.params.organizationId);
        const activeOrganizationId = safeId(req.auth?.activeOrganization?.id);
        if (!organizationId || organizationId !== activeOrganizationId) {
          return res.status(403).json({ error: 'Organization mismatch' });
        }

        const { name, data, fields } = req.body || {};
        if (!name || !data) {
          return res.status(400).json({ error: 'name and data (base64) are required' });
        }

        const buffer = Buffer.from(String(data), 'base64');
        if (buffer.length < 5 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
          return res.status(400).json({ error: 'Le fichier fourni ne semble pas être un PDF valide' });
        }
        if (buffer.length > 25 * 1024 * 1024) {
          return res.status(413).json({ error: 'PDF trop volumineux (max 25 Mo)' });
        }

        const templateId = `tpl_${crypto.randomUUID()}`;
        const binPath = path.join(TEMPLATES_DIR, `${templateId}.pdf`);
        const metaPath = path.join(TEMPLATES_DIR, `${templateId}.meta.json`);

        fs.writeFileSync(binPath, buffer);

        const meta = {
          id: templateId,
          organizationId,
          name: String(name),
          size: buffer.length,
          uploadedAt: new Date().toISOString(),
          fields: Array.isArray(fields) ? fields : [],
        };
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        return res.json(meta);
      } catch (error) {
        logger.error('[PDF Plugin] Template upload error:', error);
        return res.status(500).json({ error: 'Failed to store PDF template' });
      }
    });

    app.get('/api/plugins/pdf/templates/:templateId/file', requireAuth, async (req, res) => {
      try {
        const templateId = safeId(req.params.templateId);
        const binPath = path.join(TEMPLATES_DIR, `${templateId}.pdf`);
        if (!templateId || !fs.existsSync(binPath)) {
          return res.status(404).json({ error: 'Template introuvable' });
        }
        const meta = readMetaFile(path.join(TEMPLATES_DIR, `${templateId}.meta.json`));
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${encodeURIComponent(meta?.name || `${templateId}.pdf`)}"`
        );
        return fs.createReadStream(binPath).pipe(res);
      } catch (error) {
        logger.error('[PDF Plugin] Template file error:', error);
        return res.status(500).json({ error: 'Failed to read template' });
      }
    });

    app.get('/api/plugins/pdf/templates', requireAuth, async (req, res) => {
      try {
        const organizationId = safeId(req.query.organizationId || req.auth?.activeOrganization?.id);
        const metas = [];
        for (const file of fs.readdirSync(TEMPLATES_DIR)) {
          if (!file.endsWith('.meta.json')) continue;
          const meta = readMetaFile(path.join(TEMPLATES_DIR, file));
          if (meta && (!organizationId || meta.organizationId === organizationId)) metas.push(meta);
        }
        metas.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
        return res.json(metas);
      } catch (error) {
        logger.error('[PDF Plugin] Templates list error:', error);
        return res.status(500).json({ error: 'Failed to list templates' });
      }
    });

    // ------------------------------------------------------------------
    // PDFs sauvegardés par item
    // ------------------------------------------------------------------
    app.post('/api/plugins/pdf/saved', requireAuth, async (req, res) => {
      try {
        const { organizationId, collectionId, itemId, templateId, data, values } = req.body || {};
        const org = safeId(organizationId);
        const col = safeId(collectionId);
        const item = safeId(itemId);
        const activeOrganizationId = safeId(req.auth?.activeOrganization?.id);
        if (!org || org !== activeOrganizationId) {
          return res.status(403).json({ error: 'Organization mismatch' });
        }
        if (!col || !item || !data) {
          return res.status(400).json({ error: 'collectionId, itemId and data (base64) are required' });
        }

        const buffer = Buffer.from(String(data), 'base64');
        if (buffer.length < 5 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
          return res.status(400).json({ error: 'Contenu PDF invalide' });
        }

        const savedId = `pdf_${org}_${col}_${item}`;
        const binPath = path.join(SAVED_DIR, `${savedId}.pdf`);
        const metaPath = path.join(SAVED_DIR, `${savedId}.meta.json`);

        fs.writeFileSync(binPath, buffer);
        const meta = {
          id: savedId,
          organizationId: org,
          collectionId: col,
          itemId: item,
          templateId: templateId ? safeId(templateId) : null,
          values: values && typeof values === 'object' ? values : {},
          updatedAt: new Date().toISOString(),
          size: buffer.length,
        };
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        // Index en base (best effort : le serveur peut tourner sans Postgres)
        try {
          if (pool) {
            await pool.query(
              `INSERT INTO pdf_plugin_saved_pdfs
                 (id, organization_id, collection_id, item_id, template_id, storage_key, values, updated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
               ON CONFLICT (id) DO UPDATE SET
                 template_id = EXCLUDED.template_id,
                 storage_key = EXCLUDED.storage_key,
                 values = EXCLUDED.values,
                 updated_at = NOW()`,
              [savedId, org, col, item, meta.templateId, `${savedId}.pdf`, JSON.stringify(meta.values)]
            );
          }
        } catch (dbErr) {
          logger.warn('[PDF Plugin] Index DB indisponible (stockage fichier uniquement):', dbErr?.message);
        }

        return res.json(meta);
      } catch (error) {
        logger.error('[PDF Plugin] Save error:', error);
        return res.status(500).json({ error: 'Failed to save item PDF' });
      }
    });

    app.get(
      '/api/plugins/pdf/saved/:organizationId/:collectionId/:itemId',
      requireAuth,
      async (req, res) => {
        try {
          const org = safeId(req.params.organizationId);
          const col = safeId(req.params.collectionId);
          const item = safeId(req.params.itemId);
          const activeOrganizationId = safeId(req.auth?.activeOrganization?.id);
          if (org !== activeOrganizationId) {
            return res.status(403).json({ error: 'Organization mismatch' });
          }
          const savedId = `pdf_${org}_${col}_${item}`;
          const meta = readMetaFile(path.join(SAVED_DIR, `${savedId}.meta.json`));
          if (!meta) return res.json(null);
          return res.json(meta);
        } catch (error) {
          logger.error('[PDF Plugin] Saved lookup error:', error);
          return res.status(500).json({ error: 'Failed to load saved PDF' });
        }
      }
    );

    app.get('/api/plugins/pdf/saved/:savedId/file', requireAuth, async (req, res) => {
      try {
        const savedId = safeId(req.params.savedId);
        const meta = readMetaFile(path.join(SAVED_DIR, `${savedId}.meta.json`));
        if (!meta) return res.status(404).json({ error: 'PDF sauvegardé introuvable' });
        const activeOrganizationId = safeId(req.auth?.activeOrganization?.id);
        if (meta.organizationId !== activeOrganizationId) {
          return res.status(403).json({ error: 'Organization mismatch' });
        }
        const binPath = path.join(SAVED_DIR, `${savedId}.pdf`);
        if (!fs.existsSync(binPath)) return res.status(404).json({ error: 'Fichier PDF introuvable' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${savedId}.pdf"`);
        return fs.createReadStream(binPath).pipe(res);
      } catch (error) {
        logger.error('[PDF Plugin] Saved file error:', error);
        return res.status(500).json({ error: 'Failed to read saved PDF' });
      }
    });
  },
};
