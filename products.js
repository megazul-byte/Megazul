const express = require('express');
const { run, get, all } = require('../db');
const requireAuth = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { category, search, include_inactive } = req.query;
    let sql = `SELECT p.*, c.name as category_name
               FROM products p
               LEFT JOIN categories c ON p.category_id = c.id
               WHERE 1=1`;
    const params = [];
    if (!include_inactive || !req.session.userId) { sql += ' AND p.active = 1'; }
    if (category) { sql += ' AND c.name = ?'; params.push(category); }
    if (search) { sql += ' AND p.name LIKE ?'; params.push(`%${search}%`); }
    sql += ' ORDER BY p.created_at DESC';
    const products = await all(sql, params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const p = await get(
      'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
      [req.params.id]
    );
    if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  const { name, description, price, stock, category_id, img_type, img_value, rating, reviews } = req.body;
  if (!name || price == null || stock == null) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, preço e estoque' });
  }
  try {
    const result = await run(
      'INSERT INTO products (name, description, price, stock, category_id, img_type, img_value, rating, reviews) VALUES (?,?,?,?,?,?,?,?,?)',
      [name.trim(), description || '', parseFloat(price), parseInt(stock), category_id || null,
       img_type || 'emoji', img_value || '📦', parseInt(rating) || 5, parseInt(reviews) || 0]
    );
    const product = await get(
      'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
      [result.lastID]
    );
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  const { name, description, price, stock, category_id, img_type, img_value, rating, reviews, active } = req.body;
  if (!name || price == null || stock == null) {
    return res.status(400).json({ error: 'Campos obrigatórios: nome, preço e estoque' });
  }
  try {
    await run(
      'UPDATE products SET name=?, description=?, price=?, stock=?, category_id=?, img_type=?, img_value=?, rating=?, reviews=?, active=? WHERE id=?',
      [name.trim(), description || '', parseFloat(price), parseInt(stock), category_id || null,
       img_type || 'emoji', img_value || '📦', parseInt(rating) || 5, parseInt(reviews) || 0,
       active !== undefined ? (active ? 1 : 0) : 1, req.params.id]
    );
    const product = await get(
      'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?',
      [req.params.id]
    );
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await run('UPDATE products SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
