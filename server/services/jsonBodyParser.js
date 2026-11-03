import express from 'express';

// L'enregistrement d'un ajout contient l'ensemble de l'état ERP.
export function createJsonBodyParser(limit = process.env.JSON_BODY_LIMIT || '50mb') {
  const parser = express.json({ limit });
  return (req, res, next) => parser(req, res, (error) => {
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({
        error: 'Les données dépassent la taille maximale autorisée pour un enregistrement.',
        code: 'PAYLOAD_TOO_LARGE',
      });
    }
    next(error);
  });
}
