const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { db, initializeDatabase } = require('./db');

// Admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

const app = express();

// Database initialization (runs once at startup)
const initDB = async () => {
  try {
    console.log('Initializing database...');
    await initializeDatabase();

    console.log('Creating products table...');
    await new Promise((resolve, reject) => {
      db.run(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    image TEXT NOT NULL
  )`, (err) => err ? reject(err) : resolve());
    });

    // Check if table is empty first
const rowCount = await new Promise((resolve) => {
  db.get('SELECT COUNT(*) as count FROM products', [], (err, row) => {
    resolve(err ? 1 : row.count); // Default to 1 if error occurs
  });
});

if (rowCount === 0) {
  console.log('Seeding initial data...');
  await new Promise((resolve, reject) => {
    db.run(`
      INSERT INTO products (name, price, category, image) VALUES
      ('Classic T-Shirt', 18.99, 'Apparel', 'tshirt.png'),
      ('Hoodie', 34.99, 'Apparel', 'Hoodie.png'),
      ('Baseball Cap', 19.99, 'Apparel', 'cap.png'),
      ('Trading Card Booster', 4.99, 'Merchandise', 'cards.png'),
      ('Premium Mug', 14.99, 'Merchandise', 'Mug.png'),
      ('Socks', 11.99, 'Apparel', 'Socks.png'),
      ('Limited Edition Hoodie', 29.99, 'Apparel', 'Hoodie.png')
    `, (err) => err ? reject(err) : resolve());
  });
  console.log('Database seeded successfully');
} else {
  console.log('Database already contains data - skipping seeding');
}
  } catch (error) {
    console.error('Database initialization failed:', error);
  }
};

// ======================
// ADMIN ROUTES
// ======================

// Auth middleware
const requireAdmin = (req, res, next) => {
  if (!req.session.adminLoggedIn) {
    return res.redirect('/admin/login');
  }
  next();
};

// Login routes
app.get('/admin/login', (req, res) => {
  res.render('admin-login', { 
    title: 'Admin Login',
    error: null // Initialize error variable
  });
});

app.post('/admin/login', async (req, res) => {
  console.log('--- NEW LOGIN ATTEMPT ---');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Raw request body size:', req.socket.bytesRead);
  console.log('Raw body:', req.body);
  console.log('Parsed body:', {
    username: req.body?.username,
    password: req.body?.password
  }); // Debug log
  if (!req.body || !req.body.username || !req.body.password) {
    console.log('Missing fields in:', req.body); // Debug log
    return res.status(400).render('admin-login', { 
      title: 'Admin Login',
      error: 'Username and password are required' 
    });
  }

  const { username, password } = req.body;
  
  try {
    const user = await new Promise((resolve) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        resolve(err ? null : row);
      });
    });

    if (user && await bcrypt.compare(password, user.password_hash)) {
      req.session.adminLoggedIn = true;
      res.redirect('/admin/dashboard');
    } else {
      res.render('admin-login', { error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).render('admin-login', { error: 'Login failed' });
  }
});

// Admin dashboard
app.get('/admin/dashboard', requireAdmin, (req, res) => {
  res.render('admin-dashboard', { title: 'Admin Dashboard' });
});

// Product management routes
app.get('/admin/products', requireAdmin, async (req, res) => {
  const products = await new Promise((resolve) => {
    db.all('SELECT * FROM products', [], (err, rows) => {
      resolve(err ? [] : rows);
    });
  });
  res.render('admin-products', { title: 'Manage Products', products });
});

// Add new product
app.get('/admin/products/new', requireAdmin, (req, res) => {
  res.render('admin-product-form', { title: 'Add New Product' });
});

app.post('/admin/products', requireAdmin, async (req, res) => {
  const { name, price, category, image } = req.body;
  await new Promise((resolve) => {
    db.run(
      'INSERT INTO products (name, price, category, image) VALUES (?, ?, ?, ?)',
      [name, price, category, image],
      resolve
    );
  });
  res.redirect('/admin/products');
});

// Edit product
app.get('/admin/products/edit/:id', requireAdmin, async (req, res) => {
  const product = await new Promise((resolve) => {
    db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
      resolve(err ? null : row);
    });
  });
  res.render('admin-product-form', { title: 'Edit Product', product });
});

app.post('/admin/products/update/:id', requireAdmin, async (req, res) => {
  const { name, price, category, image } = req.body;
  await new Promise((resolve) => {
    db.run(
      'UPDATE products SET name = ?, price = ?, category = ?, image = ? WHERE id = ?',
      [name, price, category, image, req.params.id],
      resolve
    );
  });
  res.redirect('/admin/products');
});

// Delete product
app.get('/admin/products/delete/:id', requireAdmin, async (req, res) => {
  await new Promise((resolve) => {
    db.run('DELETE FROM products WHERE id = ?', [req.params.id], resolve);
  });
  res.redirect('/admin/products');
});

// Seed sample data
app.get('/admin/seed-data', requireAdmin, async (req, res) => {
  // Same seeding logic as initialization
  await seedSampleData();
  res.redirect('/admin/products');
});

// Logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Helper function for seeding
async function seedSampleData() {
  const rowCount = await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM products', [], (err, row) => {
      resolve(err ? 1 : row.count);
    });
  });

  if (rowCount === 0) {
    await new Promise((resolve) => {
      db.run(`
        INSERT INTO products (name, price, category, image) VALUES
        ('Classic T-Shirt', 18.99, 'Apparel', 'tshirt.png'),
        ('Hoodie', 34.99, 'Apparel', 'Hoodie.png'),
        ('Baseball Cap', 19.99, 'Apparel', 'cap.png'),
        ('Trading Card Booster', 4.99, 'Merchandise', 'cards.png'),
        ('Premium Mug', 14.99, 'Merchandise', 'Mug.png'),
        ('Socks', 11.99, 'Apparel', 'Socks.png'),
        ('Limited Edition Hoodie', 29.99, 'Apparel', 'Hoodie.png')
      `, resolve);
    });
  }
}

// Server initialization moved to line 202

// Middleware setup - MUST come before routes
// Raw body logging middleware
app.use((req, res, next) => {
  let data = '';
  req.on('data', chunk => data += chunk);
  req.on('end', () => {
    console.log('Raw request body:', data);
    next();
  });
});

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
console.log('Body parsers initialized');
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/media/img', express.static(path.join(__dirname, 'media/img')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.json());

// Initialize cart
app.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = [];
  next();
});

// Product routes
app.get('/products', (req, res) => {
  db.all('SELECT * FROM products', [], (err, products) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Database error');
    }
    res.render('products', {
      title: 'Our Products',
      products
    });
  });
});

// Cart routes
app.post('/api/cart/add', (req, res) => {
  const { productId } = req.body;
  db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
    
    if (product) {
      req.session.cart.push(product);
      res.json({ 
        success: true, 
        count: req.session.cart.length,
        total: req.session.cart.reduce((sum, item) => sum + item.price, 0)
      });
    } else {
      res.json({ success: false });
    }
  });
});

// Other routes (home, cart, etc.)
app.get('/', (req, res) => res.render('index', { title: 'Home' }));
app.get('/cart', (req, res) => res.render('cart', { 
  title: 'Your Cart',
  cartItems: req.session.cart || [],
  total: (req.session.cart || []).reduce((sum, item) => sum + item.price, 0)
}));

// Start server
const PORT = process.env.PORT || 54991;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});