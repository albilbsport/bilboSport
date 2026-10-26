const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/bilboag.db');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

let db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function runMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS db_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = database.prepare('SELECT version FROM db_migrations').all();
  const applied = appliedRows.map(r => r.version);

  if (!applied.includes(1)) {
    const migration1 = database.transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
          is_approved INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          external_id TEXT,
          name TEXT NOT NULL,
          body_part TEXT,
          category TEXT,
          equipment TEXT,
          target TEXT,
          muscle_group TEXT,
          measure_type TEXT NOT NULL DEFAULT 'reps' CHECK(measure_type IN ('reps','time')),
          is_global INTEGER NOT NULL DEFAULT 1,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          gif_url TEXT,
          image_url TEXT,
          instructions_es TEXT,
          instructions_en TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          exercise_id INTEGER NOT NULL REFERENCES exercises(id),
          session_date TEXT NOT NULL,
          set_number INTEGER NOT NULL DEFAULT 1,
          weight_kg REAL NOT NULL DEFAULT 0,
          reps INTEGER,
          duration_seconds INTEGER,
          one_rm REAL,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_sets_user_date ON sets(user_id, session_date);
        CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exercise_id);

        INSERT INTO db_migrations (version, applied_at) VALUES (1, datetime('now'));
      `);
    });
    migration1();
  }
}

runMigrations(db);

const dbProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === 'close') {
      return () => {
        if (db && db.open) {
          db.close();
        }
      };
    }
    if (prop === 'reopen') {
      return (newPath) => {
        if (db && db.open) {
          db.close();
        }
        db = new Database(newPath || dbPath);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        runMigrations(db);
        return db;
      };
    }
    if (prop === 'dbPath') {
      return dbPath;
    }
    if (prop === 'rawDb') {
      return db;
    }
    const value = db[prop];
    if (typeof value === 'function') {
      return value.bind(db);
    }
    return value;
  }
});

module.exports = dbProxy;
