const express = require('express');
const bcrypt = require('bcryptjs');
const { get } = require('../db');
const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
  try {
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ ok: true, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/check', (req, res) => {
  res.json({ authenticated: !!req.session.userId, username: req.session.username || null });
});

router.post('/change-password', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autorizado' });
  const { current, newPass } = req.body;
  if (!current || !newPass || newPass.length < 6) return res.status(400).json({ error: 'Dados inválidos. A nova senha deve ter pelo menos 6 caracteres.' });
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.session.userId]);
    if (!user || !(await bcrypt.compare(current, user.password))) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    const hash = await bcrypt.hash(newPass, 10);
    const { run } = require('../db');
    await run('UPDATE users SET password = ? WHERE id = ?', [hash, req.session.userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
