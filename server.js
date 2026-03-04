require('dotenv').config({ path: './env.txt' });
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const { initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'megazul_secret_key_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static('.'));
app.use('/uploads', express.static('./uploads'));

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/cart',       require('./routes/cart'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/payment',    require('./routes/payment'));
app.use('/api/upload',     require('./routes/upload'));

initDB().then(() => {
  app.listen(PORT, () => {
    console.log('\n========================================');
    console.log(`  MEGAZUL - Loja Online`);
    console.log('========================================');
    console.log(`  Loja:   http://localhost:${PORT}/index.html`);
    console.log(`  Admin:  http://localhost:${PORT}/admin.html`);
    console.log(`  Login:  admin / ${process.env.ADMIN_PASSWORD || 'megazul123'}`);
    console.log('========================================\n');
  });
}).catch(err => {
  console.error('Erro ao inicializar banco de dados:', err);
  process.exit(1);
});
