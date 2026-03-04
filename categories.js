const express = require('express');
const { run, get, all } = require('../db');
const requireAuth = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const cats = await all('SELECT * FROM categories ORDER BY name');
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  try {
    const result = await run('INSERT INTO categories (name) VALUES (?)', [name.trim()]);
    const cat = await get('SELECT * FROM categories WHERE id = ?', [result.lastID]);
    res.status(201).json(cat);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Categoria já existe' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
  try {
    const old = await get('SELECT name FROM categories WHERE id = ?', [req.params.id]);
    await run('UPDATE categories SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
    if (old) {
      await run('UPDATE products SET category_id = category_id WHERE 1=1');
    }
    const cat = await get('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(cat);
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Categoria já existe' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await run('UPDATE products SET category_id = NULL WHERE category_id = ?', [req.params.id]);
    await run('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
