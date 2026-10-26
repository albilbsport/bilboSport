const express = require('express');
const path = require('path');
const db = require('../db/database');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// GET /history
router.get('/history', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/history.html'));
});

// GET /api/history
router.get('/api/history', requireAuth, (req, res) => {
  const userId = req.session.userId;

  try {
    const sessions = db.prepare(`
      SELECT session_date as date,
             COUNT(DISTINCT exercise_id) as exercise_count,
             COUNT(id) as set_count,
             MAX(one_rm) as best_1rm,
             ROUND(SUM(weight_kg * COALESCE(reps, 1)), 1) as total_volume
      FROM sets
      WHERE user_id = ?
      GROUP BY session_date
      ORDER BY session_date DESC
    `).all(userId).map(s => ({
      date: s.date,
      exercise_count: s.exercise_count,
      set_count: s.set_count,
      best_1rm: s.best_1rm ? Math.round(s.best_1rm * 10) / 10 : null,
      total_volume: s.total_volume || 0
    }));

    res.json({
      sessions
    });
  } catch (err) {
    console.error('Error en /api/history:', err);
    res.status(500).json({ error: 'Error al obtener historial de entrenamientos' });
  }
});

// GET /api/history/:date
router.get('/api/history/:date', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const targetDate = req.params.date;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return res.status(400).json({ error: 'Formato de fecha inválido (debe ser YYYY-MM-DD)' });
  }

  try {
    const rawSets = db.prepare(`
      SELECT s.id, s.exercise_id, s.set_number, s.weight_kg, s.reps,
             s.duration_seconds, s.one_rm, s.notes, s.created_at,
             e.name as exercise_name, e.body_part, e.measure_type, e.category, e.equipment
      FROM sets s
      JOIN exercises e ON s.exercise_id = e.id
      WHERE s.user_id = ? AND s.session_date = ?
      ORDER BY e.name ASC, s.set_number ASC, s.id ASC
    `).all(userId, targetDate);

    // Group by exercise
    const exerciseMap = new Map();

    for (const s of rawSets) {
      if (!exerciseMap.has(s.exercise_id)) {
        exerciseMap.set(s.exercise_id, {
          exercise_id: s.exercise_id,
          name: s.exercise_name,
          body_part: s.body_part,
          category: s.category,
          equipment: s.equipment,
          measure_type: s.measure_type,
          sets: []
        });
      }

      exerciseMap.get(s.exercise_id).sets.push({
        id: s.id,
        set_number: s.set_number,
        weight_kg: s.weight_kg,
        reps: s.reps,
        duration_seconds: s.duration_seconds,
        one_rm: s.one_rm ? Math.round(s.one_rm * 10) / 10 : null,
        notes: s.notes
      });
    }

    const exercises = Array.from(exerciseMap.values());

    res.json({
      date: targetDate,
      total_exercises: exercises.length,
      total_sets: rawSets.length,
      exercises
    });
  } catch (err) {
    console.error(`Error en /api/history/${targetDate}:`, err);
    res.status(500).json({ error: 'Error al obtener detalle del entrenamiento' });
  }
});

module.exports = router;
