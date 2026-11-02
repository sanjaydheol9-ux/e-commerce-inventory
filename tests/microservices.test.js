const assert = require('assert');
const axios = require('axios');
const path = require('path');

const GATEWAY_URL = 'http://127.0.0.1:4000';

async function waitForServer(url, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await axios.get(url, { timeout: 1000 });
      if (res.status === 200 || res.status === 207) return true;
    } catch (e) {
      // server not ready yet
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function runMicroservicesTests() {
  console.log('\n🧪 ==========================================');
  console.log('   RUNNING MICROSERVICES CLUSTER TEST SUITE');
  console.log('==========================================');

  let passed = 0;
  let failed = 0;
  let servers = [];

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      if (err.response?.data) {
        console.error(`     API Error Details:`, JSON.stringify(err.response.data));
      }
      failed++;
    }
  }

  // Set environment variables for localhost ports
  process.env.PORT = '4000';
  process.env.CATALOG_SERVICE_URL = 'http://127.0.0.1:4001';
  process.env.INVENTORY_SERVICE_URL = 'http://127.0.0.1:4002';
  process.env.ORDER_SERVICE_URL = 'http://127.0.0.1:4003';

  console.log('  ℹ️ Initializing in-process microservices cluster on ports 4000-4003...');

  // Start the 4 microservices on their dedicated ports
  process.env.PORT = '4001';
  const catalogModule = require('../microservices/services/catalog-service/src/server');

  process.env.PORT = '4002';
  const inventoryModule = require('../microservices/services/inventory-service/src/server');

  process.env.PORT = '4003';
  const orderModule = require('../microservices/services/order-service/src/server');

  process.env.PORT = '4000';
  const gatewayModule = require('../microservices/gateway/src/gateway');

  servers = [
    catalogModule.server,
    inventoryModule.server,
    orderModule.server,
    gatewayModule.server
  ];

  try {
    await new Promise(r => setTimeout(r, 2000)); // short pause to let services start
    console.log('  ℹ️ All services successfully bound and responding through Gateway.');

    // Test 1: Aggregated Health Check
    await test('Gateway: Aggregated cluster health returns status for all 3 microservices', async () => {
      const res = await axios.get(`${GATEWAY_URL}/health`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'HEALTHY');
      assert.strictEqual(res.data.cluster['catalog-service'].status, 'UP');
      assert.strictEqual(res.data.cluster['inventory-service'].status, 'UP');
      assert.strictEqual(res.data.cluster['order-service'].status, 'UP');
    });

    // Test 2: Product Catalog via Gateway
    await test('Gateway -> Catalog: Retrieve catalog products through reverse proxy', async () => {
      const res = await axios.get(`${GATEWAY_URL}/api/products`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.length >= 5, true);
    });

    // Test 3: Inventory via Gateway
    await test('Gateway -> Inventory: Verify stock queries through reverse proxy', async () => {
      const res = await axios.get(`${GATEWAY_URL}/api/inventory/prod-001`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(typeof res.data.data.stockAvailable, 'number');
    });

    // Test 4: Dynamic Tax Engine via Gateway
    await test('Gateway -> Order: Dynamic Tax Engine calculates correct rate via reverse proxy', async () => {
      const res = await axios.get(`${GATEWAY_URL}/api/tax/quote?subtotal=100&locationCode=US-CA`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.data.jurisdiction, 'US-CA');
      assert.strictEqual(res.data.data.taxAmount, 9.50);
      assert.strictEqual(res.data.data.totalAmount, 109.50);
    });

    // Test 5: Cart Management & Distributed Item Addition
    const cartId = `micro-cart-${Date.now()}`;
    await test('Gateway -> Order: Add item to cart verifying stock across distributed boundaries', async () => {
      const addRes = await axios.post(`${GATEWAY_URL}/api/cart/${cartId}/items`, {
        productId: 'prod-001',
        quantity: 2
      });
      assert.strictEqual(addRes.status, 200);
      assert.strictEqual(addRes.data.success, true);

      // Fetch cart with Washington tax (US-WA: 10.25%)
      const cartRes = await axios.get(`${GATEWAY_URL}/api/cart/${cartId}?location=US-WA`);
      assert.strictEqual(cartRes.status, 200);
      assert.strictEqual(cartRes.data.data.tax.jurisdiction, 'US-WA');
      assert.strictEqual(cartRes.data.data.tax.taxRate, 0.1025);
    });

    // Test 6: Sprint 3 Distributed Checkout with 5-Minute Reservation Lock
    let orderId = null;
    let reservationId = null;

    await test('Distributed Saga: Checkout initiates 5-minute stock lock in Inventory Service', async () => {
      const checkoutRes = await axios.post(`${GATEWAY_URL}/api/cart/${cartId}/checkout`, {
        customerId: 'cust-micro-01',
        locationCode: 'US-NY'
      });
      assert.strictEqual(checkoutRes.status, 201);
      assert.strictEqual(checkoutRes.data.data.reservationLock.status, 'LOCKED');
      assert.strictEqual(checkoutRes.data.data.reservationLock.ttlSeconds, 300);

      orderId = checkoutRes.data.data.orderId;
      reservationId = checkoutRes.data.data.reservationLock.reservationId;
      assert.strictEqual(typeof reservationId, 'string');
    });

    // Test 7: Verify Stock Reservation status via Inventory endpoint
    await test('Gateway -> Inventory: Verify active reservation lock details and expiry', async () => {
      const res = await axios.get(`${GATEWAY_URL}/api/inventory/reservations/${reservationId}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.data.status, 'ACTIVE');
      assert.strictEqual(res.data.data.orderId, orderId);
    });

    // Test 8: Distributed Payment Confirmation
    await test('Distributed Saga Completion: Process payment and permanently confirm reservation', async () => {
      const payRes = await axios.post(`${GATEWAY_URL}/api/orders/${orderId}/pay`, {
        method: 'DEBIT_CARD'
      });
      assert.strictEqual(payRes.status, 200);
      assert.strictEqual(payRes.data.order.status, 'PAID');

      // Verify reservation is now CONFIRMED in Inventory Service
      const res = await axios.get(`${GATEWAY_URL}/api/inventory/reservations/${reservationId}`);
      assert.strictEqual(res.data.data.status, 'CONFIRMED');
    });

    // Test 9: Sweeper Expiration Test across services
    await test('Gateway -> Inventory: Sweeper endpoint triggers cleanup for expired locks', async () => {
      const sweepRes = await axios.post(`${GATEWAY_URL}/api/inventory/sweep`);
      assert.strictEqual(sweepRes.status, 200);
      assert.strictEqual(typeof sweepRes.data.sweptCount, 'number');
    });

  } finally {
    console.log('  ℹ️ Shutting down in-process test servers...');
    for (const s of servers) {
      if (s && s.close) s.close();
    }
  }

  console.log('------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  return { passed, failed, total: passed + failed };
}

module.exports = { runMicroservicesTests };

if (require.main === module) {
  runMicroservicesTests().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
