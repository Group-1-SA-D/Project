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
  saveUninitialized: true
}));

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

// Cart routes
app.get('/cart', (req, res) => {
  res.render('cart');
});

// Admin routes
app.get('/admin', (req, res) => {
  res.redirect('/admin/login');
});

app.get('/admin/login', (req, res) => {
  res.render('admin-login');
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
