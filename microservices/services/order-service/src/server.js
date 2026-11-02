const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const TaxEngine = require('./tax.engine');

const app = express();
const PORT = process.env.PORT || 4003;

const CATALOG_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:4001';
const INVENTORY_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:4002';

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'order-service',
    port: PORT,
    database: 'isolated (order_db.json)',
    downstream: {
      catalogService: CATALOG_URL,
      inventoryService: INVENTORY_URL
    },
    timestamp: new Date().toISOString()
  });
});

// Tax Endpoints
app.get('/tax/quote', (req, res) => {
  const { subtotal, locationCode } = req.query;
  res.json({ success: true, data: TaxEngine.calculateTax(subtotal, locationCode) });
});

app.get('/tax/jurisdictions', (req, res) => {
  res.json({ success: true, data: TaxEngine.getSupportedJurisdictions() });
});

// Cart Endpoints
app.get('/cart/:cartId', async (req, res) => {
  try {
    const { cartId } = req.params;
    const { location } = req.query;
    const cart = db.getCart(cartId);

    let subtotal = 0;
    const enrichedItems = [];

    for (const item of cart.items) {
      // Remote HTTP call to Catalog Service
      const catRes = await axios.get(`${CATALOG_URL}/products/${item.productId}`, { timeout: 3000 });
      const product = catRes.data.data;
      const lineTotal = Number((product.price * item.quantity).toFixed(2));
      subtotal += lineTotal;
      enrichedItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        lineTotal
      });
    }

    const loc = location || cart.locationCode || 'DEFAULT';
    const tax = TaxEngine.calculateTax(subtotal, loc);

    res.json({
      success: true,
      data: {
        cartId: cart.id,
        items: enrichedItems,
        itemCount: enrichedItems.reduce((acc, i) => acc + i.quantity, 0),
        subtotal: Number(subtotal.toFixed(2)),
        tax,
        totalAmount: tax.totalAmount,
        locationCode: tax.jurisdiction
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/cart/:cartId/items', async (req, res) => {
  try {
    const { cartId } = req.params;
    const { productId, quantity = 1 } = req.body;

    // 1. Remote call to Catalog Service to verify product
    const catRes = await axios.get(`${CATALOG_URL}/products/${productId}`, { timeout: 3000 });
    if (!catRes.data.success) {
      return res.status(404).json({ success: false, error: 'Product not found in Catalog' });
    }

    // 2. Remote call to Inventory Service to check stock
    const invRes = await axios.get(`${INVENTORY_URL}/inventory/${productId}`, { timeout: 3000 });
    const stockAvailable = invRes.data.data.stockAvailable;
    if (stockAvailable < quantity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient stock in Inventory Service. Available: ${stockAvailable}, Requested: ${quantity}`
      });
    }

    const cart = db.getCart(cartId);
    const existingIndex = cart.items.findIndex(i => i.productId === productId);
    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }
    db.saveCart(cart);

    res.json({ success: true, message: 'Item added to cart', cart });
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    res.status(400).json({ success: false, error: msg });
  }
});

app.delete('/cart/:cartId/items/:productId', (req, res) => {
  const { cartId, productId } = req.params;
  const cart = db.getCart(cartId);
  cart.items = cart.items.filter(i => i.productId !== productId);
  db.saveCart(cart);
  res.json({ success: true, message: 'Item removed from cart', cart });
});

/**
 * Distributed Checkout Flow (Saga Pattern with 5-Minute Reservation Lock)
 */
app.post('/cart/:cartId/checkout', async (req, res) => {
  const { cartId } = req.params;
  const { customerId = 'cust-01', locationCode = 'DEFAULT', shippingAddress = {} } = req.body || {};
  const effectiveLocation = shippingAddress.state ? `US-${shippingAddress.state.toUpperCase()}` : locationCode;

  try {
    const cart = db.getCart(cartId);
    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot checkout with empty cart' });
    }

    // 1. Fetch product prices over HTTP
    let subtotal = 0;
    const orderItems = [];
    for (const item of cart.items) {
      const catRes = await axios.get(`${CATALOG_URL}/products/${item.productId}`, { timeout: 3000 });
      const p = catRes.data.data;
      const lineTotal = Number((p.price * item.quantity).toFixed(2));
      subtotal += lineTotal;
      orderItems.push({
        productId: p.id,
        name: p.name,
        price: p.price,
        quantity: item.quantity,
        lineTotal
      });
    }

    // 2. Sprint 3 Injection: Compute Dynamic Tax
    const tax = TaxEngine.calculateTax(subtotal, effectiveLocation);

    // 3. Create local PENDING Order
    const orderId = `ord-${uuidv4().substring(0, 8)}`;
    const pendingOrder = {
      id: orderId,
      customerId,
      items: orderItems,
      subtotal: Number(subtotal.toFixed(2)),
      taxDetails: tax,
      totalAmount: tax.totalAmount,
      status: 'PENDING',
      shippingAddress: {
        ...shippingAddress,
        locationCode: tax.jurisdiction
      },
      createdAt: new Date().toISOString()
    };
    db.createOrder(pendingOrder);

    // 4. Sprint 3 Injection: Distributed HTTP call to lock stock for 5 minutes (300s)
    let reservationResponse;
    try {
      reservationResponse = await axios.post(`${INVENTORY_URL}/inventory/reserve`, {
        orderId,
        items: cart.items,
        ttlSeconds: 300
      }, { timeout: 4000 });
    } catch (networkErr) {
      // Compensating action: Fail order if stock lock fails
      db.updateOrder(orderId, { status: 'FAILED_STOCK_LOCK_REJECTED' });
      const errorDetail = networkErr.response?.data?.error || networkErr.message;
      return res.status(400).json({
        success: false,
        error: `Distributed stock reservation lock rejected by Inventory Service: ${errorDetail}`
      });
    }

    const reservation = reservationResponse.data.data;

    // 5. Store reservation details and clear cart
    db.updateOrder(orderId, {
      reservationId: reservation.id,
      reservationExpiresAt: reservation.expiresAt
    });
    db.clearCart(cartId);

    res.status(201).json({
      success: true,
      message: 'Distributed checkout successful. 5-minute stock reservation held.',
      data: {
        orderId,
        status: 'PENDING',
        subtotal: pendingOrder.subtotal,
        tax: pendingOrder.taxDetails,
        totalAmount: pendingOrder.totalAmount,
        items: pendingOrder.items,
        reservationLock: {
          reservationId: reservation.id,
          status: 'LOCKED',
          ttlSeconds: 300,
          expiresAt: reservation.expiresAt,
          note: 'Stock reserved via Inventory Service for 5 minutes.'
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Order payment confirmation (Saga completion)
app.post('/orders/:id/pay', async (req, res) => {
  const orderId = req.params.id;
  const order = db.findOrderById(orderId);
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  if (order.status === 'PAID') return res.json({ success: true, message: 'Already paid', order });
  if (order.status !== 'PENDING') {
    return res.status(400).json({ success: false, error: `Order is in state ${order.status}` });
  }

  // 1. Verify 5-minute reservation status over HTTP with Inventory Service
  if (order.reservationId) {
    try {
      const chkRes = await axios.get(`${INVENTORY_URL}/inventory/reservations/${order.reservationId}`, { timeout: 3000 });
      const r = chkRes.data.data;
      if (r.status === 'EXPIRED' || r.isExpired) {
        db.updateOrder(orderId, { status: 'EXPIRED' });
        return res.status(400).json({
          success: false,
          error: 'Payment failed: 5-minute stock reservation has expired in Inventory Service'
        });
      }

      // 2. Confirm reservation in Inventory Service
      await axios.post(`${INVENTORY_URL}/inventory/reservations/${order.reservationId}/confirm`, {}, { timeout: 3000 });
    } catch (invErr) {
      return res.status(500).json({
        success: false,
        error: `Inventory confirmation failed: ${invErr.response?.data?.error || invErr.message}`
      });
    }
  }

  const updated = db.updateOrder(orderId, {
    status: 'PAID',
    paidAt: new Date().toISOString(),
    paymentDetails: {
      transactionId: `dist-txn-${Date.now()}`,
      method: req.body.method || 'CREDIT_CARD',
      amount: order.totalAmount
    }
  });

  res.json({ success: true, message: 'Payment confirmed and stock permanently deducted', order: updated });
});

app.post('/orders/:id/cancel', async (req, res) => {
  const orderId = req.params.id;
  const order = db.findOrderById(orderId);
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });

  if (order.reservationId) {
    try {
      await axios.post(`${INVENTORY_URL}/inventory/reservations/${order.reservationId}/release`, {
        reason: req.body.reason || 'ORDER_CANCELLED'
      }, { timeout: 3000 });
    } catch (e) {
      console.warn('[OrderService] Could not release reservation on cancel:', e.message);
    }
  }

  const updated = db.updateOrder(orderId, { status: 'CANCELLED' });
  res.json({ success: true, message: 'Order cancelled and stock released', order: updated });
});

app.get('/orders/:id', (req, res) => {
  const order = db.findOrderById(req.params.id);
  if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
  res.json({ success: true, data: order });
});

app.get('/orders', (req, res) => {
  res.json({ success: true, count: db.getAllOrders().length, data: db.getAllOrders() });
});

const server = app.listen(PORT, () => {
  console.log(`📦 [Order Service] Running on http://localhost:${PORT}`);
});

module.exports = { app, server };
