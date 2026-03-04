const express = require('express');
const { run, get, all } = require('../db');
const requireAuth = require('../middleware/auth');
const router = express.Router();

const STATUS_LABELS = {
  pending: 'Pendente',
  pending_payment: 'Aguardando Pagamento',
  paid: 'Pago',
  processing: 'Em Processamento',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado'
};

router.post('/', async (req, res) => {
  const { customer_name, customer_email, customer_phone, customer_address, customer_city, customer_cep } = req.body;
  if (!customer_name || !customer_email || !customer_address || !customer_city || !customer_cep) {
    return res.status(400).json({ error: 'Dados do cliente incompletos' });
  }
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.status(400).json({ error: 'Carrinho vazio' });
  try {
    for (const item of cart) {
      const p = await get('SELECT * FROM products WHERE id = ? AND active = 1', [item.product_id]);
      if (!p || p.stock < item.quantity) {
        return res.status(400).json({ error: `Estoque insuficiente para "${item.name}"` });
      }
    }
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const result = await run(
      'INSERT INTO orders (customer_name, customer_email, customer_phone, customer_address, customer_city, customer_cep, total, status) VALUES (?,?,?,?,?,?,?,?)',
      [customer_name, customer_email, customer_phone || '', customer_address, customer_city, customer_cep, total, 'pending']
    );
    const orderId = result.lastID;
    for (const item of cart) {
      await run(
        'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?,?,?,?,?)',
        [orderId, item.product_id, item.name, item.quantity, item.price]
      );
    }
    res.status(201).json({ ok: true, order_id: orderId, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const orders = await all('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(orders.map(o => ({ ...o, status_label: STATUS_LABELS[o.status] || o.status })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const total = await get('SELECT COUNT(*) as n, SUM(total) as revenue FROM orders WHERE status != ?', ['cancelled']);
    const paid = await get('SELECT COUNT(*) as n FROM orders WHERE status = ?', ['paid']);
    const pending = await get('SELECT COUNT(*) as n FROM orders WHERE status IN (?,?)', ['pending', 'pending_payment']);
    res.json({ total_orders: total.n, total_revenue: total.revenue || 0, paid_orders: paid.n, pending_orders: pending.n });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    const items = await all('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ ...order, status_label: STATUS_LABELS[order.status] || order.status, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  const valid = Object.keys(STATUS_LABELS);
  if (!valid.includes(status)) return res.status(400).json({ error: 'Status inválido' });
  try {
    await run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true, status_label: STATUS_LABELS[status] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
