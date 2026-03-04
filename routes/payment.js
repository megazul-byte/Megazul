const express = require('express');
const { run, get, all } = require('../db');
const router = express.Router();

async function finalizeOrder(orderId, paymentId, method) {
  await run('UPDATE orders SET status = ?, payment_id = ?, payment_method = ? WHERE id = ?',
    ['paid', paymentId || '', method, orderId]);
  const items = await all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
  for (const item of items) {
    await run('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?', [item.quantity, item.product_id]);
  }
}

router.post('/create', async (req, res) => {
  const { order_id } = req.body;
  if (!order_id) return res.status(400).json({ error: 'order_id obrigatório' });
  try {
    const order = await get('SELECT * FROM orders WHERE id = ?', [order_id]);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    const items = await all('SELECT * FROM order_items WHERE order_id = ?', [order_id]);

    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken) {
      await finalizeOrder(order_id, `sim_${Date.now()}`, 'simulado');
      req.session.cart = [];
      return res.json({ ok: true, simulated: true, redirect_url: null, order_id });
    }

    const { MercadoPagoConfig, Preference } = require('mercadopago');
    const client = new MercadoPagoConfig({ accessToken: mpToken });
    const preferenceApi = new Preference(client);
    const base = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    const preference = await preferenceApi.create({
      body: {
        items: items.map(i => ({
          id: String(i.product_id),
          title: i.product_name,
          quantity: i.quantity,
          unit_price: i.price,
          currency_id: 'BRL'
        })),
        payer: { name: order.customer_name, email: order.customer_email },
        back_urls: {
          success: `${base}/success.html?order_id=${order_id}`,
          failure: `${base}/index.html?payment=failed&order_id=${order_id}`,
          pending: `${base}/index.html?payment=pending&order_id=${order_id}`
        },
        auto_return: 'approved',
        external_reference: String(order_id),
        notification_url: `${base}/api/payment/webhook`
      }
    });

    await run('UPDATE orders SET payment_id = ?, status = ? WHERE id = ?',
      [preference.id, 'pending_payment', order_id]);

    res.json({ ok: true, simulated: false, redirect_url: preference.init_point, order_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type === 'payment' && data?.id) {
      const mpToken = process.env.MP_ACCESS_TOKEN;
      if (mpToken) {
        const { MercadoPagoConfig, Payment } = require('mercadopago');
        const client = new MercadoPagoConfig({ accessToken: mpToken });
        const paymentApi = new Payment(client);
        const payment = await paymentApi.get({ id: data.id });
        if (payment.status === 'approved') {
          const orderId = parseInt(payment.external_reference);
          if (orderId) await finalizeOrder(orderId, String(data.id), 'mercadopago');
        }
      }
    }
  } catch (err) {
    console.error('Webhook error:', err.message);
  }
  res.sendStatus(200);
});

router.post('/confirm', async (req, res) => {
  const { order_id, payment_id, status } = req.body;
  if (!order_id) return res.status(400).json({ error: 'order_id obrigatório' });
  try {
    if (status === 'approved') {
      await finalizeOrder(order_id, payment_id || '', 'mercadopago');
      req.session.cart = [];
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
