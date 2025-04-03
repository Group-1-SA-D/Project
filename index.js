const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();

// Set up session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Set up static files and views
app.use(express.static(path.join(__dirname, 'public')));
app.use('/media/img', express.static(path.join(__dirname, 'media/img'))); // Add this line
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize cart in session (for demo purposes)
app.use((req, res, next) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    next();
});

// API endpoint to add to cart
app.post('/api/cart/add', (req, res) => {
    const { productId } = req.body;
    const product = products.find(p => p.id == productId);
    if (product) {
        req.session.cart.push(product);
        res.json({ success: true, count: req.session.cart.length });
    } else {
        res.json({ success: false });
    }
});

// API endpoint to get cart count
app.get('/api/cart/count', (req, res) => {
    res.json({ count: req.session.cart.length });
});

// API endpoint to remove from cart
app.post('/api/cart/remove', (req, res) => {
    const { productId } = req.body;
    const itemIndex = req.session.cart.findIndex(item => item.id == productId);
    if (itemIndex > -1) {
        req.session.cart.splice(itemIndex, 1);
        res.json({ 
            success: true, 
            count: req.session.cart.length,
            total: req.session.cart.reduce((sum, item) => sum + item.price, 0)
        });
    } else {
        res.json({ success: false });
    }
});

// Basic routes
app.get('/', (req, res) => {
  res.render('index', { title: 'Home' });
});

// Define products array
const products = [
    { id: 1, name: "Classic T-Shirt", price: 18.99, category: "Apparel", image: "tshirt.png" },
    { id: 2, name: "Hoodie", price: 34.99, category: "Apparel", image: "hoodie.png" },
    { id: 3, name: "Baseball Cap", price: 19.99, category: "Apparel", image: "cap.png" },
    { id: 4, name: "Trading Card Booster", price: 4.99, category: "Merchandise", image: "cards.png" },
    { id: 5, name: "Premium Mug", price: 14.99, category: "Merchandise", image: "mug.png" },
    { id: 6, name: "Socks", price: 11.99, category: "Apparel", image: "socks.png" }
];

// Update products route to pass the products array
app.get('/products', (req, res) => {
    res.render('products', { 
        title: 'Our Products',
        products: products  // Pass products to the view
    });
});

// Update cart route to show actual items
app.get('/cart', (req, res) => {
    res.render('cart', { 
        title: 'Your Cart',
        cartItems: req.session.cart,
        total: req.session.cart.reduce((sum, item) => sum + item.price, 0)
    });
});

app.get('/customer-service', (req, res) => {
  res.render('customer-service', { title: 'Customer Service' });
});

app.get('/special-offers', (req, res) => {
  res.render('special-offers', { title: 'Special Offers' });
});

// Start server
const PORT = process.env.PORT || 53400;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});