// ============================================================
// server.js  — Portfolio Backend
// Node.js + Express + SQLite
// Serves: contact form API + admin panel API + static files
// ============================================================

const express   = require('express');
const sqlite3   = require('sqlite3').verbose();
const cors      = require('cors');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const path      = require('path');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

// Change this to a long random string in production!
const JWT_SECRET = process.env.JWT_SECRET || 'my_super_secret_portfolio_key_2025';

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve all frontend files from current directory
app.use(express.static(__dirname));

// Rate limiter — max 5 contact messages per 15 minutes per IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many submissions. Try again in 15 minutes.' }
});

// ============================================================
// DATABASE — SQLite (auto-creates portfolio.db file)
// ============================================================
const db = new sqlite3.Database('./portfolio.db', err => {
  if (err) return console.error('❌ DB Error:', err.message);
  console.log('✅ SQLite database connected (portfolio.db)');
});

db.serialize(() => {

  // Table 1: contact messages
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    message    TEXT NOT NULL,
    is_read    INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // Table 2: admin users
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  )`, () => {
    // Seed default admin: username = admin, password = admin123
    // ⚠️  Change via the admin panel after first login!
    const hash = bcrypt.hashSync('admin123', 10);
    db.run(
      `INSERT OR IGNORE INTO admins (username, password_hash) VALUES (?, ?)`,
      ['admin', hash]
    );
  });

});

// ============================================================
// JWT AUTH MIDDLEWARE
// ============================================================
function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Login required.' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Session expired. Please login again.' });
    req.admin = decoded;
    next();
  });
}

// ============================================================
// PUBLIC ROUTES
// ============================================================

// POST /api/contact  — submit the contact form
app.post('/api/contact', contactLimiter, (req, res) => {
  const { name, email, message } = req.body;

  // Validation
  if (!name?.trim() || !email?.trim() || !message?.trim())
    return res.status(400).json({ error: 'All fields (name, email, message) are required.' });

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk)
    return res.status(400).json({ error: 'Please enter a valid email address.' });

  if (message.trim().length < 10)
    return res.status(400).json({ error: 'Message is too short (minimum 10 characters).' });

  db.run(
    `INSERT INTO messages (name, email, message) VALUES (?, ?, ?)`,
    [name.trim(), email.trim(), message.trim()],
    function (err) {
      if (err) return res.status(500).json({ error: 'Could not save message. Try again.' });
      res.status(201).json({
        success: true,
        message: `Thanks ${name.trim()}! I'll get back to you soon. 🙂`
      });
    }
  );
});

// ============================================================
// ADMIN AUTH ROUTES
// ============================================================

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required.' });

  db.get(
    `SELECT * FROM admins WHERE username = ?`, [username],
    (err, admin) => {
      if (err || !admin)
        return res.status(401).json({ error: 'Invalid username or password.' });

      if (!bcrypt.compareSync(password, admin.password_hash))
        return res.status(401).json({ error: 'Invalid username or password.' });

      const token = jwt.sign(
        { id: admin.id, username: admin.username },
        JWT_SECRET,
        { expiresIn: '12h' }
      );
      res.json({ success: true, token, username: admin.username });
    }
  );
});

// PUT /api/admin/change-password
app.put('/api/admin/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Both current and new password required.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });

  db.get(`SELECT * FROM admins WHERE id = ?`, [req.admin.id], (err, admin) => {
    if (!bcrypt.compareSync(currentPassword, admin.password_hash))
      return res.status(401).json({ error: 'Current password is wrong.' });

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.run(`UPDATE admins SET password_hash = ? WHERE id = ?`, [newHash, req.admin.id], err2 => {
      if (err2) return res.status(500).json({ error: 'Failed to update password.' });
      res.json({ success: true, message: 'Password changed! Please log in again.' });
    });
  });
});

// ============================================================
// ADMIN — MESSAGES ROUTES  (all protected)
// ============================================================

// GET /api/admin/messages  — get all messages
app.get('/api/admin/messages', requireAuth, (req, res) => {
  db.all(
    `SELECT * FROM messages ORDER BY created_at DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// GET /api/admin/messages/stats  — counts for dashboard
app.get('/api/admin/messages/stats', requireAuth, (req, res) => {
  db.get(`SELECT COUNT(*) AS total FROM messages`, (err, total) => {
    db.get(`SELECT COUNT(*) AS unread FROM messages WHERE is_read = 0`, (err2, unread) => {
      res.json({
        total:  total?.total  || 0,
        unread: unread?.unread || 0
      });
    });
  });
});

// PUT /api/admin/messages/:id/read  — mark as read
app.put('/api/admin/messages/:id/read', requireAuth, (req, res) => {
  db.run(`UPDATE messages SET is_read = 1 WHERE id = ?`, [req.params.id], err => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// DELETE /api/admin/messages/:id  — delete a message
app.delete('/api/admin/messages/:id', requireAuth, (req, res) => {
  db.run(`DELETE FROM messages WHERE id = ?`, [req.params.id], err => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🚀  Server running →  http://localhost:${PORT}`);
  console.log(`🌐  Portfolio     →  http://localhost:${PORT}/index.html`);
  console.log(`🔧  Admin Panel   →  http://localhost:${PORT}/admin.html`);
  console.log(`🔑  Login         →  admin / admin123  (change after first login!)\n`);
});
