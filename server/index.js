import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({ ok: true, message: 'API server is running' });
});

const dataDir = path.join(process.cwd(), 'server');
const dbPath = path.join(dataDir, 'data.sqlite');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.exec(
  `CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
  );`
);

const getStateStmt = db.prepare('SELECT data FROM app_state WHERE id = 1');
const upsertStateStmt = db.prepare(
  'INSERT INTO app_state (id, data) VALUES (1, @data) ON CONFLICT(id) DO UPDATE SET data = excluded.data;'
);

app.get('/state', (_req, res) => {
  try {
    const row = getStateStmt.get();
    if (!row) {
      return res.json({});
    }
    const parsed = JSON.parse(row.data);
    return res.json(parsed);
  } catch (err) {
    console.error('Failed to load state', err);
    return res.status(500).json({ error: 'Failed to load state' });
  }
});

app.post('/state', (req, res) => {
  try {
    const payload = req.body ?? {};
    upsertStateStmt.run({ data: JSON.stringify(payload) });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to save state', err);
    return res.status(500).json({ error: 'Failed to save state' });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
