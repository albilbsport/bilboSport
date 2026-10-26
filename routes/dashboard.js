const express = require('express');
const path = require('path');
const db = require('../db/database');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// GET / -> serve dashboard.html
router.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

// GET /api/dashboard
router.get('/api/dashboard', requireAuth, (req, res) => {
  const userId = req.session.userId;

  try {
    // 1. Last session
    const lastSessionRow = db.prepare(`
      SELECT session_date
      FROM sets
      WHERE user_id = ?
      ORDER BY session_date DESC, id DESC
      LIMIT 1
    `).get(userId);

    let lastSession = null;
    if (lastSessionRow) {
      const sessionDate = lastSessionRow.session_date;
      const exercises = db.prepare(`
        SELECT e.name, COUNT(s.id) as sets_count, MAX(s.one_rm) as best_1rm
        FROM sets s
        JOIN exercises e ON s.exercise_id = e.id
        WHERE s.user_id = ? AND s.session_date = ?
        GROUP BY e.id, e.name
        ORDER BY e.name ASC
      `).all(userId, sessionDate);

      lastSession = {
        date: sessionDate,
        exercises: exercises.map(ex => ({
          name: ex.name,
          sets_count: ex.sets_count,
          best_1rm: ex.best_1rm ? Math.round(ex.best_1rm * 10) / 10 : null
        }))
      };
    }

    // 2. Personal records (Top 5 1RMs across exercises)
    const records = db.prepare(`
      SELECT e.name as exercise_name, MAX(s.one_rm) as best_1rm, s.session_date as date
      FROM sets s
      JOIN exercises e ON s.exercise_id = e.id
      WHERE s.user_id = ? AND s.one_rm IS NOT NULL AND s.one_rm > 0
      GROUP BY e.id, e.name
      ORDER BY best_1rm DESC
      LIMIT 5
    `).all(userId).map(r => ({
      exercise_name: r.exercise_name,
      best_1rm: Math.round(r.best_1rm * 10) / 10,
      date: r.date
    }));

    // 3. Recent 7 workout dates
    const recentRows = db.prepare(`
      SELECT DISTINCT session_date
      FROM sets
      WHERE user_id = ?
      ORDER BY session_date DESC
      LIMIT 7
    `).all(userId);
    const recentDates = recentRows.map(r => r.session_date);

    // 4. Exercise progress for the exercise with the most records
    const mostFrequentEx = db.prepare(`
      SELECT s.exercise_id, e.name as exercise_name, COUNT(s.id) as total_sets
      FROM sets s
      JOIN exercises e ON s.exercise_id = e.id
      WHERE s.user_id = ? AND s.one_rm IS NOT NULL AND s.one_rm > 0
      GROUP BY s.exercise_id, e.name
      ORDER BY total_sets DESC
      LIMIT 1
    `).get(userId);

    let exerciseProgress = [];
    let progressExerciseName = null;

    if (mostFrequentEx) {
      progressExerciseName = mostFrequentEx.exercise_name;
      // Get best 1RM per date for this exercise
      const progressRows = db.prepare(`
        SELECT session_date as date, MAX(one_rm) as one_rm
        FROM sets
        WHERE user_id = ? AND exercise_id = ? AND one_rm IS NOT NULL AND one_rm > 0
        GROUP BY session_date
        ORDER BY session_date ASC
        LIMIT 15
      `).all(userId, mostFrequentEx.exercise_id);

      exerciseProgress = progressRows.map(r => ({
        date: r.date,
        one_rm: Math.round(r.one_rm * 10) / 10
      }));
    }

    // Summary stats
    const totalWorkouts = db.prepare(`
      SELECT COUNT(DISTINCT session_date) as count
      FROM sets
      WHERE user_id = ?
    `).get(userId).count;

    const totalSets = db.prepare(`
      SELECT COUNT(id) as count
      FROM sets
      WHERE user_id = ?
    `).get(userId).count;

    res.json({
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role
      },
      stats: {
        totalWorkouts,
        totalSets
      },
      lastSession,
      records,
      recentDates,
      progressExerciseName,
      exerciseProgress
    });
  } catch (err) {
    console.error('Error en /api/dashboard:', err);
    res.status(500).json({ error: 'Error cargando datos del dashboard' });
  }
});

module.exports = router;
