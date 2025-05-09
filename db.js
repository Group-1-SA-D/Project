const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, 'database.db');

// Initialize database connection
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at', DB_PATH);
  }
});

// Initialize database tables
const initializeDatabase = async () => {
  try {
    // Create users table if it doesn't exist
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => err ? reject(err) : resolve());
    });

    // Create admin user if it doesn't exist
    const adminExists = await new Promise((resolve) => {
      db.get('SELECT 1 FROM users WHERE username = "admin"', (err, row) => {
        resolve(!!row);
      });
    });

    if (!adminExists) {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO users (username, password_hash) VALUES (?, ?)',
          ['admin', hashedPassword],
          (err) => err ? reject(err) : resolve()
        );
      });
      console.log('Admin user created');
    }
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

module.exports = { db, initializeDatabase };
