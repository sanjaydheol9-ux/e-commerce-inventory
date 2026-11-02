const assert = require('assert');
const { createApp } = require('../monolith/src/app');
const { monolithDb } = require('../monolith/src/database/db');
const inventoryService = require('../monolith/src/modules/inventory/inventory.service');
const orderService = require('../monolith/src/modules/order/order.service');
const catalogService = require('../monolith/src/modules/catalog/catalog.service');
const TaxEngine = require('../monolith/src/modules/order/tax.engine');

async function runMonolithTests() {
  console.log('\n🧪 ==========================================');
  console.log('   RUNNING MODULAR MONOLITH TEST SUITE');
  console.log('==========================================');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      failed++;
    }
  }

  // Reset database before testing
  monolithDb.clearAll();
  const { seedDatabase } = require('../monolith/src/database/seed');
  seedDatabase(monolithDb);

  // Test 1: Product Catalog CRUD
  await test('Catalog Module: Fetch all products and verify initial seed', async () => {
    const products = await catalogService.getAllProducts({});
    assert.strictEqual(products.length >= 5, true, 'Seed should contain at least 5 products');
    assert.strictEqual(products[0].id, 'prod-001');
  });

  await test('Catalog Module: Create new product and verify retrieval', async () => {
    const newProd = await catalogService.createProduct({
      id: 'prod-test-01',
      name: 'Test Gaming Chair',
      category: 'Furniture',
      price: 199.99,
      description: 'Ergonomic racing style chair'
    });
    assert.strictEqual(newProd.id, 'prod-test-01');
    const fetched = await catalogService.getProductById('prod-test-01');
    assert.strictEqual(fetched.name, 'Test Gaming Chair');
  });

  // Test 2: Inventory & Low Stock Tracking
  await test('Inventory Module: Check stock levels and low-stock alert calculation', async () => {
    const inv = await inventoryService.getInventoryByProductId('prod-004'); // Stock = 8, Threshold = 2
    assert.strictEqual(inv.stockAvailable, 8);
    assert.strictEqual(inv.isLowStock, false);

    // Update stock to 1 (below threshold of 2)
    await inventoryService.setStock('prod-004', 1, 2);
    const lowInv = await inventoryService.getInventoryByProductId('prod-004');
    assert.strictEqual(lowInv.isLowStock, true, 'Should trigger low-stock alert flag');

    // Reset back for subsequent tests
    await inventoryService.setStock('prod-004', 8, 2);
  });

  // Test 3: Sprint 3 Injection: Dynamic Tax Engine
  await test('Dynamic Tax Engine: Verify jurisdiction rate calculation (US-CA, US-NY, EU-DE, IN-KA)', async () => {
    // US-CA: 9.5%
    const ca = TaxEngine.calculateTax(100.00, 'US-CA');
    assert.strictEqual(ca.taxAmount, 9.50);
    assert.strictEqual(ca.totalAmount, 109.50);

    // US-NY: 8.875% -> 8.88 on $100
    const ny = TaxEngine.calculateTax(100.00, 'US-NY');
    assert.strictEqual(ny.taxAmount, 8.88);
    assert.strictEqual(ny.totalAmount, 108.88);

    // EU-DE: 19%
    const de = TaxEngine.calculateTax(200.00, 'EU-DE');
    assert.strictEqual(de.taxAmount, 38.00);
    assert.strictEqual(de.totalAmount, 238.00);

    // IN-KA: 18%
    const inKa = TaxEngine.calculateTax(150.00, 'IN-KA');
    assert.strictEqual(inKa.taxAmount, 27.00);
    assert.strictEqual(inKa.totalAmount, 177.00);
  });

  // Test 4: Cart Management & Dynamic Tax on Cart
  await test('Cart Management: Add items and verify location-based tax on cart total', async () => {
    const cartId = 'test-cart-mono-01';
    // Add 2x Wireless Mechanical Keyboard ($129.99 * 2 = 259.98)
    await orderService.addItemToCart(cartId, 'prod-001', 2);
    const cartWithTax = await orderService.getCart(cartId, 'US-CA');

    assert.strictEqual(cartWithTax.items.length, 1);
    assert.strictEqual(cartWithTax.subtotal, 259.98);
    assert.strictEqual(cartWithTax.tax.jurisdiction, 'US-CA');
    assert.strictEqual(cartWithTax.tax.taxAmount, 24.70); // 259.98 * 0.095 = 24.6981 -> 24.70
    assert.strictEqual(cartWithTax.totalAmount, 284.68);
  });

  // Test 5: Sprint 3 Injection: 5-Minute Stock Reservation Lock during Checkout
  let testOrderId = null;
  let testReservationId = null;

  await test('Sprint 3 Checkout: Initiates 5-Minute Stock Reservation Lock and deducts available stock', async () => {
    const cartId = 'test-cart-mono-02';
    const initialInv = await inventoryService.getInventoryByProductId('prod-002');
    const startStock = initialInv.stockAvailable; // 35

    await orderService.addItemToCart(cartId, 'prod-002', 5);
    const checkoutResult = await orderService.checkout(cartId, {
      customerId: 'cust-mono-user',
      shippingAddress: { state: 'CA' }
    });

    assert.strictEqual(checkoutResult.status, 'PENDING');
    assert.strictEqual(checkoutResult.reservationLock.status, 'LOCKED');
    assert.strictEqual(checkoutResult.reservationLock.ttlSeconds, 300);
    assert.strictEqual(typeof checkoutResult.reservationLock.expiresAt, 'string');

    testOrderId = checkoutResult.orderId;
    testReservationId = checkoutResult.reservationLock.reservationId;

    // Check inventory: available should be reduced by 5, reserved increased by 5
    const postInv = await inventoryService.getInventoryByProductId('prod-002');
    assert.strictEqual(postInv.stockAvailable, startStock - 5);
    assert.strictEqual(postInv.stockReserved, 5);
  });

  // Test 6: Verify Concurrency / Double-sell Prevention during Active Lock
  await test('Stock Lock Concurrency: Prevent overselling while stock is locked in 5-minute reservation', async () => {
    const prod = await inventoryService.getInventoryByProductId('prod-004'); // Available = 8
    const cartId = 'test-cart-mono-concurrency';
    await orderService.addItemToCart(cartId, 'prod-004', 6);
    await orderService.checkout(cartId, { customerId: 'cust-concurrent-1' });

    // Stock available is now 2 (8 - 6). Another user trying to order 3 must fail!
    const cartId2 = 'test-cart-mono-concurrency-2';
    try {
      await orderService.addItemToCart(cartId2, 'prod-004', 3);
      assert.fail('Should have rejected adding 3 units when only 2 available');
    } catch (err) {
      assert.strictEqual(err.message.includes('Insufficient stock'), true);
    }
  });

  // Test 7: Payment Confirmation within 5-Minute Window
  await test('Order Payment: Confirms reservation and permanently deducts reserved stock', async () => {
    const paymentResult = await orderService.processPayment(testOrderId, { method: 'CREDIT_CARD' });
    assert.strictEqual(paymentResult.success, true);
    assert.strictEqual(paymentResult.order.status, 'PAID');

    // Reserved stock should now be 0 (permanently committed)
    const inv = await inventoryService.getInventoryByProductId('prod-002');
    assert.strictEqual(inv.stockReserved, 0);
  });

  // Test 8: 5-Minute Reservation Expiration & Auto-Release Simulation
  await test('Sprint 3 Expiration: Stock auto-releases back to inventory when 5-minute TTL elapses', async () => {
    const cartId = 'test-cart-expiry';
    const initialInv = await inventoryService.getInventoryByProductId('prod-003');
    const startAvailable = initialInv.stockAvailable;

    await orderService.addItemToCart(cartId, 'prod-003', 4);
    // Checkout with a short 1-second TTL to test expiration mechanism
    const order = await orderService.checkout(cartId, { customerId: 'cust-expiry-test' });
    
    // Verify stock is locked
    const lockedInv = await inventoryService.getInventoryByProductId('prod-003');
    assert.strictEqual(lockedInv.stockAvailable, startAvailable - 4);
    assert.strictEqual(lockedInv.stockReserved, 4);

    // Simulate 5-minute expiration by setting reservation expiresAt in the past
    monolithDb.update('reservations', order.reservationLock.reservationId, {
      expiresAt: new Date(Date.now() - 1000).toISOString()
    });

    // Run active sweeper
    const swept = inventoryService.sweepExpiredReservations();
    assert.strictEqual(swept >= 1, true, 'Sweeper should release expired reservation');

    // Verify stock has returned to available
    const restoredInv = await inventoryService.getInventoryByProductId('prod-003');
    assert.strictEqual(restoredInv.stockAvailable, startAvailable, 'Stock must be fully restored');
    assert.strictEqual(restoredInv.stockReserved, 0, 'Reserved stock must return to 0');

    // Attempting to pay expired order should be rejected
    try {
      await orderService.processPayment(order.orderId);
      assert.fail('Payment should be rejected for expired order');
    } catch (err) {
      assert.strictEqual(err.message.includes('expired'), true);
    }
  });

  inventoryService.stopExpirySweeper();

  console.log('------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  return { passed, failed, total: passed + failed };
}

module.exports = { runMonolithTests };

if (require.main === module) {
  runMonolithTests().then(res => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
