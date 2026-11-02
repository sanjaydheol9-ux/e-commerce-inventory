const express = require('express');
const cors = require('cors');
const { seedDatabase } = require('./database/seed');
const catalogRoutes = require('./modules/catalog/catalog.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const orderRoutes = require('./modules/order/order.routes');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

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

  // Global 404 handler
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

module.exports = { createApp };
