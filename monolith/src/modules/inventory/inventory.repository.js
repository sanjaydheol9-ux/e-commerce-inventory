const { monolithDb } = require('../../database/db');
const { v4: uuidv4 } = require('uuid');

class InventoryRepository {
  constructor(db = monolithDb) {
    this.db = db;
  }

  findAll() {
    return this.db.find('inventory');
  }

  findByProductId(productId) {
    return this.db.findOne('inventory', item => item.productId === productId);
  }

  createOrUpdate(productId, stockAvailable, lowStockThreshold = 5) {
    const existing = this.findByProductId(productId);
    if (existing) {
      return this.db.update('inventory', existing.id, {
        stockAvailable,
        lowStockThreshold
      });
    }
    return this.db.insert('inventory', {
      id: `inv-${uuidv4().substring(0, 8)}`,
      productId,
      stockAvailable,
      stockReserved: 0,
      lowStockThreshold
    });
  }

  updateStock(id, updates) {
    return this.db.update('inventory', id, updates);
  }

  // Reservation management (Sprint 3 requirement)
  createReservation(reservation) {
    return this.db.insert('reservations', {
      id: reservation.id || `res-${uuidv4().substring(0, 8)}`,
      orderId: reservation.orderId,
      items: reservation.items, // Array of { productId, quantity }
      status: 'ACTIVE', // ACTIVE, CONFIRMED, EXPIRED, RELEASED
      ttlSeconds: reservation.ttlSeconds || 300,
      expiresAt: reservation.expiresAt,
      createdAt: new Date().toISOString()
    });
  }

  findReservationById(id) {
    return this.db.findById('reservations', id);
  }

  findReservationByOrderId(orderId) {
    return this.db.findOne('reservations', r => r.orderId === orderId && r.status === 'ACTIVE');
  }

  findActiveReservations() {
    return this.db.find('reservations', r => r.status === 'ACTIVE');
  }

  updateReservation(id, updates) {
    return this.db.update('reservations', id, updates);
  }
}

module.exports = new InventoryRepository();
