const express = require('express');
const db = require('../db/database');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// GET /export/csv
router.get('/export/csv', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const today = new Date().toISOString().split('T')[0];

  try {
    const rows = db.prepare(`
      SELECT s.session_date as fecha,
             e.name as ejercicio,
             COALESCE(e.target, e.body_part, '') as grupo_muscular,
             COALESCE(e.equipment, '') as equipamiento,
             s.set_number as serie_num,
             s.weight_kg as peso_kg,
             COALESCE(s.reps, '') as reps,
             COALESCE(s.duration_seconds, '') as duracion_seg,
             COALESCE(s.one_rm, '') as 1rm_estimado,
             COALESCE(s.notes, '') as notas
      FROM sets s
      JOIN exercises e ON s.exercise_id = e.id
      WHERE s.user_id = ?
      ORDER BY s.session_date DESC, s.exercise_id ASC, s.set_number ASC
    `).all(userId);

    const headers = ['fecha', 'ejercicio', 'grupo_muscular', 'equipamiento', 'serie_num', 'peso_kg', 'reps', 'duracion_seg', '1rm_estimado', 'notas'];
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    csvContent += headers.join(',') + '\r\n';

    for (const row of rows) {
      const line = [
        escapeCsvField(row.fecha),
        escapeCsvField(row.ejercicio),
        escapeCsvField(row.grupo_muscular),
        escapeCsvField(row.equipamiento),
        escapeCsvField(row.serie_num),
        escapeCsvField(row.peso_kg),
        escapeCsvField(row.reps),
        escapeCsvField(row.duracion_seg),
        escapeCsvField(row['1rm_estimado']),
        escapeCsvField(row.notas)
      ].join(',');
      csvContent += line + '\r\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bilboag-entrenamientos-${today}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error exportando CSV:', err);
    res.status(500).send('Error exportando datos a CSV');
  }
});

// GET /export/json
router.get('/export/json', requireAuth, (req, res) => {
  const userId = req.session.userId;
  const today = new Date().toISOString().split('T')[0];

  try {
    const rows = db.prepare(`
      SELECT s.id,
             s.session_date as fecha,
             s.set_number as serie_num,
             s.weight_kg as peso_kg,
             s.reps,
             s.duration_seconds as duracion_seg,
             s.one_rm as one_rm_estimado,
             s.notes as notas,
             s.created_at,
             e.id as exercise_id,
             e.name as ejercicio,
             e.body_part as parte_cuerpo,
             e.target as objetivo_muscular,
             e.equipment as equipamiento,
             e.measure_type as tipo_medida
      FROM sets s
      JOIN exercises e ON s.exercise_id = e.id
      WHERE s.user_id = ?
      ORDER BY s.session_date DESC, s.exercise_id ASC, s.set_number ASC
    `).all(userId);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bilboag-entrenamientos-${today}.json"`);
    res.send(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Error exportando JSON:', err);
    res.status(500).json({ error: 'Error exportando datos a JSON' });
  }
});

module.exports = router;
