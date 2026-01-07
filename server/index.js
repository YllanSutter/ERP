import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'erp_db',
});

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({ ok: true, message: 'API server is running' });
});

// Initialize database table
(async () => {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS app_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        data TEXT NOT NULL
      );`
    );
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
})();

app.get('/state', async (_req, res) => {
  try {
    const result = await pool.query('SELECT data FROM app_state WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json({});
    }
    const parsed = JSON.parse(result.rows[0].data);
    return res.json(parsed);
  } catch (err) {
    console.error('Failed to load state', err);
    return res.status(500).json({ error: 'Failed to load state' });
  }
});

app.post('/state', async (req, res) => {
  try {
    const payload = req.body ?? {};
    const dataStr = JSON.stringify(payload);
    
    // Try to update, if no rows affected, insert
    const updateResult = await pool.query(
      'UPDATE app_state SET data = $1 WHERE id = 1',
      [dataStr]
    );
    
    if (updateResult.rowCount === 0) {
      await pool.query(
        'INSERT INTO app_state (id, data) VALUES (1, $1)',
        [dataStr]
      );
    }
    
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to save state', err);
    return res.status(500).json({ error: 'Failed to save state' });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  await pool.end();
  process.exit(0);
});
