const express = require('express');
const path = require('path');
const cors = require('cors');
const { seedDatabase } = require('./database/seed');
const catalogRoutes = require('./modules/catalog/catalog.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const orderRoutes = require('./modules/order/order.routes');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Serve the frontend
  app.use(express.static(path.join(__dirname, 'public')));

  // Automatic database seed check
  seedDatabase();

  // Root healthcheck
  app.get('/health', (req, res) => {
    res.json({
      status: 'UP',
      architecture: 'Modular Monolith',
      sprint: 'Sprint 3 (Completed)',
      features: [
        'Modular Boundaries (Catalog, Inventory, Order)',
        'Unified Relational Persistence',
        '5-Minute Stock Reservation Lock',
        'Dynamic Tax Engine'
      ],
      timestamp: new Date().toISOString()
    });
  });

  // Mount modular route packages
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api', orderRoutes);

  // SPA fallback — serve index.html for non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') return next();
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // Global 404 handler (only for /api routes now)
  app.use((req, res) => {
    res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.url}` });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('[Monolith Error]', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  });

  return app;
}

const app = createApp();
app.createApp = createApp;

module.exports = app;
