const express = require('express');
const { get } = require('../db');
const router = express.Router();

function getCart(req) {
  if (!req.session.cart) req.session.cart = [];
  return req.session.cart;
}

router.get('/', async (req, res) => {
  try {
    const cart = getCart(req);
    const enriched = [];
    for (const item of cart) {
      const p = await get('SELECT * FROM products WHERE id = ? AND active = 1', [item.product_id]);
      if (p) enriched.push({ ...item, product: p });
    }
    const total = enriched.reduce((s, i) => s + i.price * i.quantity, 0);
    const count = enriched.reduce((s, i) => s + i.quantity, 0);
    res.json({ items: enriched, total, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/add', async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  if (!product_id) return res.status(400).json({ error: 'product_id obrigatório' });
  try {
    const product = await get('SELECT * FROM products WHERE id = ? AND active = 1 AND stock > 0', [product_id]);
    if (!product) return res.status(404).json({ error: 'Produto não disponível' });
    const cart = getCart(req);
    const existing = cart.find(i => i.product_id == product_id);
    const qty = parseInt(quantity);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + qty, product.stock);
    } else {
      cart.push({ product_id: parseInt(product_id), quantity: Math.min(qty, product.stock), price: product.price, name: product.name });
    }
    req.session.cart = cart;
    const count = cart.reduce((s, i) => s + i.quantity, 0);
    res.json({ ok: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/update', (req, res) => {
  const { product_id, quantity } = req.body;
  const cart = getCart(req);
  const idx = cart.findIndex(i => i.product_id == product_id);
  if (idx === -1) return res.status(404).json({ error: 'Item não encontrado no carrinho' });
  if (parseInt(quantity) <= 0) cart.splice(idx, 1);
  else cart[idx].quantity = parseInt(quantity);
  req.session.cart = cart;
  res.json({ ok: true });
});

router.delete('/remove/:product_id', (req, res) => {
  req.session.cart = getCart(req).filter(i => i.product_id != req.params.product_id);
  res.json({ ok: true });
});

router.delete('/clear', (req, res) => {
  req.session.cart = [];
  res.json({ ok: true });
});

module.exports = router;
