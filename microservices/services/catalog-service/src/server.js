const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'catalog-service',
    port: PORT,
    database: 'isolated (catalog_db.json)',
    timestamp: new Date().toISOString()
  });
});

app.get('/products', (req, res) => {
  const products = db.findAll(req.query);
  res.json({ success: true, count: products.length, data: products });
});

app.get('/products/:id', (req, res) => {
  const product = db.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true, data: product });
});

app.post('/products', (req, res) => {
  const { name, category, price, description } = req.body;
  if (!name || price === undefined) {
    return res.status(400).json({ success: false, error: 'Name and price required' });
  }
  const created = db.insert({
    id: req.body.id || `prod-${uuidv4().substring(0, 8)}`,
    name,
    category: category || 'General',
    price: Number(price),
    description: description || ''
  });
  res.status(201).json({ success: true, data: created });
});

app.put('/products/:id', (req, res) => {
  const updated = db.update(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true, data: updated });
});

app.delete('/products/:id', (req, res) => {
  const success = db.delete(req.params.id);
  if (!success) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }
  res.json({ success: true, message: 'Product deleted' });
});

const server = app.listen(PORT, () => {
  console.log(`📦 [Catalog Service] Running on http://localhost:${PORT}`);
});

module.exports = { app, server };
