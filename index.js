const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { db, initializeDatabase } = require('./db');

// Admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

const app = express();

// ======================
// Middleware Setup
// ======================
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Initialize cart in session if it doesn't exist
app.use((req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = [];
  }
  next();
});

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ======================
// Routes
// ======================
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Home',
    user: req.session.user
  });
});

// Product routes
app.get('/products', async (req, res) => {
  try {
    const products = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.render('products', { 
      title: 'Products',
      products,
      user: req.session.user 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const product = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!product) {
      return res.status(404).send('Product not found - <a href="/products">Return to products</a>');
    }

    res.render('product-detail', {
      title: product.name,
      product,
      user: req.session.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Cart API Endpoints
app.post('/api/cart/add', async (req, res) => {
    try {
        const { productId } = req.body;
        const product = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM products WHERE id = ?', [productId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        const existingItem = req.session.cart.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            req.session.cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: 1
            });
        }
        
        res.json({ 
            success: true,
            count: req.session.cart.reduce((total, item) => total + item.quantity, 0)
        });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/cart/count', (req, res) => {
    const count = req.session.cart.reduce((total, item) => total + item.quantity, 0);
    res.json({ count });
});

app.post('/api/cart/remove', (req, res) => {
    try {
        const { productId } = req.body;
        req.session.cart = req.session.cart.filter(item => item.id != productId);
        
        const count = req.session.cart.reduce((total, item) => total + item.quantity, 0);
        const total = req.session.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        res.json({ 
            success: true,
            count,
            total: total.toFixed(2)
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

app.post('/api/cart/clear', async (req, res) => {
    try {
        // Clear the cart session or database entries
        req.session.cart = [];
        
        // Or if using database:
        // await CartItem.deleteMany({ sessionId: req.sessionID });
        
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to clear cart' });
    }
});

// Cart Page Route
app.get('/cart', (req, res) => {
    const total = req.session.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.render('cart', { 
        cartItems: req.session.cart,
        total: total ? total.toFixed(2) : '0.00',
        user: req.session.user
    });
});

// Debug route to check template data
app.get('/debug-offers', async (req, res) => {
    const testOffers = [
        {
            id: 1,
            name: 'Test Offer',
            price: 19.99,
            originalPrice: 24.99,
            image: 'tshirt.png',
            description: 'Test description',
            tag: 'TEST OFFER',
            type: 'single'
        }
    ];
    res.render('special-offers', {
        offers: testOffers,
        user: null
    });
});

app.get('/special-offers', async (req, res) => {
    try {
        // Get products marked as special offers
        const offers = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    id,
                    name,
                    price,
                    price * 1.2 AS originalPrice,
                    image,
                    description,
                    'SPECIAL OFFER' AS tag,
                    'single' AS type
                FROM products
                WHERE is_special = TRUE
                ORDER BY name
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.render('special-offers', { 
            offers,
            user: req.session.user
        });
    } catch (err) {
        console.error('Error fetching special offers:', err);
        res.status(500).send('Error loading special offers');
    }
});

app.get('/customer-service', (req, res) => {
    res.render('customer-service');
});

// Admin authentication middleware
const requireAdmin = (req, res, next) => {
  if (!req.session.adminLoggedIn) {
    return res.redirect('/admin/login');
  }
  next();
};

// Admin routes
app.get('/admin', (req, res) => {
  res.redirect('/admin/login');
});

app.get('/admin/login', (req, res) => {
  res.render('admin-login', { 
    title: 'Admin Login',
    error: null 
  });
});

app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.render('admin-login', { error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.render('admin-login', { error: 'Invalid credentials' });
    }

    req.session.adminLoggedIn = true;
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('admin-login', { error: 'Login failed' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

app.get('/admin/dashboard', requireAdmin, (req, res) => {
  res.render('admin-dashboard', {
    title: 'Admin Dashboard'
  });
});

// Product management routes
app.get('/admin/products', requireAdmin, async (req, res) => {
  try {
    const products = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM products', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    res.render('admin-products', { 
      products,
      title: 'Manage Products' 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

app.get(['/admin/products/add', '/admin/products/new'], requireAdmin, (req, res) => {
  res.render('admin-product-form', { 
    product: null,
    title: 'Add New Product',
    error: null
  });
});

app.post('/admin/products/add', requireAdmin, async (req, res) => {
  const { name, price, category, image, description } = req.body;
  
  try {
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO products (name, price, category, image, description) VALUES (?, ?, ?, ?, ?)',
        [name, price, category, image, description],
        (err) => err ? reject(err) : resolve()
      );
    });
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error adding product:', error);
    res.render('admin-product-form', { 
      product: req.body,
      title: 'Add New Product',
      error: 'Failed to add product' 
    });
  }
});

app.get('/admin/products/edit/:id', requireAdmin, async (req, res) => {
  try {
    const product = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!product) {
      return res.status(404).send('Product not found');
    }
    
    res.render('admin-product-form', { 
      product,
      title: 'Edit Product',
      error: null
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).send('Server Error');
  }
});

app.post('/admin/products/edit/:id', requireAdmin, async (req, res) => {
  const { name, price, category, image, description } = req.body;
  
  try {
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE products SET name = ?, price = ?, category = ?, image = ?, description = ? WHERE id = ?',
        [name, price, category, image, description || '', req.params.id],
        (err) => err ? reject(err) : resolve()
      );
    });
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error updating product:', error);
    res.render('admin-product-form', { 
      product: req.body,
      title: 'Edit Product',
      error: 'Failed to update product' 
    });
  }
});

app.post('/admin/products/delete/:id', requireAdmin, async (req, res) => {
  try {
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM products WHERE id = ?', [req.params.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).send('Failed to delete product');
  }
});

// Static files
app.use('/media', express.static(path.join(__dirname, 'media')));

// Error handling
app.use((req, res) => {
  res.status(404).send('Page not found - <a href="/">Return home</a>');
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).send(`
    <h1>Something went wrong</h1>
    <p>${err.message}</p>
    <a href="/">Return home</a>
  `);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// ======================
// Database Initialization
// ======================
async function initDB() {
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

    // Add is_special column if it doesn't exist
    await new Promise((resolve, reject) => {
        db.run(`
            ALTER TABLE products ADD COLUMN is_special BOOLEAN DEFAULT FALSE
        `, (err) => {
            // Ignore "duplicate column" errors
            if (err && !err.message.includes('duplicate column')) {
                reject(err);
            } else {
                resolve();
            }
        });
    });

    // Mark some products as special offers
    await new Promise((resolve, reject) => {
        db.run(`
            UPDATE products SET is_special = TRUE 
            WHERE name IN ('Trading Card Booster', 'Premium Mug', 'Limited Edition Hoodie')
        `, (err) => err ? reject(err) : resolve());
    });

    // Add description column if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(`
        ALTER TABLE products ADD COLUMN description TEXT DEFAULT ''
      `, (err) => {
        // Ignore "duplicate column" errors
        if (err && !err.message.includes('duplicate column')) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Update existing products with empty descriptions if needed
    await new Promise((resolve, reject) => {
      db.run(`
        UPDATE products SET description = '' WHERE description IS NULL
      `, (err) => err ? reject(err) : resolve());
    });

    // Check if table is empty
    const rowCount = await new Promise((resolve) => {
      db.get('SELECT COUNT(*) as count FROM products', [], (err, row) => {
        resolve(err ? 1 : row.count);
      });
    });

    if (rowCount === 0) {
      console.log('Seeding initial data...');
        await new Promise((resolve, reject) => {
          db.run(`
            INSERT INTO products (name, price, category, image, description, is_special) VALUES
            ('Classic T-Shirt', 18.99, 'Apparel', 'tshirt.png', 'Our classic cotton t-shirt with comfortable fit and durable print. Available in multiple colors.', FALSE),
            ('Hoodie', 34.99, 'Apparel', 'Hoodie.png', 'Warm and cozy hoodie with kangaroo pocket and adjustable drawstrings. Perfect for chilly days.', FALSE),
            ('Baseball Cap', 19.99, 'Apparel', 'cap.png', 'Adjustable baseball cap with structured front and curved visor. One size fits most.', FALSE),
            ('Trading Card Booster', 4.99, 'Merchandise', 'cards.png', 'Random assortment of 10 trading cards from our collection. Each pack contains at least one rare card!', TRUE),
            ('Premium Mug', 14.99, 'Merchandise', 'Mug.png', 'High-quality ceramic mug with vibrant print that won''t fade. Microwave and dishwasher safe.', TRUE),
            ('Socks', 11.99, 'Apparel', 'Socks.png', 'Comfortable crew socks with reinforced heel and toe for durability. Pack of 3 pairs.', FALSE),
            ('Limited Edition Hoodie', 29.99, 'Apparel', 'Hoodie.png', 'Special edition hoodie with exclusive design. Limited stock available!', TRUE)
          `, (err) => err ? reject(err) : resolve());
      });
      console.log('Database seeded successfully');
    } else {
      console.log('Database already contains data - skipping seeding');
    }
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// [Rest of your middleware and routes remain unchanged...]

// ======================
// Server Startup
// ======================
async function startServer() {
  try {
    console.log('Starting server initialization...');
    await initDB();
    
    // Simple port selection with fallback
    const startServer = () => {
      const portsToTry = [50000, 50001, 50002, 50003, 50004];
      
      const tryPort = (portIndex) => {
        if (portIndex >= portsToTry.length) {
          console.error('Could not find available port');
          process.exit(1);
        }

        const PORT = portsToTry[portIndex];
        const server = app.listen(PORT, '127.0.0.1', () => {
          console.log(`Server running on http://localhost:${PORT}`);
          console.log('Press Ctrl+C to stop the server');
        }).on('error', (err) => {
          if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
            console.log(`Port ${PORT} unavailable, trying next port...`);
            tryPort(portIndex + 1);
          } else {
            console.error('Server error:', err);
            process.exit(1);
          }
        });
        return server;
      };

      return tryPort(0);
    };

    // Start the server
    const server = startServer();

    // Keep database connection alive
    const keepAliveInterval = setInterval(() => {
      db.get('SELECT 1', (err) => {
        if (err) console.error('Database ping failed:', err.message);
      });
    }, 30000);

    // Clean shutdown handling
    process.on('SIGINT', () => {
      clearInterval(keepAliveInterval);
      server.close(() => {
        db.close();
        console.log('Server stopped');
        process.exit(0);
      });
    });

    process.stdin.resume();
    
  } catch (error) {
    console.error('Server startup failed:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
