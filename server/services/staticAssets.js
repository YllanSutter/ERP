import express from 'express';
import path from 'node:path';
export function registerStaticAssets(app, directory) {
  app.use('/assets', express.static(path.join(directory, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(directory, { setHeaders(res, filePath) { if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
}
