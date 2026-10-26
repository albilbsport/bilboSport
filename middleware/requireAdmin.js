const db = require('../db/database');

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    const isApi = req.xhr ||
      req.path.startsWith('/api/') ||
      (req.headers.accept && req.headers.accept.includes('application/json'));

    if (isApi) {
      return res.status(401).json({ error: 'No autorizado. Inicia sesión como administrador.' });
    }
    return res.redirect('/login');
  }

  try {
    const user = db.prepare('SELECT id, username, email, role, is_approved FROM users WHERE id = ?').get(req.session.userId);

    if (!user || user.role !== 'admin' || user.is_approved !== 1) {
      const isApi = req.xhr ||
        req.path.startsWith('/api/') ||
        (req.headers.accept && req.headers.accept.includes('application/json'));

      if (isApi) {
        return res.status(403).json({ error: 'Acceso restringido a administradores' });
      }
      return res.redirect('/');
    }

    req.user = user;
    req.session.role = 'admin';
    next();
  } catch (err) {
    console.error('Error en requireAdmin:', err);
    return res.status(500).json({ error: 'Error interno en la autorización' });
  }
}

module.exports = requireAdmin;
