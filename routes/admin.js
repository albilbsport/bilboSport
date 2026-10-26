const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const db = require('../db/database');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// Configure multer in memory (limit 50MB for SQLite database)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// All routes in this file require admin privileges
router.use(requireAdmin);

// GET /admin -> redirect to /admin/users
router.get('/admin', (req, res) => {
  res.redirect('/admin/users');
});

// GET /admin/users -> serve admin/users.html
router.get('/admin/users', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/admin/users.html'));
});

// GET /admin/backup -> serve admin/backup.html
router.get('/admin/backup', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/admin/backup.html'));
});

// GET /api/admin/users -> list all users
router.get('/api/admin/users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, email, role, is_approved, created_at,
             (SELECT COUNT(*) FROM sets WHERE user_id = users.id) as total_sets
      FROM users
      ORDER BY is_approved ASC, created_at DESC
    `).all();

    res.json({ users });
  } catch (err) {
    console.error('Error obteniendo usuarios en admin:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/admin/users/:id/approve -> approve pending user
router.post('/api/admin/users/:id/approve', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!targetId || isNaN(targetId)) {
    return res.status(400).json({ error: 'ID de usuario inválido' });
  }

  try {
    const result = db.prepare('UPDATE users SET is_approved = 1 WHERE id = ?').run(targetId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ success: true, message: 'Usuario aprobado con éxito' });
  } catch (err) {
    console.error('Error aprobando usuario:', err);
    res.status(500).json({ error: 'Error al aprobar usuario' });
  }
});

// POST /api/admin/users/:id/reject -> reject and delete pending user
router.post('/api/admin/users/:id/reject', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!targetId || isNaN(targetId)) {
    return res.status(400).json({ error: 'ID de usuario inválido' });
  }

  try {
    const user = db.prepare('SELECT id, is_approved FROM users WHERE id = ?').get(targetId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user.is_approved === 1) {
      return res.status(400).json({ error: 'El usuario ya ha sido aprobado. Para eliminarlo usa la opción de eliminar.' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    res.json({ success: true, message: 'Solicitud de usuario rechazada' });
  } catch (err) {
    console.error('Error rechazando usuario:', err);
    res.status(500).json({ error: 'Error al rechazar usuario' });
  }
});

// POST /api/admin/users/:id/password -> change user password
router.post('/api/admin/users/:id/password', async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const { newPassword } = req.body;

  if (!targetId || isNaN(targetId)) {
    return res.status(400).json({ error: 'ID de usuario inválido' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(targetId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, targetId);

    res.json({ success: true, message: `Contraseña actualizada para ${user.username}` });
  } catch (err) {
    console.error('Error cambiando contraseña:', err);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
});

// DELETE /api/admin/users/:id -> delete user and cascade data
router.delete('/api/admin/users/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  if (!targetId || isNaN(targetId)) {
    return res.status(400).json({ error: 'ID de usuario inválido' });
  }

  if (targetId === req.session.userId) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador' });
  }

  try {
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(targetId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM sets WHERE user_id = ?').run(targetId);
      db.prepare('DELETE FROM exercises WHERE user_id = ?').run(targetId);
      db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
    });
    deleteTx();

    res.json({ success: true, message: `Usuario ${user.username} eliminado correctamente` });
  } catch (err) {
    console.error('Error eliminando usuario:', err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// GET /api/admin/backup -> download database binary file
router.get('/api/admin/backup', (req, res) => {
  try {
    // Checkpoint WAL to flush all transactions into main database file
    db.pragma('wal_checkpoint(TRUNCATE)');

    const dbFilePath = db.dbPath;
    if (!fs.existsSync(dbFilePath)) {
      return res.status(404).json({ error: 'Archivo de base de datos no encontrado' });
    }

    const today = new Date().toISOString().split('T')[0];
    const filename = `bilboag-backup-${today}.db`;

    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const fileStream = fs.createReadStream(dbFilePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Error generando backup:', err);
    res.status(500).json({ error: 'Error al generar backup de la base de datos' });
  }
});

// POST /api/admin/restore -> upload .db file, validate, backup old, replace, reopen
router.post('/api/admin/restore', upload.single('database_file'), (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No se ha subido ningún archivo de base de datos' });
  }

  const buffer = req.file.buffer;

  // Validate SQLite header magic bytes (must start with "SQLite format 3\0")
  const magic = buffer.subarray(0, 16).toString('utf8');
  if (!magic.startsWith('SQLite format 3')) {
    return res.status(400).json({ error: 'El archivo subido no es una base de datos SQLite válida' });
  }

  try {
    const currentPath = db.dbPath;
    const backupOldPath = `${currentPath}.backup-${Date.now()}`;

    // 1. Flush & close active database
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (e) {
      // ignore pragma error if db already in close state
    }
    db.close();

    // 2. Make backup of the current database file if it exists
    if (fs.existsSync(currentPath)) {
      fs.copyFileSync(currentPath, backupOldPath);
    }

    // 3. Remove existing WAL / SHM files if present
    if (fs.existsSync(`${currentPath}-wal`)) {
      try { fs.unlinkSync(`${currentPath}-wal`); } catch (e) {}
    }
    if (fs.existsSync(`${currentPath}-shm`)) {
      try { fs.unlinkSync(`${currentPath}-shm`); } catch (e) {}
    }

    // 4. Overwrite database with the uploaded buffer
    fs.writeFileSync(currentPath, buffer);

    // 5. Reopen connection
    db.reopen(currentPath);

    res.json({
      success: true,
      message: 'Base de datos restaurada con éxito. La página se recargará automáticamente.'
    });
  } catch (err) {
    console.error('Error restaurando base de datos:', err);
    try {
      db.reopen();
    } catch (e) {}
    res.status(500).json({ error: `Error durante la restauración: ${err.message}` });
  }
});

module.exports = router;
