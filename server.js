const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs');

// Optional dotenv loading if .env exists
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch (e) {
  // Ignore dotenv reading error
}

// 1. Initialize Database & Seed
const db = require('./db/database');
const { seedDatabase } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxies (Railway, Heroku, etc.)
app.set('trust proxy', 1);

// Body parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration with SQLite store
const sessionsDir = path.dirname(db.dbPath);
if (!fs.existsSync(sessionsDir)) {
  fs.mkdirSync(sessionsDir, { recursive: true });
}

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: sessionsDir,
    table: 'sessions'
  }),
  secret: process.env.SESSION_SECRET || 'bilboag_session_secret_key_strength_2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax',
    secure: false // Allows both http localhost and reverse-proxied https
  }
}));

// Static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const trainingRoutes = require('./routes/training');
const exerciseRoutes = require('./routes/exercises');
const historyRoutes = require('./routes/history');
const exportRoutes = require('./routes/export');
const adminRoutes = require('./routes/admin');

app.use('/', authRoutes);
app.use('/', dashboardRoutes);
app.use('/', trainingRoutes);
app.use('/', exerciseRoutes);
app.use('/', historyRoutes);
app.use('/', exportRoutes);
app.use('/', adminRoutes);

// 404 handler
app.use((req, res) => {
  const isApi = req.xhr || req.path.startsWith('/api/') || req.headers.accept?.includes('application/json');
  if (isApi) {
    return res.status(404).json({ error: 'Ruta no encontrada' });
  }
  res.status(404).redirect('/');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  const isApi = req.xhr || req.path.startsWith('/api/') || req.headers.accept?.includes('application/json');
  if (isApi) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
  res.status(500).send('Error interno del servidor');
});

// Run seed then start server
async function startServer() {
  try {
    console.log('[Server] Verificando base de datos y ejecutando seed...');
    await seedDatabase();
    console.log('[Server] Base de datos lista.');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] BilboAG listo y escuchando en http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Error al iniciar la aplicación:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
