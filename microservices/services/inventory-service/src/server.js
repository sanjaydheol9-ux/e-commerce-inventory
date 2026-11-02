const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

// Background sweeper for expired 5-minute stock reservations
function sweepExpiredReservations() {
  const active = db.getActiveReservations();
  const now = new Date();
  let swept = 0;

  for (const res of active) {
    if (new Date(res.expiresAt) <= now) {
      // Restore reserved stock to available
      for (const item of res.items) {
        const inv = db.findByProductId(item.productId);
        if (inv) {
          inv.stockAvailable += item.quantity;
          inv.stockReserved = Math.max(0, (inv.stockReserved || 0) - item.quantity);
        }
      }
      db.updateReservation(res.id, {
        status: 'EXPIRED',
        releasedAt: new Date().toISOString(),
        releaseReason: 'AUTO_SWEEPER_5_MIN_TTL_ELAPSED'
      });
      db.save();
      swept++;
    }
  }
  return swept;
}

const sweeperInterval = setInterval(() => {
  const count = sweepExpiredReservations();
  if (count > 0) {
    console.log(`[Inventory Sweeper] Auto-released ${count} expired reservation(s)`);
  }
}, 15000);
if (sweeperInterval.unref) sweeperInterval.unref();

app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    service: 'inventory-service',
    port: PORT,
    database: 'isolated (inventory_db.json)',
    activeReservations: db.getActiveReservations().length,
    timestamp: new Date().toISOString()
  });
});

app.get('/inventory', (req, res) => {
  res.json({ success: true, data: db.getAll() });
});

app.get('/inventory/:productId', (req, res) => {
  const inv = db.findByProductId(req.params.productId);
  if (!inv) {
    return res.status(404).json({ success: false, error: 'Product inventory not found' });
  }
  res.json({ success: true, data: { ...inv, isLowStock: inv.stockAvailable <= inv.lowStockThreshold } });
});

app.put('/inventory/:productId', (req, res) => {
  const { stockAvailable, lowStockThreshold } = req.body;
  const updated = db.updateStock(req.params.productId, stockAvailable, lowStockThreshold);
  res.json({ success: true, data: updated });
});

/**
 * Sprint 3 Scope Injection: 5-Minute Stock Reservation Lock
 */
app.post('/inventory/reserve', (req, res) => {
  const { orderId, items, ttlSeconds = 300 } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Items array is required' });
  }

  // 1. Verify availability
  for (const item of items) {
    const inv = db.findByProductId(item.productId);
    if (!inv) {
      return res.status(404).json({ success: false, error: `Product ${item.productId} not found in inventory` });
    }
    if (inv.stockAvailable < item.quantity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient stock for product ${item.productId}. Available: ${inv.stockAvailable}, Requested: ${item.quantity}`
      });
    }
  }

  // 2. Lock stock
  for (const item of items) {
    const inv = db.findByProductId(item.productId);
    inv.stockAvailable -= item.quantity;
    inv.stockReserved = (inv.stockReserved || 0) + item.quantity;
  }

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const reservation = db.saveReservation({
    id: `res-${uuidv4().substring(0, 8)}`,
    orderId,
    items,
    status: 'ACTIVE',
    ttlSeconds,
    expiresAt,
    createdAt: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    message: 'Stock locked for 5 minutes',
    data: reservation
  });
});

app.post('/inventory/reservations/:id/confirm', (req, res) => {
  const reservation = db.findReservationById(req.params.id);
  if (!reservation) {
    return res.status(404).json({ success: false, error: 'Reservation not found' });
  }
  if (reservation.status !== 'ACTIVE') {
    return res.status(400).json({ success: false, error: `Cannot confirm reservation in state ${reservation.status}` });
  }

  for (const item of reservation.items) {
    const inv = db.findByProductId(item.productId);
    if (inv) {
      inv.stockReserved = Math.max(0, (inv.stockReserved || 0) - item.quantity);
    }
  }

  const updated = db.updateReservation(reservation.id, {
    status: 'CONFIRMED',
    confirmedAt: new Date().toISOString()
  });

  res.json({ success: true, message: 'Reservation confirmed', data: updated });
});

app.post('/inventory/reservations/:id/release', (req, res) => {
  const reservation = db.findReservationById(req.params.id);
  if (!reservation) {
    return res.status(404).json({ success: false, error: 'Reservation not found' });
  }
  if (reservation.status !== 'ACTIVE') {
    return res.json({ success: true, message: 'Reservation already resolved', data: reservation });
  }

  for (const item of reservation.items) {
    const inv = db.findByProductId(item.productId);
    if (inv) {
      inv.stockAvailable += item.quantity;
      inv.stockReserved = Math.max(0, (inv.stockReserved || 0) - item.quantity);
    }
  }

  const updated = db.updateReservation(reservation.id, {
    status: 'RELEASED',
    releasedAt: new Date().toISOString(),
    releaseReason: req.body.reason || 'MANUAL_RELEASE'
  });

  res.json({ success: true, message: 'Stock reservation released', data: updated });
});

app.get('/inventory/reservations/:id', (req, res) => {
  const reservation = db.findReservationById(req.params.id);
  if (!reservation) {
    return res.status(404).json({ success: false, error: 'Reservation not found' });
  }
  const isExpired = reservation.status === 'ACTIVE' && new Date(reservation.expiresAt) < new Date();
  res.json({ success: true, data: { ...reservation, isExpired } });
});

app.post('/inventory/sweep', (req, res) => {
  const swept = sweepExpiredReservations();
  res.json({ success: true, sweptCount: swept });
});

const server = app.listen(PORT, () => {
  console.log(`📦 [Inventory Service] Running on http://localhost:${PORT}`);
});

module.exports = { app, server, sweepExpiredReservations };
