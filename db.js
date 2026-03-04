const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_PATH = './megazul.db';
let db;

function getDB() {
  if (!db) db = new sqlite3.Database(DB_PATH);
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDB() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    category_id INTEGER,
    img_type TEXT DEFAULT 'emoji',
    img_value TEXT DEFAULT '📦',
    rating INTEGER DEFAULT 5,
    reviews INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT DEFAULT '',
    customer_address TEXT NOT NULL,
    customer_city TEXT NOT NULL,
    customer_cep TEXT NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_id TEXT DEFAULT '',
    payment_method TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  )`);

  const adminPass = process.env.ADMIN_PASSWORD || 'megazul123';
  const existing = await get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!existing) {
    const hash = await bcrypt.hash(adminPass, 10);
    await run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hash]);
    console.log('  ✅ Admin criado');
  }

  const catCount = await get('SELECT COUNT(*) as n FROM categories');
  if (catCount.n === 0) {
    await run('INSERT INTO categories (name) VALUES (?)', ['Smartphones']);
    await run('INSERT INTO categories (name) VALUES (?)', ['Robôs e Aspiradores']);
    console.log('  ✅ Categorias padrão criadas');
  }

  const prodCount = await get('SELECT COUNT(*) as n FROM products');
  if (prodCount.n === 0) {
    const c1 = await get('SELECT id FROM categories WHERE name = ?', ['Smartphones']);
    const c2 = await get('SELECT id FROM categories WHERE name = ?', ['Robôs e Aspiradores']);
    await run(
      'INSERT INTO products (name, description, price, stock, category_id, img_type, img_value, rating, reviews) VALUES (?,?,?,?,?,?,?,?,?)',
      ['iPhone 17 Pro Max', 'O mais avançado iPhone já criado.', 10200, 15, c1?.id, 'emoji', '📱', 5, 1284]
    );
    await run(
      'INSERT INTO products (name, description, price, stock, category_id, img_type, img_value, rating, reviews) VALUES (?,?,?,?,?,?,?,?,?)',
      ['Robô Aspirador Xiaomi X20', 'Aspiração inteligente com mapeamento laser.', 3800, 8, c2?.id, 'emoji', '🤖', 5, 432]
    );
    console.log('  ✅ Produtos padrão criados');
  }

  console.log('  ✅ Banco de dados pronto');
}

module.exports = { run, get, all, initDB };
