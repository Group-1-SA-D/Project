const express = require('express');
const path = require('path');
const app = express();

// Set up static files and views
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Basic routes
app.get('/', (req, res) => {
  res.render('products', { title: 'Our Products' });
});

app.get('/cart', (req, res) => {
  res.render('cart', { title: 'Your Cart' });
});

// Start server
const PORT = process.env.PORT || 53400;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});