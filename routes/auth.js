const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

const router = express.Router();

// GET /login
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../views/login.html'));
});

// POST /login
router.post('/login', async (req, res) => {
  const isApi = req.xhr || req.headers.accept?.includes('application/json');
  const { login, password } = req.body;

  if (!login || !password) {
    if (isApi) {
      return res.status(400).json({ error: 'Por favor completa todos los campos' });
    }
    return res.redirect('/login?error=missing_fields');
  }

  try {
    const trimmedLogin = login.trim();
    const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(trimmedLogin, trimmedLogin);

    if (!user) {
      if (isApi) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      return res.redirect('/login?error=invalid_credentials');
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      if (isApi) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }
      return res.redirect('/login?error=invalid_credentials');
    }

    if (user.is_approved !== 1) {
      if (isApi) {
        return res.status(403).json({ error: 'Tu cuenta está pendiente de aprobación por el administrador.' });
      }
      return res.redirect('/login?error=pending');
    }

    // Save session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.email = user.email;
    req.session.role = user.role;

    req.session.save((err) => {
      if (err) {
        console.error('Error guardando sesión:', err);
        if (isApi) return res.status(500).json({ error: 'Error al iniciar sesión' });
        return res.redirect('/login?error=session_error');
      }
      if (isApi) {
        return res.json({ success: true, redirect: '/' });
      }
      res.redirect('/');
    });
  } catch (err) {
    console.error('Error en login:', err);
    if (isApi) return res.status(500).json({ error: 'Error interno del servidor' });
    res.redirect('/login?error=server_error');
  }
});

// GET /register
router.get('/register', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../views/register.html'));
});

// POST /register
router.post('/register', async (req, res) => {
  const isApi = req.xhr || req.headers.accept?.includes('application/json');
  const { username, email, password, confirm_password } = req.body;

  if (!username || !email || !password || !confirm_password) {
    if (isApi) return res.status(400).json({ error: 'Por favor rellena todos los campos' });
    return res.redirect('/register?error=missing_fields');
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanUsername.length < 3) {
    if (isApi) return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres' });
    return res.redirect('/register?error=short_username');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    if (isApi) return res.status(400).json({ error: 'El formato de correo no es válido' });
    return res.redirect('/register?error=invalid_email');
  }

  if (password.length < 6) {
    if (isApi) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    return res.redirect('/register?error=short_password');
  }

  if (password !== confirm_password) {
    if (isApi) return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    return res.redirect('/register?error=password_mismatch');
  }

  try {
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existingUser) {
      if (isApi) return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
      return res.redirect('/register?error=username_taken');
    }

    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existingEmail) {
      if (isApi) return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
      return res.redirect('/register?error=email_taken');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    db.prepare(`
      INSERT INTO users (username, email, password_hash, role, is_approved, created_at)
      VALUES (?, ?, ?, 'user', 0, datetime('now'))
    `).run(cleanUsername, cleanEmail, passwordHash);

    if (isApi) {
      return res.json({ success: true, message: 'Registro exitoso. Tu cuenta quedará pendiente de aprobación.' });
    }
    res.redirect('/login?success=registered');
  } catch (err) {
    console.error('Error en register:', err);
    if (isApi) return res.status(500).json({ error: 'Error interno al registrar usuario' });
    res.redirect('/register?error=server_error');
  }
});

// POST /logout & GET /logout
function handleLogout(req, res) {
  req.session.destroy((err) => {
    if (err) console.error('Error destruyendo sesión:', err);
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
}

router.post('/logout', handleLogout);
router.get('/logout', handleLogout);

// GET /api/auth/me
router.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ loggedIn: false });
  }
  const user = db.prepare('SELECT id, username, email, role, is_approved FROM users WHERE id = ?').get(req.session.userId);
  if (!user || user.is_approved !== 1) {
    return res.json({ loggedIn: false });
  }
  res.json({
    loggedIn: true,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  });
});

module.exports = router;
