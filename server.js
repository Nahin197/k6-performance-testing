
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// Generate 1,000 products for the initial dataset.
const products = Array.from({ length: 1000 }, (_, index) => ({
  id: index + 1,
  name: `Product ${index + 1}`,
  price: Number((10 + index * 0.5).toFixed(2)),
  category: ['Electronics', 'Clothing', 'Books'][index % 3],
}));

const orders = [];
let nextOrderId = 1;

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Retrieve products with pagination
app.get('/api/products', (req, res) => {
  const page = Number.parseInt(req.query.page ?? '1', 10);
  const limit = Number.parseInt(req.query.limit ?? '20', 10);

  if (
    !Number.isInteger(page) ||
    !Number.isInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 1000
  ) {
    return res.status(400).json({
      error: 'page must be >= 1 and limit must be between 1 and 1000',
    });
  }

  const start = (page - 1) * limit;
  const items = products.slice(start, start + limit);

  res.status(200).json({
    page,
    limit,
    total: products.length,
    count: items.length,
    data: items,
  });
});

// Retrieve a single product
app.get('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const product = products.find((item) => item.id === id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  res.status(200).json(product);
});

// Create an order
app.post('/api/orders', (req, res) => {
  const { customerId, items } = req.body ?? {};

  if (
    !Number.isInteger(customerId) ||
    customerId < 1 ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return res.status(400).json({
      error: 'A valid customerId and non-empty items array are required',
    });
  }

  for (const item of items) {
    if (
      !Number.isInteger(item.productId) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      !products.some((product) => product.id === item.productId)
    ) {
      return res.status(400).json({
        error: 'Each item needs a valid productId and positive quantity',
      });
    }
  }

  const order = {
    id: nextOrderId++,
    customerId,
    items,
    createdAt: new Date().toISOString(),
  };

  orders.push(order);
  res.status(201).json(order);
});

// Start the API
app.listen(PORT, '127.0.0.1', () => {
  console.log(`API running at http://127.0.0.1:${PORT}`);
});
