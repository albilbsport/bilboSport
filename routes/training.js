const express = require('express');
const path = require('path');
const db = require('../db/database');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculate1RM(weightKg, reps) {
  const w = parseFloat(weightKg);
  const r = parseInt(reps, 10);
  if (!w || w <= 0 || !r || r <= 0) return null;
  if (r === 1) return Math.round(w * 10) / 10;
  // Epley formula: w * (1 + r / 30)
  return Math.round(w * (1 + r / 30) * 10) / 10;
}

// GET /training
router.get('/training', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/training.html'));
});

// GET /api/training/today
router.get('/api/training/today', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const targetDate = req.query.date || getTodayString();

  try {
    const sets = db.prepare(`
      SELECT s.id, s.exercise_id, s.session_date, s.set_number,
             s.weight_kg, s.reps, s.duration_seconds, s.one_rm, s.notes, s.created_at,
             e.name as exercise_name, e.body_part, e.measure_type, e.category, e.equipment, e.gif_url, e.image_url
      FROM sets s
      JOIN exercises e ON s.exercise_id = e.id
      WHERE s.user_id = ? AND s.session_date = ?
      ORDER BY s.exercise_id ASC, s.set_number ASC, s.id ASC
    `).all(userId, targetDate);

    res.json({
      date: targetDate,
      sets
    });
  } catch (err) {
    console.error('Error en /api/training/today:', err);
    res.status(500).json({ error: 'Error al obtener series del entrenamiento' });
  }
});

// POST /api/sets
router.post('/api/sets', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const {
    exercise_id,
    session_date,
    weight_kg,
    reps,
    duration_seconds,
    notes
  } = req.body;

  if (!exercise_id) {
    return res.status(400).json({ error: 'Debes seleccionar un ejercicio' });
  }

  try {
    const exercise = db.prepare(`
      SELECT id, name, measure_type FROM exercises
      WHERE id = ? AND (is_global = 1 OR user_id = ?)
    `).get(exercise_id, userId);

    if (!exercise) {
      return res.status(404).json({ error: 'Ejercicio no encontrado' });
    }

    const date = session_date && /^\d{4}-\d{2}-\d{2}$/.test(session_date)
      ? session_date
      : getTodayString();

    const weight = weight_kg !== undefined && weight_kg !== '' ? parseFloat(weight_kg) : 0;
    const repsInt = reps !== undefined && reps !== '' ? parseInt(reps, 10) : null;
    const duration = duration_seconds !== undefined && duration_seconds !== '' ? parseInt(duration_seconds, 10) : null;
    const cleanNotes = notes ? String(notes).trim() : null;

    if (exercise.measure_type === 'reps' && (repsInt === null || isNaN(repsInt) || repsInt < 1)) {
      return res.status(400).json({ error: 'Indica un número válido de repeticiones' });
    }

    if (exercise.measure_type === 'time' && (duration === null || isNaN(duration) || duration < 1)) {
      return res.status(400).json({ error: 'Indica una duración válida en segundos' });
    }

    // Auto calculate set_number
    const maxSet = db.prepare(`
      SELECT COALESCE(MAX(set_number), 0) as last_set
      FROM sets
      WHERE user_id = ? AND exercise_id = ? AND session_date = ?
    `).get(userId, exercise_id, date);

    const nextSetNumber = (maxSet ? maxSet.last_set : 0) + 1;
    const oneRm = calculate1RM(weight, repsInt);

    const insertResult = db.prepare(`
      INSERT INTO sets (
        user_id, exercise_id, session_date, set_number,
        weight_kg, reps, duration_seconds, one_rm, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      userId,
      exercise_id,
      date,
      nextSetNumber,
      weight,
      repsInt,
      duration,
      oneRm,
      cleanNotes
    );

    const createdSet = db.prepare(`
      SELECT s.id, s.exercise_id, s.session_date, s.set_number,
             s.weight_kg, s.reps, s.duration_seconds, s.one_rm, s.notes,
             e.name as exercise_name, e.measure_type
      FROM sets s
      JOIN exercises e ON s.exercise_id = e.id
      WHERE s.id = ?
    `).get(insertResult.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Serie registrada correctamente',
      set: createdSet,
      one_rm: oneRm
    });
  } catch (err) {
    console.error('Error en POST /api/sets:', err);
    res.status(500).json({ error: 'Error al registrar la serie' });
  }
});

// DELETE /api/sets/:id
router.delete('/api/sets/:id', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const setId = parseInt(req.params.id, 10);

  if (!setId || isNaN(setId)) {
    return res.status(400).json({ error: 'ID de serie inválido' });
  }

  try {
    const existing = db.prepare('SELECT id, user_id FROM sets WHERE id = ?').get(setId);
    if (!existing) {
      return res.status(404).json({ error: 'Serie no encontrada' });
    }

    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta serie' });
    }

    db.prepare('DELETE FROM sets WHERE id = ?').run(setId);
    res.json({ success: true, message: 'Serie eliminada' });
  } catch (err) {
    console.error('Error en DELETE /api/sets/:id:', err);
    res.status(500).json({ error: 'Error al eliminar la serie' });
  }
});

// GET /api/training/history-sets?exercise_id=&limit=5
router.get('/api/training/history-sets', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const exerciseId = parseInt(req.query.exercise_id, 10);
  const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);

  if (!exerciseId || isNaN(exerciseId)) {
    return res.status(400).json({ error: 'exercise_id requerido' });
  }

  try {
    const historySets = db.prepare(`
      SELECT id, session_date, set_number, weight_kg, reps, duration_seconds, one_rm, notes, created_at
      FROM sets
      WHERE user_id = ? AND exercise_id = ?
      ORDER BY session_date DESC, id DESC
      LIMIT ?
    `).all(userId, exerciseId, limit);

    res.json({
      exercise_id: exerciseId,
      history: historySets
    });
  } catch (err) {
    console.error('Error en /api/training/history-sets:', err);
    res.status(500).json({ error: 'Error al obtener histórico de series' });
  }
});

module.exports = router;
