const express = require('express');
const path = require('path');
const db = require('../db/database');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// GET /exercises
router.get('/exercises', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../views/exercises.html'));
});

// GET /api/exercises
router.get('/api/exercises', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const search = req.query.search ? String(req.query.search).trim() : '';
  const bodyPart = req.query.body_part ? String(req.query.body_part).trim() : '';
  const filter = req.query.filter ? String(req.query.filter).trim() : 'all'; // all, mine, global
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  try {
    const whereClauses = [];
    const params = [];

    // Base visibility
    if (filter === 'mine') {
      whereClauses.push('is_global = 0 AND user_id = ?');
      params.push(userId);
    } else if (filter === 'global') {
      whereClauses.push('is_global = 1');
    } else {
      whereClauses.push('(is_global = 1 OR user_id = ?)');
      params.push(userId);
    }

    if (bodyPart) {
      whereClauses.push('LOWER(body_part) = LOWER(?)');
      params.push(bodyPart);
    }

    if (search) {
      whereClauses.push('(name LIKE ? OR target LIKE ? OR muscle_group LIKE ? OR category LIKE ?)');
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Total count
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM exercises ${whereSql}`).get(...params);
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Paginated list
    const exercises = db.prepare(`
      SELECT id, external_id, name, body_part, category, equipment,
             target, muscle_group, measure_type, is_global, user_id,
             gif_url, image_url, instructions_es, instructions_en, created_at
      FROM exercises
      ${whereSql}
      ORDER BY is_global ASC, name ASC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    // List of available body parts for filters
    const bodyParts = db.prepare(`
      SELECT DISTINCT body_part
      FROM exercises
      WHERE (is_global = 1 OR user_id = ?) AND body_part IS NOT NULL AND body_part != ''
      ORDER BY body_part ASC
    `).all(userId).map(r => r.body_part);

    res.json({
      exercises,
      total,
      page,
      limit,
      totalPages,
      bodyParts
    });
  } catch (err) {
    console.error('Error en GET /api/exercises:', err);
    res.status(500).json({ error: 'Error al buscar ejercicios' });
  }
});

// POST /api/exercises
router.post('/api/exercises', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const {
    name,
    body_part,
    category,
    equipment,
    target,
    muscle_group,
    measure_type,
    instructions_es
  } = req.body;

  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'El nombre del ejercicio es obligatorio' });
  }

  const cleanName = String(name).trim();
  const cleanBodyPart = body_part ? String(body_part).trim().toLowerCase() : 'custom';
  const cleanCategory = category ? String(category).trim().toLowerCase() : 'other';
  const cleanEquipment = equipment ? String(equipment).trim().toLowerCase() : 'other';
  const cleanTarget = target ? String(target).trim().toLowerCase() : 'general';
  const cleanMuscleGroup = muscle_group ? String(muscle_group).trim() : null;
  const cleanMeasureType = measure_type === 'time' ? 'time' : 'reps';
  const cleanInstructions = instructions_es ? String(instructions_es).trim() : null;

  try {
    const insertResult = db.prepare(`
      INSERT INTO exercises (
        name, body_part, category, equipment, target,
        muscle_group, measure_type, is_global, user_id,
        instructions_es, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'))
    `).run(
      cleanName,
      cleanBodyPart,
      cleanCategory,
      cleanEquipment,
      cleanTarget,
      cleanMuscleGroup,
      cleanMeasureType,
      userId,
      cleanInstructions
    );

    const createdExercise = db.prepare('SELECT * FROM exercises WHERE id = ?').get(insertResult.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Ejercicio personal creado con éxito',
      exercise: createdExercise
    });
  } catch (err) {
    console.error('Error creando ejercicio personal:', err);
    res.status(500).json({ error: 'Error al crear el ejercicio personal' });
  }
});

// DELETE /api/exercises/:id
router.delete('/api/exercises/:id', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const exerciseId = parseInt(req.params.id, 10);

  if (!exerciseId || isNaN(exerciseId)) {
    return res.status(400).json({ error: 'ID de ejercicio inválido' });
  }

  try {
    const exercise = db.prepare('SELECT id, is_global, user_id FROM exercises WHERE id = ?').get(exerciseId);

    if (!exercise) {
      return res.status(404).json({ error: 'Ejercicio no encontrado' });
    }

    if (exercise.is_global === 1) {
      return res.status(403).json({ error: 'No es posible eliminar ejercicios globales' });
    }

    if (exercise.user_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este ejercicio' });
    }

    // Cascade delete sets associated with this custom exercise
    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM sets WHERE exercise_id = ? AND user_id = ?').run(exerciseId, userId);
      db.prepare('DELETE FROM exercises WHERE id = ?').run(exerciseId);
    });
    deleteTx();

    res.json({ success: true, message: 'Ejercicio eliminado correctamente' });
  } catch (err) {
    console.error('Error eliminando ejercicio:', err);
    res.status(500).json({ error: 'Error al eliminar ejercicio' });
  }
});

module.exports = router;
