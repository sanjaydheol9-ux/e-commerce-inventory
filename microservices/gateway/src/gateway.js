const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 4000;

const CATALOG_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:4001';
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:4002';
const ORDER_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:4003';

app.use(cors());
app.use(express.json());

// Forwarding helper
async function forwardRequest(targetBaseUrl, req, res, pathPrefix = '') {
  // Strip query string from path so params: req.query handles query cleanly
  const rawPath = req.url.split('?')[0];
  const targetPath = `${pathPrefix}${rawPath === '/' ? '' : rawPath}`;
  const url = `${targetBaseUrl}${targetPath}`;
  
  try {
    const response = await axios({
      method: req.method,
      url,
      data: req.body,
      params: req.query,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-By': 'SEPM-API-Gateway'
      },
      timeout: 5000,
      validateStatus: () => true // Pass through status codes
    });

    res.status(response.status).json(response.data);
  } catch (err) {
    console.error(`[Gateway Error] Proxy to ${url} failed:`, err.message);
    res.status(502).json({
      success: false,
      error: `Bad Gateway: Target service at ${targetBaseUrl} unreachable`,
      details: err.message
    });
  }
}

// Aggregated Cluster Health Check
app.get('/health', async (req, res) => {
  const services = [
    { name: 'catalog-service', url: `${CATALOG_URL}/health` },
    { name: 'inventory-service', url: `${INVENTORY_URL}/health` },
    { name: 'order-service', url: `${ORDER_URL}/health` }
  ];

  const results = {};
  let allHealthy = true;

  await Promise.all(
    services.map(async s => {
      try {
        const resp = await axios.get(s.url, { timeout: 1500 });
        results[s.name] = { status: 'UP', data: resp.data };
      } catch (e) {
        results[s.name] = { status: 'DOWN', error: e.message };
        allHealthy = false;
      }
    })
  );

  res.status(200).json({
    status: allHealthy ? 'HEALTHY' : 'DEGRADED',
    architecture: 'Microservices with API Gateway',
    gatewayPort: PORT,
    cluster: results,
    timestamp: new Date().toISOString()
  });
});

// Route: Catalog Service
app.use('/api/catalog', (req, res) => {
  forwardRequest(CATALOG_URL, req, res, '/products');
});
app.use('/api/products', (req, res) => {
  forwardRequest(CATALOG_URL, req, res, '/products');
});

// Route: Inventory Service
app.use('/api/inventory', (req, res) => {
  forwardRequest(INVENTORY_URL, req, res, '/inventory');
});

// Route: Order Service (Cart, Orders, Tax)
app.use('/api/cart', (req, res) => {
  forwardRequest(ORDER_URL, req, res, '/cart');
});
app.use('/api/orders', (req, res) => {
  forwardRequest(ORDER_URL, req, res, '/orders');
});
app.use('/api/tax', (req, res) => {
  forwardRequest(ORDER_URL, req, res, '/tax');
});

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🌐 [SEPM] API Gateway Running on http://localhost:${PORT}`);
  console.log(`🔀 Downstream Catalog:   ${CATALOG_URL}`);
  console.log(`🔀 Downstream Inventory: ${INVENTORY_URL}`);
  console.log(`🔀 Downstream Order:     ${ORDER_URL}`);
  console.log(`====================================================`);
});

module.exports = { app, server };
