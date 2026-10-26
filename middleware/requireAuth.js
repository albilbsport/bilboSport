const db = require('../db/database');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    const isApi = req.xhr ||
      req.path.startsWith('/api/') ||
      req.path.startsWith('/export/') ||
      (req.headers.accept && req.headers.accept.includes('application/json'));

    if (isApi) {
      return res.status(401).json({ error: 'No autorizado. Por favor inicia sesión.' });
    }
    return res.redirect('/login');
  }

  try {
    const user = db.prepare('SELECT id, username, email, role, is_approved FROM users WHERE id = ?').get(req.session.userId);

    if (!user) {
      req.session.destroy(() => {});
      return res.redirect('/login?error=user_not_found');
    }

    if (user.is_approved !== 1) {
      req.session.destroy(() => {});
      const isApi = req.xhr || req.path.startsWith('/api/') || (req.headers.accept && req.headers.accept.includes('application/json'));
      if (isApi) {
        return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación por el administrador.' });
      }
      return res.redirect('/login?error=pending');
    }

    req.user = user;
    // Keep session in sync with db role
    req.session.role = user.role;
    req.session.username = user.username;
    next();
  } catch (err) {
    console.error('Error en requireAuth:', err);
    return res.status(500).json({ error: 'Error interno en la autenticación' });
  }
}

module.exports = requireAuth;
